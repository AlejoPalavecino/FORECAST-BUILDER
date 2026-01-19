import { Repos } from '../storage';
import { ForecastMonthly, HistoricMonthly, Scenario, ForecastResult, ForecastCalculationMetadata, BaseSourceType } from '../types';
import { generateId } from '../utils';

/**
 * Finds the "equivalent" scenario for a previous FY.
 * Strategy:
 * 1. Check `sourceScenarioId` lineage.
 * 2. Fallback: Normalize Name (remove "FYxx") and find match for target FY.
 * 3. Fallback: Any scenario for the target FY (Prefer LOCKED).
 */
const findEquivalentScenario = (currentScenario: Scenario, targetFy: number): Scenario | undefined => {
    const allScenarios = Repos.scenarios.getAll();

    // Strategy A: Lineage (Explicit Source)
    if (currentScenario.sourceScenarioId) {
        const parent = allScenarios.find(s => s.id === currentScenario.sourceScenarioId);
        if (parent && parent.fyStartYear === targetFy) return parent;
        
        // If parent is even older (rare but possible), we might need to search siblings?
        // For MVP, we stick to direct parent or siblings with same source.
        const siblings = allScenarios.filter(s => s.sourceScenarioId === currentScenario.sourceScenarioId && s.fyStartYear === targetFy);
        if (siblings.length > 0) return siblings[0];
    }

    // Strategy B: Name Normalization (Family Name)
    // Remove "FY2025", "FY25", "- 2025", etc.
    const normalizeName = (name: string) => name.replace(/[-_]?\s*FY\s*\d{2,4}\s*/gi, '').replace(/\s*\d{4}\s*/g, '').trim().toLowerCase();
    
    const currentBaseName = normalizeName(currentScenario.name);
    
    let candidates = allScenarios.filter(s => 
        s.id !== currentScenario.id && 
        s.fyStartYear === targetFy && 
        normalizeName(s.name) === currentBaseName
    );

    // Strategy C: Fallback to ANY scenario in that FY if strict matching failed
    // This allows disparate names to still function for 75/25 rule
    if (candidates.length === 0) {
        candidates = allScenarios.filter(s => s.id !== currentScenario.id && s.fyStartYear === targetFy);
    }

    // Prefer "LOCKED" ones or just the first one
    return candidates.find(s => s.status === 'LOCKED') || candidates[0];
};

interface BaseVolumeResult {
    monthlyBase: number;
    source: BaseSourceType;
}

