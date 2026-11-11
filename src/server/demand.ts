// GitHub https://github.com/joaork

import type { Issue, OperationInput } from '../shared/contracts';
import { operationSchema } from '../shared/schemas';
import { AppError, checked } from './errors';
import { decodeText } from './spreadsheet';

const fields: Record<string, keyof OperationInput> = {
  titulo: 'poCode', rev: 'revision', revisao: 'revision', operacao: 'operationName',
  'agrupamento familia': 'productName', produto: 'productName', tamanho: 'size',
  'medidas da peca em m': 'dimensions', 'pontos cm': 'density',
  'perimetro costura em m': 'perimeter', 'perimetro de costura em m': 'perimeter',
  'cod eqp': 'machineCode', elementos: 'route', observacoes: 'notes', responsavel: 'author',
};

export function parseDemand(data: Uint8Array): OperationInput {
  const source = decodeText(data);
  const draft: Record<string, string | string[]> = { route: [] };
  const seen = new Set<string>();
  const issues: Issue[] = [];

  for (const [index, row] of source.split(/\r?\n/).entries()) {
    if (!row.trim()) continue;
    const delimiter = row.indexOf(':');
    const label = row.slice(0, Math.max(0, delimiter)).normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const field = fields[label];
    if (!field || !Object.hasOwn(fields, label)) {
      issues.push({ line: index + 1, message: 'Campo desconhecido. Use o formato “Campo: valor” da demanda.' });
      continue;
    }
    if (seen.has(field)) {
      issues.push({ line: index + 1, field, message: 'O campo aparece mais de uma vez na demanda.' });
      continue;
    }
    const value = row.slice(delimiter + 1).trim().replace(/^["“](.*)["”]$/u, '$1');
    draft[field] = field === 'route' ? value.split(/[\s,;]+/u).filter(Boolean) : value;
    seen.add(field);
  }
  if (issues.length) throw new AppError('Revise o formato do arquivo de demanda.', 422, issues);
  return checked(operationSchema, draft);
}
