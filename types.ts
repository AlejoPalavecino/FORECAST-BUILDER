export type Role = 'ANALYST' | 'ADMIN';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Channel {
  id: string;
  code: string; // TT, MT
  name: string;
  active: boolean;
}

export interface SKUProduct {
  id: string;
  sku: string;
  brand: string;
  categoryMacro: string; // Spirits, Wine
  category: string; // Vodka, Gin
  active: boolean;
  description: string;
  attributes?: Record<string, any>;
}

export interface ChannelSKU {
  id: string;
  channelCode: string;
  sku: string;
  channelSkuKey: string; // TT_SKU123
  active: boolean;
  // Discontinuation: forecast becomes 0 AFTER this date
  discontinueEffective?: {
    fyStartYear: number;
    monthIndex: number; // 1-12 (Apr-Mar)
  };
}

export interface HistoricMonthly {
  id: string;
  channelSkuKey: string;
  fyStartYear: number;
  monthIndex: number; // 1=Apr ... 12=Mar
  c9l: number;
}

export interface Variable {
  id: string;
  name: string; // Seasonality, Status, BrandGrowth
  code: string;
  active: boolean;
}

export interface VariableCategory {
  id: string;
  variableId: string;
  variableCode: string;
  name: string; // High Season, Launch, Mature
  code: string;
  active: boolean;
}

export interface SkuVariableAssignment {
  id: string;
  sku: string;
  variableCode: string;
  categoryCode: string;
}

export type ScenarioStatus = 'DRAFT' | 'LOCKED';

export interface Scenario {
  id: string;
  name: string;
  fyStartYear: number;
  status: ScenarioStatus;
  description?: string;
  sourceScenarioId?: string; // Tracks lineage for Multi-Year logic
  createdAt: string;
}

export interface ScenarioCoefficient {
  id: string;
  scenarioId: string;
  variableCode: string;
  categoryCode: string;
  monthIndex: number;
  value: number; // Multiplier, e.g. 1.15
}

export interface OverrideBaseMonthly {
  id: string;
  scenarioId: string;
  channelSkuKey: string;
  fyStartYear: number; // Added to support multi-year overrides
  monthIndex: number;
  baseMonthlyC9l: number; // The manual override value
  updatedAt?: string;
}

export interface ForecastMonthly {
  id: string;
  scenarioId: string;
  channelSkuKey: string;
  fyStartYear: number;
  monthIndex: number;
  baseMonthlyC9l: number;
  forecastC9l: number;
  forecastLiters: number;
  isDiscontinued: boolean;
  factorsApplied: {
    variableCode: string;
    categoryCode?: string;
    value: number;
    isMissing?: boolean;
  }[];
}

export interface ImportRejection {
  rowNumber: number;
  message: string;
  details?: string;
}

export interface ImportJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  originalFileName: string;
  checksum: string;
  startedAt: string;
  finishedAt?: string;
  stats: {
    totalRows: number;
    importedRows: number;
    rejectedRows: number;
    duplicatesInFile: number;
  };
  rejections: ImportRejection[];
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actor: string;
  action: string | 'BACKUP' | 'RESTORE' | 'RESET' | 'EXPORT'; // Added system actions
  summary: string;
  entityType?: string;
  entityId?: string;
  before?: any; // Snapshot before change
  after?: any;  // Snapshot after change
}

export type BaseSourceType = 'HISTORIC_FY_MINUS_1' | 'WEIGHTED_75_25';

export interface ForecastCalculationMetadata {
  baseSource: BaseSourceType;
  baseDetails: string;
  warnings: string[];
  scenarioUsedForFyMinus1?: string;
}

export interface ForecastResult {
  stats: {
    totalForecastC9L: number;
    totalHistoryC9L: number;
    deltaPercent: number;
  };
  metadata: ForecastCalculationMetadata;
}