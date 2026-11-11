// GitHub https://github.com/joaork

import { z } from 'zod';
import { addDecimals, ceilingMinutes, multiplyDecimals } from '../shared/decimal';
import { minuteOfDay as minute, protectedJobs } from '../shared/workflow';
import type { Assignment, PlanInput, PlanPreview, ResourceBlock } from '../shared/workflow';
import { AppError } from './errors';
import type { Repository } from './repository';
import { fingerprint, issuedLabel, onMachine, requireCurrentOperation } from './workflow';

const name = z.string().trim().min(1, 'Informe o nome.').max(120);
const id = z.string().min(1).max(80);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário em HH:mm.');
const codes = z.array(id).min(1, 'Selecione ao menos uma máquina.').max(25);

export const planSchema = z.object({
  name, start: time, end: time, from: time,
  teams: z.array(z.object({ id, name, machineCodes: codes })).min(1).max(20),
  jobs: z.array(z.object({
    id, name, poId: z.uuid(), quantity: z.number().int().min(1).max(1000000),
    deadline: time, setup: z.number().int().min(0).max(720), machineCodes: codes,
  })).min(1).max(50),
  blocks: z.array(z.object({ kind: z.enum(['machine', 'team']), resource: id, start: time, end: time })).max(80),
  previousId: z.uuid().optional(),
  locked: z.array(id).max(50),
});

function validRange(start: number, end: number, floor: number, ceiling: number): boolean {
  return start >= floor && end <= ceiling && start < end;
}

function distinct(ids: string[], label: string): void {
  if (new Set(ids).size !== ids.length) throw new AppError('Há identificadores repetidos em ' + label + '.', 422);
}

function occupies(array: Uint8Array, start: number, end: number): boolean {
  return array.subarray(start, end).includes(1);
}

function firstSlot(machine: Uint8Array, team: Uint8Array, from: number, end: number, duration: number): number | undefined {
  let open = 0;
  for (let cursor = from; cursor < end; cursor++) {
    open = machine[cursor] || team[cursor] ? 0 : open + 1;
    if (open === duration) return cursor + 1 - duration;
  }
  return undefined;
}

function isInterrupted(assignment: Assignment, blocks: ResourceBlock[]): boolean {
  return blocks.some((block) => block.resource === (block.kind === 'machine' ? assignment.machineCode : assignment.teamId)
    && minute(block.start) < assignment.end && minute(block.end) > assignment.start);
}

