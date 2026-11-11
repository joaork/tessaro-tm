import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { read } from 'xlsx';
import type { CatalogKind } from '../src/shared/contracts';
import { suggestMapping } from '../src/shared/contracts';
import { calculateOperation } from '../src/server/calculation';
import { parseDemand } from '../src/server/demand';
import { exportOperation } from '../src/server/export';
import { Imports } from '../src/server/imports';
import { Repository } from '../src/server/repository';

const directory = resolve(process.argv[2] ?? 'docs/referencias/kit-oficial');
const repository = new Repository(':memory:');

try {
  const [entries, demand, reference] = await Promise.all([
    readFile(resolve(directory, 'Entradas.ods')),
    readFile(resolve(directory, 'demanda_000.txt')),
    readFile(resolve(directory, 'PO-SL-000.ods')),
  ]);
  const imports = new Imports(repository);

  function importSheet(kind: CatalogKind, sheet: string, headerRow: number, count: number): void {
    const inspection = imports.inspect('Entradas.ods', kind, entries);
    const header = inspection.sheets.find(({ name }) => name === sheet)?.rows[headerRow - 1];
    assert(header, `Cabeçalho ausente em ${sheet}.`);
    const selection = { id: inspection.id, sheet, headerRow, mapping: suggestMapping(header, kind) };
    const preview = imports.preview(selection);
    assert(preview.valid, JSON.stringify(preview.issues));
    assert.equal(imports.confirm(selection).count, count);
    console.log(`${sheet}: ${count} registros importados e validados.`);
  }

  importSheet('mtm', 'MATRIZ_DE_ELEMENTOS', 1, 9);
  importSheet('machines', 'TEMPO-CM', 2, 3);

  const input = parseDemand(demand);
  const po = repository.insertOperation(calculateOperation(input, repository.catalog('machines'), repository.catalog('mtm')));
  assert.equal(po.fixedMinutes, '0.670944');
  assert.equal(po.mtmMinutes, '0.27');
  assert.equal(po.totalMinutes, '0.940944');
  assert.deepEqual(po.items.map(({ element }) => element.code), ['2.1', '1.1', '3.1']);
  assert.equal(po.items[1]?.element.minutes, '0');

  const expected = read(reference).Sheets.PO;
  assert(expected, 'Aba PO ausente no gabarito.');
  const normalize = (value: unknown) => String(value).replace(/\s+/g, ' ').trim();
  const fields = Object.entries(expected).filter(([address, cell]) => /^[A-E]\d+$/.test(address) && cell.v !== undefined);

  async function validateOutput(bytes: Uint8Array, label: string): Promise<void> {
    const output = new ExcelJS.Workbook();
    await output.xlsx.load(Uint8Array.from(bytes).buffer);
    const exported = output.getWorksheet('PO');
    assert(exported, 'Aba PO ausente.');
    for (const [address, cell] of fields) {
      assert.equal(normalize(exported.getCell(address).value), normalize(cell.v), `Divergência na célula ${address} de ${label}.`);
    }
    assert.equal(exported.getCell('E12').value, 0.9409);
    const memory = output.getWorksheet('Memória');
    assert(memory, 'Aba Memória ausente.');
    const exact = new Map<string, unknown>();
    memory.eachRow((row) => exact.set(String(row.getCell(1).value), row.getCell(2).value));
    assert.equal(exact.get('FIXO'), '0.670944');
    assert.equal(exact.get('Soma MTM'), '0.27');
    assert.equal(exact.get('TP'), '0.940944');
    console.log(`${label}: ${fields.length} células preenchidas conferidas com o gabarito, além de TP e Memória.`);
  }
  await validateOutput(await exportOperation(po), `PO ${input.poCode} gerada pelo ensaio`);
  if (process.argv[3]) {
    await validateOutput(await readFile(resolve(process.argv[3])), 'XLSX fornecido');
  }
  console.log('FIXO 0,670944 min (0,6709 na ficha); MTM 0,27 min; TP 0,940944 min (0,9409 na ficha).');
  console.log('TP incluído conforme o regulamento. Aba Memória conferida com os decimais exatos.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error(`Arquivo não encontrado: ${(error as NodeJS.ErrnoException).path ?? directory}. Informe a pasta do kit e, se desejar, um XLSX existente.`);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  repository.close();
}
