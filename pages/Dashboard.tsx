import React from 'react';
import { Repos, AuthService } from '../storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { formatC9L } from '../utils';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowRight, TrendingUp, Package, Layers, PlayCircle, 
    FileSpreadsheet, Edit3, Download, Search
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const skus = Repos.skus.getAll();
  const forecasts = Repos.forecasts.getAll();
  const scenarios = Repos.scenarios.getAll();
  
  // Logic to find the "Most Relevant" Scenario (Last modified or Base)
  const baseScenario = scenarios.find(s => s.name.toLowerCase().includes("base")) || scenarios[0];
  
  // Basic Stats
  const activeSKUs = skus.filter(s => s.active).length;
  const totalForecast = forecasts
    .filter(f => f.scenarioId === baseScenario?.id)
    .reduce((sum, f) => sum + f.forecastC9l, 0);

  // Chart Data
  const chartData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const monthVol = forecasts
      .filter(f => f.scenarioId === baseScenario?.id && f.monthIndex === m)
      .reduce((sum, f) => sum + f.forecastC9l, 0);
    return {
      name: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'][m-1],
      vol: monthVol
    };
  });

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, onClick }: any) => (
    <div 
        onClick={onClick}
        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
                {subtext && <p className="text-sm text-slate-400 mt-1 group-hover:text-blue-600 transition-colors flex items-center">{subtext} <ArrowRight size={12} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"/></p>}
            </div>
            <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
                <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
            </div>
        </div>
    </div>
  );

  const QuickAction = ({ title, desc, icon: Icon, to, primary }: any) => (
      <button 
        onClick={() => navigate(to)}
        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center group
            ${primary 
                ? 'bg-blue-600 border-blue-600 text-white shadow-md hover:bg-blue-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:shadow-md'
            }`}
      >
          <div className={`p-2 rounded-lg mr-4 ${primary ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-blue-50'}`}>
              <Icon size={20} className={primary ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'} />
          </div>
          <div>
              <div className={`font-bold ${primary ? 'text-white' : 'text-slate-800'}`}>{title}</div>
              <div className={`text-xs mt-0.5 ${primary ? 'text-blue-100' : 'text-slate-500'}`}>{desc}</div>
          </div>
          <ChevronRightIcon className={`ml-auto w-5 h-5 ${primary ? 'text-white/50' : 'text-slate-300'} group-hover:translate-x-1 transition-transform`} />
      </button>
  );

  const ChevronRightIcon = ({className}: {className?: string}) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
                Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{user?.name.split(' ')[0]}</span>.
            </h1>
            <p className="text-slate-500 mt-1 text-lg">Aquí tenés el resumen de tu proyección de ventas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
                title="Forecast Total (Base)" 
                value={<span>{formatC9L(totalForecast)} <span className="text-lg font-normal text-slate-400">C9L</span></span>} 
                subtext="Ver detalle mensual"
                icon={TrendingUp}
                colorClass="text-blue-600 bg-blue-600"
                onClick={() => navigate('/analysis')}
            />
            <StatCard 
                title="Escenarios Activos" 
                value={scenarios.length} 
                subtext="Administrar escenarios"
                icon={FileSpreadsheet}
                colorClass="text-emerald-600 bg-emerald-600"
                onClick={() => navigate('/scenarios')}
            />
            <StatCard 
                title="SKUs Activos" 
                value={activeSKUs} 
                subtext="Ir al catálogo"
                icon={Package}
                colorClass="text-purple-600 bg-purple-600"
                onClick={() => navigate('/masters/skus')}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-slate-800">Tendencia de Volumen</h3>
                        <p className="text-sm text-slate-500">Escenario: {baseScenario?.name || 'N/A'}</p>
                    </div>
                    <button onClick={() => navigate('/analysis')} className="text-sm text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                        Ver Reporte Completo
                    </button>
                </div>
                
                {baseScenario ? (
                    <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                <Tooltip 
                                    cursor={{stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="vol" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <p>No hay escenarios creados.</p>
                    </div>
                )}
            </div>

            <div className="flex flex-col space-y-4">
                <h3 className="font-bold text-slate-800 mb-1 px-1">Acciones Rápidas</h3>
                
                <QuickAction 
                    title="Ejecutar Forecast" 
                    desc="Recalcular con últimos cambios" 
                    icon={PlayCircle} 
                    to="/forecast"
                    primary={true}
                />
                
                <QuickAction 
                    title="Ajustes Manuales" 
                    desc="Modificar base mensual (Overrides)" 
                    icon={Edit3} 
                    to="/overrides"
                />

                <QuickAction 
                    title="Importar Histórico" 
                    desc="Cargar nuevos datos de venta" 
                    icon={Download} 
                    to="/import"
                />

                <div className="bg-slate-100 rounded-xl p-5 mt-auto border border-slate-200">
                    <h4 className="font-bold text-slate-700 text-sm mb-2 flex items-center">
                        <Search size={16} className="mr-2" />
                        ¿Buscás algo puntual?
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">
                        Podés ir al análisis detallado para filtrar por SKU, Canal o Marca.
                    </p>
                    <button onClick={() => navigate('/analysis')} className="w-full py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 hover:shadow-sm transition-all">
                        Ir al Explorador
                    </button>
                </div>
            </div>
        </div>
      </div>
  );
};