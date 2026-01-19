import React, { useState, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Repos } from '../storage';
import { AuditEvent } from '../types';
import { 
    Search, Calendar, Filter, Download, Eye, 
    ChevronLeft, ChevronRight, RefreshCw, XCircle 
} from 'lucide-react';

// Helpers
const formatDateTimeAR = (isoStr: string) => {
    try {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(isoStr));
    } catch (e) {
        return isoStr;
    }
};

const getActionColor = (action: string) => {
    switch (action) {
        case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
        case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
        case 'IMPORT': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'LOCK': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'UNLOCK': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        // System Actions
        case 'BACKUP': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'RESTORE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'RESET': return 'bg-rose-100 text-rose-800 border-rose-200';
        case 'EXPORT': return 'bg-sky-100 text-sky-800 border-sky-200';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

export const Audit: React.FC = () => {
  const [events] = useState<AuditEvent[]>(Repos.audit.getAll());
  
  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Detail Modal State
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Derived Values for Selects
  const uniqueActors = useMemo(() => Array.from(new Set(events.map(e => e.actor))).sort(), [events]);
  const uniqueActions = useMemo(() => Array.from(new Set(events.map(e => e.action))).sort(), [events]);
  const uniqueEntities = useMemo(() => Array.from(new Set(events.map(e => e.entityType || ''))).filter(Boolean).sort(), [events]);

  // Filtering Logic
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
        // Search Text
        if (searchText) {
            const low = searchText.toLowerCase();
            const matchSummary = e.summary.toLowerCase().includes(low);
            const matchId = e.entityId?.toLowerCase().includes(low);
            if (!matchSummary && !matchId) return false;
        }

        // Filters
        if (actorFilter && e.actor !== actorFilter) return false;
        if (actionFilter && e.action !== actionFilter) return false;
        if (entityTypeFilter && e.entityType !== entityTypeFilter) return false;

        // Dates
        if (startDate) {
            if (new Date(e.occurredAt) < new Date(startDate)) return false;
        }
        if (endDate) {
            // End date inclusive (end of day)
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(e.occurredAt) > end) return false;
        }

        return true;
    }).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [events, searchText, actorFilter, actionFilter, entityTypeFilter, startDate, endDate]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Actions
  const handleClearFilters = () => {
      setStartDate('');
      setEndDate('');
      setActorFilter('');
      setActionFilter('');
      setEntityTypeFilter('');
      setSearchText('');
      setCurrentPage(1);
  };

  const handleExport = () => {
      const headers = ['ID', 'Fecha', 'Actor', 'Acción', 'Entidad', 'ID Entidad', 'Resumen'];
      const rows = filteredEvents.map(e => [
          e.id, 
          e.occurredAt, 
          e.actor, 
          e.action, 
          e.entityType || '', 
          e.entityId || '', 
          `"${e.summary.replace(/"/g, '""')}"`
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auditoria_pao_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const filterInputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Auditoría</h1>
            <p className="text-slate-500">Historial de cambios y acciones en el sistema.</p>
        </div>
        <div className="flex space-x-2">
            <button onClick={handleClearFilters} className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center text-sm transition-colors">
                <RefreshCw size={16} className="mr-2" /> Limpiar
            </button>
            <button onClick={handleExport} className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center text-sm font-medium shadow-sm transition-colors">
                <Download size={16} className="mr-2" /> Exportar CSV
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end md:gap-4">
          <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Desde</label>
              <input type="date" className={filterInputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Hasta</label>
              <input type="date" className={filterInputClass} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
              <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Resumen o ID..." className={`${filterInputClass} pl-9`} value={searchText} onChange={e => setSearchText(e.target.value)} />
              </div>
          </div>
          <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Actor</label>
              <select className={`${filterInputClass} w-32`} value={actorFilter} onChange={e => setActorFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {uniqueActors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          </div>
          <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Acción</label>
              <select className={`${filterInputClass} w-32`} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          </div>
          <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Entidad</label>
              <select className={`${filterInputClass} w-32`} value={entityTypeFilter} onChange={e => setEntityTypeFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {uniqueEntities.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                          <th className="px-4 py-3 w-32">Fecha</th>
                          <th className="px-4 py-3">Actor</th>
                          <th className="px-4 py-3">Acción</th>
                          <th className="px-4 py-3">Entidad</th>
                          <th className="px-4 py-3">Resumen</th>
                          <th className="px-4 py-3 text-right"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {paginatedEvents.map(e => (
                          <tr key={e.id} className="hover:bg-slate-50 group">
                              <td className="px-4 py-3 text-slate-500 text-xs font-mono">{formatDateTimeAR(e.occurredAt)}</td>
                              <td className="px-4 py-3 text-slate-700 font-medium">{e.actor}</td>
                              <td className="px-4 py-3">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${getActionColor(e.action)}`}>
                                      {e.action}
                                  </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                  {e.entityType && <div className="text-xs font-bold">{e.entityType}</div>}
                                  {e.entityId && <div className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]" title={e.entityId}>{e.entityId}</div>}
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-md truncate" title={e.summary}>
                                  {e.summary}
                              </td>
                              <td className="px-4 py-3 text-right">
                                  <button 
                                      onClick={() => setSelectedEvent(e)}
                                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                      title="Ver Detalles"
                                  >
                                      <Eye size={18} />
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {paginatedEvents.length === 0 && (
                          <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500">
                                  {events.length === 0 ? "No hay eventos registrados." : "No se encontraron eventos con los filtros actuales."}
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <div className="text-xs text-slate-500">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEvents.length)} de {filteredEvents.length}
                </div>
                <div className="flex space-x-1">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
          )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)} title="Detalle de Auditoría" size="xl">
          {selectedEvent && (
              <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div>
                          <div className="flex items-center space-x-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${getActionColor(selectedEvent.action)}`}>
                                  {selectedEvent.action}
                              </span>
                              <span className="text-sm font-bold text-slate-700">
                                  {selectedEvent.entityType} <span className="text-slate-400 font-normal">#{selectedEvent.entityId}</span>
                              </span>
                          </div>
                          <div className="text-lg font-medium text-slate-900">{selectedEvent.summary}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-bold text-slate-700">{selectedEvent.actor}</div>
                          <div className="text-xs text-slate-500">{formatDateTimeAR(selectedEvent.occurredAt)}</div>
                      </div>
                  </div>

                  {/* Changes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedEvent.before ? (
                          <div className="border border-red-100 rounded-lg overflow-hidden">
                              <div className="bg-red-50 px-3 py-2 border-b border-red-100 font-semibold text-red-800 text-sm flex items-center">
                                  <XCircle size={14} className="mr-2" /> Anterior (Before)
                              </div>
                              <pre className="p-3 bg-slate-50 text-xs overflow-auto max-h-60 font-mono text-slate-600">
                                  {JSON.stringify(selectedEvent.before, null, 2)}
                              </pre>
                          </div>
                      ) : (
                         <div className="p-4 bg-slate-50 rounded border border-slate-100 text-slate-400 text-xs text-center italic">Sin estado anterior</div>
                      )}

                      {selectedEvent.after ? (
                          <div className="border border-green-100 rounded-lg overflow-hidden">
                              <div className="bg-green-50 px-3 py-2 border-b border-green-100 font-semibold text-green-800 text-sm flex items-center">
                                  <RefreshCw size={14} className="mr-2" /> Nuevo (After)
                              </div>
                              <pre className="p-3 bg-slate-50 text-xs overflow-auto max-h-60 font-mono text-slate-600">
                                  {JSON.stringify(selectedEvent.after, null, 2)}
                              </pre>
                          </div>
                      ) : (
                        <div className="p-4 bg-slate-50 rounded border border-slate-100 text-slate-400 text-xs text-center italic">Sin estado nuevo</div>
                      )}
                  </div>

                  {/* Raw ID */}
                  <div className="text-[10px] text-slate-400 text-center pt-4 border-t border-slate-100">
                      Event ID: {selectedEvent.id}
                  </div>
              </div>
          )}
      </Modal>
    </Layout>
  );
};