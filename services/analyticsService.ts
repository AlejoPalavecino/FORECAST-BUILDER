import { Repos } from '../storage';
import { ForecastMonthly, HistoricMonthly, SKUProduct, ChannelSKU, Scenario } from '../types';

export type AnalysisSource = 'HISTORY' | 'FORECAST';
export type GroupByOption = 'CHANNEL' | 'BRAND' | 'CATEGORY_MACRO' | 'SKU' | 'CHANNEL_SKU';
export type Metric = 'C9L' | 'LITERS';

export interface AnalyticDataPoint {
    fy: number;
    value: number;
    monthsCount: number; // For data quality (N/12)
}

export interface AggregationResult {
    // Map<EntityName, Map<FY, DataPoint>>
    data: Map<string, Map<number, AnalyticDataPoint>>;
    availableFYs: number[];
    entities: string[];
}

export interface MonthlyBreakdown {
    monthIndex: number;
    valueA: number;
    valueB: number;
}

// --- HELPERS ---

// Helper to resolve entity name based on grouping
const resolveEntityName = (
    channelSkuKey: string, 
    groupBy: GroupByOption,
    csLookup: Map<string, ChannelSKU>,
    skuLookup: Map<string, SKUProduct>
): string => {
    if (groupBy === 'CHANNEL_SKU') return channelSkuKey;
    
    const cs = csLookup.get(channelSkuKey);
    const sku = cs ? skuLookup.get(cs.sku) : undefined;
    
    if (!cs || !sku) return 'Desconocido';

    switch (groupBy) {
        case 'CHANNEL': return cs.channelCode;
        case 'BRAND': return sku.brand || '(Sin Marca)';
        case 'CATEGORY_MACRO': return sku.categoryMacro || '(Sin Categoría)';
        case 'SKU': return sku.sku;
        default: return channelSkuKey;
    }
};

// --- MAIN SERVICE ---