export function planProduction(repository: Repository, input: PlanInput): PlanPreview {
  const start = minute(input.start);
  const end = minute(input.end);
  const from = minute(input.from);
  if (start >= end || from < start || from > end) throw new AppError('Confira o início, o fim e o horário de replanejamento do turno.', 422);
  distinct(input.teams.map(({ id }) => id), 'equipes');
  distinct(input.jobs.map(({ id }) => id), 'pedidos');
  distinct(input.locked, 'pedidos fixados');
  const machines = new Map(repository.catalog('machines').map((machine) => [machine.code, machine]));
  const machineTime = new Map([...machines.keys()].map((code) => [code, new Uint8Array(1440)]));
  const teamTime = new Map(input.teams.map(({ id }) => [id, new Uint8Array(1440)]));
  const checkMachines = (codes: string[]) => {
    if (codes.some((code) => !machines.has(code))) throw new AppError('Existe uma máquina selecionada que não está mais no cadastro.', 422);
    distinct(codes, 'máquinas selecionadas');
  };
  for (const team of input.teams) checkMachines(team.machineCodes);
  for (const job of input.jobs) checkMachines(job.machineCodes);
  for (const block of input.blocks) {
    const availability = (block.kind === 'machine' ? machineTime : teamTime).get(block.resource);
    const begins = minute(block.start);
    const ends = minute(block.end);
    if (!availability || !validRange(begins, ends, start, end)) throw new AppError('Cada indisponibilidade precisa de um recurso e de um intervalo dentro do turno.', 422);
    availability.fill(1, begins, ends);
  }

  const previous = input.previousId ? repository.getPlan(input.previousId) : undefined;
  if (input.locked.length && !previous) throw new AppError('Abra um plano salvo para fixar pedidos em andamento ou concluídos.', 422);
  if (previous && from < minute(previous.input.from)) throw new AppError('O horário de replanejamento deve avançar em relação ao plano anterior.', 422);
  const former = new Map(previous?.assignments.map((assignment) => [assignment.jobId, assignment]));
  const locked = protectedJobs(input, previous?.assignments ?? []);
  const assignments: Assignment[] = [];
  const unassigned: PlanPreview['unassigned'] = [];
  let demonstrative = previous?.demonstrative ?? false;

  for (const jobId of locked) {
    const before = former.get(jobId);
    const currentJob = input.jobs.find(({ id }) => id === jobId);
    const previousJob = previous?.input.jobs.find(({ id }) => id === jobId);
    if (!before || !currentJob || !previousJob || fingerprint(currentJob) !== fingerprint(previousJob)) {
      throw new AppError('Um pedido fixado deve manter os dados do plano salvo.', 409);
    }
    const machine = machineTime.get(before.machineCode);
    const team = teamTime.get(before.teamId);
    if (!machine || !team || !validRange(before.start, before.end, start, end)) {
      throw new AppError('Mantenha os recursos e o horário dos pedidos fixados dentro do turno.', 409);
    }
    machine.fill(1, before.start, before.end);
    team.fill(1, before.start, before.end);
    assignments.push({ ...before, locked: true, interrupted: isInterrupted(before, input.blocks), reason: before.start < from
      ? 'Alocação preservada por ter iniciado antes do horário de replanejamento.' : 'Alocação mantida a pedido do responsável.' });
  }

  const queue = [...input.jobs].filter(({ id }) => !locked.has(id)).sort((a, b) => minute(a.deadline) - minute(b.deadline));
  for (const job of queue) {
    const operation = repository.getOperation(job.poId);
    requireCurrentOperation(operation);
    demonstrative ||= operation.demonstrative;
    const before = former.get(job.id);
    let best: Assignment | undefined;
    let hasQualifiedTeam = false;
    let fitsWindow = false;
    for (const code of job.machineCodes) {
      const machine = code === operation.machine.code ? operation.machine : machines.get(code)!;
      const unitMinutes = onMachine(operation, machine).totalMinutes;
      const needed = ceilingMinutes(addDecimals(multiplyDecimals(unitMinutes, String(job.quantity)), String(job.setup)));
      for (const team of input.teams.filter(({ machineCodes }) => machineCodes.includes(code))) {
        hasQualifiedTeam = true;
        if (needed > BigInt(end - from)) continue;
        fitsWindow = true;
        const duration = Number(needed);
        const machineSlots = machineTime.get(code)!;
        const teamSlots = teamTime.get(team.id)!;
        const keepSlot = before && before.machineCode === code && before.teamId === team.id
          && before.start >= from && before.start + duration <= Math.min(end, minute(job.deadline))
          && !occupies(machineSlots, before.start, before.start + duration) && !occupies(teamSlots, before.start, before.start + duration);
        const begins = keepSlot ? before.start : firstSlot(machineSlots, teamSlots, from, end, duration);
        if (begins === undefined) continue;
        const finishes = begins + duration;
        const candidate: Assignment = {
          jobId: job.id, name: job.name, poId: operation.id, poLabel: issuedLabel(operation) + ' · rev. ' + (operation.input.revision || '00'),
          quantity: job.quantity, machineCode: code, machineVersion: machine.version, teamId: team.id, teamName: team.name, unitMinutes,
          start: begins, end: finishes, late: Math.max(0, finishes - minute(job.deadline)), locked: false, interrupted: false,
          reason: keepSlot ? 'Horário anterior disponível e dentro do prazo.' : 'Encaixe em máquina compatível e equipe habilitada.',
        };
        const bestKeepsSlot = best && before && best.machineCode === before.machineCode && best.teamId === before.teamId && best.start === before.start && best.late === 0;
        if (!best || candidate.late < best.late
          || (candidate.late === best.late && (keepSlot && !bestKeepsSlot || !bestKeepsSlot && candidate.end < best.end))) {
          best = candidate;
        }
      }
    }
    if (!best) {
      unassigned.push({
        jobId: job.id, name: job.name,
        reason: !hasQualifiedTeam ? 'Nenhuma equipe está habilitada nas máquinas selecionadas.'
          : !fitsWindow ? 'O lote excede o tempo restante do turno nas máquinas habilitadas.'
            : 'As reservas e indisponibilidades impedem um intervalo contínuo para o lote.',
      });
      continue;
    }
    demonstrative ||= machines.get(best.machineCode)?.origin === 'demo';
    machineTime.get(best.machineCode)!.fill(1, best.start, best.end);
    teamTime.get(best.teamId)!.fill(1, best.start, best.end);
    assignments.push(best);
  }
  assignments.sort((a, b) => a.start - b.start || a.machineCode.localeCompare(b.machineCode));
  const changed = previous ? new Set([
    ...assignments.filter((next) => {
      const before = former.get(next.jobId);
      return !before || ['start', 'end', 'machineCode', 'teamId', 'poId', 'quantity'].some((key) => {
        const field = key as keyof Assignment;
        return before[field] !== next[field];
      });
    }).map(({ jobId }) => jobId),
    ...previous.assignments.filter((before) => !assignments.some((next) => next.jobId === before.jobId)).map(({ jobId }) => jobId),
  ]).size : 0;
  const result = { input: { ...input, locked: [...locked] }, assignments, unassigned, changed, demonstrative };
  return { ...result, token: fingerprint(result) };
}
