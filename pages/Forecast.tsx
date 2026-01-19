import React, { useState } from 'react';
import { Repos } from '../storage';
import { runForecast } from '../services/forecastEngine';
import { ExportService } from '../services/exportService';
import { AiAnalysisService } from '../services/aiAnalysisService';
import { formatC9L, getMonthLabel } from '../utils';
import { Play, Loader2, Info, AlertTriangle, Download, ArrowRight, Settings, Sparkles, BrainCircuit } from 'lucide-react';
import { Scenario, ForecastResult } from '../types';
import { useNavigate } from 'react-router-dom';

export const Forecast: React.FC = () => {
  const navigate = useNavigate();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  
  // Forecast State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const scenarios = Repos.scenarios.getAll();

  // Load forecasts for display
  const forecasts = Repos.forecasts.filter(f => f.scenarioId === selectedScenarioId);
  
  // Basic grouping
  const groupedForecasts = React.useMemo(() => {
     if (!selectedScenarioId) return [];
     const map = new Map();
     forecasts.forEach(f => {
       if (!map.has(f.channelSkuKey)) {
         map.set(f.channelSkuKey, { key: f.channelSkuKey, total: 0, months: new Array(12).fill(0) });
       }
       const entry = map.get(f.channelSkuKey);
       entry.months[f.monthIndex - 1] = f.forecastC9l;
       entry.total += f.forecastC9l;
     });
     return Array.from(map.values());
  }, [forecasts, selectedScenarioId]);

  const handleRun = async () => {
    if (!selectedScenarioId) return;
    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    setAiAnalysis(null); // Clear previous analysis
    
    setTimeout(async () => {
      try {
        const res = await runForecast(selectedScenarioId);
        setResult(res);
        Repos.audit.save({
          id: Math.random().toString(), action: 'GENERATE', actor: 'Usuario Actual', occurredAt: new Date().toISOString(),
          entityType: 'Scenario', entityId: selectedScenarioId, summary: `Forecast generado para escenario ${selectedScenarioId}`
        });
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "Error desconocido ejecutando forecast");
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  const handleRunAi = async () => {
      if (!selectedScenarioId || !result) return;
      setAiLoading(true);
      try {
          const analysis = await AiAnalysisService.analyzeForecast({ scenarioId: selectedScenarioId });
          setAiAnalysis(analysis);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setAiLoading(false);
      }
  };

  const handleExport = () => {
      if (!selectedScenarioId) return;
      if (forecasts.length === 0) {
          alert("No hay forecast generado para exportar. Generalo primero.");
          return;
      }
      try {
          ExportService.exportForecastMonthly(selectedScenarioId);
      } catch (e: any) {
          alert(e.message);
      }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Motor de Forecast</h1>
          <p className="text-slate-500">Seleccioná un escenario para calcular la proyección basada en el histórico, ajustes y coeficientes.</p>
      </div>

      {/* CONTROLS CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 w-full">
                  <label className="block text-sm font-bold text-slate-700 mb-2">1. Escenario a procesar</label>
                  <div className="relative">
                      <select 
                          className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 pr-8 shadow-sm transition-all hover:border-slate-400"
                          value={selectedScenarioId}
                          onChange={(e) => { setSelectedScenarioId(e.target.value); setResult(null); setErrorMsg(null); setAiAnalysis(null); }}
                      >
                          <option value="">-- Seleccionar --</option>
                          {scenarios.map(s => <option key={s.id} value={s.id}>{s.name} (FY{s.fyStartYear})</option>)}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                          <Settings size={16} />
                      </div>
                  </div>
              </div>

              <div className="flex-none">
                  <button 
                      disabled={!selectedScenarioId || loading}
                      onClick={handleRun}
                      className="h-[46px] px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center justify-center shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none transition-all w-full md:w-auto"
                  >
                      {loading ? (
                          <><Loader2 className="animate-spin mr-2" size={18} /> Procesando...</>
                      ) : (
                          <><Play className="mr-2 fill-current" size={18} /> Ejecutar Motor</>
                      )}
                  </button>
              </div>
          </div>

          {/* Quick Validation Links */}
          {selectedScenarioId && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center text-sm text-slate-500 space-x-4">
                  <span>Configuraciones:</span>
                  <button onClick={() => navigate('/overrides')} className="text-blue-600 hover:underline">Revisar Overrides</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => navigate('/scenarios')} className="text-blue-600 hover:underline">Ver Coeficientes</button>
              </div>
          )}
      </div>

      {/* ERROR STATE */}
      {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-start animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="mr-3 mt-0.5 shrink-0" size={20} />
              <div>
                  <h4 className="font-bold">No se pudo generar el forecast</h4>
                  <p className="text-sm mt-1 opacity-90">{errorMsg}</p>
              </div>
          </div>
      )}

      {/* SUCCESS RESULT CARD */}
      {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 animate-in zoom-in-95 duration-300">
              
              {/* METRICS & DETAILS */}
              <div className="lg:col-span-2 bg-white border border-emerald-100 rounded-xl p-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                          <div className="flex items-center space-x-2 mb-1">
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded uppercase">Éxito</span>
                              <span className="text-slate-400 text-xs">Cálculo finalizado</span>
                          </div>
                          <h3 className="text-3xl font-bold text-slate-900">
                              {formatC9L(result.stats.totalForecastC9L)} <span className="text-lg font-normal text-slate-500">C9L</span>
                          </h3>
                      </div>
                      <div className="text-right">
                           <div className={`text-xl font-bold ${result.stats.deltaPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                               {result.stats.deltaPercent > 0 ? '+' : ''}{result.stats.deltaPercent.toFixed(1)}%
                           </div>
                           <div className="text-xs text-slate-500 uppercase font-medium">vs. Base Histórica</div>
                      </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 text-sm border border-slate-100">
                      <div className="flex items-start">
                          <Info size={16} className="mr-2 mt-0.5 text-blue-500 shrink-0" />
                          <div>
                              <span className="font-bold text-slate-700 block mb-1">Detalle del Cálculo:</span>
                              <p className="text-slate-600">{result.metadata.baseDetails}</p>
                          </div>
                      </div>
                      {result.metadata.warnings.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                               <div className="flex items-center text-orange-700 font-bold mb-1">
                                   <AlertTriangle size={14} className="mr-1"/> Advertencias ({result.metadata.warnings.length})
                               </div>
                               <ul className="list-disc list-inside text-orange-800/80 text-xs space-y-1 ml-1">
                                  {result.metadata.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                                  {result.metadata.warnings.length > 3 && <li>... y {result.metadata.warnings.length - 3} más.</li>}
                               </ul>
                          </div>
                      )}
                  </div>
              </div>

              {/* AI ANALYSIS ACTION */}
              <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                      <BrainCircuit size={24} />
                  </div>
                  <h3 className="font-bold text-slate-900">Análisis Inteligente</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                      Usá Gemini AI para detectar riesgos, tendencias y anomalías en tu proyección.
                  </p>
                  
                  <button 
                    onClick={handleRunAi}
                    disabled={aiLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center justify-center shadow-md shadow-indigo-600/20 disabled:opacity-70 transition-all group"
                  >
                      {aiLoading ? (
                          <Loader2 className="animate-spin" size={16} />
                      ) : (
                          <>
                            <Sparkles size={16} className="mr-2 group-hover:text-yellow-200 transition-colors" />
                            Analizar con IA
                          </>
                      )}
                  </button>
              </div>
          </div>
      )}

      {/* AI RESULT DISPLAY */}
      {aiAnalysis && (
          <div className="bg-white border border-indigo-200 rounded-xl p-6 mb-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <BrainCircuit size={120} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center">
                  <Sparkles className="text-indigo-500 mr-2" size={20} />
                  Feedback del Asistente Virtual
              </h3>
              <div className="prose prose-sm prose-indigo max-w-none text-slate-700">
                   {aiAnalysis.split('\n').map((line, i) => (
                       <p key={i} className={line.startsWith('-') ? 'ml-4' : ''}>
                           {line.startsWith('#') ? <strong>{line.replace(/#/g, '')}</strong> : line}
                       </p>
                   ))}
              </div>
          </div>
      )}

      {/* DATA PREVIEW */}
      {selectedScenarioId && groupedForecasts.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700">Vista Previa (Detalle por SKU)</h3>
                  <button 
                      onClick={handleExport}
                      className="text-sm font-medium flex items-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded transition-all"
                  >
                      <Download size={16} className="mr-2" />
                      Descargar Excel
                  </button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase tracking-wider">
                      <tr>
                      <th className="px-4 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Canal / SKU</th>
                      <th className="px-4 py-3 text-right text-slate-800 font-bold bg-slate-100">Total FY</th>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                          <th key={m} className="px-4 py-3 text-right min-w-[70px]">{getMonthLabel(m)}</th>
                      ))}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {groupedForecasts.slice(0, 10).map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-100">{row.key}</td>
                          <td className="px-4 py-2 text-right font-bold text-blue-600 bg-slate-50/50">{formatC9L(row.total)}</td>
                          {row.months.map((val: number, idx: number) => (
                          <td key={idx} className="px-4 py-2 text-right text-slate-500">{formatC9L(val)}</td>
                          ))}
                      </tr>
                      ))}
                  </tbody>
                  </table>
                  {groupedForecasts.length > 10 && (
                      <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100 italic">
                          Mostrando primeros 10 registros. Exportá para ver todo.
                      </div>
                  )}
              </div>
          </div>
      ) : (
          selectedScenarioId && !loading && (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="text-slate-400 ml-1" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Listo para Calcular</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mt-2">
                      El escenario está seleccionado. Presioná <strong className="text-slate-700">Ejecutar Motor</strong> para procesar los datos.
                  </p>
              </div>
          )
      )}
    </div>
  );
};