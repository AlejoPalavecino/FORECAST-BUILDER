import React, { useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { BackupService } from '../services/backupService';
import { Download, Upload, Trash2, AlertTriangle, FileJson, CheckCircle2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loading, setLoading] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  
  // Restore State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreError, setRestoreError] = useState('');

  // Reset State
  const [resetConfirmText, setResetConfirmText] = useState('');

  // --- HANDLERS ---

  const handleBackup = () => {
    setLoading(true);
    try {
        const payload = BackupService.createBackup();
        BackupService.downloadFile(payload);
    } catch (e) {
        alert("Error generando backup");
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setSelectedFile(e.target.files[0]);
        setRestoreError('');
        setRestoreModalOpen(true);
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    }
  };

  const handleRestoreConfirm = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
        const result = await BackupService.restoreBackup(selectedFile);
        if (result.success) {
            alert(`Éxito: ${result.message}\nLa aplicación se recargará ahora.`);
            window.location.reload();
        } else {
            setRestoreError(result.message);
        }
    } catch (e) {
        setRestoreError("Error inesperado durante la restauración.");
    } finally {
        setLoading(false);
        // Don't close modal if error, so user can see it. 
        // If success, reload happens.
    }
  };

  const handleResetConfirm = () => {
      if (resetConfirmText !== 'BORRAR') return;
      
      setLoading(true);
      try {
          BackupService.factoryReset();
          alert("Sistema restablecido. La aplicación se recargará.");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("Error al restablecer.");
          setLoading(false);
      }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ajustes</h1>
        <p className="text-slate-500">Gestión de datos, copias de seguridad y restauración del sistema.</p>
      </div>

      <div className="max-w-4xl space-y-6">
          
          {/* SECTION 1: BACKUP */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                          <Download size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-slate-900">Copia de Seguridad (Backup)</h3>
                          <p className="text-slate-500 text-sm mt-1 max-w-lg">
                              Descargá todos los datos locales (escenarios, forecasts, usuarios, histórico) en un archivo JSON. 
                              Guardá este archivo en un lugar seguro.
                          </p>
                      </div>
                  </div>
                  <button 
                    onClick={handleBackup}
                    disabled={loading}
                    className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                      <Download size={18} />
                      <span>Descargar Backup</span>
                  </button>
              </div>
          </div>

          {/* SECTION 2: RESTORE */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Upload size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-slate-900">Restaurar Datos</h3>
                          <p className="text-slate-500 text-sm mt-1 max-w-lg">
                              Importá un archivo de backup previo. 
                              <strong className="text-slate-700"> Atención:</strong> Esto reemplazará toda la información actual por la del archivo.
                          </p>
                      </div>
                  </div>
                  <div>
                      <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={onFileSelect}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                          <Upload size={18} />
                          <span>Importar Backup</span>
                      </button>
                  </div>
              </div>
          </div>

          {/* SECTION 3: RESET */}
          <div className="bg-red-50 rounded-xl border border-red-100 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                      <div className="p-3 bg-white text-red-600 rounded-lg border border-red-100">
                          <Trash2 size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-red-900">Zona de Peligro: Restablecer de Fábrica</h3>
                          <p className="text-red-700/80 text-sm mt-1 max-w-lg">
                              Esta acción eliminará <strong>permanentemente</strong> todos los datos locales (Escenarios, Historial, Usuarios) y restaurará los datos de ejemplo (Seed).
                          </p>
                      </div>
                  </div>
                  <button 
                    onClick={() => { setResetConfirmText(''); setResetModalOpen(true); }}
                    disabled={loading}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                      <RotateCcw size={18} />
                      <span>Restablecer Datos</span>
                  </button>
              </div>
          </div>
      </div>

      {/* RESTORE MODAL */}
      <Modal isOpen={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} title="Restaurar Copia de Seguridad">
          <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex items-start">
                  <AlertTriangle className="text-yellow-600 mt-0.5 mr-3 shrink-0" size={20} />
                  <div className="text-sm text-yellow-800">
                      <p className="font-bold mb-1">Advertencia de Seguridad</p>
                      <p>Estás a punto de reemplazar toda la base de datos actual con el contenido de este archivo. Esta acción no se puede deshacer.</p>
                  </div>
              </div>

              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex items-center">
                  <FileJson className="text-slate-400 mr-3" size={24} />
                  <div className="overflow-hidden">
                      <div className="text-sm font-bold text-slate-700 truncate">{selectedFile?.name}</div>
                      <div className="text-xs text-slate-500">{(selectedFile?.size || 0) / 1024 > 1024 ? `${((selectedFile?.size || 0)/1024/1024).toFixed(2)} MB` : `${((selectedFile?.size || 0)/1024).toFixed(2)} KB`}</div>
                  </div>
              </div>

              {restoreError && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                      Error: {restoreError}
                  </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => setRestoreModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                  <button 
                    onClick={handleRestoreConfirm} 
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center shadow-sm"
                  >
                      {loading ? 'Procesando...' : 'Confirmar y Restaurar'}
                  </button>
              </div>
          </div>
      </Modal>

      {/* RESET MODAL */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Confirmar Restablecimiento" size="lg">
          <div className="space-y-6">
              <div className="text-center py-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="text-red-600" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">¿Estás absolutamente seguro?</h3>
                  <p className="text-slate-500">
                      Esta acción borrará <strong>todos los escenarios, ajustes, importaciones y usuarios</strong> creados en este navegador.
                      La aplicación volverá al estado inicial (Seed Data).
                  </p>
              </div>

              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                      Para confirmar, escribí <span className="font-mono font-bold select-all">BORRAR</span> a continuación:
                  </label>
                  <input 
                      type="text" 
                      className="w-full border border-slate-300 rounded-lg p-3 text-center uppercase font-bold tracking-widest focus:ring-4 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all shadow-sm"
                      placeholder="BORRAR"
                      value={resetConfirmText}
                      onChange={e => setResetConfirmText(e.target.value.toUpperCase())}
                  />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                  <button onClick={() => setResetModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
                  <button 
                    onClick={handleResetConfirm} 
                    disabled={loading || resetConfirmText !== 'BORRAR'}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                      {loading ? 'Restableciendo...' : 'Sí, borrar todo'}
                  </button>
              </div>
          </div>
      </Modal>

    </Layout>
  );
};