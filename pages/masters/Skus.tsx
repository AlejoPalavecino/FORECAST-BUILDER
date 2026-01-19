import React, { useState, useMemo } from 'react';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { Repos } from '../../storage';
import { SKUProduct } from '../../types';
import { generateId } from '../../utils';
import { Plus, Search, Edit2, Filter, Box } from 'lucide-react';

export const MasterSkus: React.FC = () => {
  const [skus, setSkus] = useState<SKUProduct[]>(Repos.skus.getAll());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSku, setCurrentSku] = useState<Partial<SKUProduct>>({});
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Filters
  const filteredSkus = useMemo(() => {
    return skus.filter(s => {
      if (!showInactive && !s.active) return false;
      if (searchText) {
        const txt = searchText.toLowerCase();
        return s.sku.toLowerCase().includes(txt) || s.description?.toLowerCase().includes(txt) || s.brand?.toLowerCase().includes(txt);
      }
      return true;
    });
  }, [skus, searchText, showInactive]);

  const handleEdit = (sku: SKUProduct) => {
    setCurrentSku({ ...sku });
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setCurrentSku({ active: true, attributes: {} });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSku.sku) return;

    const trimmedSku = currentSku.sku.trim().toUpperCase();
    
    // Validate Duplicate
    const existing = skus.find(s => s.sku === trimmedSku);
    if (existing && existing.id !== currentSku.id) {
        alert("Ya existe un SKU con ese código.");
        return;
    }

    const payload: SKUProduct = {
        id: currentSku.id || generateId(),
        sku: trimmedSku,
        brand: currentSku.brand || '',
        categoryMacro: currentSku.categoryMacro || '',
        category: currentSku.category || '',
        description: currentSku.description || '',
        active: currentSku.active ?? true,
        attributes: currentSku.attributes || {},
    };

    Repos.skus.save(payload);
    
    // Audit
    Repos.audit.save({
        id: generateId(),
        action: currentSku.id ? 'UPDATE' : 'CREATE',
        actor: 'User',
        occurredAt: new Date().toISOString(),
        entityType: 'SKUProduct',
        entityId: payload.id,
        summary: `${currentSku.id ? 'Editado' : 'Creado'} SKU ${trimmedSku}`
    });

    setSkus(Repos.skus.getAll());
    setIsModalOpen(false);
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500";

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maestro de SKUs</h1>
          <p className="text-slate-500">Gestionar productos. Desactivar un SKU lo excluye del forecast.</p>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm transition-colors">
            <Plus size={18} className="mr-2" /> Nuevo SKU
        </button>
      </div>

      <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center space-x-3 flex-1">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar SKU, Marca..." 
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                />
            </div>
            <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 border-slate-300" />
                <span>Mostrar inactivos</span>
            </label>
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Marca</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredSkus.map(s => (
                        <tr key={s.id} className={`hover:bg-slate-50 ${!s.active ? 'opacity-60 bg-slate-50' : ''}`}>
                            <td className="px-4 py-3 font-medium text-slate-900 flex items-center">
                                <Box size={16} className="mr-2 text-slate-400" />
                                {s.sku}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{s.brand}</td>
                            <td className="px-4 py-3 text-slate-600">{s.categoryMacro} / {s.category}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {s.active ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button onClick={() => handleEdit(s)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors">
                                    <Edit2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {filteredSkus.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">No se encontraron SKUs.</td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {/* Modal CRUD */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentSku.id ? "Editar SKU" : "Nuevo SKU"}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Código SKU *</label>
                    <input 
                        type="text" required 
                        className={`${inputClass} uppercase`}
                        value={currentSku.sku || ''}
                        onChange={e => setCurrentSku({...currentSku, sku: e.target.value.toUpperCase()})}
                        disabled={!!currentSku.id} // Lock ID on edit
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                    <input type="text" className={inputClass}
                        value={currentSku.brand || ''} onChange={e => setCurrentSku({...currentSku, brand: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría Macro</label>
                    <input type="text" className={inputClass}
                        value={currentSku.categoryMacro || ''} onChange={e => setCurrentSku({...currentSku, categoryMacro: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                    <input type="text" className={inputClass}
                        value={currentSku.category || ''} onChange={e => setCurrentSku({...currentSku, category: e.target.value})} />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                    <textarea className={`${inputClass} h-24 resize-none`}
                        value={currentSku.description || ''} onChange={e => setCurrentSku({...currentSku, description: e.target.value})} />
                </div>
                
                <div className="col-span-2 bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">¿SKU Activo?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={currentSku.active ?? true} onChange={e => setCurrentSku({...currentSku, active: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                {!currentSku.active && (
                    <div className="col-span-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                        Atención: Al desactivar el SKU, se excluirá automáticamente de todos los forecasts futuros.
                    </div>
                )}
            </div>
            <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Guardar</button>
            </div>
          </form>
      </Modal>
    </Layout>
  );
};