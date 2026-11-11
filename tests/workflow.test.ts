// GitHub https://github.com/joaork

import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from '../src/server/app';
import type { ProcessOperation, Workspace } from '../src/shared/contracts';
import type { BatchPreview, PlanInput, PlanPreview, RevisionPreview, SavedPlan, Simulation, SuggestedStep } from '../src/shared/workflow';

type Server = ReturnType<typeof createServer>;
type RequestServer = Pick<Server, 'inject'>;
let app: Server | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const draft = {
  productName: 'Amostra', poCode: 'PO-TESTE', revision: '00', perimeter: '10', density: '2,5',
  machineCode: 'DEMO-M01', route: ['DEMO-01', 'DEMO-02', 'DEMO-02'],
};

async function seeded(options?: Pick<Parameters<typeof createServer>[0], 'transcriptionKey' | 'audioFetch'>) {
  app = createServer({ dbPath: ':memory:', ...options });
  await app.inject({ method: 'POST', url: '/api/demo' });
  return app;
}

function post(server: RequestServer, url: string, payload: object) {
  return server.inject({ method: 'POST', url, payload });
}

async function audioRequest(server: RequestServer, url: string, consent = true) {
  const form = new FormData();
  if (consent) form.set('consent', 'openai');
  form.set('file', new Blob(['bytes simulados']), 'teste.wav');
  const multipart = new Request('http://localhost', { method: 'POST', body: form });
  return server.inject({ method: 'POST', url, headers: { 'content-type': multipart.headers.get('content-type') ?? '' },
    payload: Buffer.from(await multipart.arrayBuffer()) });
}

async function issue(server: RequestServer): Promise<ProcessOperation> {
  const result = await post(server, '/api/operations', draft);
  expect(result.statusCode).toBe(201);
  return result.json<ProcessOperation>();
}

it('OFÍCIO mantém ordem, repetição e trecho revisado, deixando descrições incertas pendentes', async () => {
  const server = await seeded();
  const result = await post(server, '/api/capture/suggest', { text: 'DEMO-01; DEMO-02 x2; Uma ação sem correspondência' });
  expect(result.statusCode).toBe(200);
  const [first, second, unknown] = result.json<SuggestedStep[]>();
  expect(first).toMatchObject({ code: 'DEMO-01', count: 1 });
  expect(second).toMatchObject({ code: 'DEMO-02', count: 2, text: 'DEMO-02 x2' });
  expect(unknown).toMatchObject({ code: '', matches: [] });

  const saved = await post(server, '/api/operations', { ...draft, capture: { steps: [first, second] } });
  expect(saved.statusCode).toBe(201);
  expect(saved.json()).toMatchObject({ totalMinutes: '1.28', input: { route: draft.route, capture: { steps: [
    { code: 'DEMO-01', text: 'DEMO-01', count: 1 }, { code: 'DEMO-02', text: 'DEMO-02 x2', count: 2 },
  ] } } });
});

it('OFÍCIO exige confirmação por arquivo e interpreta a resposta de áudio sem enviar dados reais no teste', async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: 'DEMO-02 x2' }));
  const server = await seeded({ transcriptionKey: 'fixture-key', audioFetch: send });
  expect((await audioRequest(server, '/api/capture/transcribe', false)).statusCode).toBe(422);
  expect(send).not.toHaveBeenCalled();
  const result = await audioRequest(server, '/api/capture/audio');
  expect(result.statusCode).toBe(200);
  expect(result.json()).toMatchObject([{ code: 'DEMO-02', count: 2, audioName: 'teste.wav' }]);
  expect(send).toHaveBeenCalledWith('https://api.openai.com/v1/audio/transcriptions', expect.objectContaining({ method: 'POST' }));
  const form = send.mock.calls[0]?.[1]?.body as FormData;
  expect(form.get('response_format')).toBe('json');
  expect(form.getAll('languages[]')).toEqual(['pt']);
  expect(form.get('file')).toMatchObject({ type: 'audio/wav', name: 'operacao.wav' });
});

it('OFÍCIO devolve o texto editável antes do mapeamento e entende artigos e repetições faladas', async () => {
  const audio = 'Pegar a peça da mesa duas vezes. Não executar DEMO-02.';
  const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: audio }));
  const server = await seeded({ transcriptionKey: 'fixture-key', audioFetch: send });
  await server.inject({ method: 'PUT', url: '/api/mtm', payload: { code: 'QA-1', description: 'Pegar peça da mesa', minutes: '0.12' } });
  const transcript = await audioRequest(server, '/api/capture/transcribe');
  expect(transcript.statusCode).toBe(200);
  expect(transcript.json()).toEqual({ text: audio, audioName: 'teste.wav' });
  const steps = await post(server, '/api/capture/suggest', { text: audio });
  expect(steps.json()).toMatchObject([{ code: 'QA-1', count: 2 }, { code: '', matches: ['DEMO-02'] }]);
});

