import { Repos, initializeData } from '../storage';
import { generateId } from '../utils';

const KEY_PREFIX = 'pao_';
const APP_NAME = 'PAO Builder';
const CURRENT_SCHEMA_VERSION = 1;

export interface BackupMeta {
    schemaVersion: number;
    exportedAt: string;
    appName: string;
    keys: string[];
}

export interface BackupPayload {
    meta: BackupMeta;
    data: Record<string, any>;
}

export const BackupService = {
    /**
     * Export all data starting with prefix 'pao_' to a JSON object
     */
    createBackup: (): BackupPayload => {
        const data: Record<string, any> = {};
        const keys: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(KEY_PREFIX)) {
                const val = localStorage.getItem(key);
                if (val) {
                    try {
                        data[key] = JSON.parse(val);
                        keys.push(key);
                    } catch (e) {
                        console.warn(`Could not parse key ${key} for backup`, e);
                        data[key] = val; // fallback raw
                    }
                }
            }
        }

        const payload: BackupPayload = {
            meta: {
                schemaVersion: CURRENT_SCHEMA_VERSION,
                exportedAt: new Date().toISOString(),
                appName: APP_NAME,
                keys
            },
            data
        };

        // Audit the export
        Repos.audit.save({
            id: generateId(),
            action: 'BACKUP',
            actor: 'User', // In a real app, pass current user
            occurredAt: new Date().toISOString(),
            summary: `Backup generado. Claves exportadas: ${keys.length}`,
            entityType: 'System'
        });

        return payload;
    },

    /**
     * Download a JSON object as a file
     */
    downloadFile: (payload: BackupPayload) => {
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Generate filename: pao-backup-YYYYMMDD-HHMM.json
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const filename = `pao-backup-${yyyy}${mm}${dd}-${hh}${min}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Restore data from a BackupPayload
     */
    restoreBackup: async (file: File): Promise<{ success: boolean; message: string; count: number }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    const payload = JSON.parse(text) as BackupPayload;

                    // 1. Validations
                    if (!payload.meta || !payload.data) {
                        return resolve({ success: false, message: 'El archivo no tiene el formato correcto de backup.', count: 0 });
                    }
                    if (payload.meta.appName !== APP_NAME) {
                        return resolve({ success: false, message: `El backup pertenece a otra aplicación (${payload.meta.appName}).`, count: 0 });
                    }
                    // For now we accept older/newer versions as localStorage is flexible, but could block here.
                    
                    // 2. Clear current state (Safety first: only app keys)
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(KEY_PREFIX)) {
                            localStorage.removeItem(key);
                        }
                    }

                    // 3. Write new state
                    let count = 0;
                    Object.entries(payload.data).forEach(([key, val]) => {
                        if (key.startsWith(KEY_PREFIX)) {
                            localStorage.setItem(key, JSON.stringify(val));
                            count++;
                        }
                    });

                    // 4. Force Audit of the Restore (We need to manually insert into the fresh localStorage audit repo)
                    // We assume 'pao_audit' is one of the restored keys. We append this event.
                    // If not restored, we initialize it.
                    const auditKey = 'pao_audit';
                    const existingAuditStr = localStorage.getItem(auditKey);
                    const existingAudit = existingAuditStr ? JSON.parse(existingAuditStr) : [];
                    
                    existingAudit.push({
                        id: generateId(),
                        action: 'RESTORE',
                        actor: 'User',
                        occurredAt: new Date().toISOString(),
                        summary: `Sistema restaurado desde backup. Claves importadas: ${count}`,
                        entityType: 'System'
                    });
                    localStorage.setItem(auditKey, JSON.stringify(existingAudit));

                    resolve({ success: true, message: 'Restauración completada.', count });

                } catch (err) {
                    console.error(err);
                    resolve({ success: false, message: 'Error al procesar el archivo JSON.', count: 0 });
                }
            };
            reader.onerror = () => resolve({ success: false, message: 'Error de lectura del archivo.', count: 0 });
            reader.readAsText(file);
        });
    },

    /**
     * Wipe all data and re-seed
     */
    factoryReset: () => {
        // 1. Clear
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(KEY_PREFIX)) {
                localStorage.removeItem(key);
            }
        }

        // 2. Seed (initializeData checks existing users, so we cleared them first)
        initializeData();

        // 3. Audit (Wait, initializeData already logs some events, but let's log the Reset explicitely)
        // Since initializeData creates fresh repos, we can use Repos object now (after reload it would be better but we can try)
        // Actually, we must rely on reload to re-instantiate Repos correctly or manually parse.
        // Let's manually append to the fresh pao_audit created by initializeData
        const auditKey = 'pao_audit';
        const existingAudit = JSON.parse(localStorage.getItem(auditKey) || '[]');
        existingAudit.push({
            id: generateId(),
            action: 'RESET',
            actor: 'User',
            occurredAt: new Date().toISOString(),
            summary: 'Restablecimiento de fábrica ejecutado.',
            entityType: 'System'
        });
        localStorage.setItem(auditKey, JSON.stringify(existingAudit));
    }
};