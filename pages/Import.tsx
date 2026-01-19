import React, { useState, useRef } from 'react';
import { ImportService } from '../services/importService';
import { Repos } from '../storage';
import { ImportJob } from '../types';
import { Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { DEMO_CSV } from '../utils';

export const Import: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load history sorted desc
  const history = Repos.jobs.getAll().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const handleFiles = async (file: File) => {
    setProcessing(true);
    setCurrentJob(null);
    try {
        const result = await ImportService.processFile(file);
        if (result.duplicateOf) {
            const confirmReuse = window.confirm(`Este archivo ya fue importado el ${new Date(result.duplicateOf.finishedAt || '').toLocaleString()}. \n\n¿Querés visualizar el resultado anterior?`);
            if (confirmReuse) {
                setCurrentJob(result.duplicateOf);
            }
        } else {
            setCurrentJob(result.job);
        }
    } catch (error) {
        alert('Error inesperado procesando el archivo');
        console.error(error);
    } finally {
        setProcessing(false);
    }
  };

  const loadDemo = async () => {
      setProcessing(true);
      setCurrentJob(null);
      try {
          const result = await ImportService.processFile(DEMO_CSV, 'demo_data.csv');
          setCurrentJob(result.job);
      } finally {
          setProcessing(false);
      }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Importar Histórico</h1>
        <p className="text-slate-500">Cargá tus archivos CSV de ventas históricas (SAP).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Uploader */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Upload Area */}
            <div 
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}
                onDragEnter={onDrag}
                onDragLeave={onDrag}
                onDragOver={onDrag}
                onDrop={onDrop}
            >
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-slate-100 rounded-full text-slate-500">
                        {processing ? <RefreshCw className="animate-spin" size={32} /> : <Upload size={32} />}
                    </div>
                    <div>
                        <p className="text-lg font-medium text-slate-900">Arrastrá tu archivo CSV acá</p>
                        <p className="text-slate-500 text-sm mt-1">o clickeá para buscar en tu equipo</p>
                    </div>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => e.target.files && e.target.files[0] && handleFiles(e.target.files[0])}
                    />
                    <div className="flex space-x-3">
                        <button 
                            disabled={processing}
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                        >
                            Seleccionar Archivo
                        </button>
                        <button 
                            disabled={processing}
                            onClick={loadDemo}
                            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                        >
                            Cargar Demo
                        </button>
                    </div>
                </div>
            </div>

            {/* Current Job Status */}
            {currentJob && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div>
                            <h3 className="font-semibold text-slate-900 flex items-center space-x-2">
                                <FileText size={18} />
                                <span>{currentJob.originalFileName}</span>
                            </h3>
                            <div className="text-xs text-slate-500 mt-1">ID: {currentJob.id} • {new Date(currentJob.startedAt).toLocaleString()}</div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                            ${currentJob.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' : 
                              currentJob.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {currentJob.status}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
                        <div className="p-4 text-center">
                            <div className="text-xs text-slate-500 uppercase">Total Filas</div>
                            <div className="text-xl font-bold text-slate-900">{currentJob.stats.totalRows}</div>
                        </div>
                        <div className="p-4 text-center">
                            <div className="text-xs text-slate-500 uppercase">Importadas</div>
                            <div className="text-xl font-bold text-emerald-600">{currentJob.stats.importedRows}</div>
                        </div>
                        <div className="p-4 text-center">
                            <div className="text-xs text-slate-500 uppercase">Rechazadas</div>
                            <div className={`text-xl font-bold ${currentJob.stats.rejectedRows > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {currentJob.stats.rejectedRows}
                            </div>
                        </div>
                        <div className="p-4 text-center">
                            <div className="text-xs text-slate-500 uppercase">Duplicados</div>
                            <div className="text-xl font-bold text-yellow-600">{currentJob.stats.duplicatesInFile}</div>
                        </div>
                    </div>

                    {currentJob.rejections.length > 0 && (
                        <div className="p-0">
                            <div className="px-4 py-2 bg-red-50 text-red-800 text-xs font-bold uppercase border-b border-red-100">
                                Detalle de Rechazos
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">Fila #</th>
                                            <th className="px-4 py-2">Mensaje</th>
                                            <th className="px-4 py-2">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentJob.rejections.map((rej, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 font-mono text-slate-600">{rej.rowNumber}</td>
                                                <td className="px-4 py-2 text-red-700">{rej.message}</td>
                                                <td className="px-4 py-2 text-slate-500 italic truncate max-w-xs">{rej.details || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Right Column: History */}
        <div className="bg-white rounded-xl border border-slate-200 h-fit">
            <div className="p-4 border-b border-slate-100 font-semibold text-slate-900 flex items-center space-x-2">
                <Clock size={18} />
                <span>Historial</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {history.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No hay importaciones previas.
                    </div>
                )}
                {history.map(job => (
                    <div key={job.id} onClick={() => setCurrentJob(job)} className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-slate-700 truncate max-w-[150px]" title={job.originalFileName}>{job.originalFileName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                job.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>{job.status}</span>
                        </div>
                        <div className="text-xs text-slate-400 mb-2">
                            {new Date(job.startedAt).toLocaleDateString()} {new Date(job.startedAt).toLocaleTimeString()}
                        </div>
                        <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center text-emerald-600" title="Importadas">
                                <CheckCircle size={12} className="mr-1"/> {job.stats.importedRows}
                            </div>
                            {job.stats.rejectedRows > 0 && (
                                <div className="flex items-center text-red-500" title="Rechazadas">
                                    <AlertTriangle size={12} className="mr-1"/> {job.stats.rejectedRows}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </>
  );
};