// GitHub https://github.com/joaork

import type { OperationInput, PoPreview, ProcessOperation } from './contracts';

export const audioFormats = {
  mp3: 'audio/mpeg', mp4: 'video/mp4', mpeg: 'audio/mpeg', mpga: 'audio/mpeg', m4a: 'audio/mp4',
  wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac',
} as const;

export interface Transcript {
  text: string;
  audioName: string;
}

export function splitRoute(value: string): string[] {
  return value.trim().split(/[\s,;→|]+/u).filter(Boolean);
}

export interface CaptureStep {
  text: string;
  code: string;
  count: number;
  audioName?: string;
}

export interface CaptureSource {
  steps: CaptureStep[];
}

export function captureRoute(capture: CaptureSource): string[] {
  return capture.steps.flatMap(({ code, count }) => Array<string>(count).fill(code));
}

export function captureMatchesRoute(capture: CaptureSource, route: string[]): boolean {
  const captured = captureRoute(capture);
  return captured.length === route.length && captured.every((code, index) => code === route[index]);
}

export interface SuggestedStep extends CaptureStep {
  matches: string[];
}

export interface ScenarioResult {
  machineCode: string;
  description: string;
  minutes: string;
  fixedMinutes: string;
  mtmMinutes: string;
  difference: string;
  reduction: string;
  reachesGoal: boolean;
}

export interface Simulation {
  target: string;
  maximumFactor: string | null;
  manualMinutes: string;
  baseline: string;
  baselineManualMinutes: string;
  route: string[];
  results: ScenarioResult[];
}

export interface RevisionSelection {
  machineCode?: string;
  route?: string[];
}

export interface ScenarioHandoff {
  operationId: string;
  machineCode: string;
  route: string[];
  minutes: string;
}

export interface RevisionPreview {
  preview: PoPreview;
  changes: string[];
  difference: string;
  token: string;
}

export interface Impact {
  id: string;
  changes: string[];
  before: string;
  after: string;
  difference: string;
}

export interface BatchPreview {
  rows: { line: number; input: OperationInput; totalMinutes: string }[];
  issues: { line: number; message: string }[];
  token: string;
}

export interface PlanningTeam {
  id: string;
  name: string;
  machineCodes: string[];
}

export interface PlanningJob {
  id: string;
  name: string;
  poId: string;
  quantity: number;
  deadline: string;
  setup: number;
  machineCodes: string[];
}

export interface ResourceBlock {
  kind: 'machine' | 'team';
  resource: string;
  start: string;
  end: string;
}

export interface PlanInput {
  name: string;
  start: string;
  end: string;
  from: string;
  teams: PlanningTeam[];
  jobs: PlanningJob[];
  blocks: ResourceBlock[];
  previousId?: string;
  locked: string[];
}

export interface Assignment {
  jobId: string;
  name: string;
  poId: string;
  poLabel: string;
  quantity: number;
  machineCode: string;
  machineVersion: number;
  teamId: string;
  teamName: string;
  unitMinutes: string;
  start: number;
  end: number;
  late: number;
  locked: boolean;
  interrupted: boolean;
  reason: string;
}

export interface PlanPreview {
  input: PlanInput;
  assignments: Assignment[];
  unassigned: { jobId: string; name: string; reason: string }[];
  changed: number;
  demonstrative: boolean;
  token: string;
}

export interface SavedPlan extends PlanPreview {
  id: string;
  createdAt: string;
}

export function minuteOfDay(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function protectedJobs(input: Pick<PlanInput, 'locked' | 'from'>, assignments: Assignment[]): Set<string> {
  const from = minuteOfDay(input.from);
  return new Set([...input.locked, ...assignments.filter(({ start }) => start < from).map(({ jobId }) => jobId)]);
}

export function currentOperationVersion(byId: ReadonlyMap<string, ProcessOperation>, id: string): ProcessOperation | undefined {
  const visited = new Set<string>();
  let operation = byId.get(id);
  while (operation?.supersededBy) {
    if (visited.has(operation.id)) return undefined;
    visited.add(operation.id);
    operation = byId.get(operation.supersededBy);
  }
  return operation;
}