it.each([
  [{ text: '  … ' }, 200, 422, 'Nenhuma fala foi reconhecida'],
  [{ unexpected: true }, 200, 502, 'resposta de transcrição inesperada'],
  [{}, 401, 503, 'recusou a credencial'],
  [{}, 429, 503, 'limite de uso'],
] as const)('OFÍCIO distingue resposta vazia, formato e disponibilidade (%j)', async (body, providerStatus, status, message) => {
  const server = await seeded({ transcriptionKey: 'fixture-key', audioFetch: vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status: providerStatus })) });
  const response = await audioRequest(server, '/api/capture/transcribe');
  expect(response.statusCode).toBe(status);
  expect(response.json().error.message).toContain(message);
});

it('TRAMA compara a máquina com os tempos da ficha e separa meta de mudança persistida', async () => {
  const server = await seeded();
  const operation = await issue(server);
  const result = await post(server, '/api/operations/' + operation.id + '/simulate', { goal: '10', machineCodes: ['DEMO-M02'] });
  expect(result.statusCode).toBe(200);
  expect(result.json<Simulation>()).toMatchObject({
    baseline: '1.28', target: '1.152', maximumFactor: '0.0872', manualMinutes: '0.28',
    results: [{ minutes: '1.13', difference: '-0.15', reachesGoal: true }],
  });
  const impossible = await post(server, '/api/operations/' + operation.id + '/simulate', { goal: '90', machineCodes: ['DEMO-M02'] });
  expect(impossible.json()).toMatchObject({ maximumFactor: null, results: [{ reachesGoal: false }] });
  expect((await server.inject('/api/workspace')).json<Workspace>().operations).toEqual([operation]);
});

it('LASTRO detecta impacto, rejeita uma prévia vencida e emite uma revisão que preserva a anterior', async () => {
  const server = await seeded();
  const operation = await issue(server);
  const path = '/api/operations/' + operation.id + '/revision';
  async function updateFactor(factor: string, expectedVersion: number) {
    const result = await server.inject({ method: 'PUT', url: '/api/machines', payload: {
      code: 'DEMO-M01', description: 'Máquina de teste', rpm: '4500', factor, expectedVersion,
    } });
    expect(result.statusCode).toBe(200);
  }
  await updateFactor('0.2', 1);
  expect((await server.inject('/api/revisions/impact')).json()).toMatchObject([{ id: operation.id, before: '1.28', after: '2.28' }]);
  const previous = (await post(server, path + '/preview', {})).json<RevisionPreview>();
  await updateFactor('0.3', 2);
  expect((await post(server, path, { token: previous.token })).statusCode).toBe(409);
  const preview = (await post(server, path + '/preview', {})).json<RevisionPreview>();
  const saved = await post(server, path, { token: preview.token });
  expect(saved.statusCode).toBe(201);
  const revision = saved.json<ProcessOperation>();
  expect(revision).toMatchObject({ previousId: operation.id, totalMinutes: '3.28', input: { poCode: 'PO-TESTE', revision: '01' } });
  const records = (await server.inject('/api/workspace')).json<Workspace>().operations;
  expect(records.find(({ id }) => id === operation.id)).toEqual({ ...operation, supersededBy: revision.id });
  expect((await post(server, path, { token: preview.token })).statusCode).toBe(409);
});

it('LASTRO valida todas as linhas antes de emitir o lote em uma transação', async () => {
  const server = await seeded();
  const heading = 'produto;perimetro;densidade;maquina;roteiro';
  const valid = 'Primeira;10;2,5;DEMO-M01;DEMO-02,DEMO-02';
  const invalidText = [heading, valid, 'Segunda;2;2;DEMO-M01;X'].join('\n');
  const invalid = (await post(server, '/api/operations/batch/preview', { text: invalidText })).json<BatchPreview>();
  expect(invalid.issues).toMatchObject([{ line: 3 }]);
  expect((await post(server, '/api/operations/batch', { text: invalidText, token: invalid.token })).statusCode).toBe(422);
  expect((await server.inject('/api/workspace')).json<Workspace>().operations).toHaveLength(0);

  const text = [heading, valid, 'Segunda;2;2;DEMO-M02;DEMO-01'].join('\n');
  const preview = (await post(server, '/api/operations/batch/preview', { text })).json<BatchPreview>();
  const saved = await post(server, '/api/operations/batch', { text, token: preview.token });
  expect(saved.statusCode).toBe(201);
  expect(saved.json()).toMatchObject([{ totalMinutes: '1.16' }, { totalMinutes: '0.29' }]);
});

