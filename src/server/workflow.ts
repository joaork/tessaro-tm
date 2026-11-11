// GitHub https://github.com/joaork

import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import type { Machine, MtmElement, OperationInput, PoPreview, ProcessOperation } from '../shared/contracts';
import { differenceDecimals, divideDecimals, multiplyDecimals } from '../shared/decimal';
import { audioFormats, splitRoute } from '../shared/workflow';
import type { BatchPreview, RevisionPreview, RevisionSelection, Simulation, SuggestedStep } from '../shared/workflow';
import { calculateOperation } from './calculation';
import { AppError } from './errors';
import type { Repository } from './repository';

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function requireCurrentToken(expected: string, actual: string): void {
  if (expected !== actual) throw new AppError('Os dados mudaram desde a prévia. Confira novamente antes de salvar.', 409);
}

export function issuedLabel(operation: ProcessOperation): string {
  return operation.input.poCode || 'PO-' + String(operation.number).padStart(4, '0');
}

export function requireCurrentOperation(operation: ProcessOperation): void {
  if (operation.supersededBy) throw new AppError('Esta ficha possui uma revisão posterior. Abra a versão vigente para continuar.', 409);
}

export function onMachine(operation: ProcessOperation, machine: Machine): PoPreview {
  return calculateOperation({ ...operation.input, machineCode: machine.code }, [machine], operation.items.map(({ element }) => element));
}

export function simulate(operation: ProcessOperation, machines: Machine[], approved: string[], goal: string, method?: { route: string[]; catalog: MtmElement[] }): Simulation {
  const target = multiplyDecimals(operation.totalMinutes, multiplyDecimals(differenceDecimals('100', goal), '0.01'));
  const route = method?.route ?? operation.input.route;
  const results = [...new Set(approved)].map((machineCode) => {
    const machine = machines.find(({ code }) => code === machineCode);
    if (!machine) throw new AppError('A máquina ' + machineCode + ' não está cadastrada.', 422);
    const alternative = method ? calculateOperation({ ...operation.input, machineCode, route }, [machine], method.catalog) : onMachine(operation, machine);
    const difference = differenceDecimals(alternative.totalMinutes, operation.totalMinutes);
    const magnitude = divideDecimals(multiplyDecimals(difference.replace(/^-/, ''), '100'), operation.totalMinutes, 4);
    const reduction = difference.startsWith('-') || magnitude === '0' ? magnitude : '-' + magnitude;
    const excess = differenceDecimals(alternative.totalMinutes, target);
    return {
      machineCode, description: machine.description, minutes: alternative.totalMinutes,
      fixedMinutes: alternative.fixedMinutes, mtmMinutes: alternative.mtmMinutes, difference, reduction,
      reachesGoal: excess === '0' || excess.startsWith('-'),
    };
  });
  const manualMinutes = results[0]?.mtmMinutes ?? operation.mtmMinutes;
  const remaining = differenceDecimals(target, manualMinutes);
  const maximumFactor = remaining.startsWith('-') ? null : divideDecimals(remaining, operation.input.perimeter, 10);
  return { target, maximumFactor, manualMinutes, baseline: operation.totalMinutes, baselineManualMinutes: operation.mtmMinutes, route, results };
}

export function compareReferences(operation: ProcessOperation, machines: Machine[], catalog: MtmElement[], machineCode = operation.machine.code): string[] {
  const machine = machines.find(({ code }) => code === machineCode);
  const changes: string[] = [];
  if (!machine) changes.push('Máquina ' + machineCode + ' indisponível no cadastro.');
  else if (machine.code !== operation.machine.code || machine.version !== operation.machine.version) {
    changes.push('Máquina ' + operation.machine.code + ' v' + operation.machine.version + ' → ' + machine.code + ' v' + machine.version);
  }
  const current = new Map(catalog.map((item) => [item.code, item]));
  const seen = new Set<string>();
  for (const { element } of operation.items) {
    if (seen.has(element.code)) continue;
    seen.add(element.code);
    const next = current.get(element.code);
    if (!next) changes.push('MTM ' + element.code + ' indisponível no cadastro.');
    else if (element.version !== next.version) changes.push('MTM ' + element.code + ' v' + element.version + ' → v' + next.version);
  }
  return changes;
}

