// GitHub https://github.com/joaork

import ExcelJS from 'exceljs';
import type { CatalogKind, ProcessOperation } from '../shared/contracts';
import { formatDecimal } from '../shared/decimal';
import { captureMatchesRoute } from '../shared/workflow';
import { demoMachines, demoMtm } from './demo';

const grey = 'FFD9D9D9';
const yellow = 'FFFFFF00';
const ink = 'FF1C1C1C';
const border: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: ink } };

function numericCell(value: string, separator = ','): number | string {
  const digits = value.replace('.', '').replace(/^0+|0+$/g, '');
  return digits.length <= 15 ? Number(value) : value.replace('.', separator);
}

function displayMinutes(value: string): number | string {
  return numericCell(formatDecimal(value, 4, '.'));
}

function paint(cell: ExcelJS.Cell, fill?: string, bold = false): void {
  cell.font = { name: 'Arial', size: 10, bold, color: { argb: ink } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = { top: border, right: border, bottom: border, left: border };
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

export async function exportOperation(operation: ProcessOperation): Promise<Buffer> {
  const { input, machine, items } = operation;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tessaro Soluções';
  workbook.created = new Date(operation.createdAt);
  const sheet = workbook.addWorksheet('PO', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 21 }, { width: 26 }, { width: 20 }, { width: 17 }, { width: 22 }];

  const poCode = input.poCode || `PO-${String(operation.number).padStart(4, '0')}`;
  const revision = input.revision || '00';
  const rows: ExcelJS.CellValue[][] = [
    [poCode, '', '', '', `Rev. ${revision}`],
    ['Operação', input.operationName || input.productName],
    ['Agrupamento família', 'Tamanho', 'Medidas da peça (em m)', 'Pontos/cm', 'Perímetro costura (em m)'],
    [input.productName, input.size || '—', input.dimensions || '—', numericCell(input.density), numericCell(input.perimeter)],
    ['Cód. Eqp.', 'Equipamento', 'RPM - limite inferior', 'RPM - padrão', 'RPM - limite superior'],
    [machine.code, machine.machineType || machine.description, numericCell(operation.rpmLower), numericCell(machine.rpm), numericCell(operation.rpmUpper)],
    ['Código do elemento', 'Elementos', '', 'Frequência', 'Tempos (em minutos)'],
    ['FIXO', 'Tempo de costura', '', 1, displayMinutes(operation.fixedMinutes)],
    ...items.map(({ element }) => [element.code, element.description, '', 1, displayMinutes(element.minutes)]),
    ['Tempo Total da Operação (TP)', '', '', '', displayMinutes(operation.totalMinutes)],
  ];
  sheet.addRows(rows);
  sheet.mergeCells('A1:D1');
  sheet.mergeCells('B2:E2');
  for (let index = 7; index < rows.length; index += 1) sheet.mergeCells(`B${index}:C${index}`);
  sheet.mergeCells(`A${rows.length}:D${rows.length}`);

  for (let index = 1; index <= rows.length; index += 1) {
    const row = sheet.getRow(index);
    const header = [1, 3, 5, 7, rows.length].includes(index);
    const fill = index === 8 ? yellow : header ? grey : undefined;
    row.height = index === 1 ? 30 : header ? 30 : 28;
    for (let column = 1; column <= 5; column += 1) paint(row.getCell(column), fill, header || index === 8);
    if (index >= 8) row.getCell(5).numFmt = '0.0000';
    if (index === 4) {
      row.getCell(4).numFmt = '0.00################';
      row.getCell(5).numFmt = '0.00################';
    }
    if (index >= 9 && index < rows.length) {
      const description = items[index - 9]?.element.description ?? '';
      row.height = Math.max(row.height, Math.ceil(description.length / 46) * 15 + 7);
      row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    }
  }
  sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: ink } };

  const footer = [
    ...(operation.demonstrative ? ['Dados demonstrativos — substituir pelo kit oficial.'] : []),
    `Modelo ${machine.description}  |  Fator ${machine.factor.replace('.', ',')} min/m`,
    'Tempos exibidos com 4 casas decimais. O TP soma os valores exatos da aba Memória.',
    'Tessaro T&M — uma solução Tessaro Soluções',
  ];
  for (const note of footer) {
    const { number } = sheet.addRow([note]);
    sheet.mergeCells(number, 1, number, 5);
    sheet.getCell(number, 1).font = { name: 'Arial', size: 9, bold: note.startsWith('Dados demonstrativos') };
    sheet.getCell(number, 1).alignment = { wrapText: true, vertical: 'middle' };
    sheet.getRow(number).height = 21;
  }
  sheet.pageSetup.printArea = `A1:E${sheet.rowCount}`;

  const memory = workbook.addWorksheet('Memória', { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
  memory.columns = [{ width: 26 }, { width: 48 }, { width: 55 }, { width: 19 }, { width: 65 }];
  memory.addRows([
    ['Parcela / referência', 'Valor exato', 'Regra / descrição', 'Versão / unidade', 'Origem'],
    ['Ficha', poCode, operation.id, revision, operation.createdAt],
    ['Produto', input.productName, input.operationName || '', '', operation.demonstrative ? 'Dados demonstrativos — substituir pelo kit oficial' : 'Cadastro local'],
    ['Perímetro', input.perimeter, 'Informado na demanda', 'm'],
    ['Densidade', input.density, 'Parâmetro de identificação', 'pontos/cm'],
    ['Máquina', machine.code, machine.description, String(machine.version), sourceText(machine)],
    ['RPM padrão', machine.rpm, 'Parâmetro de identificação', 'RPM'],
    ['RPM inferior', operation.rpmLower, 'RPM padrão × 0,9 (modelo de PO)', 'RPM'],
    ['RPM superior', operation.rpmUpper, 'RPM padrão × 1,1 (modelo de PO)', 'RPM'],
    ['Fator', machine.factor, 'Fator do cadastro da máquina', 'min/m'],
    ['FIXO', operation.fixedMinutes, `${input.perimeter} × ${machine.factor}`, 'min'],
    ...items.map(({ position, element }) => [`${position}. ${element.code}`, element.minutes, element.description, `v${element.version} · min`, sourceText(element)]),
    ['Soma MTM', operation.mtmMinutes, 'Soma das ocorrências do roteiro', 'min'],
    ['TP', operation.totalMinutes, `${operation.fixedMinutes} + ${operation.mtmMinutes}`, 'min'],
    ['Versão do cálculo', operation.formulaVersion, 'Valores exatos gravados em texto'],
    ['Responsável', input.author || '—'],
    ['Observações', input.notes || '—'],
  ]);
  if (operation.previousId) memory.addRow(['Revisão anterior', operation.previousId]);
  if (input.capture) {
    memory.addRow(['Origem do roteiro', 'OFÍCIO', captureMatchesRoute(input.capture, input.route)
      ? 'Trechos conferidos ao preparar a operação' : 'Trechos do roteiro de origem. A aba PO mostra a sequência final emitida.']);
    for (const step of input.capture.steps) memory.addRow([step.code, String(step.count), step.text, 'ocorrências', step.audioName || 'Texto']);
  }
  memory.getRow(1).eachCell((cell) => paint(cell, grey, true));
  memory.getRow(1).height = 24;
  memory.getColumn(2).numFmt = '@';
  memory.getColumn(5).alignment = { wrapText: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function sourceText(entry: ProcessOperation['machine'] | ProcessOperation['items'][number]['element']): string {
  if (!entry.source) return entry.origin === 'demo' ? 'Demonstração' : 'Cadastro manual';
  const { filename, sheet, line, batchId } = entry.source;
  return `${entry.origin === 'demo' ? 'Demonstração · ' : ''}${filename} · ${sheet} · linha ${line} · lote ${batchId}`;
}

export async function exportCatalogTemplate(kind: CatalogKind, format: 'csv' | 'xlsx', demonstrative: boolean): Promise<Buffer> {
  const columns = kind === 'machines'
    ? ['Código de máquina', 'Tipo Máquina', 'Descrição', 'RPM padrão', 'Fator de tempo por metro (min/m)']
    : ['Código MTM', 'Descrição do elemento', 'Tempo unitário (min)'];
  const data = !demonstrative ? [] : kind === 'machines'
    ? demoMachines.map(({ code, machineType, description, rpm, factor }) => [code, machineType, description, rpm, factor])
    : demoMtm.map(({ code, description, minutes }) => [code, description, minutes]);
  const rows = [columns, ...data];
  if (format === 'csv') {
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    return Buffer.from(`\ufeff${csv}\r\n`, 'utf8');
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind === 'machines' ? 'Máquinas' : 'Elementos MTM');
  sheet.columns = columns.map((heading) => ({ width: Math.max(20, heading.length + 3) }));
  sheet.addRows(rows);
  sheet.getRow(1).eachCell((cell) => paint(cell, grey, true));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
