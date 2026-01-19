import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../storage';
import { ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('analyst@local');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = AuthService.login(email);
    if (user) {
      navigate('/');
    } else {
      alert('Usuario no encontrado. Probá con analyst@local');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <div className="mb-8 text-center">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-6 shadow-lg shadow-blue-600/20">P</div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">PAO Builder</h1>
            <p className="text-slate-500 mt-2 text-sm">Herramienta de Forecast & Planeamiento</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Email Corporativo</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3.5 text-slate-900 placeholder-slate-400 shadow-sm transition-all hover:border-blue-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10"
              placeholder="nombre@empresa.com"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg transition-all shadow-md hover:shadow-lg shadow-blue-600/20 flex items-center justify-center group"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight size={18} className="ml-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400">
                Entorno Seguro • Local First • v1.2.0
             </p>
        </div>
      </div>
    </div>
  );
};