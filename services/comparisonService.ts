import { Repos } from '../storage';
import { ForecastMonthly, Scenario, SKUProduct, ChannelSKU } from '../types';

export type GroupByOption = 'CHANNEL' | 'BRAND' | 'CATEGORY_MACRO' | 'SKU';

export interface ComparisonRow {
    groupKey: string;
    groupLabel: string;
    
    // Scenario A
    volA: number;
    litersA: number;
    
    // Scenario B
    volB: number;
    litersB: number;
    
    // Deltas
    deltaVol: number;
    deltaVolPct: number | null; // null if A is 0
    deltaLiters: number;
    
    // Breakdown for drill-down
    details: ComparisonDetailRow[];
}

export interface ComparisonDetailRow {
    channelSkuKey: string;
    sku: string;
    channel: string;
    volA: number;
    volB: number;
    deltaVol: number;
}

interface Aggregate {
    vol: number;
    liters: number;
}

// Helper: Get Aggregates by ChannelSKU for a whole FY
const getFyAggregates = (scenarioId: string): Map<string, Aggregate> => {
    const forecasts = Repos.forecasts.filter(f => f.scenarioId === scenarioId);
    const map = new Map<string, Aggregate>();

    forecasts.forEach(f => {
        const current = map.get(f.channelSkuKey) || { vol: 0, liters: 0 };
        current.vol += f.forecastC9l;
        current.liters += f.forecastLiters;
        map.set(f.channelSkuKey, current);
    });

    return map;
};

export const runComparison = (scenarioA: Scenario, scenarioB: Scenario, groupBy: GroupByOption): ComparisonRow[] => {
    // 1. Get Totals per SKU for both scenarios
    const aggA = getFyAggregates(scenarioA.id);
    const aggB = getFyAggregates(scenarioB.id);

    // 2. Load Master Data Lookups
    const allChannelSkus = Repos.channelSkus.getAll();
    const allSkus = Repos.skus.getAll();
    
    const csLookup = new Map<string, ChannelSKU>();
    allChannelSkus.forEach(cs => csLookup.set(cs.channelSkuKey, cs));

    const skuLookup = new Map<string, SKUProduct>();
    allSkus.forEach(s => skuLookup.set(s.sku, s));

    // 3. Identify all unique keys involved
    const allKeys = new Set([...aggA.keys(), ...aggB.keys()]);

    // 4. Grouping Map
    const groups = new Map<string, ComparisonRow>();

    allKeys.forEach(key => {
        const valA = aggA.get(key) || { vol: 0, liters: 0 };
        const valB = aggB.get(key) || { vol: 0, liters: 0 };

        // Resolve Metadata
        const cs = csLookup.get(key);
        const sku = cs ? skuLookup.get(cs.sku) : undefined;

        let groupKey = 'Unknown';
        let groupLabel = '(Sin Datos Maestros)';

        if (cs && sku) {
            switch (groupBy) {
                case 'CHANNEL':
                    groupKey = cs.channelCode;
                    groupLabel = cs.channelCode; // Could look up channel Name
                    break;
                case 'BRAND':
                    groupKey = sku.brand || '(Sin Marca)';
                    groupLabel = groupKey;
                    break;
                case 'CATEGORY_MACRO':
                    groupKey = sku.categoryMacro || '(Sin Categoría)';
                    groupLabel = groupKey;
                    break;
                case 'SKU':
                    groupKey = sku.sku;
                    groupLabel = `${sku.sku} - ${sku.description || ''}`;
                    break;
            }
        } else {
            // Fallback if master data is missing but forecast exists (orphan data)
            groupKey = key; 
            groupLabel = key;
        }

        // Init Group Row if needed
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                groupKey,
                groupLabel,
                volA: 0, litersA: 0,
                volB: 0, litersB: 0,
                deltaVol: 0, deltaVolPct: 0, deltaLiters: 0,
                details: []
            });
        }

        const row = groups.get(groupKey)!;

        // Accumulate
        row.volA += valA.vol;
        row.litersA += valA.liters;
        row.volB += valB.vol;
        row.litersB += valB.liters;
        
        // Add detail
        row.details.push({
            channelSkuKey: key,
            sku: cs?.sku || key,
            channel: cs?.channelCode || '??',
            volA: valA.vol,
            volB: valB.vol,
            deltaVol: valB.vol - valA.vol
        });
    });

    // 5. Calculate Final Deltas and Format
    return Array.from(groups.values()).map(row => {
        const deltaVol = row.volB - row.volA;
        const deltaLiters = row.litersB - row.litersA;
        
        let deltaVolPct: number | null = 0;
        if (row.volA === 0) {
            deltaVolPct = row.volB === 0 ? 0 : null; // null means "Infinite" or "New"
        } else {
            deltaVolPct = (deltaVol / row.volA) * 100;
        }

        return {
            ...row,
            deltaVol,
            deltaLiters,
            deltaVolPct
        };
    }).sort((a, b) => Math.abs(b.deltaVol) - Math.abs(a.deltaVol)); // Default sort by absolute impact
};