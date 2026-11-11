import { extname } from 'node:path';
import { parse } from 'csv-parse/sync';
import { read, utils } from 'xlsx';
import type { CellObject } from 'xlsx';
import { AppError } from './errors';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
const MAX_COLUMNS = 64;
const MAX_SHEETS = 30;

export interface ImportCell {
  text: string;
  rawNumber?: string;
  error?: string;
}

export interface ImportSheet {
  name: string;
  rows: ImportCell[][];
}

export function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    return new TextDecoder('windows-1252').decode(data);
  }
}

function csvRows(data: Uint8Array): ImportCell[][] {
  const source = decodeText(data);
  const possibilities = [';', ',', '\t'].flatMap((delimiter) => {
    try {
      const rows = parse(source, { delimiter, bom: true, relax_column_count: true, max_record_size: 128_000 }) as string[][];
      const sample = rows.slice(0, 40).filter((row) => row.some((value) => value.trim()));
      const headerSize = sample[0]?.length ?? 0;
      const score = headerSize > 1 ? sample.filter((row) => row.length === headerSize).length * 100 + headerSize : 0;
      return [{ rows, score }];
    } catch {
      return [];
    }
  }).sort((left, right) => right.score - left.score);
  const rows = possibilities[0]?.rows;
  if (!rows?.length) throw new AppError('O CSV está vazio ou contém aspas ou separadores inválidos.', 422);
  if (rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLUMNS)) throw sheetTooLarge();
  return rows.map((row) => row.map((text) => ({ text })));
}

function sheetTooLarge(): AppError {
  return new AppError(`Use até ${MAX_ROWS.toLocaleString('pt-BR')} linhas e ${MAX_COLUMNS} colunas por aba.`, 422);
}

function numberText(value: number): string {
  const text = String(value);
  const [mantissa, exponent] = text.split('e');
  if (!mantissa || exponent === undefined) return text;
  const sign = mantissa.startsWith('-') ? '-' : '';
  const unsigned = mantissa.slice(sign.length);
  const [whole = '', fraction = ''] = unsigned.split('.');
  const digits = whole + fraction;
  const decimalPosition = whole.length + Number(exponent);
  if (decimalPosition <= 0) return `${sign}0.${'0'.repeat(-decimalPosition)}${digits}`;
  if (decimalPosition >= digits.length) return sign + digits.padEnd(decimalPosition, '0');
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
}

function sheetCell(cell?: CellObject): ImportCell {
  if (!cell) return { text: '' };
  if (cell.t === 'e' || (cell.f && (cell.v === undefined || cell.v === null || cell.t === 'z'))) {
    return { text: cell.w ?? '', error: 'A célula contém erro ou uma fórmula sem resultado salvo. Calcule e salve a planilha ou cole valores.' };
  }
  const text = cell.v === undefined || cell.v === null ? '' : String(cell.v);
  if (cell.t === 'n' && typeof cell.v === 'number') {
    // Mantém o código exibido (inclusive zeros à esquerda) e o valor numérico original para medidas.
    return { text: cell.w ?? text, rawNumber: numberText(cell.v) };
  }
  return { text };
}

export function readCatalogSheets(filename: string, data: Buffer): ImportSheet[] {
  const extension = extname(filename).toLowerCase();
  if (extension === '.csv') return [{ name: 'CSV', rows: csvRows(data) }];
  if (extension !== '.xlsx' && extension !== '.ods') throw new AppError('Selecione um arquivo Excel (.xlsx), LibreOffice (.ods) ou CSV.', 415);
  if (data[0] !== 0x50 || data[1] !== 0x4b) throw new AppError('O conteúdo do arquivo não é uma planilha XLSX ou ODS válida.', 422);

  let workbook: ReturnType<typeof read>;
  try {
    workbook = read(data, { cellFormula: true, cellText: true, sheetStubs: true, sheetRows: MAX_ROWS + 1 });
  } catch {
    throw new AppError('Não foi possível ler a planilha. Verifique o formato e salve uma nova cópia.', 422);
  }
  if (!workbook.SheetNames.length || workbook.SheetNames.length > MAX_SHEETS) {
    throw new AppError(`A planilha deve conter entre 1 e ${MAX_SHEETS} abas.`, 422);
  }
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const range = sheet?.['!fullref'] ?? sheet?.['!ref'];
    if (!sheet || !range) return { name, rows: [] };

    const { e } = utils.decode_range(range);
    if (e.r >= MAX_ROWS || e.c >= MAX_COLUMNS) throw sheetTooLarge();
    const rows = Array.from({ length: e.r + 1 }, (_, r) => Array.from({ length: e.c + 1 }, (_, c) =>
      sheetCell(sheet[utils.encode_cell({ r, c })] as CellObject | undefined),
    ));
    return { name, rows };
  });
}
