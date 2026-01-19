import {
  UserAccount, Channel, SKUProduct, ChannelSKU, HistoricMonthly,
  Variable, VariableCategory, SkuVariableAssignment, Scenario,
  ScenarioCoefficient, OverrideBaseMonthly, ForecastMonthly, ImportJob, AuditEvent
} from './types';
import { generateId } from './utils';

const STORAGE_KEYS = {
  USERS: 'pao_users',
  CHANNELS: 'pao_channels',
  SKUS: 'pao_skus',
  CHANNEL_SKUS: 'pao_channel_skus',
  HISTORY: 'pao_history',
  VARIABLES: 'pao_variables',
  VAR_CATEGORIES: 'pao_var_categories',
  ASSIGNMENTS: 'pao_assignments',
  SCENARIOS: 'pao_scenarios',
  COEFFICIENTS: 'pao_coefficients',
  OVERRIDES: 'pao_overrides',
  FORECASTS: 'pao_forecasts',
  JOBS: 'pao_jobs',
  AUDIT: 'pao_audit',
  SESSION: 'pao_session',
};

// Generic Repository
class Repository<T extends { id: string }> {
  constructor(private key: string) {}

  getAll(): T[] {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  getById(id: string): T | undefined {
    return this.getAll().find(item => item.id === id);
  }

  save(item: T): void {
    const all = this.getAll();
    const index = all.findIndex(i => i.id === item.id);
    if (index >= 0) {
      all[index] = item;
    } else {
      all.push(item);
    }
    localStorage.setItem(this.key, JSON.stringify(all));
  }

  saveAll(items: T[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
  }
  
  // Simple filter helper
  filter(predicate: (item: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }
}

// Repositories
export const Repos = {
  users: new Repository<UserAccount>(STORAGE_KEYS.USERS),
  channels: new Repository<Channel>(STORAGE_KEYS.CHANNELS),
  skus: new Repository<SKUProduct>(STORAGE_KEYS.SKUS),
  channelSkus: new Repository<ChannelSKU>(STORAGE_KEYS.CHANNEL_SKUS),
  history: new Repository<HistoricMonthly>(STORAGE_KEYS.HISTORY),
  variables: new Repository<Variable>(STORAGE_KEYS.VARIABLES),
  varCategories: new Repository<VariableCategory>(STORAGE_KEYS.VAR_CATEGORIES),
  assignments: new Repository<SkuVariableAssignment>(STORAGE_KEYS.ASSIGNMENTS),
  scenarios: new Repository<Scenario>(STORAGE_KEYS.SCENARIOS),
  coefficients: new Repository<ScenarioCoefficient>(STORAGE_KEYS.COEFFICIENTS),
  overrides: new Repository<OverrideBaseMonthly>(STORAGE_KEYS.OVERRIDES),
  forecasts: new Repository<ForecastMonthly>(STORAGE_KEYS.FORECASTS),
  jobs: new Repository<ImportJob>(STORAGE_KEYS.JOBS),
  audit: new Repository<AuditEvent>(STORAGE_KEYS.AUDIT),
};

// Auth Helper
export const AuthService = {
  login: (email: string) => {
    // Mock login
    const user = Repos.users.getAll().find(u => u.email === email);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
      return user;
    }
    return null;
  },
  getCurrentUser: (): UserAccount | null => {
    const s = localStorage.getItem(STORAGE_KEYS.SESSION);
    return s ? JSON.parse(s) : null;
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  }
};

// --- DATA SEEDING ---

export const initializeData = () => {
  if (Repos.users.getAll().length > 0) return; // Already seeded

  console.log("Inicializando Sistema Limpio (Producción)...");

  // 1. Users (Essential for Login)
  Repos.users.save({ 
    id: 'u1', 
    email: 'analyst@local', 
    name: 'Analista Principal', 
    role: 'ANALYST', 
    createdAt: new Date().toISOString() 
  });

  // NOTE: No mock data is loaded.
  // Channels, SKUs, and History will be created via Import (CSV).
  // Variables and Scenarios will be created via UI.
  
  console.log("Sistema listo para carga de datos.");
};