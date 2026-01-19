import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Repos } from '../storage';
import { OverrideBaseMonthly, Scenario, ChannelSKU } from '../types';
import { getMonthLabel, generateId, isOverrideAllowed } from '../utils';
import { Save, AlertTriangle, RotateCcw, Play, Lock, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Overrides: React.FC = () => {
  const navigate = useNavigate();
  const scenarios = Repos.scenarios.getAll();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // Load basic data
  const channelSkus = Repos.channelSkus.filter(c => c.active);
  const channels = Repos.channels.getAll();

  // Local state for edits: Map<"channelSkuKey|monthIndex", value>
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Computed data
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);
  const isLocked = selectedScenario?.status === 'LOCKED';
  
  // Existing overrides from DB
  const existingOverrides = useMemo(() => {
    if (!selectedScenarioId || !selectedScenario) return [];
    return Repos.overrides.filter(o => o.scenarioId === selectedScenarioId && o.fyStartYear === selectedScenario.fyStartYear);
  }, [selectedScenarioId, selectedScenario]);

  // Filtered SKUs
  const filteredSkus = useMemo(() => {
    return channelSkus.filter(cs => {
      const matchText = cs.channelSkuKey.toLowerCase().includes(searchText.toLowerCase());
      const matchChannel = channelFilter ? cs.channelCode === channelFilter : true;
      return matchText && matchChannel;
    });
  }, [channelSkus, searchText, channelFilter]);

  // Helper to get value
  const getValue = (cs: ChannelSKU, monthIndex: number) => {
    const key = `${cs.channelSkuKey}|${monthIndex}`;
    // 1. Look in local edits
    if (key in edits) {
      return edits[key];
    }
    // 2. Look in DB
    const dbVal = existingOverrides.find(o => o.channelSkuKey === cs.channelSkuKey && o.monthIndex === monthIndex);
    return dbVal ? dbVal.baseMonthlyC9l.toString() : '';
  };

  const handleCellChange = (cs: ChannelSKU, monthIndex: number, val: string) => {
    if (isLocked) return;
    const key = `${cs.channelSkuKey}|${monthIndex}`;
    setEdits(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSavedSuccess(false);
  };

  const handleSave = () => {
    if (!selectedScenario || isLocked) return;

    // 1. Process Edits
    Object.entries(edits).forEach(([key, rawValue]) => {
      const valStr = rawValue as string;
      const [channelSkuKey, mIdxStr] = key.split('|');
      const monthIndex = parseInt(mIdxStr, 10);
      
      const existing = existingOverrides.find(o => o.channelSkuKey === channelSkuKey && o.monthIndex === monthIndex);
      
      if (valStr === '' || valStr.trim() === '') {
        // DELETE intent
        if (existing) {
            const all = Repos.overrides.getAll();
            const filtered = all.filter(o => o.id !== existing.id);
            Repos.overrides.saveAll(filtered);

            Repos.audit.save({
                id: generateId(), action: 'DELETE', actor: 'User', occurredAt: new Date().toISOString(),
                summary: `Override eliminado para ${channelSkuKey} mes ${monthIndex}`, entityType: 'Override'
            });
        }
      } else {
        // UPSERT intent
        const numVal = parseFloat(valStr);
        if (isNaN(numVal) || numVal < 0) return; // Skip invalid

        if (existing) {
            Repos.overrides.save({ ...existing, baseMonthlyC9l: numVal, updatedAt: new Date().toISOString() });
        } else {
            Repos.overrides.save({
                id: generateId(),
                scenarioId: selectedScenarioId,
                fyStartYear: selectedScenario.fyStartYear,
                channelSkuKey,
                monthIndex,
                baseMonthlyC9l: numVal,
                updatedAt: new Date().toISOString()
            });
        }
      }
    });

    Repos.audit.save({
         id: generateId(), action: 'UPDATE', actor: 'User', occurredAt: new Date().toISOString(),
         summary: `Overrides actualizados masivamente en escenario ${selectedScenario.name}`, entityType: 'Override'
    });

    setEdits({});
    setDirty(false);
    setSavedSuccess(true);
    window.location.reload(); 
  };

  const handleDiscard = () => {
    if (confirm("¿Descartar cambios no guardados?")) {
        setEdits({});
        setDirty(false);
    }
  };

  const handleGoToForecast = () => {
    navigate('/forecast');
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const selectClass = inputClass;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Ajustes Manuales (Overrides)</h1>
            <p className="text-slate-500">Definí la base mensual manualmente. Estos valores pisan el histórico promedio.</p>
        </div>
        <div className="flex items-center space-x-2">
            <select 
                className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 min-w-[200px] shadow-sm"
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
            >
                <option value="">Seleccionar Escenario...</option>
                {scenarios.map(s => <option key={s.id} value={s.id}>{s.name} ({s.fyStartYear}) {s.status === 'LOCKED' ? '🔒' : ''}</option>)}
            </select>
            {selectedScenarioId && !isLocked && (
                <>
                <button 
                    disabled={!dirty}
                    onClick={handleDiscard}
                    className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"
                    title="Descartar cambios"
                >
                    <RotateCcw size={20} />
                </button>
                <button 
                    disabled={!dirty}
                    onClick={handleSave}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 text-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                    <Save size={16} />
                    <span>Guardar</span>
                </button>
                </>
            )}
        </div>
      </div>

      {isLocked && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg mb-6 flex items-center shadow-sm">
            <Lock size={18} className="mr-2" />
            <span className="font-medium">Este escenario está bloqueado (LOCKED). No se pueden modificar los overrides.</span>
        </div>
      )}

      {savedSuccess && (
          <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6 flex justify-between items-center border border-green-200 shadow-sm">
              <span className="font-medium">Cambios guardados correctamente.</span>
              <button onClick={handleGoToForecast} className="text-sm underline hover:text-green-900 flex items-center">
                  <Play size={14} className="mr-1"/> Ir a Recalcular Forecast
              </button>
          </div>
      )}

      {selectedScenarioId ? (
          <>
            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Buscar SKU..." 
                        className="pl-3 pr-10 py-2 border border-slate-300 rounded-lg text-sm w-64 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
                <select 
                    className="border border-slate-300 rounded-lg text-sm py-2 px-3 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={channelFilter}
                    onChange={e => setChannelFilter(e.target.value)}
                >
                    <option value="">Todos los Canales</option>
                    {channels.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                </select>
                <div className="ml-auto text-xs text-slate-400 flex items-center">
                    <Info size={14} className="mr-1" />
                    Valores vacíos = Sin override (usa base histórica).
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 sticky left-0 bg-slate-50 z-20 w-64 shadow-sm border-r border-slate-200">Channel / SKU</th>
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                    <th key={m} className="px-2 py-3 text-center min-w-[80px] border-r border-slate-100 last:border-0">{getMonthLabel(m)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSkus.map((cs) => {
                                const discontinuedText = cs.discontinueEffective ? 
                                    `Disc: ${getMonthLabel(cs.discontinueEffective.monthIndex)}/${cs.discontinueEffective.fyStartYear}` : null;
                                
                                return (
                                <tr key={cs.id} className="hover:bg-slate-50 group">
                                    <td className="px-4 py-3 sticky left-0 bg-white z-10 group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="font-medium text-slate-900">{cs.channelSkuKey}</div>
                                        {discontinuedText && (
                                            <div className="text-xs text-red-500 font-medium flex items-center mt-1">
                                                <AlertTriangle size={10} className="mr-1" />
                                                {discontinuedText}
                                            </div>
                                        )}
                                    </td>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                                        const allowed = !isLocked && isOverrideAllowed(cs.discontinueEffective, selectedScenario.fyStartYear, m);
                                        const val = getValue(cs, m);
                                        const isEdited = `${cs.channelSkuKey}|${m}` in edits;
                                        
                                        return (
                                            <td key={m} className={`p-1 border-r border-slate-50 ${!allowed && !isLocked ? 'bg-slate-50' : ''}`}>
                                                <input 
                                                    type="number" 
                                                    disabled={!allowed}
                                                    placeholder={!allowed && !isLocked ? "X" : "-"}
                                                    className={`w-full text-right p-1.5 rounded text-sm outline-none transition-all border
                                                        ${!allowed 
                                                            ? 'bg-transparent text-slate-400 cursor-not-allowed border-transparent' 
                                                            : 'bg-white text-slate-700 border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'}
                                                        ${isEdited ? 'bg-yellow-50 border-yellow-400' : ''}
                                                        ${val !== '' && !isEdited ? 'font-bold text-blue-700 bg-blue-50/30' : ''}
                                                    `}
                                                    value={val}
                                                    onChange={(e) => handleCellChange(cs, m, e.target.value)}
                                                    title={!allowed ? (isLocked ? "Escenario Bloqueado" : "Discontinuado") : "Base Mensual Manual"}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            )})}
                            {filteredSkus.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="p-8 text-center text-slate-500">
                                        No se encontraron SKUs con los filtros actuales.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <div className="mx-auto mb-4 text-slate-300 flex justify-center"><Info size={48} /></div>
            <p className="text-slate-500">Seleccioná un escenario arriba para comenzar a editar overrides.</p>
        </div>
      )}
    </Layout>
  );
};