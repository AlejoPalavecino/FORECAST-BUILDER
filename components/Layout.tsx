import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, FileInput, Database, Calculator, 
  BarChart3, Settings, LogOut, Menu, X, Table, FileSpreadsheet, Edit3, Tags, ChevronDown, Box, Layers, PlayCircle, Library, SlidersHorizontal
} from 'lucide-react';
import { AuthService } from '../storage';
import { UserAccount } from '../types';

interface LayoutProps {
  children?: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, active, onClick, className }: any) => (
  <Link 
    to={to} 
    onClick={onClick} 
    className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    } ${className}`}
  >
    <Icon size={18} className={active ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
    <span className="font-medium text-sm">{label}</span>
  </Link>
);

const NavGroupLabel = ({ label }: { label: string }) => (
    <div className="px-4 mt-6 mb-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
    </div>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [user, setUser] = useState<UserAccount | null>(AuthService.getCurrentUser()); // Init directly if possible
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);

  useEffect(() => {
    const u = AuthService.getCurrentUser();
    if (!u) {
      navigate('/login');
    } else {
      setUser(u);
    }
  }, [navigate]);

  // Auto-expand masters if inside a sub-route
  useEffect(() => {
      if (location.pathname.startsWith('/masters')) {
          setMastersOpen(true);
      }
  }, [location.pathname]);

  const handleLogout = () => {
    AuthService.logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out border-r border-slate-800`}>
        {/* Logo Area */}
        <div className="flex items-center justify-between h-16 px-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-500/20 text-white">P</div>
            <div>
                <span className="block text-sm font-bold tracking-tight text-white leading-none">PAO Builder</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Forecast Engine</span>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        {/* Navigation Scroll */}
        <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100vh-4rem)] scrollbar-hide">
          
          <NavItem to="/" icon={LayoutDashboard} label="Inicio" active={location.pathname === '/'} />
          <NavItem to="/analysis" icon={BarChart3} label="Reportes y Análisis" active={location.pathname === '/analysis'} />

          <NavGroupLabel label="Construcción del Forecast" />
          <NavItem to="/scenarios" icon={FileSpreadsheet} label="1. Escenarios" active={location.pathname === '/scenarios'} />
          <NavItem to="/assignments" icon={Tags} label="2. Config. Variables" active={location.pathname === '/assignments'} />
          <NavItem to="/overrides" icon={Edit3} label="3. Ajustes Manuales" active={location.pathname === '/overrides'} />
          <NavItem to="/forecast" icon={PlayCircle} label="4. Ejecutar Motor" active={location.pathname === '/forecast'} className="mt-1 ring-1 ring-slate-800 bg-slate-800/50" />

          <NavGroupLabel label="Datos y Catálogos" />
          <NavItem to="/import" icon={FileInput} label="Importar Histórico" active={location.pathname === '/import'} />
          
          {/* Masters Dropdown */}
          <div className="space-y-1 pt-1">
            <button 
                onClick={() => setMastersOpen(!mastersOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    location.pathname.startsWith('/masters') ? 'text-white bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
                <div className="flex items-center space-x-3">
                    <Database size={18} className={location.pathname.startsWith('/masters') ? 'text-white' : 'text-slate-500'} />
                    <span>Catálogos Maestros</span>
                </div>
                <ChevronDown size={14} className={`transform transition-transform duration-200 text-slate-500 ${mastersOpen ? 'rotate-180' : ''}`} />
            </button>
            {mastersOpen && (
                <div className="relative ml-3 pl-3 border-l border-slate-700 space-y-1 animate-in slide-in-from-left-2 duration-200">
                     <NavItem to="/masters/variables" icon={SlidersHorizontal} label="Variables y Categorías" active={location.pathname === '/masters/variables'} />
                     <NavItem to="/masters/skus" icon={Box} label="Productos (SKUs)" active={location.pathname === '/masters/skus'} />
                     <NavItem to="/masters/channel-sku" icon={Layers} label="Canales y Status" active={location.pathname === '/masters/channel-sku'} />
                </div>
            )}
          </div>

          <NavGroupLabel label="Sistema" />
          <NavItem to="/audit" icon={Table} label="Historial de Cambios" active={location.pathname === '/audit'} />
          <NavItem to="/settings" icon={Settings} label="Configuración" active={location.pathname === '/settings'} />

          {/* Footer Area */}
          <div className="pt-6 mt-6 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-red-950/30 hover:text-red-400 transition-colors text-sm font-medium">
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
            <div className="mt-4 px-3 text-[10px] text-slate-600 font-mono text-center">
                v1.2.0 • Local First
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 transition-shadow hover:shadow-sm">
          <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-slate-500 hover:text-slate-700">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-6 ml-auto">
            <div className="flex flex-col text-right hidden sm:block">
              <span className="text-sm font-bold text-slate-800">{user.name}</span>
              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full w-fit ml-auto">{user.role === 'ANALYST' ? 'Analista' : user.role}</span>
            </div>
            <div className="h-9 w-9 bg-gradient-to-tr from-slate-200 to-slate-300 rounded-full flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm ring-1 ring-slate-100 cursor-default">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden max-w-7xl mx-auto w-full">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};