it('carrega o roteiro aprovado de TRAMA para LASTRO e atualiza só o pedido pendente de REVEZA', async () => {
  const server = await seeded();
  const original = await issue(server);
  const input: PlanInput = {
    name: 'Turno com revisão', start: '08:00', end: '12:00', from: '08:00',
    teams: [{ id: 'a', name: 'Equipe A', machineCodes: ['DEMO-M01', 'DEMO-M02'] }],
    jobs: [
      { id: 'a', name: 'Lote iniciado', poId: original.id, quantity: 20, setup: 0, deadline: '09:00', machineCodes: ['DEMO-M01'] },
      { id: 'b', name: 'Lote pendente', poId: original.id, quantity: 10, setup: 0, deadline: '10:00', machineCodes: ['DEMO-M01'] },
    ],
    blocks: [], locked: [],
  };
  const first = (await post(server, '/api/plans/preview', input)).json<PlanPreview>();
  const savedPlan = (await post(server, '/api/plans', { input: first.input, token: first.token })).json<SavedPlan>();
  const scenario = { route: ['DEMO-02'], machineCode: 'DEMO-M02' };
  const simulation = (await post(server, `/api/operations/${original.id}/simulate`, { goal: '20', machineCodes: [scenario.machineCode], route: scenario.route })).json<Simulation>();
  expect(simulation).toMatchObject({ route: scenario.route, baseline: '1.28', manualMinutes: '0.08', results: [{ minutes: '0.93', reachesGoal: true }] });
  const revisionPath = `/api/operations/${original.id}/revision`;
  const revisionPreview = (await post(server, revisionPath + '/preview', scenario)).json<RevisionPreview>();
  expect(revisionPreview.preview.totalMinutes).toBe(simulation.results[0]?.minutes);
  const revised = (await post(server, revisionPath, { ...scenario, token: revisionPreview.token })).json<ProcessOperation>();
  expect(revised).toMatchObject({ previousId: original.id, input: { route: scenario.route } });
  const replan = { ...input, previousId: savedPlan.id, from: '08:05', jobs: [input.jobs[0]!, { ...input.jobs[1]!, poId: revised.id, machineCodes: [scenario.machineCode] }] };
  expect((await post(server, '/api/plans/preview', { ...replan, jobs: replan.jobs.slice(1) })).statusCode).toBe(409);
  const next = (await post(server, '/api/plans/preview', replan)).json<PlanPreview>();
  expect(next.input.locked).toEqual(['a']);
  expect(next.assignments).toMatchObject([
    { jobId: 'a', locked: true, poId: original.id, start: 480, end: 506 },
    { jobId: 'b', locked: false, poId: revised.id, start: 506, end: 516, unitMinutes: '0.93' },
  ]);
  expect((await post(server, '/api/plans', { input: next.input, token: next.token })).statusCode).toBe(201);
});

it('REVEZA evita sobreposição de recursos, congela o lote iniciado e realoca a ordem afetada', async () => {
  const server = await seeded();
  const operation = await issue(server);
  const input: PlanInput = {
    name: 'Turno de teste', start: '08:00', end: '12:00', from: '08:00',
    teams: [{ id: 'a', name: 'Equipe A', machineCodes: ['DEMO-M01', 'DEMO-M02'] }, { id: 'b', name: 'Equipe B', machineCodes: ['DEMO-M02'] }],
    jobs: [
      { id: '1', name: 'Lote A', poId: operation.id, quantity: 20, setup: 0, deadline: '09:00', machineCodes: ['DEMO-M01'] },
      { id: '2', name: 'Lote B', poId: operation.id, quantity: 20, setup: 0, deadline: '10:00', machineCodes: ['DEMO-M02'] },
    ],
    blocks: [], locked: [],
  };
  const before = await post(server, '/api/plans/preview', input);
  expect(before.statusCode).toBe(200);
  const preview = before.json<PlanPreview>();
  expect(preview.assignments).toMatchObject([
    { jobId: '1', machineCode: 'DEMO-M01', teamId: 'a', start: 480, end: 506 },
    { jobId: '2', machineCode: 'DEMO-M02', teamId: 'b', start: 480, end: 503 },
  ]);
  const saved = await post(server, '/api/plans', { input, token: preview.token });
  expect(saved.statusCode).toBe(201);
  const plan = saved.json<SavedPlan>();
  expect((await server.inject('/api/plans')).json()).toMatchObject([{ id: plan.id }]);

  const changed = await post(server, '/api/plans/preview', {
    ...input, previousId: plan.id, locked: ['2'],
    jobs: input.jobs.map((job) => job.id === '1' ? { ...job, machineCodes: ['DEMO-M01', 'DEMO-M02'] } : job),
    blocks: [{ kind: 'machine', resource: 'DEMO-M01', start: '08:00', end: '12:00' }],
  });
  expect(changed.statusCode).toBe(200);
  expect(changed.json()).toMatchObject({
    changed: 1, unassigned: [], assignments: [
      { jobId: '2', machineCode: 'DEMO-M02', teamId: 'b', start: 480, end: 503, locked: true },
      { jobId: '1', machineCode: 'DEMO-M02', start: 503, end: 526, late: 0 },
    ],
  });
});
