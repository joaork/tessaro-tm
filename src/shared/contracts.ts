import type { CaptureSource } from './workflow';

export type CatalogKind = 'machines' | 'mtm';
export type Origin = 'demo' | 'manual' | 'imported';

interface Reference {
  code: string;
  description: string;
  origin: Origin;
  version: number;
  updatedAt: string;
  source?: { filename: string; sheet: string; line: number; batchId: string };
}

export interface Machine extends Reference {
  rpm: string;
  factor: string;
  machineType?: string;
}

export interface MtmElement extends Reference {
  minutes: string;
}

export interface OperationInput {
  productName: string;
  perimeter: string;
  density: string;
  machineCode: string;
  route: string[];
  notes?: string;
  author?: string;
  poCode?: string;
  revision?: string;
  operationName?: string;
  size?: string;
  dimensions?: string;
  capture?: CaptureSource;
}

export interface PoPreview {
  input: OperationInput;
  machine: Machine;
  items: { position: number; element: MtmElement }[];
  fixedMinutes: string;
  mtmMinutes: string;
  totalMinutes: string;
  rpmLower: string;
  rpmUpper: string;
  demonstrative: boolean;
  formulaVersion: string;
}

export interface ProcessOperation extends PoPreview {
  id: string;
  number: number;
  createdAt: string;
  previousId?: string;
  supersededBy?: string;
}

export interface Workspace {
  machines: Machine[];
  mtm: MtmElement[];
  operations: ProcessOperation[];
}

export interface Issue {
  line?: number;
  field?: string;
  message: string;
}

export type MappingField = 'code' | 'description' | 'rpm' | 'factor' | 'minutes' | 'machineType';
export type ColumnMapping = Partial<Record<MappingField, number>>;

export interface ImportInspection {
  id: string;
  filename: string;
  kind: CatalogKind;
  sheets: { name: string; rows: string[][]; rowCount: number }[];
}

export interface ImportSelection {
  id: string;
  sheet: string;
  headerRow: number;
  mapping: ColumnMapping;
}

export interface ImportPreview {
  id: string;
  valid: boolean;
  totalRows: number;
  rows: { line: number; values: Partial<Record<MappingField, string>> }[];
  issues: Issue[];
}

export const catalogFields: Record<CatalogKind, MappingField[]> = {
  machines: ['code', 'description', 'rpm', 'factor'],
  mtm: ['code', 'description', 'minutes'],
};

export const optionalCatalogFields: Record<CatalogKind, MappingField[]> = {
  machines: ['machineType'],
  mtm: [],
};

const aliases: Record<MappingField, string[]> = {
  code: ['codigo', 'cod', 'codigo mtm', 'codigo da maquina', 'codigo de maquina', 'codigo maquina', 'cod maquina', 'cod mtm', 'code', 'elemento agrupador'],
  description: ['descricao', 'descricao do elemento', 'descricao modelo', 'descricao da maquina', 'modelo', 'elemento', 'maquina', 'description'],
  rpm: ['rpm', 'rpm padrao', 'rotacao', 'rotacao padrao', 'velocidade rpm'],
  factor: ['fator', 'tempo por metro', 'fator de tempo por metro', 'tempo metro', 'tempo m', 'tempo tempo metro', 'min m', 'factor'],
  minutes: ['tempo', 'tempo unitario', 'tempo mtm', 'tempo em minutos', 'minutos', 'minutes', 'tempo do elemento'],
  machineType: ['tipo', 'tipo maquina', 'tipo da maquina', 'tipo de maquina'],
};

export function suggestMapping(headers: string[], kind: CatalogKind): ColumnMapping {
  const normalized = headers.map((header) => header.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  const mapping: ColumnMapping = {};

  for (const field of [...catalogFields[kind], ...optionalCatalogFields[kind]]) {
    const names = aliases[field];
    const exact = normalized.findIndex((header) => names.includes(header));
    const withUnits = normalized.findIndex((header) => names.some((name) => header.startsWith(`${name} min`)));
    const index = exact >= 0 ? exact : withUnits;
    if (index >= 0) mapping[field] = index;
  }

  return mapping;
}