export const runForecast = async (scenarioId: string): Promise<ForecastResult> => {
  // 1. Get Scenario
  const scenario = Repos.scenarios.getById(scenarioId);
  if (!scenario) throw new Error('Scenario not found');

  const targetFY = scenario.fyStartYear;
  const previousFY = targetFY - 1;

  // Metadata collection
  let baseSource: BaseSourceType = 'HISTORIC_FY_MINUS_1';
  let baseDetails = '';
  const warnings: Set<string> = new Set();
  let prevScenarioUsed: Scenario | undefined;

  // 2. Load Data
  const allSkus = Repos.skus.getAll();
  const allChannelSkus = Repos.channelSkus.filter(cs => {
      if (!cs.active) return false;
      const parentSku = allSkus.find(s => s.sku === cs.sku);
      return !!parentSku && parentSku.active;
  });

  const allAssignments = Repos.assignments.getAll();
  const allCoefficients = Repos.coefficients.filter(c => c.scenarioId === scenarioId);
  const allOverrides = Repos.overrides.filter(o => o.scenarioId === scenarioId);
  const allVariables = Repos.variables.filter(v => v.active);

  // 3. Determine Calculation Strategy (Global Check for Metadata, though applied per SKU)
  // Check if we have substantial history for FY-1
  const historyFY1 = Repos.history.filter(h => h.fyStartYear === previousFY);
  const hasHistoryFY1 = historyFY1.length > 0;

  if (hasHistoryFY1) {
      baseSource = 'HISTORIC_FY_MINUS_1';
      baseDetails = `Base mensual calculada desde Histórico Real FY${previousFY}.`;
  } else {
      // MULTI-YEAR LOGIC (75/25)
      // Requirements: History FY-2 AND Forecast FY-1 (from equiv scenario)
      const fyMinus2 = targetFY - 2;
      const historyFY2 = Repos.history.filter(h => h.fyStartYear === fyMinus2);
      
      if (historyFY2.length === 0) {
          throw new Error(`No existe Histórico para FY${previousFY} ni para FY${fyMinus2}. No se puede calcular base.`);
      }

      prevScenarioUsed = findEquivalentScenario(scenario, previousFY);
      if (!prevScenarioUsed) {
          throw new Error(`Para aplicar regla 75/25 (falta histórico FY${previousFY}), se requiere un escenario equivalente del FY${previousFY} para obtener el 25% del forecast. No se encontró ninguno.`);
      }

      // Check if that scenario has forecasts generated
      const prevForecasts = Repos.forecasts.filter(f => f.scenarioId === prevScenarioUsed!.id);
      if (prevForecasts.length === 0) {
          throw new Error(`El escenario previo "${prevScenarioUsed.name}" (FY${previousFY}) no tiene forecast generado. Generalo primero para usarlo como base.`);
      }

      baseSource = 'WEIGHTED_75_25';
      baseDetails = `Base 75% Histórico FY${fyMinus2} + 25% Forecast FY${previousFY} (Escenario: ${prevScenarioUsed.name}).`;
  }

  const newForecasts: ForecastMonthly[] = [];
  let totalForecastVol = 0;
  let totalHistoryVol = 0; // Tracks the volume of the used base (FY-1 or FY-2/Fcst combo) for comparison

  // Helper to get volumes
  const getVol = (channelSkuKey: string, fy: number, source: 'HISTORY' | 'FORECAST', scId?: string) => {
      if (source === 'HISTORY') {
          const items = Repos.history.filter(h => h.channelSkuKey === channelSkuKey && h.fyStartYear === fy);
          const sum = items.reduce((a,b) => a + b.c9l, 0);
          return { sum, count: items.length };
      } else {
          const items = Repos.forecasts.filter(f => f.scenarioId === scId && f.channelSkuKey === channelSkuKey && f.fyStartYear === fy);
          const sum = items.reduce((a,b) => a + b.forecastC9l, 0);
          return { sum, count: items.length };
      }
  };

  // 4. Iterate ChannelSKUs
  for (const cs of allChannelSkus) {
      let monthlyBase = 0;
      
      // A. Calculate Base
      if (baseSource === 'HISTORIC_FY_MINUS_1') {
          const h = getVol(cs.channelSkuKey, previousFY, 'HISTORY');
          if (h.sum > 0) {
              if (h.count < 12) warnings.add(`Histórico FY${previousFY} incompleto (${h.count}/12 meses)`);
              monthlyBase = h.sum / 12;
              totalHistoryVol += h.sum;
          }
      } else {
          // 75/25 Rule
          const h2 = getVol(cs.channelSkuKey, targetFY - 2, 'HISTORY');
          const f1 = getVol(cs.channelSkuKey, previousFY, 'FORECAST', prevScenarioUsed!.id);

          // We only apply logic if we have data. If Volume is 0, base is 0.
          if (h2.sum > 0 || f1.sum > 0) {
             if (h2.count < 12 && h2.sum > 0) warnings.add(`Histórico FY${targetFY-2} incompleto (${h2.count}/12)`);
             if (f1.count < 12 && f1.sum > 0) warnings.add(`Forecast FY${previousFY} incompleto (${f1.count}/12)`); // Serious warning
             
             const weightedVol = (0.75 * h2.sum) + (0.25 * f1.sum);
             monthlyBase = weightedVol / 12;
             totalHistoryVol += weightedVol; // "Equivalent" history volume
          }
      }

      // Get Assignments for this SKU
      const assignments = allAssignments.filter(a => a.sku === cs.sku);

      // B. Monthly Loop
      for (let m = 1; m <= 12; m++) {
          // B1. Override Check
          const override = allOverrides.find(o => 
             o.channelSkuKey === cs.channelSkuKey && 
             o.monthIndex === m &&
             o.fyStartYear === targetFY
          );

          // If override exists, it REPLACES the calculated base
          const effectiveBase = override ? override.baseMonthlyC9l : monthlyBase;

          // B2. Apply Coefficients
          let totalFactor = 1.0;
          const appliedFactors: any[] = [];

          for (const variable of allVariables) {
              const assignment = assignments.find(a => a.variableCode === variable.code);
              if (assignment) {
                  const coeff = allCoefficients.find(c => 
                      c.variableCode === variable.code && 
                      c.categoryCode === assignment.categoryCode && 
                      c.monthIndex === m
                  );
                  const val = coeff ? coeff.value : 1.0;
                  totalFactor *= val;
                  appliedFactors.push({ variableCode: variable.code, categoryCode: assignment.categoryCode, value: val, isMissing: false });
              } else {
                  // Missing assignment
                  appliedFactors.push({ variableCode: variable.code, value: 1.0, isMissing: true });
              }
          }

          let finalC9L = effectiveBase * totalFactor;

          // B3. Discontinuation Logic
          let isDiscontinued = false;
          if (cs.discontinueEffective) {
            if (cs.discontinueEffective.fyStartYear === targetFY) {
                if (m > cs.discontinueEffective.monthIndex) {
                    finalC9L = 0;
                    isDiscontinued = true;
                }
            } else if (cs.discontinueEffective.fyStartYear < targetFY) {
                finalC9L = 0;
                isDiscontinued = true;
            }
          }

          newForecasts.push({
              id: generateId(),
              scenarioId,
              channelSkuKey: cs.channelSkuKey,
              fyStartYear: targetFY,
              monthIndex: m,
              baseMonthlyC9l: effectiveBase,
              forecastC9l: finalC9L,
              forecastLiters: finalC9L * 9,
              isDiscontinued,
              factorsApplied: appliedFactors
          });

          totalForecastVol += finalC9L;
      }
  }

  // 5. Save Forecasts
  const otherForecasts = Repos.forecasts.filter(f => f.scenarioId !== scenarioId);
  Repos.forecasts.saveAll([...otherForecasts, ...newForecasts]);

  // 6. Return Result with Metadata
  return {
      stats: {
          totalForecastC9L: totalForecastVol,
          totalHistoryC9L: totalHistoryVol,
          deltaPercent: totalHistoryVol > 0 ? ((totalForecastVol - totalHistoryVol) / totalHistoryVol) * 100 : 0
      },
      metadata: {
          baseSource,
          baseDetails,
          warnings: Array.from(warnings),
          scenarioUsedForFyMinus1: prevScenarioUsed?.name
      }
  };
};