export const AnalyticsService = {
    
    /**
     * Get list of FYs present in the selected source
     */
    getAvailableFYs: (source: AnalysisSource, scenarioId?: string): number[] => {
        const fySet = new Set<number>();
        
        if (source === 'HISTORY') {
            const data = Repos.history.getAll();
            data.forEach(d => fySet.add(d.fyStartYear));
        } else if (scenarioId) {
            // Usually a scenario is for ONE target FY, but we might have forecasts for multiple if we support multi-year scenarios in future.
            // For now, we look at the ForecastMonthly records.
            const data = Repos.forecasts.filter(f => f.scenarioId === scenarioId);
            data.forEach(d => fySet.add(d.fyStartYear));
        }

        return Array.from(fySet).sort((a,b) => a - b);
    },

    /**
     * Core Aggregation Function
     */
    getAggregatedData: (
        source: AnalysisSource, 
        groupBy: GroupByOption, 
        metric: Metric,
        scenarioId?: string
    ): AggregationResult => {
        // 1. Prepare Lookups
        const allCS = Repos.channelSkus.getAll();
        const allSkus = Repos.skus.getAll();
        
        const csLookup = new Map<string, ChannelSKU>();
        allCS.forEach(cs => csLookup.set(cs.channelSkuKey, cs));
        
        const skuLookup = new Map<string, SKUProduct>();
        allSkus.forEach(s => skuLookup.set(s.sku, s));

        // 2. Fetch Raw Data
        let rawData: { channelSkuKey: string, fyStartYear: number, monthIndex: number, val: number }[] = [];

        if (source === 'HISTORY') {
            rawData = Repos.history.getAll().map(h => ({
                channelSkuKey: h.channelSkuKey,
                fyStartYear: h.fyStartYear,
                monthIndex: h.monthIndex,
                val: metric === 'C9L' ? h.c9l : h.c9l * 9
            }));
        } else if (scenarioId) {
            rawData = Repos.forecasts.filter(f => f.scenarioId === scenarioId).map(f => ({
                channelSkuKey: f.channelSkuKey,
                fyStartYear: f.fyStartYear,
                monthIndex: f.monthIndex,
                val: metric === 'C9L' ? f.forecastC9l : f.forecastLiters
            }));
        }

        // 3. Aggregate
        // Structure: Entity -> FY -> { sum, count }
        const map = new Map<string, Map<number, AnalyticDataPoint>>();
        const allFYs = new Set<number>();

        rawData.forEach(row => {
            const entity = resolveEntityName(row.channelSkuKey, groupBy, csLookup, skuLookup);
            allFYs.add(row.fyStartYear);

            if (!map.has(entity)) {
                map.set(entity, new Map());
            }
            
            const fyMap = map.get(entity)!;
            if (!fyMap.has(row.fyStartYear)) {
                fyMap.set(row.fyStartYear, { fy: row.fyStartYear, value: 0, monthsCount: 0 });
            }

            const point = fyMap.get(row.fyStartYear)!;
            point.value += row.val;
            // Note: This is a simplification for month counting. 
            // Ideally we track unique months. Since rawData is flat, we assume one record per month per key.
            // But we are aggregating multiple SKUs into one Brand. 
            // So "monthsCount" for a Brand is ambiguous (sum of all sku-months? or just 12 if fully present?).
            // Better logic: We won't track specific month count for aggregated groups here, 
            // but we can flag if *any* SKU was missing if we needed deep audit.
            // For this MVP, we will treat monthsCount as "records aggregated" which is not N/12.
            // FIX: To display N/12 correctly, we'd need to check completeness at the lowest level.
            // Let's assume completeness if value > 0 for now in aggregated view.
            point.monthsCount += 1; 
        });

        return {
            data: map,
            availableFYs: Array.from(allFYs).sort((a,b) => a - b),
            entities: Array.from(map.keys()).sort()
        };
    },

    /**
     * Get Monthly Breakdown for YoY (Entity specific)
     */
    getMonthlyBreakdown: (
        entity: string,
        fyA: number,
        fyB: number,
        source: AnalysisSource,
        groupBy: GroupByOption,
        metric: Metric,
        scenarioId?: string
    ): MonthlyBreakdown[] => {
        // Prepare Lookups
        const allCS = Repos.channelSkus.getAll();
        const allSkus = Repos.skus.getAll();
        const csLookup = new Map(allCS.map(cs => [cs.channelSkuKey, cs]));
        const skuLookup = new Map(allSkus.map(s => [s.sku, s]));

        // Fetch Raw
        let rawData: { channelSkuKey: string, fyStartYear: number, monthIndex: number, val: number }[] = [];
        if (source === 'HISTORY') {
             // Optimize: filter by FYs first if possible, but repo.getAll is simple
             rawData = Repos.history.filter(h => h.fyStartYear === fyA || h.fyStartYear === fyB).map(h => ({
                 channelSkuKey: h.channelSkuKey, fyStartYear: h.fyStartYear, monthIndex: h.monthIndex,
                 val: metric === 'C9L' ? h.c9l : h.c9l * 9
             }));
        } else if (scenarioId) {
             rawData = Repos.forecasts.filter(f => f.scenarioId === scenarioId && (f.fyStartYear === fyA || f.fyStartYear === fyB)).map(f => ({
                 channelSkuKey: f.channelSkuKey, fyStartYear: f.fyStartYear, monthIndex: f.monthIndex,
                 val: metric === 'C9L' ? f.forecastC9l : f.forecastLiters
             }));
        }

        // Aggregate by Month
        const monthlyA = new Array(12).fill(0);
        const monthlyB = new Array(12).fill(0);

        rawData.forEach(row => {
            const rowEntity = resolveEntityName(row.channelSkuKey, groupBy, csLookup, skuLookup);
            if (rowEntity === entity) {
                // Adjust index (1..12 -> 0..11)
                const idx = row.monthIndex - 1;
                if (idx >= 0 && idx < 12) {
                    if (row.fyStartYear === fyA) monthlyA[idx] += row.val;
                    if (row.fyStartYear === fyB) monthlyB[idx] += row.val;
                }
            }
        });

        return monthlyA.map((valA, i) => ({
            monthIndex: i + 1,
            valueA: valA,
            valueB: monthlyB[i]
        }));
    }
};