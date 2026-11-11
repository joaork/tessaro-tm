import { randomUUID } from 'node:crypto';
import { basename, win32 } from 'node:path';
import { catalogFields, optionalCatalogFields } from '../shared/contracts';
import type { CatalogKind, ImportInspection, ImportPreview, ImportSelection, Issue, MappingField } from '../shared/contracts';
import { machineSchema, mtmSchema } from '../shared/schemas';
import { AppError, schemaIssues } from './errors';
import type { ReferenceInput, Repository } from './repository';
import { readCatalogSheets } from './spreadsheet';
import type { ImportSheet } from './spreadsheet';

const SAMPLE_ROWS = 30;
const MAX_PENDING = 8;
const EXPIRY_MS = 30 * 60 * 1000;

interface PendingImport {
  filename: string;
  kind: CatalogKind;
  sheets: ImportSheet[];
  expires: number;
  previewed?: string;
}

interface Validation {
  preview: ImportPreview;
  entries: { line: number; values: ReferenceInput }[];
}

const labels: Record<MappingField, string> = {
  code: 'Código', description: 'Descrição', rpm: 'RPM padrão', factor: 'Fator (min/m)',
  minutes: 'Tempo unitário (min)', machineType: 'Tipo de máquina',
};

function selectionKey(selection: ImportSelection): string {
  return JSON.stringify([selection.sheet, selection.headerRow, Object.entries(selection.mapping).sort()]);
}

export class Imports {
  private readonly pending = new Map<string, PendingImport>();

  constructor(private readonly repository: Repository) {}

  inspect(filename: string, kind: CatalogKind, data: Buffer): ImportInspection {
    const name = basename(win32.basename(filename));
    const sheets = readCatalogSheets(name, data);
    const id = randomUUID();
    const now = Date.now();
    for (const [key, item] of this.pending) {
      if (item.expires <= now) this.pending.delete(key);
    }
    if (this.pending.size >= MAX_PENDING) {
      const oldest = this.pending.keys().next().value;
      if (oldest) this.pending.delete(oldest);
    }
    this.pending.set(id, { filename: name, kind, sheets, expires: now + EXPIRY_MS });
    return {
      id, filename: name, kind,
      sheets: sheets.map(({ name, rows }) => ({
        name, rowCount: rows.length,
        rows: rows.slice(0, SAMPLE_ROWS).map((row) => row.map((cell) => cell.text)),
      })),
    };
  }

  private get(id: string): PendingImport {
    const item = this.pending.get(id);
    if (!item || item.expires <= Date.now()) {
      this.pending.delete(id);
      throw new AppError('O envio expirou ou já foi confirmado. Selecione o arquivo novamente.', 410);
    }
    return item;
  }

  private validate(item: PendingImport, selection: ImportSelection): Validation {
    const { id, sheet, headerRow, mapping } = selection;
    const issues: Issue[] = [];
    const preview: ImportPreview = { id, valid: false, totalRows: 0, rows: [], issues };
    const entries: Validation['entries'] = [];
    const source = item.sheets.find(({ name }) => name === sheet);
    const header = source?.rows[headerRow - 1];
    if (!source || !header?.some(({ text }) => text.trim())) {
      issues.push({ line: headerRow, message: 'Selecione uma aba e uma linha de cabeçalho com conteúdo.' });
      return { preview, entries };
    }

    const columns = new Map<number, MappingField>();
    const required = catalogFields[item.kind];
    for (const field of [...required, ...optionalCatalogFields[item.kind]]) {
      const index = mapping[field];
      if (index === undefined && !required.includes(field)) continue;
      if (index === undefined || !header[index]?.text.trim()) {
        issues.push({ line: headerRow, field, message: `Selecione a coluna “${labels[field]}”.` });
      } else if (columns.has(index)) {
        issues.push({ line: headerRow, field, message: 'Cada campo deve apontar para uma coluna diferente.' });
      } else {
        columns.set(index, field);
      }
    }
    if (issues.length) return { preview, entries };

    const schema = item.kind === 'machines' ? machineSchema : mtmSchema;
    const saved = new Set(this.repository.catalog(item.kind).map(({ code }) => code));
    const seen = new Map<string, number>();
    for (const [index, row] of source.rows.slice(headerRow).entries()) {
      if (!row.some((cell) => cell.text.trim() || cell.error)) continue;
      const line = index + headerRow + 1;
      preview.totalRows += 1;
      const mapped: Partial<Record<MappingField, string>> = {};
      for (const [column, field] of columns) {
        const cell = row[column];
        const isDecimal = field === 'rpm' || field === 'factor' || field === 'minutes';
        mapped[field] = (isDecimal ? cell?.rawNumber ?? cell?.text : cell?.text)?.trim() ?? '';
        if (cell?.error) issues.push({ line, field, message: cell.error });
      }
      const result = schema.safeParse(mapped);
      if (result.success) {
        const { code } = result.data;
        const firstLine = seen.get(code);
        if (firstLine !== undefined) {
          issues.push({ line, field: 'code', message: `Código “${code}” repetido no arquivo (linha ${firstLine}).` });
        } else if (saved.has(code)) {
          issues.push({ line, field: 'code', message: `Código “${code}” já cadastrado. Edite o item na base.` });
        } else {
          entries.push({ line, values: result.data });
        }
        seen.set(code, firstLine ?? line);
      } else {
        issues.push(...schemaIssues(result.error, line));
      }
      if (preview.rows.length < 60) preview.rows.push({ line, values: result.success ? result.data : mapped });
    }
    if (preview.totalRows === 0) issues.push({ message: 'A aba não contém registros abaixo do cabeçalho.' });
    preview.valid = issues.length === 0;
    if (issues.length > 200) preview.issues = [...issues.slice(0, 200), { message: `${issues.length - 200} outras ocorrências de validação. Corrija o arquivo e envie novamente.` }];
    return { preview, entries };
  }

  preview(selection: ImportSelection): ImportPreview {
    const item = this.get(selection.id);
    const { preview } = this.validate(item, selection);
    item.previewed = preview.valid ? selectionKey(selection) : undefined;
    return preview;
  }

  confirm(selection: ImportSelection): { count: number; batchId: string } {
    const item = this.get(selection.id);
    if (item.previewed !== selectionKey(selection)) throw new AppError('Valide a prévia com o mapeamento atual antes de confirmar.', 409);
    const result = this.repository.transaction(() => {
      const { preview, entries } = this.validate(item, selection);
      if (!preview.valid) throw new AppError('A importação contém pendências. Revise a prévia.', 409, preview.issues);
      const batchId = this.repository.insertImport(item.kind, item.filename, selection.sheet, entries);
      return { count: entries.length, batchId };
    });
    this.pending.delete(selection.id);
    return result;
  }
}
