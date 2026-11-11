// GitHub https://github.com/joaork

import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { suggestMapping } from '../src/shared/contracts';
import type { CatalogKind, ImportSelection } from '../src/shared/contracts';
import { Imports } from '../src/server/imports';
import { Repository } from '../src/server/repository';

let repository: Repository;
let imports: Imports;

beforeEach(() => {
  repository = new Repository(':memory:');
  imports = new Imports(repository);
});
afterEach(() => repository.close());

function inspectCsv(csv: string, kind: CatalogKind = 'mtm'): ImportSelection {
  const inspection = imports.inspect('teste.csv', kind, Buffer.from(csv, 'utf8'));
  return { id: inspection.id, sheet: 'CSV', headerRow: 1, mapping: suggestMapping(inspection.sheets[0]?.rows[0] ?? [], kind) };
}

describe('importação de cadastros', () => {
  it('mapeia colunas reordenadas e mantém ponto e zeros à esquerda nos códigos', () => {
    const selection = inspectCsv('Tempo unitário (min);Descrição;Código MTM\n0,12;"Etapa; teste";01.01\n');
    expect(selection.mapping).toEqual({ code: 2, description: 1, minutes: 0 });
    expect(imports.preview(selection)).toMatchObject({ valid: true, totalRows: 1 });
    expect(imports.confirm(selection).count).toBe(1);
    expect(repository.catalog('mtm')[0]).toMatchObject({ code: '01.01', description: 'Etapa; teste', minutes: '0.12', origin: 'imported' });
  });

  it('identifica coluna obrigatória ausente', () => {
    const selection = inspectCsv('Descrição;Código MTM\nEtapa;1.1');
    expect(imports.preview(selection)).toMatchObject({ valid: false, issues: [expect.objectContaining({ field: 'minutes', line: 1 })] });
  });

  it('aponta linha inválida e impede salvar lote parcialmente', () => {
    const selection = inspectCsv('Código;Descrição;Tempo\n1.1;Etapa válida;0,12\n2.1;Etapa inválida;-0,25');
    expect(imports.preview(selection)).toMatchObject({ valid: false, issues: [expect.objectContaining({ field: 'minutes', line: 3 })] });
    expect(() => imports.confirm(selection)).toThrow('Valide a prévia');
    expect(repository.catalog('mtm')).toEqual([]);
  });

  it('bloqueia duplicidade no arquivo e colisões com o cadastro', () => {
    const selection = inspectCsv('Código;Descrição;Tempo\n1.1;Etapa;0,12\n1.1;Etapa repetida;0,25');
    expect(imports.preview(selection).issues[0]?.message).toContain('repetido no arquivo');
    repository.writeReference('mtm', { code: '1.1', description: 'Etapa já existente', minutes: '0.2' });
    expect(imports.preview(selection).issues[0]?.message).toContain('já cadastrado');
  });

  it('revalida conflitos após prévia sem salvar as demais linhas', () => {
    const selection = inspectCsv('Código;Descrição;Tempo\n1.1;Etapa;0,12\n2.1;Outra etapa;0,25');
    expect(imports.preview(selection).valid).toBe(true);
    repository.writeReference('mtm', { code: '2.1', description: 'Etapa criada durante a prévia', minutes: '0.2' });
    expect(() => imports.confirm(selection)).toThrow('A importação contém pendências.');
    expect(repository.catalog('mtm').map(({ code }) => code)).toEqual(['2.1']);
  });

  it('lê XLSX por aba e cabeçalho, com valor bruto de RPM e código formatado', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Ignorar');
    const sheet = workbook.addWorksheet('Máquinas');
    sheet.addRows([['Catálogo técnico'], ['RPM', 'Fator', 'Código', 'Descrição'], [5000, 0.09, 3, 'Reta de teste']]);
    sheet.getCell('A3').numFmt = '#,##0';
    sheet.getCell('C3').numFmt = '000';
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    const inspection = imports.inspect('teste.xlsx', 'machines', file);
    const header = inspection.sheets[1]?.rows[1] ?? [];
    const selection = { id: inspection.id, sheet: 'Máquinas', headerRow: 2, mapping: suggestMapping(header, 'machines') };
    expect(imports.preview(selection)).toMatchObject({ valid: true, rows: [{ line: 3, values: { rpm: '5000', factor: '0.09', code: '003' } }] });
    imports.confirm(selection);
    expect(repository.catalog('machines')[0]?.code).toBe('003');
  });

  it('rejeita fórmula de planilha sem resultado salvo', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('MTM');
    sheet.addRows([['Código', 'Descrição', 'Tempo'], ['1.0', 'Etapa']]);
    sheet.getCell('C2').value = { formula: '1/3' };
    const inspection = imports.inspect('teste.xlsx', 'mtm', Buffer.from(await workbook.xlsx.writeBuffer()));
    const preview = imports.preview({ id: inspection.id, sheet: 'MTM', headerRow: 1, mapping: { code: 0, description: 1, minutes: 2 } });
    expect(preview.valid).toBe(false);
    expect(preview.issues).toContainEqual(expect.objectContaining({ message: expect.stringContaining('sem resultado salvo') }));
  });

  it('preserva números de planilha pequenos e rejeita precisão além do limite', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('MTM');
    sheet.addRows([['Código', 'Descrição', 'Tempo'], ['T1', 'Valor válido', 1e-18], ['T2', 'Além do limite', 1e-19]]);
    const inspection = imports.inspect('teste.xlsx', 'mtm', Buffer.from(await workbook.xlsx.writeBuffer()));
    const preview = imports.preview({ id: inspection.id, sheet: 'MTM', headerRow: 1, mapping: { code: 0, description: 1, minutes: 2 } });
    expect(preview.rows[0]?.values.minutes).toBe('0.000000000000000001');
    expect(preview).toMatchObject({ valid: false, issues: [expect.objectContaining({ line: 3, field: 'minutes' })] });
  });
});
