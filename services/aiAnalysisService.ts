import { GoogleGenAI } from "@google/genai";
import { Repos } from "../storage";
import { ForecastMonthly, Scenario } from "../types";

// Initialize Gemini
// Note: In a production environment, ensure process.env.API_KEY is populated via your build tool (Vite/Webpack)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface AIAnalysisRequest {
  scenarioId: string;
}

interface BrandSummary {
  brand: string;
  historyVol: number;
  forecastVol: number;
  growthPct: number;
}

export const AiAnalysisService = {
  /**
   * Prepares data and sends it to Gemini for a qualitative analysis
   */
  analyzeForecast: async ({ scenarioId }: AIAnalysisRequest): Promise<string> => {
    const scenario = Repos.scenarios.getById(scenarioId);
    if (!scenario) throw new Error("Escenario no encontrado");

    // 1. Gather Data (Forecast vs History FY-1)
    const forecasts = Repos.forecasts.filter(f => f.scenarioId === scenarioId);
    const targetFY = scenario.fyStartYear;
    const historyFY = targetFY - 1;

    // Aggregate by Brand to reduce token count and provide high-level strategy insight
    const brandMap = new Map<string, { h: number; f: number }>();
    const skus = Repos.skus.getAll();
    const skuLookup = new Map(skus.map(s => [s.sku, s]));

    // Fill Forecast
    forecasts.forEach(f => {
      // Find Brand
      // We need to look up the SKU from the channelSkuKey (e.g. "TT_SKU123" -> "SKU123")
      // Simplification: We assume ChannelSKU exists, or we extract from key if consistent, 
      // but lets rely on Repo lookups for safety.
      const cs = Repos.channelSkus.getAll().find(c => c.channelSkuKey === f.channelSkuKey);
      const sku = cs ? skuLookup.get(cs.sku) : null;
      const brand = sku?.brand || "Otros";

      const current = brandMap.get(brand) || { h: 0, f: 0 };
      current.f += f.forecastC9l;
      brandMap.set(brand, current);
    });

    // Fill History
    // We assume we have history for FY-1. If not, AI will see 0 growth (Infinite).
    const historyData = Repos.history.filter(h => h.fyStartYear === historyFY);
    historyData.forEach(h => {
        const cs = Repos.channelSkus.getAll().find(c => c.channelSkuKey === h.channelSkuKey);
        const sku = cs ? skuLookup.get(cs.sku) : null;
        const brand = sku?.brand || "Otros";

        const current = brandMap.get(brand) || { h: 0, f: 0 };
        current.h += h.c9l;
        brandMap.set(brand, current);
    });

    // Format for Prompt
    const summaries: BrandSummary[] = Array.from(brandMap.entries()).map(([brand, vals]) => ({
        brand,
        historyVol: Math.round(vals.h),
        forecastVol: Math.round(vals.f),
        growthPct: vals.h > 0 ? Math.round(((vals.f - vals.h) / vals.h) * 100) : 100
    }));

    const totalStats = summaries.reduce((acc, curr) => ({ 
        h: acc.h + curr.historyVol, 
        f: acc.f + curr.forecastVol 
    }), { h: 0, f: 0 });

    const totalGrowth = totalStats.h > 0 ? ((totalStats.f - totalStats.h) / totalStats.h) * 100 : 0;

    // 2. Build Prompt
    const prompt = `
      Actúa como un Gerente de Planeamiento de Demanda Senior (S&OP Manager).
      Analiza la siguiente proyección de ventas (Forecast) para el año fiscal FY${targetFY} comparado con el cierre del año anterior FY${historyFY}.
      
      Contexto:
      - Escenario: "${scenario.name}"
      - Volumen Total Proyectado: ${totalStats.f.toLocaleString()} C9L
      - Crecimiento Total: ${totalGrowth.toFixed(1)}%

      Detalle por Marca (Principales drivers):
      ${JSON.stringify(summaries.sort((a,b) => Math.abs(b.forecastVol) - Math.abs(a.forecastVol)).slice(0, 15))}

      Instrucciones:
      1. Evalúa si el crecimiento total es conservador, moderado o agresivo.
      2. Identifica anomalías o riesgos: Marcas con crecimiento excesivo (>20%) o caídas bruscas.
      3. Sugiere 2 acciones tácticas de negocio basándote en estos números.
      4. Sé conciso, usa formato Markdown (bullet points, negritas). No uses introducciones genéricas.
    `;

    // 3. Call Gemini
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                temperature: 0.7,
                systemInstruction: "Sos un consultor experto en supply chain y ventas. Tu tono es profesional, directo y analítico. Respondé siempre en español."
            }
        });
        
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("Error calling Gemini:", error);
        throw new Error("Error de conexión con el servicio de IA. Verificá tu API Key.");
    }
  }
};
