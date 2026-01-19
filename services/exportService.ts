import { Repos } from '../storage';
import { getMonthLabel, generateId } from '../utils';
import { toCsv, downloadTextFile } from '../utils/csv';
import { ComparisonRow } from './comparisonService';

export const ExportService = {
    
    /**
     * Exports the Monthly Forecast Details (Long Format)
     */
    exportForecastMonthly: (scenarioId: string) => {
        const scenario = Repos.scenarios.getById(scenarioId);
        if (!scenario) throw new Error("Escenario no encontrado");

        const forecasts = Repos.forecasts.filter(f => f.scenarioId === scenarioId);
        if (forecasts.length === 0) throw new Error("No hay forecast generado para este escenario.");

        // Lookups to enrich data
        const channelSkus = Repos.channelSkus.getAll();
        const skus = Repos.skus.getAll();
        
        const csLookup = new Map(channelSkus.map(cs => [cs.channelSkuKey, cs]));
        
        // Build Rows
        const rows = forecasts.map(f => {
            const cs = csLookup.get(f.channelSkuKey);
            
            // Determine Quality flag
            const missingFactors = f.factorsApplied.some(fa => fa.isMissing);

            return {
                scenarioName: scenario.name,
                scenarioId: scenario.id,
                fyStartYear: f.fyStartYear,
                channelCode: cs?.channelCode || 'UNKNOWN',
                sku: cs?.sku || 'UNKNOWN',
                channelSkuKey: f.channelSkuKey,
                monthIndex: f.monthIndex,
                monthLabel: getMonthLabel(f.monthIndex),
                forecastC9l: Number(f.forecastC9l.toFixed(2)), // Excel friendly numbers
                forecastLiters: Math.round(f.forecastLiters),
                baseMonthlyC9l: Number(f.baseMonthlyC9l.toFixed(2)),
                isDiscontinued: f.isDiscontinued ? 'SI' : 'NO',
                hasMissingFactors: missingFactors ? 'SI' : 'NO'
            };
        });

        const csvContent = toCsv(rows);
        const filename = `forecast_${scenario.name.replace(/\s+/g, '_')}_FY${scenario.fyStartYear}_mensual.csv`;
        
        downloadTextFile(filename, csvContent);

        // Audit
        Repos.audit.save({
            id: generateId(),
            action: 'EXPORT',
            actor: 'User',
            occurredAt: new Date().toISOString(),
            entityType: 'Scenario',
            entityId: scenarioId,
            summary: `Exportación CSV Mensual: ${filename}`
        });
    },

    /**
     * Exports a Summary Table (from Comparison or Analysis)
     */
    exportSummaryTable: (
        data: ComparisonRow[], 
        groupBy: string, 
        scenarioAName: string, 
        scenarioBName: string
    ) => {
        if (!data || data.length === 0) throw new Error("No hay datos para exportar.");

        const rows = data.map((row, idx) => ({
            rank: idx + 1,
            groupBy: groupBy,
            groupKey: row.groupKey,
            groupLabel: row.groupLabel,
            [`${scenarioAName}_C9L`]: Number(row.volA.toFixed(2)),
            [`${scenarioBName}_C9L`]: Number(row.volB.toFixed(2)),
            delta_C9L: Number(row.deltaVol.toFixed(2)),
            delta_Percent: row.deltaVolPct === null ? 'NEW' : Number(row.deltaVolPct.toFixed(2)),
            [`${scenarioAName}_Litros`]: Math.round(row.litersA),
            [`${scenarioBName}_Litros`]: Math.round(row.litersB),
        }));

        const csvContent = toCsv(rows);
        const filename = `comparacion_${groupBy}_${new Date().toISOString().slice(0,10)}.csv`;

        downloadTextFile(filename, csvContent);

        // Audit
        Repos.audit.save({
            id: generateId(),
            action: 'EXPORT',
            actor: 'User',
            occurredAt: new Date().toISOString(),
            entityType: 'Analysis',
            summary: `Exportación CSV Resumen (${groupBy}): ${filename}`
        });
    }
};