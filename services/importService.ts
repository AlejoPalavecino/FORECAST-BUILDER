import Papa from 'papaparse';
import { Repos } from '../storage';
import { ImportJob, ImportRejection, HistoricMonthly, SKUProduct, ChannelSKU, Channel } from '../types';
import { generateId, parseCsvDate } from '../utils';

export interface ImportResult {
    job: ImportJob;
    duplicateOf?: ImportJob;
}

// Helper: Calculate SHA-256 Checksum
async function computeChecksum(file: File | string): Promise<string> {
    let buffer: ArrayBuffer;
    if (typeof file === 'string') {
        const enc = new TextEncoder();
        buffer = enc.encode(file).buffer;
    } else {
        buffer = await file.arrayBuffer();
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Merge strategy (Don't overwrite existing non-empty values with empty/null)
function mergePartial<T>(existing: T, incoming: Partial<T>): T {
    const merged = { ...existing };
    for (const key in incoming) {
        const val = incoming[key];
        // Only update if incoming value is not null/undefined/empty string
        if (val !== null && val !== undefined && val !== '') {
            (merged as any)[key] = val;
        }
    }
    return merged;
}

export const ImportService = {
    async processFile(file: File | string, fileName?: string): Promise<ImportResult> {
        const originalFileName = typeof file === 'string' ? (fileName || 'demo_data.csv') : file.name;
        const checksum = await computeChecksum(file);

        // 1. Check Idempotency
        const existingJob = Repos.jobs.getAll().find(j => j.checksum === checksum && j.status === 'DONE');
        if (existingJob) {
            return { job: existingJob, duplicateOf: existingJob };
        }

        // 2. Create Job
        const newJob: ImportJob = {
            id: generateId(),
            status: 'RUNNING',
            originalFileName,
            checksum,
            startedAt: new Date().toISOString(),
            stats: { totalRows: 0, importedRows: 0, rejectedRows: 0, duplicatesInFile: 0 },
            rejections: []
        };
        Repos.jobs.save(newJob);

        // 3. Parse CSV
        return new Promise((resolve) => {
            Papa.parse(typeof file === 'string' ? file : file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const rows = results.data as Record<string, string>[];
                    newJob.stats.totalRows = rows.length;
                    
                    const historyUpserts = new Map<string, HistoricMonthly>();
                    const skuUpserts = new Map<string, Partial<SKUProduct>>();
                    const channelSkuUpserts = new Set<string>();

                    // Cache existing data to minimize IO in loop
                    const channels = Repos.channels.getAll();
                    const channelCodes = new Set(channels.map(c => c.code));

                    rows.forEach((row, index) => {
                        const rowNum = index + 2; // +1 header +1 0-index
                        
                        // A. Extract mandatory fields
                        const chCode = row['channelCode']?.trim().toUpperCase();
                        const sku = row['sku']?.trim().toUpperCase();
                        const dateStr = row['date']?.trim();
                        const c9lStr = row['c9l']?.trim();

                        // B. Validate Mandatory
                        if (!chCode || !sku || !dateStr || !c9lStr) {
                            newJob.rejections.push({ rowNumber: rowNum, message: 'Faltan campos obligatorios (channelCode, sku, date, c9l)' });
                            newJob.stats.rejectedRows++;
                            return;
                        }

                        // C. Validate Types & Values
                        const c9l = parseFloat(c9lStr);
                        if (isNaN(c9l) || c9l < 0) {
                             newJob.rejections.push({ rowNumber: rowNum, message: 'Valor C9L inválido (debe ser número >= 0)', details: c9lStr });
                             newJob.stats.rejectedRows++;
                             return;
                        }

                        const dateParsed = parseCsvDate(dateStr);
                        if (!dateParsed) {
                            newJob.rejections.push({ rowNumber: rowNum, message: 'Fecha inválida. Formato requerido: 01-MM-YYYY', details: dateStr });
                            newJob.stats.rejectedRows++;
                            return;
                        }

                        // D. Ensure Channel Exists
                        if (!channelCodes.has(chCode)) {
                           Repos.channels.save({ id: generateId(), code: chCode, name: `Canal ${chCode}`, active: true });
                           channelCodes.add(chCode);
                        }

                        // E. Prepare Upserts
                        const channelSkuKey = `${chCode}_${sku}`;
                        
                        // E1. SKU Product Attributes
                        if (!skuUpserts.has(sku)) {
                             skuUpserts.set(sku, {
                                 sku,
                                 brand: row['brand'] || '', // Empty str will be ignored by mergePartial
                                 categoryMacro: row['categoryMacro'] || '',
                                 category: row['category'] || '',
                                 description: row['description'] || sku,
                                 active: true,
                                 // Capture dynamic attributes
                                 attributes: Object.keys(row)
                                    .filter(k => k.startsWith('attr_'))
                                    .reduce((acc, k) => ({ ...acc, [k]: row[k] }), {})
                             });
                        }

                        // E2. Channel SKU
                        channelSkuUpserts.add(JSON.stringify({ channelCode: chCode, sku, channelSkuKey }));

                        // E3. History
                        const historyKey = `${channelSkuKey}|${dateParsed.fyStartYear}|${dateParsed.monthIndex}`;
                        
                        if (historyUpserts.has(historyKey)) {
                            newJob.stats.duplicatesInFile++;
                        }

                        // Last row wins for history
                        historyUpserts.set(historyKey, {
                            id: generateId(), 
                            channelSkuKey,
                            fyStartYear: dateParsed.fyStartYear,
                            monthIndex: dateParsed.monthIndex,
                            c9l
                        });

                        newJob.stats.importedRows++;
                    });

                    // 4. Persistence Phase
                    
                    // P1. Upsert SKUs (Smart Merge)
                    const existingSkus = Repos.skus.getAll();
                    skuUpserts.forEach((val) => {
                        const existing = existingSkus.find(s => s.sku === val.sku);
                        if (existing) {
                             const merged = mergePartial(existing, val);
                             // Merge attributes object specially
                             merged.attributes = { ...existing.attributes, ...val.attributes };
                             Repos.skus.save(merged);
                        } else {
                             Repos.skus.save({ id: generateId(), ...val } as SKUProduct);
                        }
                    });

                    // P2. Upsert ChannelSKUs (Keep existing props like discontinueEffective)
                    const existingCSkus = Repos.channelSkus.getAll();
                    channelSkuUpserts.forEach((json) => {
                        const { channelCode, sku, channelSkuKey } = JSON.parse(json);
                        const existing = existingCSkus.find(cs => cs.channelSkuKey === channelSkuKey);
                        if (!existing) {
                            Repos.channelSkus.save({ id: generateId(), channelCode, sku, channelSkuKey, active: true });
                        } 
                        // If exists, we do NOTHING. We don't want to accidentally reactivate or clear configs.
                    });

                    // P3. Upsert History (This is the heavy part)
                    const allHistory = Repos.history.getAll();
                    const dbHistoryMap = new Map<string, HistoricMonthly>();
                    allHistory.forEach(h => {
                         dbHistoryMap.set(`${h.channelSkuKey}|${h.fyStartYear}|${h.monthIndex}`, h);
                    });

                    historyUpserts.forEach((newItem, key) => {
                        const existing = dbHistoryMap.get(key);
                        if (existing) {
                            // Update existing record
                            existing.c9l = newItem.c9l;
                            Repos.history.save(existing);
                        } else {
                            // New record
                            Repos.history.save(newItem);
                        }
                    });

                    // 5. Finalize Job
                    newJob.status = 'DONE';
                    newJob.finishedAt = new Date().toISOString();
                    Repos.jobs.save(newJob);

                    Repos.audit.save({
                        id: generateId(),
                        occurredAt: new Date().toISOString(),
                        action: 'IMPORT',
                        actor: 'System', 
                        entityType: 'ImportJob',
                        entityId: newJob.id,
                        summary: `Importación finalizada. Filas: ${newJob.stats.totalRows}.`
                    });

                    resolve({ job: newJob });
                },
                error: (err) => {
                    newJob.status = 'FAILED';
                    newJob.rejections.push({ rowNumber: 0, message: 'Error de lectura CSV', details: err.message });
                    Repos.jobs.save(newJob);
                    resolve({ job: newJob });
                }
            });
        });
    }
};