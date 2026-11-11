// GitHub https://github.com/joaork

import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it } from 'vitest';
import type { ImportInspection, ProcessOperation, Workspace } from '../src/shared/contracts';
import { createServer } from '../src/server/app';

let app: ReturnType<typeof createServer> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

async function upload(kind: 'mtm' | 'machines' | undefined, filename: string, data: string) {
  const body = new FormData();
  if (kind) body.set('kind', kind);
  body.set('file', new Blob([data]), filename);
  const request = new Request('http://localhost', { method: 'POST', body });
  return {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
    payload: Buffer.from(await request.arrayBuffer()),
  };
}

describe('API local', () => {
  it('abre vazia e carrega a demonstração de forma idempotente', async () => {
    app = createServer({ dbPath: ':memory:' });
    expect((await app.inject('/api/workspace')).json()).toEqual({ machines: [], mtm: [], operations: [] });
    const first = (await app.inject({ method: 'POST', url: '/api/demo' })).json<Workspace>();
    const second = (await app.inject({ method: 'POST', url: '/api/demo' })).json<Workspace>();
    expect(first).toEqual(second);
    expect(first.machines).toHaveLength(2);
    expect(first.mtm).toHaveLength(3);
    expect([...first.machines, ...first.mtm].every(({ code, origin }) => code.startsWith('DEMO-') && origin === 'demo')).toBe(true);
  });

  it('recebe CSV em multipart, valida e confirma, com origem e metadados do lote', async () => {
    app = createServer({ dbPath: ':memory:' });
    const received = await app.inject({
      method: 'POST', url: '/api/imports/inspect',
      ...await upload('mtm', 'base-teste.csv', 'Código;Descrição;Tempo\n0.01;Primeira etapa;0,125'),
    });
    expect(received.statusCode).toBe(200);
    const { id } = received.json<ImportInspection>();
    const selection = { id, sheet: 'CSV', headerRow: 1, mapping: { code: 0, description: 1, minutes: 2 } };
    const preview = await app.inject({ method: 'POST', url: '/api/imports/preview', payload: selection });
    expect(preview.json()).toMatchObject({ valid: true, totalRows: 1 });
    const saved = await app.inject({ method: 'POST', url: '/api/imports/confirm', payload: selection });
    expect(saved.statusCode).toBe(201);
    const { batchId } = saved.json<{ batchId: string }>();
    expect((await app.inject('/api/workspace')).json<Workspace>().mtm).toMatchObject([
      { code: '0.01', minutes: '0.125', origin: 'imported', source: { batchId, filename: 'base-teste.csv', sheet: 'CSV', line: 2 } },
    ]);
  });

  it('interpreta TXT preservando identificadores, roteiro, medidas e perímetro fornecido', async () => {
    app = createServer({ dbPath: ':memory:' });
    const received = await app.inject({
      method: 'POST', url: '/api/demands/parse', ...await upload(undefined, 'teste.txt',
        'Título: PO-TESTE\nREV: 00\nOperação: "Costurar amostra"\nAgrupamento família: Peça de teste\nTamanho: M\nMedidas da peça (em m): 1,50 x 2,30\nPontos/cm: 2,50\nPerímetro costura (em m): 7,20\nCód. Eqp: 003\nElementos: 2.1, 1.1, 2.1'),
    });
    expect(received.statusCode).toBe(200);
    expect(received.json()).toMatchObject({
      poCode: 'PO-TESTE', revision: '00', productName: 'Peça de teste', operationName: 'Costurar amostra',
      machineCode: '003', route: ['2.1', '1.1', '2.1'], perimeter: '7.2', density: '2.5', dimensions: '1,50 x 2,30',
    });
  });

  it('preserva snapshot no disco e exporta XLSX completo depois de alterar a base e reiniciar', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tessaro-test-'));
    const dbPath = join(directory, 'test.sqlite');
    try {
      app = createServer({ dbPath });
      await app.inject({ method: 'POST', url: '/api/demo' });
      const input = { productName: 'Peça de demonstração', perimeter: '6.2', density: '2.5', machineCode: 'DEMO-M01', route: ['DEMO-02', 'DEMO-01', 'DEMO-02'] };
      const preview = await app.inject({ method: 'POST', url: '/api/operations/preview', payload: input });
      expect(preview.statusCode).toBe(200);
      expect((await app.inject('/api/workspace')).json<Workspace>().operations).toHaveLength(0);
      const saved = await app.inject({ method: 'POST', url: '/api/operations', payload: input });
      expect(saved.statusCode).toBe(201);
      const operation = saved.json<ProcessOperation>();
      expect(operation).toMatchObject({ fixedMinutes: '0.62', mtmMinutes: '0.28', totalMinutes: '0.9', demonstrative: true });

      const change = await app.inject({ method: 'PUT', url: '/api/machines', payload: {
        code: 'DEMO-M01', description: 'Máquina alterada', rpm: '5000', factor: '0.2', expectedVersion: 1,
      } });
      expect(change.statusCode).toBe(200);
      const outdated = await app.inject({ method: 'POST', url: '/api/operations', payload: { ...input, token: preview.json().token } });
      expect(outdated.statusCode).toBe(409);
      expect((await app.inject('/api/workspace')).json<Workspace>().operations).toHaveLength(1);
      const changed = await app.inject({ method: 'POST', url: '/api/operations/preview', payload: input });
      expect(changed.json()).toMatchObject({ fixedMinutes: '1.24', totalMinutes: '1.52' });
      await app.close();
      app = createServer({ dbPath });
      const workspace = (await app.inject('/api/workspace')).json<Workspace>();
      expect(workspace.machines[0]).toMatchObject({ version: 2, factor: '0.2' });
      expect(workspace.operations[0]).toEqual(operation);

      const download = await app.inject(`/api/operations/${operation.id}.xlsx`);
      expect(download.statusCode).toBe(200);
      expect(download.headers['content-disposition']).toBe('attachment; filename="PO-0001.xlsx"');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Uint8Array.from(download.rawPayload).buffer);
      const po = workbook.getWorksheet('PO');
      expect(['A8', 'A9', 'A10', 'A11'].map((address) => po?.getCell(address).value)).toEqual(['FIXO', ...input.route]);
      expect(['E8', 'E9', 'E10', 'E11', 'E12'].map((address) => po?.getCell(address).value)).toEqual([0.62, 0.08, 0.12, 0.08, 0.9]);
      expect(po?.getCell('A13').value).toContain('Dados demonstrativos');
      const memory = workbook.getWorksheet('Memória');
      expect(memory?.getCell('B11').value).toBe('0.62');
      expect(memory?.getCell('B16').value).toBe('0.9');
    } finally {
      await app?.close();
      app = undefined;
      for (const suffix of ['', '-shm', '-wal']) await rm(`${dbPath}${suffix}`, { force: true });
      await rmdir(directory);
    }
  });

  it('protege edição contra revisão desatualizada e sobrescrita por cadastro novo', async () => {
    app = createServer({ dbPath: ':memory:' });
    const url = '/api/mtm';
    const payload = { code: '09.1', description: 'Elemento de teste', minutes: '0' };
    expect((await app.inject({ method: 'PUT', url, payload })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url, payload })).statusCode).toBe(409);
    expect((await app.inject({ method: 'PUT', url, payload: { ...payload, expectedVersion: 1, minutes: '0.1' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url, payload: { ...payload, expectedVersion: 1, minutes: '0.2' } })).statusCode).toBe(409);
    expect((await app.inject('/api/workspace')).json<Workspace>().mtm[0]).toMatchObject({ version: 2, minutes: '0.1' });
  });
});
