import React, { useState, useMemo } from 'react';
import { Modal } from '../components/Modal';
import { Repos } from '../storage';
import { Scenario, ScenarioCoefficient, OverrideBaseMonthly } from '../types';
import { generateId, getMonthLabel } from '../utils';
import { 
  Plus, Copy, Lock, Unlock, FileSpreadsheet, 
  CheckCircle2, AlertTriangle, ChevronRight, Search, ArrowRightLeft 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Scenarios: React.FC = () => {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>(Repos.scenarios.getAll());
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [coefficients, setCoefficients] = useState<ScenarioCoefficient[]>(Repos.coefficients.getAll());
  
  // Modal State
  const [modalMode, setModalMode] = useState<'CREATE' | 'CLONE' | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    fyStartYear: new Date().getFullYear(), 
    sourceId: '' // For Clone or Copy From
  });
  
  // Basic Data
  const variables = Repos.variables.filter(v => v.active);
  const categories = Repos.varCategories.filter(c => c.active);

  // Derived
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);
  const isLocked = selectedScenario?.status === 'LOCKED';

  // --- ACTIONS ---

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newId = generateId();
    const newScenario: Scenario = {
      id: newId,
      name: formData.name,
      fyStartYear: Number(formData.fyStartYear),
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };

    // Initialize Coefficients
    const newCoeffs: ScenarioCoefficient[] = [];
    
    if (formData.sourceId) {
        // Copy from existing
        const sourceCoeffs = Repos.coefficients.filter(c => c.scenarioId === formData.sourceId);
        sourceCoeffs.forEach(sc => {
            newCoeffs.push({
                ...sc,
                id: generateId(),
                scenarioId: newId
                // Variable/Category structure remains, values copied
            });
        });
    } else {
        // Create Defaults (1.0)
        variables.forEach(v => {
            const vCats = categories.filter(c => c.variableCode === v.code);
            vCats.forEach(cat => {
                for(let m=1; m<=12; m++) {
                    newCoeffs.push({
                        id: generateId(),
                        scenarioId: newId,
                        variableCode: v.code,
                        categoryCode: cat.code,
                        monthIndex: m,
                        value: 1.0
                    });
                }
            });
        });
    }

    // Save
    Repos.scenarios.save(newScenario);
    Repos.coefficients.saveAll([...coefficients, ...newCoeffs]);
    
    // Audit
    Repos.audit.save({
        id: generateId(), action: 'CREATE', actor: 'User', occurredAt: new Date().toISOString(),
        entityType: 'Scenario', entityId: newId, summary: `Escenario creado: ${newScenario.name}`
    });

    // Reset & Select
    setScenarios(Repos.scenarios.getAll());
    setCoefficients(Repos.coefficients.getAll());
    setSelectedScenarioId(newId);
    setModalMode(null);
  };

  const handleClone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sourceId) return; // Should be set when opening modal

    const sourceScenario = scenarios.find(s => s.id === formData.sourceId);
    if (!sourceScenario) return;

    const newId = generateId();
    const newFY = Number(formData.fyStartYear);
    const newScenario: Scenario = {
      id: newId,
      name: formData.name,
      fyStartYear: newFY,
      status: 'DRAFT',
      sourceScenarioId: sourceScenario.id, // IMPORTANT: Link lineage for Multi-Year logic
      createdAt: new Date().toISOString()
    };

    // 1. Clone Coefficients
    const sourceCoeffs = Repos.coefficients.filter(c => c.scenarioId === sourceScenario.id);
    const newCoeffs = sourceCoeffs.map(c => ({
        ...c,
        id: generateId(),
        scenarioId: newId
    }));

    // 2. Clone Overrides (Adapting FY)
    const sourceOverrides = Repos.overrides.filter(o => o.scenarioId === sourceScenario.id);
    const newOverrides = sourceOverrides.map(o => ({
        ...o,
        id: generateId(),
        scenarioId: newId,
        fyStartYear: newFY // Update FY to target
    }));

    // Save
    Repos.scenarios.save(newScenario);
    Repos.coefficients.saveAll([...coefficients, ...newCoeffs]);
    Repos.overrides.saveAll([...Repos.overrides.getAll(), ...newOverrides]);

    // Audit
    Repos.audit.save({
        id: generateId(), action: 'CLONE', actor: 'User', occurredAt: new Date().toISOString(),
        entityType: 'Scenario', entityId: newId, summary: `Escenario clonado de ${sourceScenario.name}`
    });

    setScenarios(Repos.scenarios.getAll());
    setCoefficients(Repos.coefficients.getAll());
    setSelectedScenarioId(newId);
    setModalMode(null);
  };

  const toggleLock = (scenario: Scenario) => {
    const newStatus = scenario.status === 'DRAFT' ? 'LOCKED' : 'DRAFT';
    const action = newStatus === 'LOCKED' ? 'lock' : 'unlock';
    
    if (!confirm(`¿Estás seguro de que querés ${action === 'lock' ? 'BLOQUEAR' : 'DESBLOQUEAR'} este escenario?`)) return;

    const updated = { ...scenario, status: newStatus };
    Repos.scenarios.save(updated as Scenario);

    // Audit
    Repos.audit.save({
        id: generateId(), action: newStatus === 'LOCKED' ? 'LOCK' : 'UNLOCK', actor: 'User', occurredAt: new Date().toISOString(),
        entityType: 'Scenario', entityId: scenario.id, summary: `Escenario ${action === 'lock' ? 'bloqueado' : 'desbloqueado'}`
    });

    setScenarios(Repos.scenarios.getAll());
  };

  const handleCoeffChange = (id: string, newVal: string) => {
    if (isLocked) return;
    const val = parseFloat(newVal);
    if (isNaN(val)) return;

    // Optimistic UI update
    setCoefficients(prev => prev.map(c => c.id === id ? { ...c, value: val } : c));
    
    // Save to DB (In real app, debounce this)
    const coeff = Repos.coefficients.getById(id);
    if (coeff) {
        Repos.coefficients.save({ ...coeff, value: val });
    }
  };

  // --- UI PREP ---

  // Filter View
  const filteredCoeffs = coefficients.filter(c => c.scenarioId === selectedScenarioId);

  // Group by Variable -> Category
  const gridRows = useMemo(() => {
      if (!selectedScenarioId) return [];
      const rows: any[] = [];
      variables.forEach(v => {
        const vCats = categories.filter(c => c.variableCode === v.code);
        vCats.forEach(cat => {
            const rowCoeffs = [1,2,3,4,5,6,7,8,9,10,11,12].map(m => 
            filteredCoeffs.find(c => c.variableCode === v.code && c.categoryCode === cat.code && c.monthIndex === m)
            );
            rows.push({ variable: v, category: cat, coeffs: rowCoeffs });
        });
      });
      return rows;
  }, [selectedScenarioId, coefficients, variables, categories]);

  const openCloneModal = (s: Scenario, e: React.MouseEvent) => {
      e.stopPropagation();
      setFormData({ name: `${s.name} (Copia)`, fyStartYear: s.fyStartYear, sourceId: s.id });
      setModalMode('CLONE');
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
       <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
         
         {/* Sidebar: Scenario List */}
         <div className="w-full md:w-1/3 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                    <h2 className="font-bold text-slate-800">Escenarios</h2>
                    <p className="text-xs text-slate-500">{scenarios.length} disponibles</p>
                </div>
                <div className="flex space-x-1">
                    <button 
                        onClick={() => navigate('/scenarios/compare')}
                        className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 p-2 rounded-lg shadow-sm transition-colors"
                        title="Comparar Escenarios"
                    >
                        <ArrowRightLeft size={18} />
                    </button>
                    <button 
                        onClick={() => {
                            setFormData({ name: '', fyStartYear: new Date().getFullYear() + 1, sourceId: '' });
                            setModalMode('CREATE');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow-sm transition-colors"
                        title="Nuevo Escenario"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {scenarios.map(s => (
                    <div 
                        key={s.id}
                        onClick={() => setSelectedScenarioId(s.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all group ${
                            selectedScenarioId === s.id 
                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-semibold text-slate-900">{s.name}</div>
                                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono border border-slate-200">FY{s.fyStartYear}</span>
                                    {s.status === 'LOCKED' ? (
                                        <span className="flex items-center text-orange-600 font-medium"><Lock size={10} className="mr-1"/> Cerrado</span>
                                    ) : (
                                        <span className="flex items-center text-emerald-600 font-medium"><CheckCircle2 size={10} className="mr-1"/> Abierto</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => openCloneModal(s, e)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Clonar">
                                    <Copy size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); toggleLock(s); }} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded" title={s.status === 'LOCKED' ? 'Desbloquear' : 'Bloquear'}>
                                    {s.status === 'LOCKED' ? <Unlock size={14} /> : <Lock size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
         </div>

         {/* Main: Coefficients Matrix */}
         <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
            {selectedScenarioId ? (
                <>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h2 className="font-bold text-slate-800 flex items-center">
                                <FileSpreadsheet className="mr-2 text-blue-600" size={18} />
                                Coeficientes: {selectedScenario?.name}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Editando estacionalidad y variables de impacto.</p>
                        </div>
                        {isLocked && (
                            <div className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center border border-orange-200 shadow-sm">
                                <Lock size={12} className="mr-1.5" /> SOLO LECTURA
                            </div>
                        )}
                        {!isLocked && (
                            <div className="text-xs text-slate-400 font-medium italic">
                                Autosave activo
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-left w-48 sticky left-0 bg-slate-50 z-30 border-r border-slate-200">Variable / Categoría</th>
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                        <th key={m} className="px-2 py-3 text-center min-w-[70px] border-r border-slate-100 last:border-0">{getMonthLabel(m)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {gridRows.map((row) => (
                                    <tr key={`${row.variable.code}-${row.category.code}`} className="hover:bg-slate-50 group">
                                        <td className="px-4 py-3 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="text-slate-900">{row.variable.name}</div>
                                            <div className="text-xs text-slate-500 font-normal mt-0.5 flex items-center">
                                                <ChevronRight size={10} className="mr-1" />
                                                {row.category.name}
                                            </div>
                                        </td>
                                        {row.coeffs.map((c: ScenarioCoefficient | undefined, mIdx: number) => (
                                            <td key={mIdx} className="p-1 border-r border-slate-50 last:border-0 text-center">
                                                {c ? (
                                                    <input 
                                                        type="number" 
                                                        step="0.05"
                                                        disabled={isLocked}
                                                        className={`w-full text-center p-1.5 rounded text-sm outline-none transition-all border
                                                            ${isLocked 
                                                                ? 'bg-transparent text-slate-500 cursor-not-allowed border-transparent' 
                                                                : 'bg-white text-slate-700 border-transparent hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                                            }
                                                            ${c.value !== 1 && !isLocked ? 'font-bold text-blue-700 bg-blue-50/50' : ''}
                                                            ${c.value !== 1 && isLocked ? 'font-bold text-blue-700' : ''}
                                                        `}
                                                        value={c.value}
                                                        onChange={(e) => handleCoeffChange(c.id, e.target.value)}
                                                    />
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {gridRows.length === 0 && (
                                    <tr>
                                        <td colSpan={13} className="p-12 text-center text-slate-400">
                                            No hay variables activas o categorías configuradas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                    <Search size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium text-slate-500">Seleccioná un escenario</p>
                    <p className="text-sm">Elegí uno de la lista o creá uno nuevo para comenzar.</p>
                </div>
            )}
         </div>

       {/* MODALS */}
       <Modal 
         isOpen={modalMode === 'CREATE'} 
         onClose={() => setModalMode(null)} 
         title="Nuevo Escenario"
       >
           <form onSubmit={handleCreate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                    <input type="text" required autoFocus className={inputClass} 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Optimista FY25" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Año Fiscal (Inicio)</label>
                    <input type="number" required className={inputClass} 
                        value={formData.fyStartYear} onChange={e => setFormData({...formData, fyStartYear: parseInt(e.target.value)})} />
                </div>
                <div className="pt-2 border-t border-slate-100 mt-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Inicialización</label>
                    <select 
                        className={selectClass}
                        value={formData.sourceId}
                        onChange={e => setFormData({...formData, sourceId: e.target.value})}
                    >
                        <option value="">(Vacío) Usar coeficientes 1.00 por defecto</option>
                        {scenarios.map(s => <option key={s.id} value={s.id}>Copiar de: {s.name}</option>)}
                    </select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Crear Escenario</button>
                </div>
           </form>
       </Modal>

       <Modal 
         isOpen={modalMode === 'CLONE'} 
         onClose={() => setModalMode(null)} 
         title="Clonar Escenario"
       >
           <form onSubmit={handleClone} className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-4 flex items-start border border-blue-100">
                    <Copy size={16} className="mr-2 mt-0.5 shrink-0" />
                    <div>Estás clonando <strong>{scenarios.find(s => s.id === formData.sourceId)?.name}</strong>. Se copiarán todos los coeficientes y overrides.</div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nuevo Nombre</label>
                    <input type="text" required autoFocus className={inputClass} 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Año Fiscal Objetivo</label>
                    <input type="number" required className={inputClass} 
                        value={formData.fyStartYear} onChange={e => setFormData({...formData, fyStartYear: parseInt(e.target.value)})} />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <button type="button" onClick={() => setModalMode(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Clonar</button>
                </div>
           </form>
       </Modal>
    </div>
  );
};