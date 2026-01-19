import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Repos } from '../storage';
import { AnalyticsService, AnalysisSource, GroupByOption, Metric, AggregationResult } from '../services/analyticsService';
import { formatC9L, formatLiters, getMonthLabel } from '../utils';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { 
    TrendingUp, TrendingDown, BarChart2, AlertCircle, Search, 
    Filter, AlertTriangle, ArrowRight, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Analysis: React.FC = () => {
  const navigate = useNavigate();
  const scenarios = Repos.scenarios.getAll();

  // --- GLOBAL STATE ---
  const [activeTab, setActiveTab] = useState<'TRENDS' | 'YOY' | 'OUTLIERS'>('TRENDS');
  const [source, setSource] = useState<AnalysisSource>('HISTORY');
  const [scenarioId, setScenarioId] = useState<string>('');
  const [metric, setMetric] = useState<Metric>('C9L');
  const [groupBy, setGroupBy] = useState<GroupByOption>('BRAND');
  
  // --- SUB-STATE ---
  // Entity Selector
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [filterText, setFilterText] = useState('');

  // YoY State
  const [fyA, setFyA] = useState<number>(0);
  const [fyB, setFyB] = useState<number>(0);
  const [showMonthly, setShowMonthly] = useState(false);

  // Outliers State
  const [outlierThreshold, setOutlierThreshold] = useState(20); // %
  const [outlierMode, setOutlierMode] = useState<'ALL' | 'GROWTH' | 'DROP'>('ALL');

  // --- DATA LOADING ---

  // 1. Available FYs
  const availableFYs = useMemo(() => {
      return AnalyticsService.getAvailableFYs(source, scenarioId);
  }, [source, scenarioId]);

  // Set default FYs when loaded
  useMemo(() => {
      if (availableFYs.length >= 2) {
          if (fyA === 0) setFyA(availableFYs[availableFYs.length - 2]);
          if (fyB === 0) setFyB(availableFYs[availableFYs.length - 1]);
      } else if (availableFYs.length === 1) {
          if (fyA === 0) setFyA(availableFYs[0]);
          if (fyB === 0) setFyB(availableFYs[0]);
      }
  }, [availableFYs]);

  // 2. Main Aggregation (Memoized)
  const aggregation: AggregationResult | null = useMemo(() => {
      if (source === 'FORECAST' && !scenarioId) return null;
      return AnalyticsService.getAggregatedData(source, groupBy, metric, scenarioId);
  }, [source, groupBy, metric, scenarioId]);

  // 3. Filtered Entities
  const filteredEntities = useMemo(() => {
      if (!aggregation) return [];
      return aggregation.entities.filter(e => 
          e.toLowerCase().includes(filterText.toLowerCase())
      );
  }, [aggregation, filterText]);

  // Set default entity
  useMemo(() => {
      if (filteredEntities.length > 0 && !selectedEntity) {
          setSelectedEntity(filteredEntities[0]);
      }
  }, [filteredEntities]);


  // --- HELPERS ---
  const formatVal = (v: number) => metric === 'C9L' ? formatC9L(v) : formatLiters(v);
  
  const renderDelta = (val: number, isPct: boolean = false) => {
      if (val === Infinity || isNaN(val)) return <span className="text-slate-400">—</span>;
      if (Math.abs(val) < 0.01) return <span className="text-slate-400">0</span>;
      
      const isPos = val > 0;
      const color = isPos ? 'text-emerald-600' : 'text-red-600';
      const Icon = isPos ? TrendingUp : TrendingDown;
      
      return (
          <div className={`flex items-center font-medium justify-end ${color}`}>
              <Icon size={14} className="mr-1" />
              {isPct ? `${val.toFixed(1)}%` : formatVal(val)}
          </div>
      );
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const selectClass = inputClass;

  // --- RENDER CONTENT ---

  // 1. TRENDS CONTENT
  const renderTrends = () => {
      if (!aggregation || !selectedEntity) return <EmptyState />;
      
      const entityMap = aggregation.data.get(selectedEntity);
      if (!entityMap) return <EmptyState />;

      const chartData = availableFYs.map(fy => {
          const point = entityMap.get(fy);
          return {
              name: `FY${fy}`,
              value: point ? point.value : 0
          };
      });

      return (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
                 <h3 className="text-lg font-bold text-slate-800 mb-4">Tendencia Multi-Anual: {selectedEntity}</h3>
                 <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
                        <YAxis axisLine={false} tickLine={false} />
                        <ReTooltip 
                             formatter={(value: number) => [formatVal(value), metric]}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                     </LineChart>
                 </ResponsiveContainer>
             </div>

             <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 text-slate-500 font-medium">
                         <tr>
                             <th className="px-4 py-3">Año Fiscal</th>
                             <th className="px-4 py-3 text-right">Volumen ({metric})</th>
                             <th className="px-4 py-3 text-right">Crecimiento (vs año ant.)</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {chartData.map((d, idx) => {
                             const prev = idx > 0 ? chartData[idx-1].value : 0;
                             const delta = d.value - prev;
                             const pct = prev > 0 ? (delta / prev) * 100 : (d.value > 0 ? 100 : 0);
                             
                             return (
                                 <tr key={d.name} className="hover:bg-slate-50">
                                     <td className="px-4 py-3 font-mono text-slate-700">{d.name}</td>
                                     <td className="px-4 py-3 text-right font-medium text-slate-900">{formatVal(d.value)}</td>
                                     <td className="px-4 py-3 text-right">
                                         {idx === 0 ? <span className="text-slate-400">—</span> : renderDelta(pct, true)}
                                     </td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
          </div>
      );
  };

  // 2. YOY CONTENT
  const renderYoY = () => {
      if (!aggregation || !selectedEntity) return <EmptyState />;
      
      const entityMap = aggregation.data.get(selectedEntity);
      const valA = entityMap?.get(fyA)?.value || 0;
      const valB = entityMap?.get(fyB)?.value || 0;
      const deltaAbs = valB - valA;
      const deltaPct = valA > 0 ? (deltaAbs / valA) * 100 : (valB > 0 ? 100 : 0);

      // Monthly breakdown
      const monthlyData = showMonthly ? AnalyticsService.getMonthlyBreakdown(selectedEntity, fyA, fyB, source, groupBy, metric, scenarioId) : [];

      return (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs font-bold text-slate-400 uppercase">Total FY{fyA}</div>
                      <div className="text-2xl font-bold text-slate-700">{formatVal(valA)}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-xs font-bold text-slate-400 uppercase">Total FY{fyB}</div>
                      <div className="text-2xl font-bold text-slate-900">{formatVal(valB)}</div>
                  </div>
                  <div className={`p-4 rounded-xl border shadow-sm ${deltaAbs >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="text-xs font-bold opacity-60 uppercase">Diferencia Abs</div>
                      <div className={`text-2xl font-bold ${deltaAbs >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {deltaAbs > 0 ? '+' : ''}{formatVal(deltaAbs)}
                      </div>
                  </div>
                  <div className={`p-4 rounded-xl border shadow-sm ${deltaAbs >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="text-xs font-bold opacity-60 uppercase">Variación %</div>
                      <div className={`text-2xl font-bold ${deltaAbs >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {deltaAbs > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                      </div>
                  </div>
              </div>

              {/* Toggle Monthly */}
              <div className="flex justify-end">
                  <button 
                    onClick={() => setShowMonthly(!showMonthly)}
                    className={`text-sm px-4 py-2 rounded-lg font-medium border transition-colors ${showMonthly ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  >
                      {showMonthly ? 'Ocultar Mensual' : 'Ver Desglose Mensual'}
                  </button>
              </div>

              {showMonthly && (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 text-slate-500 font-medium">
                               <tr>
                                   <th className="px-4 py-3">Mes</th>
                                   <th className="px-4 py-3 text-right">FY{fyA}</th>
                                   <th className="px-4 py-3 text-right">FY{fyB}</th>
                                   <th className="px-4 py-3 text-right">Var %</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {monthlyData.map(m => {
                                   const dp = m.valueA > 0 ? ((m.valueB - m.valueA) / m.valueA) * 100 : (m.valueB > 0 ? 100 : 0);
                                   return (
                                       <tr key={m.monthIndex} className="hover:bg-slate-50">
                                           <td className="px-4 py-3 font-medium text-slate-700">{getMonthLabel(m.monthIndex)}</td>
                                           <td className="px-4 py-3 text-right text-slate-500">{formatVal(m.valueA)}</td>
                                           <td className="px-4 py-3 text-right text-slate-900">{formatVal(m.valueB)}</td>
                                           <td className="px-4 py-3 text-right">{renderDelta(dp, true)}</td>
                                       </tr>
                                   );
                               })}
                           </tbody>
                       </table>
                       {/* Optional Chart */}
                       <div className="h-48 p-4 mt-4 border-t border-slate-100">
                           <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData.map(m => ({ name: getMonthLabel(m.monthIndex), FYA: m.valueA, FYB: m.valueB }))}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{fontSize: 10}} />
                                    <YAxis tick={{fontSize: 10}} />
                                    <ReTooltip />
                                    <Legend />
                                    <Bar dataKey="FYA" name={`FY${fyA}`} fill="#94a3b8" />
                                    <Bar dataKey="FYB" name={`FY${fyB}`} fill="#3b82f6" />
                                </BarChart>
                           </ResponsiveContainer>
                       </div>
                  </div>
              )}
          </div>
      );
  };

  // 3. OUTLIERS CONTENT
  const renderOutliers = () => {
      if (!aggregation) return <EmptyState />;

      // Calculate outliers for ALL entities
      const outliers = aggregation.entities.map(ent => {
          const map = aggregation.data.get(ent);
          const valA = map?.get(fyA)?.value || 0;
          const valB = map?.get(fyB)?.value || 0;
          const delta = valB - valA;
          const pct = valA > 0 ? (delta / valA) * 100 : (valB > 0 ? 100 : 0);
          
          return { entity: ent, valA, valB, delta, pct };
      }).filter(item => {
          if (item.valA === 0 && item.valB === 0) return false;
          if (Math.abs(item.pct) < outlierThreshold) return false;
          
          if (outlierMode === 'GROWTH' && item.delta <= 0) return false;
          if (outlierMode === 'DROP' && item.delta >= 0) return false;

          // Search text
          if (filterText && !item.entity.toLowerCase().includes(filterText.toLowerCase())) return false;

          return true;
      }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)); // Sort by impact %

      return (
          <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-slate-700">Umbral %</label>
                      <input 
                        type="number" 
                        className={`${inputClass} w-20 py-1.5`}
                        value={outlierThreshold}
                        onChange={e => setOutlierThreshold(Number(e.target.value))}
                      />
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setOutlierMode('ALL')} 
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${outlierMode === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                      >
                          Todos
                      </button>
                      <button 
                        onClick={() => setOutlierMode('GROWTH')} 
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${outlierMode === 'GROWTH' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500'}`}
                      >
                          Crecimiento
                      </button>
                      <button 
                        onClick={() => setOutlierMode('DROP')} 
                        className={`px-3 py-1 text-xs font-bold rounded transition-all ${outlierMode === 'DROP' ? 'bg-red-100 text-red-800' : 'text-slate-500'}`}
                      >
                          Caídas
                      </button>
                  </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">Entidad ({groupBy})</th>
                              <th className="px-4 py-3 text-right">FY{fyA}</th>
                              <th className="px-4 py-3 text-right">FY{fyB}</th>
                              <th className="px-4 py-3 text-right">Var Abs</th>
                              <th className="px-4 py-3 text-right">Var %</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {outliers.map(o => (
                              <tr key={o.entity} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-medium text-slate-900">{o.entity}</td>
                                  <td className="px-4 py-3 text-right text-slate-500">{formatVal(o.valA)}</td>
                                  <td className="px-4 py-3 text-right text-slate-500">{formatVal(o.valB)}</td>
                                  <td className="px-4 py-3 text-right">{renderDelta(o.delta)}</td>
                                  <td className="px-4 py-3 text-right">{renderDelta(o.pct, true)}</td>
                              </tr>
                          ))}
                          {outliers.length === 0 && (
                              <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-400">
                                      No se encontraron variaciones mayores al {outlierThreshold}%.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const EmptyState = () => (
      <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <BarChart2 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">No hay datos para mostrar con los filtros actuales.</p>
          {source === 'FORECAST' && !scenarioId && <p className="text-sm text-blue-600 mt-2">Seleccioná un escenario.</p>}
      </div>
  );

  return (
    <Layout>
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Analítica</h1>
            <p className="text-slate-500">Tendencias, comparaciones anuales y detección de anomalías.</p>
        </div>

        {/* TOP CONTROLS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Fuente</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setSource('HISTORY')} className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${source === 'HISTORY' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>HISTÓRICO</button>
                    <button onClick={() => setSource('FORECAST')} className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${source === 'FORECAST' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>FORECAST</button>
                </div>
            </div>

            {source === 'FORECAST' && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Escenario</label>
                    <select 
                        className={`${selectClass} w-48`}
                        value={scenarioId}
                        onChange={e => setScenarioId(e.target.value)}
                    >
                        <option value="">Seleccionar...</option>
                        {scenarios.map(s => <option key={s.id} value={s.id}>{s.name} (FY{s.fyStartYear})</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nivel (Agrupación)</label>
                <select 
                    className={`${selectClass} w-40`}
                    value={groupBy}
                    onChange={e => { setGroupBy(e.target.value as GroupByOption); setSelectedEntity(''); }}
                >
                    <option value="BRAND">Marca</option>
                    <option value="CHANNEL">Canal</option>
                    <option value="CATEGORY_MACRO">Categoría</option>
                    <option value="SKU">SKU</option>
                    <option value="CHANNEL_SKU">Canal-SKU</option>
                </select>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Métrica</label>
                <select 
                    className={`${selectClass} w-24`}
                    value={metric}
                    onChange={e => setMetric(e.target.value as Metric)}
                >
                    <option value="C9L">C9L</option>
                    <option value="LITERS">Litros</option>
                </select>
            </div>
            
            {/* If Forecast selected but missing, warn */}
            {source === 'FORECAST' && scenarioId && !aggregation && (
                 <div className="flex items-center text-orange-600 bg-orange-50 px-3 py-2 rounded text-xs font-medium border border-orange-100 ml-auto">
                    <AlertTriangle size={14} className="mr-2" />
                    Sin datos. <button onClick={() => navigate('/forecast')} className="underline ml-1">Generar forecast</button>
                 </div>
            )}
        </div>

        {/* TABS HEADER */}
        <div className="flex border-b border-slate-200 mb-6">
            <button 
                onClick={() => setActiveTab('TRENDS')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center ${activeTab === 'TRENDS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <TrendingUp size={16} className="mr-2" /> Tendencias
            </button>
            <button 
                onClick={() => setActiveTab('YOY')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center ${activeTab === 'YOY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <BarChart2 size={16} className="mr-2" /> Comparación YoY
            </button>
            <button 
                onClick={() => setActiveTab('OUTLIERS')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center ${activeTab === 'OUTLIERS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <AlertCircle size={16} className="mr-2" /> Outliers
            </button>
        </div>

        {/* SUB-FILTERS (Common for Trends/YoY, Outlier uses its own) */}
        {activeTab !== 'OUTLIERS' && aggregation && (
             <div className="flex flex-wrap gap-4 mb-6 items-center">
                 <div className="flex-1 max-w-sm relative">
                     <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder={`Buscar ${groupBy.toLowerCase()}...`}
                        className={`${inputClass} pl-9`}
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                     />
                 </div>
                 
                 <div className="flex items-center space-x-2">
                     <span className="text-sm text-slate-500 font-medium">Visualizar:</span>
                     <select 
                        className={`${selectClass} max-w-xs`}
                        value={selectedEntity}
                        onChange={e => setSelectedEntity(e.target.value)}
                     >
                         {filteredEntities.map(e => <option key={e} value={e}>{e}</option>)}
                     </select>
                 </div>

                 {activeTab === 'YOY' && (
                     <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-200 ml-auto">
                         <span className="text-xs font-bold text-slate-400 uppercase mr-1">Comparar</span>
                         <select className={`${selectClass} w-auto py-1`} value={fyA} onChange={e => setFyA(Number(e.target.value))}>
                             {availableFYs.map(fy => <option key={fy} value={fy}>FY{fy}</option>)}
                         </select>
                         <ArrowRight size={14} className="text-slate-400" />
                         <select className={`${selectClass} w-auto py-1`} value={fyB} onChange={e => setFyB(Number(e.target.value))}>
                             {availableFYs.map(fy => <option key={fy} value={fy}>FY{fy}</option>)}
                         </select>
                     </div>
                 )}
             </div>
        )}

        {/* OUTLIER FILTERS */}
        {activeTab === 'OUTLIERS' && aggregation && (
             <div className="flex flex-wrap gap-4 mb-6 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                 <div className="flex items-center space-x-2">
                     <span className="text-xs font-bold text-slate-500 uppercase mr-1">Comparar Periodos</span>
                     <select className={`${selectClass} w-auto py-1`} value={fyA} onChange={e => setFyA(Number(e.target.value))}>
                         {availableFYs.map(fy => <option key={fy} value={fy}>FY{fy}</option>)}
                     </select>
                     <ArrowRight size={14} className="text-slate-400" />
                     <select className={`${selectClass} w-auto py-1`} value={fyB} onChange={e => setFyB(Number(e.target.value))}>
                         {availableFYs.map(fy => <option key={fy} value={fy}>FY{fy}</option>)}
                     </select>
                 </div>
                 
                 <div className="h-6 w-px bg-slate-300 mx-2"></div>

                 <div className="flex-1 max-w-sm relative">
                     <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder={`Filtrar ${groupBy.toLowerCase()}...`}
                        className={`${inputClass} pl-9 py-1.5`}
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                     />
                 </div>
             </div>
        )}

        {/* CONTENT AREA */}
        <div className="min-h-[400px]">
            {activeTab === 'TRENDS' && renderTrends()}
            {activeTab === 'YOY' && renderYoY()}
            {activeTab === 'OUTLIERS' && renderOutliers()}
        </div>
    </Layout>
  );
};