import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Repos } from '../storage';
import { runComparison, GroupByOption, ComparisonRow } from '../services/comparisonService';
import { ExportService } from '../services/exportService';
import { formatC9L, formatLiters } from '../utils';
import { 
    ArrowRightLeft, AlertCircle, BarChart2, TrendingUp, TrendingDown, 
    Minus, Search, ChevronRight, Calculator, AlertTriangle, ArrowRight, Download 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ScenarioComparison: React.FC = () => {
  const navigate = useNavigate();
  const scenarios = Repos.scenarios.getAll();

  // State
  const [scenarioAId, setScenarioAId] = useState('');
  const [scenarioBId, setScenarioBId] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByOption>('BRAND');
  const [filterText, setFilterText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<ComparisonRow | null>(null);

  // Derived Objects
  const scenarioA = scenarios.find(s => s.id === scenarioAId);
  const scenarioB = scenarios.find(s => s.id === scenarioBId);

  // Filter B options based on A's FY (if A selected)
  const availableForB = useMemo(() => {
      if (!scenarioA) return [];
      return scenarios.filter(s => s.fyStartYear === scenarioA.fyStartYear && s.id !== scenarioA.id);
  }, [scenarioA, scenarios]);

  // Check Data Availability
  const hasForecastA = useMemo(() => scenarioA ? Repos.forecasts.filter(f => f.scenarioId === scenarioA.id).length > 0 : false, [scenarioA]);
  const hasForecastB = useMemo(() => scenarioB ? Repos.forecasts.filter(f => f.scenarioId === scenarioB.id).length > 0 : false, [scenarioB]);

  // Run Calculation
  const comparisonData = useMemo(() => {
      if (!scenarioA || !scenarioB || !hasForecastA || !hasForecastB) return null;
      return runComparison(scenarioA, scenarioB, groupBy);
  }, [scenarioA, scenarioB, groupBy, hasForecastA, hasForecastB]);

  // KPIs
  const kpis = useMemo(() => {
      if (!comparisonData) return null;
      const totalA = comparisonData.reduce((s, r) => s + r.volA, 0);
      const totalB = comparisonData.reduce((s, r) => s + r.volB, 0);
      const delta = totalB - totalA;
      const pct = totalA > 0 ? (delta / totalA) * 100 : 0;
      return { totalA, totalB, delta, pct };
  }, [comparisonData]);

  // Filtered Table Rows
  const filteredRows = useMemo(() => {
      if (!comparisonData) return [];
      return comparisonData.filter(r => 
          r.groupLabel.toLowerCase().includes(filterText.toLowerCase())
      );
  }, [comparisonData, filterText]);

  // Helpers
  const renderDelta = (val: number, isPct: boolean = false) => {
      if (Math.abs(val) < 0.01) return <span className="text-slate-400">—</span>;
      const isPos = val > 0;
      const color = isPos ? 'text-emerald-600' : 'text-red-600';
      const Icon = isPos ? TrendingUp : TrendingDown;
      
      return (
          <div className={`flex items-center font-medium ${color}`}>
              <Icon size={14} className="mr-1" />
              {isPct ? `${val.toFixed(1)}%` : formatC9L(val)}
          </div>
      );
  };

  const handleExport = () => {
      if (!comparisonData || !scenarioA || !scenarioB) return;
      try {
          ExportService.exportSummaryTable(
              filteredRows, // Export what is filtered or all if no filter
              groupBy,
              scenarioA.name,
              scenarioB.name
          );
      } catch (e: any) {
          alert(e.message);
      }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <ArrowRightLeft className="mr-3 text-blue-600" />
            Comparación de Escenarios
        </h1>
        <p className="text-slate-500">Analizá las diferencias de volumen entre dos escenarios del mismo año fiscal.</p>
      </div>

      {/* CONTROLS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Escenario A (Base)</label>
                  <select 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
                      value={scenarioAId}
                      onChange={e => { setScenarioAId(e.target.value); setScenarioBId(''); }}
                  >
                      <option value="">Seleccionar...</option>
                      {scenarios.map(s => <option key={s.id} value={s.id}>{s.name} (FY{s.fyStartYear})</option>)}
                  </select>
              </div>
              
              <div className="flex items-center justify-center pb-2 text-slate-400">
                  <ArrowRight size={24} />
              </div>

              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Escenario B (Comparado)</label>
                  <select 
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      value={scenarioBId}
                      onChange={e => setScenarioBId(e.target.value)}
                      disabled={!scenarioAId}
                  >
                      <option value="">Seleccionar...</option>
                      {availableForB.map(s => <option key={s.id} value={s.id}>{s.name} (FY{s.fyStartYear})</option>)}
                  </select>
              </div>
          </div>
          
          {/* Warnings / Empty States */}
          {scenarioA && !hasForecastA && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between text-orange-800">
                  <div className="flex items-center">
                      <AlertTriangle size={18} className="mr-2" />
                      <span>El <strong>Escenario A</strong> no tiene forecast generado.</span>
                  </div>
                  <button onClick={() => navigate('/forecast')} className="text-sm font-bold hover:underline">Ir a generar</button>
              </div>
          )}
          {scenarioB && !hasForecastB && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between text-orange-800">
                  <div className="flex items-center">
                      <AlertTriangle size={18} className="mr-2" />
                      <span>El <strong>Escenario B</strong> no tiene forecast generado.</span>
                  </div>
                  <button onClick={() => navigate('/forecast')} className="text-sm font-bold hover:underline">Ir a generar</button>
              </div>
          )}
      </div>

      {kpis && comparisonData && (
          <>
            {/* KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 mb-1">Volumen Total A</div>
                    <div className="text-2xl font-bold text-slate-900">{formatC9L(kpis.totalA)}</div>
                    <div className="text-xs text-slate-400 mt-1">{scenarioA?.name}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500 mb-1">Volumen Total B</div>
                    <div className="text-2xl font-bold text-slate-900">{formatC9L(kpis.totalB)}</div>
                    <div className="text-xs text-slate-400 mt-1">{scenarioB?.name}</div>
                </div>
                <div className={`p-5 rounded-xl border shadow-sm ${kpis.delta >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-sm text-slate-600 mb-1 font-medium">Diferencia (B - A)</div>
                    <div className={`text-2xl font-bold ${kpis.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {kpis.delta > 0 ? '+' : ''}{formatC9L(kpis.delta)}
                    </div>
                    <div className={`text-sm font-medium mt-1 ${kpis.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {kpis.delta > 0 ? '+' : ''}{kpis.pct.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* TABLE CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setGroupBy('BRAND')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'BRAND' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Marca</button>
                    <button onClick={() => setGroupBy('CHANNEL')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'CHANNEL' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Canal</button>
                    <button onClick={() => setGroupBy('CATEGORY_MACRO')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'CATEGORY_MACRO' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Categoría</button>
                    <button onClick={() => setGroupBy('SKU')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'SKU' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>SKU</button>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 w-64"
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleExport}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors text-sm"
                        title="Exportar esta tabla"
                    >
                        <Download size={16} />
                        <span className="hidden md:inline">Exportar Tabla</span>
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Grupo ({groupBy})</th>
                                <th className="px-4 py-3 text-right">A: {scenarioA?.name}</th>
                                <th className="px-4 py-3 text-right">B: {scenarioB?.name}</th>
                                <th className="px-4 py-3 text-right w-32">Δ C9L</th>
                                <th className="px-4 py-3 text-right w-24">Δ %</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRows.map((row) => (
                                <tr key={row.groupKey} 
                                    className="hover:bg-slate-50 cursor-pointer group transition-colors"
                                    onClick={() => setSelectedGroup(row)}
                                >
                                    <td className="px-4 py-3 font-medium text-slate-900">{row.groupLabel}</td>
                                    <td className="px-4 py-3 text-right text-slate-500">{formatC9L(row.volA)}</td>
                                    <td className="px-4 py-3 text-right text-slate-900 font-medium">{formatC9L(row.volB)}</td>
                                    <td className="px-4 py-3 text-right">{renderDelta(row.deltaVol)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {row.deltaVolPct === null 
                                            ? <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="Base cero">NUEVO</span> 
                                            : renderDelta(row.deltaVolPct, true)
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-300 group-hover:text-blue-500">
                                        <ChevronRight size={16} />
                                    </td>
                                </tr>
                            ))}
                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron resultados.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      )}

      {/* Empty State / Initial */}
      {!comparisonData && hasForecastA && hasForecastB && (
          <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 mt-6">
              <Calculator size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg">Seleccioná dos escenarios para ver la comparación.</p>
          </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedGroup} onClose={() => setSelectedGroup(null)} title={`Detalle: ${selectedGroup?.groupLabel}`} size="lg">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Canal</th>
                          <th className="px-4 py-2 text-right">Vol A</th>
                          <th className="px-4 py-2 text-right">Vol B</th>
                          <th className="px-4 py-2 text-right">Diferencia</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {selectedGroup?.details.sort((a,b) => Math.abs(b.deltaVol) - Math.abs(a.deltaVol)).map(d => (
                          <tr key={d.channelSkuKey}>
                              <td className="px-4 py-2 font-medium text-slate-700">{d.sku}</td>
                              <td className="px-4 py-2 text-slate-500">{d.channel}</td>
                              <td className="px-4 py-2 text-right text-slate-500">{formatC9L(d.volA)}</td>
                              <td className="px-4 py-2 text-right text-slate-900">{formatC9L(d.volB)}</td>
                              <td className="px-4 py-2 text-right">{renderDelta(d.deltaVol)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </Modal>
    </Layout>
  );
};