export function revise(repository: Repository, id: string, selection: RevisionSelection): RevisionPreview {
  const operation = repository.getOperation(id);
  requireCurrentOperation(operation);
  const machines = repository.catalog('machines');
  const catalog = repository.catalog('mtm');
  const { machineCode, route = operation.input.route } = selection;
  const changes = compareReferences(operation, machines, catalog, machineCode);
  if (route.length !== operation.input.route.length || route.some((code, index) => code !== operation.input.route[index])) {
    changes.push('Roteiro MTM alterado · ' + operation.input.route.length + ' → ' + route.length + ' ocorrências.');
  }
  if (!changes.length) throw new AppError('A ficha já usa as referências atuais.', 422);
  const previous = operation.input.revision ?? '';
  const revision = /^\d{1,29}$/.test(previous) ? String(BigInt(previous) + 1n).padStart(Math.max(previous.length, 2), '0') : '01';
  const preview = calculateOperation({
    ...operation.input, route, machineCode: machineCode ?? operation.machine.code, poCode: issuedLabel(operation), revision,
  }, machines, catalog);
  const difference = differenceDecimals(preview.totalMinutes, operation.totalMinutes);
  return { preview, changes, difference, token: fingerprint({ id, preview }) };
}

const normalized = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const stopWords = new Set(['a', 'o', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos']);
const comparable = (value: string) => normalized(value).split(' ').filter((word) => !stopWords.has(word)).join(' ');
const spokenCounts = new Map(Object.entries({ um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 }));

export function suggestSteps(text: string, catalog: MtmElement[], audioName?: string): SuggestedStep[] {
  const byCode = new Map(catalog.map(({ code }) => [code.toLowerCase(), code]));
  const pieces = text.trim().split(/\n+|[;→]+|[.!?](?=\s|$)/u).map((piece) => piece.trim()).filter(Boolean)
    .flatMap((piece) => {
      const codes = piece.split(/[\s,]+/).filter(Boolean);
      return codes.length > 1 && codes.every((code) => byCode.has(code.toLowerCase())) ? codes : [piece];
    });
  if (!pieces.length || pieces.length > 50 || pieces.some((piece) => piece.length > 1500)) {
    throw new AppError('Separe o relato em até 50 trechos com até 1.500 caracteres cada.', 422);
  }
  return pieces.map((piece) => {
    const quantity = /\s+(?:x\s*(\d+)|(\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\s+vez(?:es)?)$/iu.exec(piece);
    const countText = quantity?.[1] ?? quantity?.[2] ?? '1';
    const count = spokenCounts.get(normalized(countText)) ?? Number(countText);
    if (!Number.isInteger(count) || count < 1 || count > 250) throw new AppError('Informe de 1 a 250 ocorrências em cada trecho.', 422);
    const phrase = quantity ? piece.slice(0, quantity.index) : piece;
    const source = ' ' + comparable(phrase) + ' ';
    const explicit = [...new Set(phrase.toLowerCase().split(/[\s,:()[\]]+/u).flatMap((token) => byCode.get(token) ?? []))];
    const descriptions = catalog.filter(({ description }) => {
      const value = comparable(description);
      return value.length >= 4 && source.includes(' ' + value + ' ');
    }).map(({ code }) => code);
    const matches = explicit.length ? explicit : descriptions;
    const uncertain = /\b(?:nao|nunca|sem|talvez)\b/.test(normalized(phrase));
    return { text: piece, count, code: matches.length === 1 && !uncertain ? matches[0] ?? '' : '', matches, audioName };
  });
}

export async function transcribe(file: { data: Buffer; filename: string }, key: string, send: typeof fetch = fetch): Promise<string> {
  const extension = /\.([a-z0-9]+)$/i.exec(file.filename)?.[1]?.toLowerCase();
  if (!extension || !Object.hasOwn(audioFormats, extension) || !file.data.length) {
    throw new AppError('Selecione um áudio válido, como MP3, M4A, WAV ou WEBM.', 415);
  }
  const form = new FormData();
  form.set('model', 'gpt-transcribe');
  form.set('response_format', 'json');
  form.append('languages[]', 'pt');
  form.set('file', new Blob([Uint8Array.from(file.data)], { type: audioFormats[extension as keyof typeof audioFormats] }), 'operacao.' + extension);
  let result: Response;
  try {
    result = await send('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', body: form, headers: { Authorization: 'Bearer ' + key },
      redirect: 'error', signal: AbortSignal.timeout(90000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new AppError('A transcrição demorou demais. Tente um trecho mais curto ou revise por texto.', 504);
    throw new AppError('A transcrição não respondeu. Confira a conexão ou use a descrição por texto.', 502);
  }
  if (result.status === 401 || result.status === 403) throw new AppError('O serviço de transcrição recusou a credencial. Confira a chave configurada no servidor.', 503);
  if (result.status === 429) throw new AppError('O serviço de transcrição atingiu um limite de uso. Tente mais tarde ou revise por texto.', 503);
  if (result.status === 400 || result.status === 415 || result.status === 422) throw new AppError('O serviço não conseguiu ler esse áudio. Ouça o trecho e tente gravar novamente ou importar um WAV ou MP3.', 422);
  if (!result.ok) throw new AppError('O serviço de transcrição está indisponível. O trecho pode ser revisado por texto.', 502);
  const body = await result.json().catch(() => null) as { text?: unknown } | null;
  if (typeof body?.text !== 'string') throw new AppError('O serviço enviou uma resposta de transcrição inesperada. Tente novamente.', 502);
  if (!/[\p{L}\p{N}]/u.test(body.text)) throw new AppError('Nenhuma fala foi reconhecida. Ouça a gravação, confira o microfone e grave um trecho com voz ou descreva a operação em texto.', 422);
  return body.text.trim();
}

const columns = ['produto', 'perimetro', 'densidade', 'maquina', 'roteiro'];

export function readBatch(text: string, machines: Machine[], mtm: MtmElement[]) {
  let lines: string[][];
  try {
    lines = parse(text, { delimiter: ';', bom: true, trim: true, skip_empty_lines: true, max_record_size: 12000 });
  } catch {
    throw new AppError('O CSV não pôde ser lido. Use ponto e vírgula entre as colunas e confira as aspas.', 422);
  }
  const headers = lines.shift()?.map(normalized) ?? [];
  if (!columns.every((column) => headers.includes(column)) || new Set(headers).size !== headers.length) {
    throw new AppError('O cabeçalho deve conter produto;perimetro;densidade;maquina;roteiro. Confira as colunas duplicadas.', 422);
  }
  if (!lines.length || lines.length > 50) throw new AppError('Importe de 1 a 50 operações por lote.', 422);
  const rows: BatchPreview['rows'] = [];
  const issues: BatchPreview['issues'] = [];
  const previews: PoPreview[] = [];
  lines.forEach((row, index) => {
    const cell = (name: string) => row[headers.indexOf(name)] ?? '';
    const input: OperationInput = {
      productName: cell('produto'), perimeter: cell('perimetro'), density: cell('densidade'), machineCode: cell('maquina'),
      route: splitRoute(cell('roteiro')),
      poCode: cell('ficha') || undefined, operationName: cell('operacao') || undefined,
    };
    try {
      const preview = calculateOperation(input, machines, mtm);
      rows.push({ line: index + 2, input: preview.input, totalMinutes: preview.totalMinutes });
      previews.push(preview);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      issues.push({ line: index + 2, message: error.issues?.map(({ message }) => message).join(' ') || error.message });
    }
  });
  return { rows, issues, previews, token: fingerprint(previews) };
}
