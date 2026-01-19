import React, { useState, useMemo, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Repos } from '../storage';
import { SKUProduct, SkuVariableAssignment } from '../types';
import { generateId } from '../utils';
import { Save, AlertTriangle, RotateCcw, Play, CheckSquare, Square, Filter, Tags } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Assignments: React.FC = () => {
  const navigate = useNavigate();
  
  // Data Loading
  const variables = Repos.variables.filter(v => v.active);
  const allSkus = Repos.skus.filter(s => s.active); // Only assign active SKUs
  
  // Local State
  const [selectedVarCode, setSelectedVarCode] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map()); // SKU -> CategoryCode
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [lastSaved, setLastSaved] = useState(Date.now()); // Trigger reload
  
  // Filters
  const [filterText, setFilterText] = useState('');
  const [filterMissing, setFilterMissing] = useState(false);
  const [filterBrand, setFilterBrand] = useState('');

  // Derived Data
  const categories = useMemo(() => {
    if (!selectedVarCode) return [];
    return Repos.varCategories.filter(c => c.variableCode === selectedVarCode && c.active);
  }, [selectedVarCode]);

  const assignmentsMap = useMemo(() => {
    if (!selectedVarCode) return new Map<string, string>();
    const assigns = Repos.assignments.filter(a => a.variableCode === selectedVarCode);
    const map = new Map<string, string>();
    assigns.forEach(a => map.set(a.sku, a.categoryCode));
    return map;
  }, [selectedVarCode, lastSaved]);

  // Derived: Filtered List
  const filteredSkus = useMemo(() => {
    return allSkus.filter(s => {
      // Pending value or Saved value
      const currentCat = pendingChanges.has(s.sku) ? pendingChanges.get(s.sku) : assignmentsMap.get(s.sku);
      
      if (filterMissing && currentCat) return false;
      if (filterBrand && s.brand !== filterBrand) return false;
      if (filterText && !s.sku.toLowerCase().includes(filterText.toLowerCase()) && !s.description?.toLowerCase().includes(filterText.toLowerCase())) return false;
      
      return true;
    });
  }, [allSkus, assignmentsMap, pendingChanges, filterText, filterMissing, filterBrand]);

  // Stats
  const stats = useMemo(() => {
    let assigned = 0;
    allSkus.forEach(s => {
        const cat = pendingChanges.has(s.sku) ? pendingChanges.get(s.sku) : assignmentsMap.get(s.sku);
        if (cat) assigned++;
    });
    return {
        total: allSkus.length,
        assigned,
        missing: allSkus.length - assigned,
        percent: allSkus.length > 0 ? Math.round((assigned / allSkus.length) * 100) : 0
    };
  }, [allSkus, assignmentsMap, pendingChanges]);

  // Handlers
  const handleVarChange = (code: string) => {
    if (pendingChanges.size > 0 && !confirm("Tenés cambios sin guardar. ¿Cambiar de variable y perderlos?")) {
        return;
    }
    setSelectedVarCode(code);
    setPendingChanges(new Map());
    setSelectedSkus(new Set());
    setFilterMissing(false);
  };

  const handleAssignmentChange = (sku: string, catCode: string) => {
    const newMap = new Map(pendingChanges);
    newMap.set(sku, catCode);
    setPendingChanges(newMap);
  };

  const toggleSelection = (sku: string) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) newSet.delete(sku);
    else newSet.add(sku);
    setSelectedSkus(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSkus.size === filteredSkus.length) {
        setSelectedSkus(new Set());
    } else {
        setSelectedSkus(new Set(filteredSkus.map(s => s.sku)));
    }
  };

  const handleBulkApply = (catCode: string) => {
    const newMap = new Map(pendingChanges);
    selectedSkus.forEach(sku => newMap.set(sku, catCode));
    setPendingChanges(newMap);
    // Optional: Clear selection after apply? No, let user verify.
  };

  const handleSave = () => {
    if (!selectedVarCode) return;

    // We need to merge pending changes into DB
    // Strategy: Delete existing assignments for modified SKUs, then insert new ones.
    const allAssignments = Repos.assignments.getAll();
    const skusToUpdate = Array.from(pendingChanges.keys());
    
    // 1. Remove old assignments for these SKUs on this Variable
    const cleanAssignments = allAssignments.filter(a => 
        !(a.variableCode === selectedVarCode && skusToUpdate.includes(a.sku))
    );

    // 2. Add new assignments (only if categoryCode is not empty/null)
    const newAssignments: SkuVariableAssignment[] = [];
    pendingChanges.forEach((catCode, sku) => {
        if (catCode) {
            newAssignments.push({
                id: generateId(),
                sku,
                variableCode: selectedVarCode,
                categoryCode: catCode
            });
        }
    });

    Repos.assignments.saveAll([...cleanAssignments, ...newAssignments]);

    // Audit
    Repos.audit.save({
        id: generateId(),
        action: 'UPDATE',
        actor: 'User',
        occurredAt: new Date().toISOString(),
        entityType: 'SkuVariableAssignment',
        summary: `Actualizadas asignaciones para variable ${selectedVarCode} (${skusToUpdate.length} SKUs)`
    });

    setPendingChanges(new Map());
    setSelectedSkus(new Set());
    setLastSaved(Date.now());
  };

  const handleDiscard = () => {
    if (confirm("¿Descartar cambios?")) {
        setPendingChanges(new Map());
    }
  };

  // Extract unique brands for filter
  const brands = useMemo(() => Array.from(new Set(allSkus.map(s => s.brand))).sort(), [allSkus]);

  const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asignaciones</h1>
          <p className="text-slate-500">Definí qué categoría le corresponde a cada SKU por variable.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <Tags className="ml-2 text-slate-400" size={18} />
            <select 
                className="bg-transparent border-none font-medium focus:ring-0 text-slate-900 py-2 pr-8 text-sm"
                value={selectedVarCode}
                onChange={e => handleVarChange(e.target.value)}
            >
                <option value="">Seleccionar Variable...</option>
                {variables.map(v => <option key={v.id} value={v.code}>{v.name}</option>)}
            </select>
        </div>
      </div>

      {selectedVarCode ? (
        <>
            {/* Stats & Quality */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`p-4 rounded-lg border flex items-center justify-between shadow-sm ${stats.percent < 100 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div>
                        <div className="text-sm font-medium opacity-70">Cobertura</div>
                        <div className="text-2xl font-bold">{stats.percent}%</div>
                    </div>
                    {stats.missing > 0 ? <AlertTriangle className="text-orange-500" /> : <CheckSquare className="text-emerald-500" />}
                </div>
                <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="text-sm font-medium text-slate-500">Asignados</div>
                    <div className="text-2xl font-bold text-slate-900">{stats.assigned} <span className="text-sm font-normal text-slate-400">/ {stats.total} SKUs</span></div>
                </div>
                <div className="flex items-center space-x-2 justify-end">
                    {pendingChanges.size > 0 && (
                        <>
                            <button onClick={handleDiscard} className="p-2 text-slate-500 hover:bg-slate-100 rounded transition-colors">
                                <RotateCcw size={20} />
                            </button>
                            <button onClick={handleSave} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
                                <Save size={18} />
                                <span>Guardar ({pendingChanges.size})</span>
                            </button>
                        </>
                    )}
                    <button onClick={() => navigate('/forecast')} className="p-2 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-100 transition-colors" title="Ir a Motor">
                        <Play size={20} />
                    </button>
                </div>
            </div>

            {/* Filters & Bulk Actions */}
            <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
                    <Filter size={18} className="text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar SKU..." 
                        className={`${inputClass} w-40`}
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                    <select 
                        className={`${inputClass} w-32`}
                        value={filterBrand}
                        onChange={e => setFilterBrand(e.target.value)}
                    >
                        <option value="">Marca...</option>
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer select-none">
                        <input type="checkbox" checked={filterMissing} onChange={e => setFilterMissing(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                        <span>Solo pendientes</span>
                    </label>
                </div>
                
                {selectedSkus.size > 0 && (
                    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-200 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">{selectedSkus.size} Seleccionados</span>
                        <div className="h-4 w-px bg-blue-200"></div>
                        <select 
                            className="text-sm bg-white border border-blue-200 rounded px-2 py-1 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            onChange={(e) => {
                                if (e.target.value === '__UNASSIGN__') handleBulkApply('');
                                else if (e.target.value) handleBulkApply(e.target.value);
                                e.target.value = ''; // reset
                            }}
                        >
                            <option value="">Asignar categoría...</option>
                            {categories.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                            <option value="__UNASSIGN__" className="text-red-600 font-medium">-- Quitar Asignación --</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                                        {selectedSkus.size > 0 && selectedSkus.size === filteredSkus.length ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">SKU</th>
                                <th className="px-4 py-3">Marca</th>
                                <th className="px-4 py-3">Categoría Macro</th>
                                <th className="px-4 py-3 w-64">Categoría Asignada ({categories.length})</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSkus.map(s => {
                                const currentCat = pendingChanges.has(s.sku) ? pendingChanges.get(s.sku) : assignmentsMap.get(s.sku);
                                const isDirty = pendingChanges.has(s.sku);
                                const isMissing = !currentCat;

                                return (
                                    <tr key={s.id} className={`hover:bg-slate-50 ${selectedSkus.has(s.sku) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleSelection(s.sku)} className={selectedSkus.has(s.sku) ? "text-blue-600" : "text-slate-300 hover:text-slate-500"}>
                                                {selectedSkus.has(s.sku) ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">{s.sku}</td>
                                        <td className="px-4 py-3 text-slate-500">{s.brand}</td>
                                        <td className="px-4 py-3 text-slate-500">{s.categoryMacro}</td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center space-x-2">
                                                <select 
                                                    className={`w-full text-sm border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none transition-colors
                                                        ${isDirty ? 'border-yellow-400 bg-yellow-50 focus:border-yellow-500 focus:ring-yellow-500' : 'border-slate-300 hover:border-slate-400'}
                                                        ${isMissing && !isDirty ? 'border-red-300 bg-red-50 text-red-600' : ''}
                                                    `}
                                                    value={currentCat || ''}
                                                    onChange={e => handleAssignmentChange(s.sku, e.target.value)}
                                                >
                                                    <option value="">-- Sin Asignación --</option>
                                                    {categories.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                                                </select>
                                                {isMissing && <AlertTriangle size={16} className="text-red-400 shrink-0" title="Sin asignación (afecta forecast)" />}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredSkus.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
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
        <div className="text-center py-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Tags className="mx-auto mb-4 text-slate-300" size={48} />
            <h3 className="text-lg font-medium text-slate-900">Seleccioná una Variable</h3>
            <p className="text-slate-500 mt-1">Elegí una variable arriba para gestionar las categorías de los SKUs.</p>
        </div>
      )}
    </Layout>
  );
};