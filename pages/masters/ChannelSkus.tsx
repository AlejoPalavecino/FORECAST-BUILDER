import React, { useState, useMemo } from 'react';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { Repos } from '../../storage';
import { ChannelSKU, SKUProduct, Channel } from '../../types';
import { generateId, getMonthLabel } from '../../utils';
import { Plus, Search, Edit2, AlertTriangle, Layers, CalendarOff } from 'lucide-react';

export const MasterChannelSkus: React.FC = () => {
  const [cSkus, setCSkus] = useState<ChannelSKU[]>(Repos.channelSkus.getAll());
  const [skus] = useState<SKUProduct[]>(Repos.skus.getAll());
  const [channels] = useState<Channel[]>(Repos.channels.getAll());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDiscModalOpen, setIsDiscModalOpen] = useState(false);
  
  const [currentCSku, setCurrentCSku] = useState<Partial<ChannelSKU>>({});
  
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Filters
  const filtered = useMemo(() => {
    return cSkus.filter(cs => {
      if (!showInactive && !cs.active) return false;
      if (searchText) {
        const txt = searchText.toLowerCase();
        return cs.channelSkuKey.toLowerCase().includes(txt) || cs.sku.toLowerCase().includes(txt);
      }
      return true;
    });
  }, [cSkus, searchText, showInactive]);

  const handleEdit = (cs: ChannelSKU) => {
    setCurrentCSku({ ...cs });
    setIsModalOpen(true);
  };
  
  const handleDiscontinue = (cs: ChannelSKU) => {
      setCurrentCSku({ ...cs });
      setIsDiscModalOpen(true);
  };

  const handleCreate = () => {
    setCurrentCSku({ active: true, channelCode: channels[0]?.code || 'TT' });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCSku.sku || !currentCSku.channelCode) return;

    const channelSkuKey = `${currentCSku.channelCode}_${currentCSku.sku}`;
    
    // Validate Duplicate
    const existing = cSkus.find(c => c.channelSkuKey === channelSkuKey);
    if (existing && existing.id !== currentCSku.id) {
        alert("Ya existe este SKU en este Canal.");
        return;
    }

    const payload: ChannelSKU = {
        id: currentCSku.id || generateId(),
        channelCode: currentCSku.channelCode,
        sku: currentCSku.sku,
        channelSkuKey,
        active: currentCSku.active ?? true,
        discontinueEffective: currentCSku.discontinueEffective
    };

    Repos.channelSkus.save(payload);
    
    // Audit
    Repos.audit.save({
        id: generateId(),
        action: currentCSku.id ? 'UPDATE' : 'CREATE',
        actor: 'User',
        occurredAt: new Date().toISOString(),
        entityType: 'ChannelSKU',
        entityId: payload.id,
        summary: `${currentCSku.id ? 'Editado' : 'Creado'} CanalSKU ${channelSkuKey}`
    });

    setCSkus(Repos.channelSkus.getAll());
    setIsModalOpen(false);
  };

  const handleSaveDiscontinue = () => {
      if (!currentCSku.id || !currentCSku.channelSkuKey) return;
      
      const realItem = Repos.channelSkus.getById(currentCSku.id);
      if (realItem) {
          Repos.channelSkus.save({ ...realItem, discontinueEffective: currentCSku.discontinueEffective });
          setCSkus(Repos.channelSkus.getAll());
          Repos.audit.save({
            id: generateId(), action: 'UPDATE', actor: 'User', occurredAt: new Date().toISOString(),
            entityType: 'ChannelSKU', summary: `Discontinuación actualizada para ${realItem.channelSkuKey}`
          });
      }
      setIsDiscModalOpen(false);
  };

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500";
  const selectClass = inputClass; // Same style for selects

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maestro Canal-SKU</h1>
          <p className="text-slate-500">Relación Canal-Producto y discontinuaciones.</p>
        </div>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm transition-colors">
            <Plus size={18} className="mr-2" /> Asociar SKU a Canal
        </button>
      </div>

      <div className="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex flex-wrap gap-4 items-center justify-between">
         <div className="flex items-center space-x-3 flex-1">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
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
                        <th className="px-4 py-3">Canal / SKU</th>
                        <th className="px-4 py-3">Key</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Discontinuación</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filtered.map(cs => {
                        const disc = cs.discontinueEffective;
                        const discText = disc ? `${getMonthLabel(disc.monthIndex)} ${disc.fyStartYear}` : '—';
                        return (
                        <tr key={cs.id} className={`hover:bg-slate-50 ${!cs.active ? 'opacity-60 bg-slate-50' : ''}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                                <div className="flex items-center">
                                    <Layers size={16} className="mr-2 text-slate-400" />
                                    <span className="font-bold mr-2 text-slate-600">{cs.channelCode}</span>
                                    <span>{cs.sku}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{cs.channelSkuKey}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${cs.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {cs.active ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {disc ? (
                                    <span className="text-red-600 font-medium flex items-center bg-red-50 px-2 py-1 rounded w-fit text-xs border border-red-100">
                                        <CalendarOff size={12} className="mr-1"/> {discText}
                                    </span>
                                ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right flex justify-end space-x-2">
                                <button onClick={() => handleDiscontinue(cs)} className="text-slate-600 hover:bg-slate-100 p-1.5 rounded transition-colors" title="Configurar Discontinuación">
                                    <CalendarOff size={16} />
                                </button>
                                <button onClick={() => handleEdit(cs)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors" title="Editar">
                                    <Edit2 size={16} />
                                </button>
                            </td>
                        </tr>
                    )})}
                    {filtered.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">No se encontraron registros.</td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {/* Modal CRUD */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentCSku.id ? "Editar Relación" : "Nueva Relación Canal-SKU"}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Canal *</label>
                    <select 
                        className={selectClass}
                        value={currentCSku.channelCode}
                        onChange={e => setCurrentCSku({...currentCSku, channelCode: e.target.value})}
                        disabled={!!currentCSku.id}
                    >
                        {channels.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
                    {currentCSku.id ? (
                        <input type="text" disabled value={currentCSku.sku} className={inputClass} />
                    ) : (
                        <select 
                            className={selectClass}
                            value={currentCSku.sku || ''}
                            onChange={e => setCurrentCSku({...currentCSku, sku: e.target.value})}
                        >
                            <option value="">Seleccionar SKU...</option>
                            {skus.filter(s => s.active).map(s => <option key={s.id} value={s.sku}>{s.sku} - {s.brand}</option>)}
                        </select>
                    )}
                </div>
                
                <div className="col-span-2 bg-slate-50 p-4 rounded-lg flex items-center justify-between border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">¿Relación Activa?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={currentCSku.active ?? true} onChange={e => setCurrentCSku({...currentCSku, active: e.target.checked})} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>
            </div>
            <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Guardar</button>
            </div>
          </form>
      </Modal>

      {/* Modal Discontinuation */}
      <Modal isOpen={isDiscModalOpen} onClose={() => setIsDiscModalOpen(false)} title="Configurar Discontinuación">
           <div className="space-y-4">
               <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-sm text-yellow-800 flex items-start">
                   <AlertTriangle size={16} className="mt-0.5 mr-3 shrink-0" />
                   <p>El forecast será 0 desde el mes posterior a la fecha efectiva. No se permitirán Overrides en esos meses.</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Año Fiscal (Inicio)</label>
                       <input 
                            type="number" 
                            className={inputClass}
                            placeholder="Ej: 2024"
                            value={currentCSku.discontinueEffective?.fyStartYear || 2024}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                const current = currentCSku.discontinueEffective || { monthIndex: 1, fyStartYear: val };
                                setCurrentCSku({ ...currentCSku, discontinueEffective: { ...current, fyStartYear: val } });
                            }}
                        />
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">Mes Efectivo (Inclusive)</label>
                       <select 
                            className={selectClass}
                            value={currentCSku.discontinueEffective?.monthIndex || 1}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                const current = currentCSku.discontinueEffective || { fyStartYear: 2024, monthIndex: val };
                                setCurrentCSku({ ...currentCSku, discontinueEffective: { ...current, monthIndex: val } });
                            }}
                       >
                           {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{getMonthLabel(m)}</option>)}
                       </select>
                   </div>
               </div>

               <div className="pt-4 flex justify-between">
                   <button 
                        onClick={() => {
                            setCurrentCSku({ ...currentCSku, discontinueEffective: undefined });
                        }}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                   >
                       Quitar Discontinuación
                   </button>
                   <div className="flex space-x-3">
                        <button onClick={() => setIsDiscModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                        <button onClick={handleSaveDiscontinue} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors">Guardar</button>
                   </div>
               </div>
           </div>
      </Modal>
    </Layout>
  );
};