// GitHub https://github.com/joaork

import { extname } from 'node:path';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { importSchema, machineWriteSchema, mtmWriteSchema, operationSchema } from '../shared/schemas';
import { calculateOperation } from './calculation';
import { parseDemand } from './demand';
import { AppError, checked } from './errors';
import { exportCatalogTemplate, exportOperation } from './export';
import { Imports } from './imports';
import { Repository } from './repository';
import { MAX_UPLOAD_BYTES } from './spreadsheet';
import { differenceDecimals } from '../shared/decimal';
import { planProduction, planSchema } from './planning';
import { compareReferences, fingerprint, readBatch, requireCurrentToken, revise, simulate, suggestSteps, transcribe } from './workflow';

const loopback = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;
const loopbackOrigin = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;
const kindSchema = z.enum(['machines', 'mtm'], { error: 'Selecione a base de máquinas ou elementos MTM.' });
const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function upload(request: FastifyRequest) {
  const file = await request.file();
  if (!file) throw new AppError('Selecione um arquivo para enviar.', 422);
  const data = await file.toBuffer();
  return { data, filename: file.filename, fields: file.fields };
}

export function createServer(options: { dbPath: string; logger?: boolean; distPath?: string; transcriptionKey?: string; audioFetch?: typeof fetch }) {
  const app = fastify({ logger: options.logger ?? false, bodyLimit: 256 * 1024 });
  const repository = new Repository(options.dbPath);
  const imports = new Imports(repository);

  app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1, parts: 2 } });
  app.addHook('onClose', async () => repository.close());
  app.addHook('onRequest', async (request, reply) => {
    const { host, origin } = request.headers;
    if ((host && !loopback.test(host)) || (origin && !loopbackOrigin.test(origin))) {
      throw new AppError('Acesse o Tessaro T&M pelo endereço local informado no terminal.', 403);
    }
    reply.header('X-Content-Type-Options', 'nosniff');
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { message: error.message, issues: error.issues } });
    }
    const err = error as { statusCode?: number; code?: string };
    const status = err.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      const message = status === 413 ? 'O arquivo excede o limite de 5 MB ou o envio contém anexos extras.' : 'Envio inválido. Confira os dados e tente novamente.';
      return reply.code(status).send({ error: { message } });
    }
    request.log.error(error);
    return reply.code(500).send({ error: { message: 'Ocorreu uma falha ao concluir a solicitação.' } });
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  app.get('/api/workspace', async () => repository.workspace());
  app.post('/api/demo', async () => repository.seedDemo());

  app.put('/api/machines', async (request) => {
    const { expectedVersion, ...input } = checked(machineWriteSchema, request.body);
    return repository.writeReference('machines', input, expectedVersion);
  });
  app.put('/api/mtm', async (request) => {
    const { expectedVersion, ...input } = checked(mtmWriteSchema, request.body);
    return repository.writeReference('mtm', input, expectedVersion);
  });

  app.post('/api/imports/inspect', async (request) => {
    const { data, filename, fields } = await upload(request);
    const kind = fields.kind;
    return imports.inspect(filename, checked(kindSchema, kind && 'value' in kind ? kind.value : undefined), data);
  });
  app.post('/api/imports/preview', async (request) => imports.preview(checked(importSchema, request.body)));
  app.post('/api/imports/confirm', async (request, reply) => {
    return reply.code(201).send(imports.confirm(checked(importSchema, request.body)));
  });
  app.post('/api/demands/parse', async (request) => {
    const { filename, data } = await upload(request);
    if (extname(filename).toLowerCase() !== '.txt') throw new AppError('Selecione a demanda em formato TXT.', 415);
    if (data.byteLength > 64 * 1024) throw new AppError('A demanda deve ter até 64 KB.', 413);
    return parseDemand(data);
  });

  app.get('/api/capture/status', async () => ({ audio: Boolean(options.transcriptionKey) }));
  app.post('/api/capture/suggest', async (request) => {
    const { text } = checked(z.object({ text: z.string().trim().min(1).max(20000) }), request.body);
    return suggestSteps(text, repository.catalog('mtm'));
  });
  async function captureTranscript(request: FastifyRequest) {
    if (!options.transcriptionKey) throw new AppError('Configure TESSARO_OPENAI_API_KEY para transcrever áudio, ou use texto.', 503);
    const file = await upload(request);
    const consent = file.fields.consent;
    if (!consent || !('value' in consent) || consent.value !== 'openai') throw new AppError('Confirme o envio deste áudio ao serviço de transcrição.', 422);
    const text = await transcribe(file, options.transcriptionKey, options.audioFetch);
    return { text, audioName: file.filename.slice(0, 250) };
  }
  app.post('/api/capture/transcribe', captureTranscript);
  app.post('/api/capture/audio', async (request) => {
    const { text, audioName } = await captureTranscript(request);
    return suggestSteps(text, repository.catalog('mtm'), audioName);
  });

  app.post<{ Params: { id: string } }>('/api/operations/:id/simulate', async (request) => {
    const { goal, machineCodes, route } = checked(z.object({
      goal: z.string().regex(/^\d{1,3}(?:[.,]\d{1,4})?$/).transform((value) => value.replace(',', '.'))
        .refine((value) => Number(value) <= 100, 'Informe uma redução entre 0 e 100%.'),
      machineCodes: z.array(operationSchema.shape.machineCode).min(1).max(25),
      route: operationSchema.shape.route.optional(),
    }), request.body);
    return simulate(repository.getOperation(request.params.id), repository.catalog('machines'), machineCodes, goal,
      route ? { route, catalog: repository.catalog('mtm') } : undefined);
  });

  app.get('/api/revisions/impact', async () => {
    const { machines, mtm, operations } = repository.workspace();
    return operations.filter(({ supersededBy }) => !supersededBy).flatMap((operation) => {
      const changes = compareReferences(operation, machines, mtm);
      if (!changes.length) return [];
      const after = calculateOperation(operation.input, machines, mtm).totalMinutes;
      return [{ id: operation.id, changes, before: operation.totalMinutes, after, difference: differenceDecimals(after, operation.totalMinutes) }];
    });
  });

  const revisionSelection = z.object({ machineCode: operationSchema.shape.machineCode.optional(), route: operationSchema.shape.route.optional() });
  const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
  app.post<{ Params: { id: string } }>('/api/operations/:id/revision/preview', async (request) => {
    return revise(repository, request.params.id, checked(revisionSelection, request.body));
  });
  app.post<{ Params: { id: string } }>('/api/operations/:id/revision', async (request, reply) => {
    const { token, ...selection } = checked(revisionSelection.extend({ token: tokenSchema }), request.body);
    const operation = repository.transaction(() => {
      const proposal = revise(repository, request.params.id, selection);
      requireCurrentToken(token, proposal.token);
      return repository.insertRevision(request.params.id, proposal.preview);
    });
    return reply.code(201).send(operation);
  });

  const batchSchema = z.object({ text: z.string().trim().min(1).max(65000) });
  app.post('/api/operations/batch/preview', async (request) => {
    const { text } = checked(batchSchema, request.body);
    const { rows, issues, token } = readBatch(text, repository.catalog('machines'), repository.catalog('mtm'));
    return { rows, issues, token };
  });
  app.post('/api/operations/batch', async (request, reply) => {
    const { text, token } = checked(batchSchema.extend({ token: tokenSchema }), request.body);
    const operations = repository.transaction(() => {
      const batch = readBatch(text, repository.catalog('machines'), repository.catalog('mtm'));
      if (batch.issues.length) throw new AppError('Corrija todas as linhas antes de emitir o lote.', 422, batch.issues);
      requireCurrentToken(token, batch.token);
      return batch.previews.map((preview) => repository.insertOperation(preview));
    });
    return reply.code(201).send(operations);
  });

  app.get('/api/plans', async () => repository.plans());
  app.post('/api/plans/preview', async (request) => planProduction(repository, checked(planSchema, request.body)));
  app.post('/api/plans', async (request, reply) => {
    const { input, token } = checked(z.object({ input: planSchema, token: tokenSchema }), request.body);
    const saved = repository.transaction(() => {
      const preview = planProduction(repository, input);
      requireCurrentToken(token, preview.token);
      return repository.savePlan(preview);
    });
    return reply.code(201).send(saved);
  });

  const preview = (input: unknown) => calculateOperation(input, repository.catalog('machines'), repository.catalog('mtm'));
  app.post('/api/operations/preview', async (request) => {
    const result = preview(request.body);
    return { ...result, token: fingerprint(result) };
  });
  app.post('/api/operations', async (request, reply) => {
    const { token } = checked(z.object({ token: tokenSchema.optional() }), request.body);
    const operation = repository.transaction(() => {
      const result = preview(request.body);
      if (token) requireCurrentToken(token, fingerprint(result));
      return repository.insertOperation(result);
    });
    return reply.code(201).send(operation);
  });
  app.get<{ Params: { id: string } }>('/api/operations/:id.xlsx', async (request, reply) => {
    const operation = repository.getOperation(request.params.id);
    const suppliedCode = operation.input.poCode?.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    const code = suppliedCode || `PO-${String(operation.number).padStart(4, '0')}`;
    return reply.type(xlsxType).header('Content-Disposition', `attachment; filename="${code}.xlsx"`).send(await exportOperation(operation));
  });

  for (const group of ['templates', 'fixtures'] as const) {
    app.get<{ Params: { file: string } }>(`/api/${group}/:file`, async (request, reply) => {
      const [, kind, format] = /^(machines|mtm)\.(csv|xlsx)$/.exec(request.params.file) ?? [];
      if ((kind !== 'machines' && kind !== 'mtm') || (format !== 'csv' && format !== 'xlsx')) throw new AppError('Modelo de importação não encontrado.', 404);
      const demonstrative = group === 'fixtures';
      const filename = `${kind === 'machines' ? 'maquinas' : 'elementos-mtm'}-${demonstrative ? 'sample-demo' : 'modelo'}.${format}`;
      const data = await exportCatalogTemplate(kind, format, demonstrative);
      return reply.type(format === 'xlsx' ? xlsxType : 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`).send(data);
    });
  }

  if (options.distPath) app.register(fastifyStatic, { root: options.distPath, redirect: true });
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send({ error: { message: 'Endereço não encontrado.' } });
  });
  return app;
}
