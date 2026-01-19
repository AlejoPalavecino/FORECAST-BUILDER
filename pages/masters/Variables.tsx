import React, { useState, useMemo } from 'react';
import { Modal } from '../../components/Modal';
import { Repos } from '../../storage';
import { Variable, VariableCategory } from '../../types';
import { generateId } from '../../utils';
import { Plus, Edit2, Trash2, Layers, Tag, ArrowRight, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export const MasterVariables: React.FC = () => {
  // State
  const [variables, setVariables] = useState<Variable[]>(Repos.variables.getAll());
  const [categories, setCategories] = useState<VariableCategory[]>(Repos.varCategories.getAll());
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);

  // Modals
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  
  // Forms
  const [currentVar, setCurrentVar] = useState<Partial<Variable>>({});
  const [currentCat, setCurrentCat] = useState<Partial<VariableCategory>>({});

  // Derived
  const selectedVariable = variables.find(v => v.id === selectedVarId);
  const filteredCategories = categories.filter(c => c.variableId === selectedVarId);

  // --- HELPERS ---
  const generateCode = (name: string) => {
      return name
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/&/g, 'AND')
        .replace(/[^A-Z0-9]/g, '_'); // Replace non-alphanumeric with _
  };

  // --- VARIABLE ACTIONS ---
  const handleEditVar = (v: Variable) => {
      setCurrentVar({ ...v });
      setVarModalOpen(true);
  };

  const handleCreateVar = () => {
      setCurrentVar({ active: true, name: '' });
      setVarModalOpen(true);
  };

  const handleSaveVar = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentVar.name) return;

      const code = currentVar.code || generateCode(currentVar.name);
      
      // Validate Duplicate Code
      const exists = variables.find(v => v.code === code && v.id !== currentVar.id);
      if (exists) {
          alert(`Ya existe una variable con el código ${code}`);
          return;
      }

      const payload = {
          id: currentVar.id || generateId(),
          name: currentVar.name,
          code: code,
          active: currentVar.active ?? true
      };

      Repos.variables.save(payload as Variable);
      
      // Audit
      Repos.audit.save({
          id: generateId(), action: currentVar.id ? 'UPDATE' : 'CREATE', actor: 'User', occurredAt: new Date().toISOString(),
          entityType: 'Variable', entityId: payload.id, summary: `${currentVar.id ? 'Editada' : 'Creada'} variable ${payload.name}`
      });

      setVariables(Repos.variables.getAll());
      setVarModalOpen(false);
      if (!selectedVarId) setSelectedVarId(payload.id);
  };

  const handleDeleteVar = (v: Variable) => {
      if (!confirm(`¿Estás seguro de eliminar "${v.name}"? Esto ocultará todas sus categorías y asignaciones.`)) return;
      // Soft Delete
      const updated = { ...v, active: false };
      Repos.variables.save(updated);
      setVariables(Repos.variables.getAll());
  };

  // --- CATEGORY ACTIONS ---
  const handleEditCat = (c: VariableCategory) => {
      setCurrentCat({ ...c });
      setCatModalOpen(true);
  };

  const handleCreateCat = () => {
      if (!selectedVariable) return;
      setCurrentCat({ active: true, name: '', variableId: selectedVariable.id, variableCode: selectedVariable.code });
      setCatModalOpen(true);
  };

  const handleSaveCat = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentCat.name || !selectedVariable) return;

      const code = currentCat.code || generateCode(currentCat.name);
      
      // Validate Duplicate Code within Variable
      const exists = categories.find(c => c.variableId === selectedVariable.id && c.code === code && c.id !== currentCat.id);
      if (exists) {
          alert(`Ya existe una categoría con el código ${code} en esta variable.`);
          return;
      }

      const payload = {
          id: currentCat.id || generateId(),
          variableId: selectedVariable.id,
          variableCode: selectedVariable.code,
          name: currentCat.name,
          code: code,
          active: currentCat.active ?? true
      };

      Repos.varCategories.save(payload as VariableCategory);
      
      Repos.audit.save({
        id: generateId(), action: currentCat.id ? 'UPDATE' : 'CREATE', actor: 'User', occurredAt: new Date().toISOString(),
        entityType: 'VariableCategory', entityId: payload.id, summary: `${currentCat.id ? 'Editada' : 'Creada'} categoría ${payload.name} en ${selectedVariable.name}`
      });

      setCategories(Repos.varCategories.getAll());
      setCatModalOpen(false);
  };

  const handleDeleteCat = (c: VariableCategory) => {
      if (!confirm(`¿Desactivar categoría "${c.name}"?`)) return;
      const updated = { ...c, active: false };
      Repos.varCategories.save(updated);
      setCategories(Repos.varCategories.getAll());
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Variables y Categorías</h1>
          <p className="text-slate-500">Definí los drivers del negocio (Estacionalidad, Canal, Marca) y sus segmentos.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)]">
          
          {/* LEFT: VARIABLES LIST */}
          <div className="w-full lg:w-1/3 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                  <h3 className="font-bold text-slate-800 flex items-center">
                      <Layers size={18} className="mr-2 text-blue-600" /> Variables
                  </h3>
                  <button onClick={handleCreateVar} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors" title="Nueva Variable">
                      <Plus size={16} />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {variables.map(v => (
                      <div 
                        key={v.id}
                        onClick={() => setSelectedVarId(v.id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all group relative ${
                            selectedVarId === v.id 
                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' 
                            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                        } ${!v.active ? 'opacity-60' : ''}`}
                      >
                          <div className="flex justify-between items-start">
                              <div>
                                  <div className="font-semibold text-slate-900">{v.name}</div>
                                  <div className="text-xs text-slate-400 font-mono mt-0.5">{v.code}</div>
                              </div>
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); handleEditVar(v); }} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded">
                                      <Edit2 size={14} />
                                  </button>
                                  {v.active && (
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteVar(v); }} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded">
                                          <Trash2 size={14} />
                                      </button>
                                  )}
                              </div>
                          </div>
                          {!v.active && <div className="text-[10px] text-red-500 font-bold mt-1 uppercase">Inactivo</div>}
                          {selectedVarId === v.id && (
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-3 text-blue-500 hidden lg:block">
                                  <ArrowRight size={24} className="drop-shadow-sm" />
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* RIGHT: CATEGORIES LIST */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm">
              {selectedVariable ? (
                  <>
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center">
                                <Tag size={18} className="mr-2 text-indigo-600" /> 
                                Categorías de: <span className="ml-1 text-slate-900">{selectedVariable.name}</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Estas categorías se asignarán a los SKUs para definir coeficientes.</p>
                        </div>
                        <button onClick={handleCreateCat} className="flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium">
                            <Plus size={16} className="mr-1.5" /> Nueva Categoría
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-0">
                        {filteredCategories.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                <AlertCircle size={32} className="mb-2 opacity-50" />
                                <p>No hay categorías creadas para esta variable.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">Nombre</th>
                                        <th className="px-6 py-3">Código (Sistema)</th>
                                        <th className="px-6 py-3">Estado</th>
                                        <th className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCategories.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50 group">
                                            <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                                            <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.code}</td>
                                            <td className="px-6 py-3">
                                                {c.active ? (
                                                    <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded w-fit">
                                                        <CheckCircle2 size={12} className="mr-1"/> Activo
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-slate-400 text-xs font-bold bg-slate-100 px-2 py-1 rounded w-fit">
                                                        <XCircle size={12} className="mr-1"/> Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button onClick={() => handleEditCat(c)} className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors mr-2">
                                                    <Edit2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                  </>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl">
                      <Layers size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium text-slate-500">Seleccioná una Variable</p>
                      <p className="text-sm">Elegí una variable de la izquierda para gestionar sus categorías.</p>
                  </div>
              )}
          </div>
      </div>

      {/* MODAL VARIABLE */}
      <Modal isOpen={varModalOpen} onClose={() => setVarModalOpen(false)} title={currentVar.id ? "Editar Variable" : "Nueva Variable"}>
          <form onSubmit={handleSaveVar} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                  <input 
                    type="text" autoFocus required
                    className={inputClass}
                    placeholder="Ej: Canal TT"
                    value={currentVar.name || ''}
                    onChange={e => setCurrentVar({ ...currentVar, name: e.target.value })}
                  />
                  <p className="text-xs text-slate-400 mt-1">Este nombre aparecerá en los reportes y asignaciones.</p>
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                  <input 
                    type="text" 
                    className={`${inputClass} bg-slate-100 font-mono`}
                    placeholder="Auto-generado"
                    value={currentVar.code || (currentVar.name ? generateCode(currentVar.name) : '')}
                    disabled
                  />
              </div>
              <div className="pt-2">
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={currentVar.active ?? true} onChange={e => setCurrentVar({ ...currentVar, active: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>Activo</span>
                  </label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setVarModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">Guardar</button>
              </div>
          </form>
      </Modal>

      {/* MODAL CATEGORY */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={currentCat.id ? "Editar Categoría" : "Nueva Categoría"}>
          <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Categoría *</label>
                  <input 
                    type="text" autoFocus required
                    className={inputClass}
                    placeholder="Ej: Espirituosas"
                    value={currentCat.name || ''}
                    onChange={e => setCurrentCat({ ...currentCat, name: e.target.value })}
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno</label>
                  <input 
                    type="text" 
                    className={`${inputClass} bg-slate-100 font-mono`}
                    placeholder="Auto-generado"
                    value={currentCat.code || (currentCat.name ? generateCode(currentCat.name) : '')}
                    disabled
                  />
              </div>
              <div className="pt-2">
                  <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={currentCat.active ?? true} onChange={e => setCurrentCat({ ...currentCat, active: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>Activa</span>
                  </label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setCatModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm">Guardar</button>
              </div>
          </form>
      </Modal>
    </>
  );
};