// GitHub https://github.com/joaork

import { useEffect, useState } from 'react';
import { CalendarClock, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { Workspace } from '../shared/contracts';
import type { PlanInput, PlanningJob, PlanningTeam, PlanPreview, ResourceBlock, SavedPlan } from '../shared/workflow';
import { currentOperationVersion, minuteOfDay as minutes, protectedJobs } from '../shared/workflow';
import { messageFrom, request } from './api';
import type { ApiError } from './api';
import { dateLabel, decimal, ErrorNotice, Notice, PageTitle, PanelTitle, ScrollTable, Spinner } from './ui';
import { FicheSelect, MachineChoices } from './WorkflowControls';

const emptyTeam = (): PlanningTeam => ({ id: crypto.randomUUID(), name: '', machineCodes: [] });
const emptyJob = (poId = '', machineCodes: string[] = []): PlanningJob => ({
  id: crypto.randomUUID(), name: '', poId, quantity: 1, deadline: '12:00', setup: 0, machineCodes,
});

const clock = (value: number) => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');

export function Reveza({ workspace, initialId, reload }: { workspace: Workspace; initialId?: string; reload: () => Promise<void> }) {
  const operations = workspace.operations.filter(({ supersededBy }) => !supersededBy);
  const selected = operations.find(({ id }) => id === initialId);
  const [input, setInput] = useState<PlanInput>(() => ({
    name: 'Turno de costura', start: '08:00', end: '16:00', from: '08:00',
    teams: [emptyTeam()], jobs: [emptyJob(selected?.id, selected ? [selected.machine.code] : [])], blocks: [], locked: [],
  }));
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [historyId, setHistoryId] = useState('');
  const [result, setResult] = useState<PlanPreview>();
  const [saved, setSaved] = useState<SavedPlan>();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void request<SavedPlan[]>('/plans').then((items) => { if (alive) setPlans(items); })
      .catch((cause) => { if (alive) setError(messageFrom(cause)); });
    return () => { alive = false; };
  }, []);

  function change(values: Partial<PlanInput>) {
    setInput((current) => ({ ...current, ...values }));
    setResult(undefined);
    setSaved(undefined);
    setError(null);
  }
  function changeTeam(id: string, values: Partial<PlanningTeam>) {
    change({ teams: input.teams.map((team) => team.id === id ? { ...team, ...values } : team) });
  }
  function changeJob(id: string, values: Partial<PlanningJob>) {
    change({ jobs: input.jobs.map((job) => job.id === id ? { ...job, ...values } : job) });
  }
  function changeBlock(index: number, values: Partial<ResourceBlock>) {
    change({ blocks: input.blocks.map((block, position) => position === index ? { ...block, ...values } : block) });
  }

  async function run(action: () => Promise<void>, invalidatesPreview = false) {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (cause) {
      const issue = messageFrom(cause);
      setError(issue);
      if (invalidatesPreview && (issue.status === 409 || issue.status === 422)) {
        setResult(undefined);
        await reload();
      }
    }
    finally { setBusy(false); }
  }

  function replan(plan: SavedPlan) {
    change({ ...plan.input, previousId: plan.id });
    window.scrollTo(0, 0);
  }

  const previous = plans.find(({ id }) => id === input.previousId);
  const lockedJobs = protectedJobs(input, previous?.assignments ?? []);
  const operationsById = new Map(workspace.operations.map((operation) => [operation.id, operation]));
  const replacements = new Map(input.jobs.flatMap((job) => {
    const latest = currentOperationVersion(operationsById, job.poId);
    return !lockedJobs.has(job.id) && latest && latest.id !== job.poId ? [[job.id, latest] as const] : [];
  }));
  const history = plans.find(({ id }) => id === historyId);
  const resultPlan = saved ?? result;

  return <div className="stack">
    <PageTitle module="reveza" title="REVEZA" description="Distribua pedidos entre máquinas e equipes e replaneje quando a disponibilidade mudar." />
    <ErrorNotice error={error} />
    {!operations.length && <Notice>Emita uma ficha PO para programar um pedido.</Notice>}
    {plans.length > 0 && <section className="panel">
      <PanelTitle title="Planos salvos" description="Abra um plano para ver o resultado e preparar uma nova distribuição." />
      <div className="panel-padding form-grid">
        <label className="field"><span>Versão do plano</span><select value={historyId} onChange={(event) => setHistoryId(event.target.value)}>
          <option value="">Selecione um plano</option>
          {plans.map((item) => <option key={item.id} value={item.id}>{item.input.name} · {dateLabel(item.createdAt)}</option>)}
        </select></label>
        <div className="button-group workflow-align">
          <button className="button button-secondary" disabled={!history || busy} onClick={() => { setSaved(history); setResult(undefined); }}>Ver plano</button>
          <button className="button button-secondary" disabled={!history || busy} onClick={() => { if (history) replan(history); }}>Replanejar este turno</button>
        </div>
      </div>
    </section>}
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      if (busy || !operations.length || replacements.size) return;
      void run(async () => {
        setSaved(undefined); setResult(undefined);
        setResult(await request<PlanPreview>('/plans/preview', 'POST', input));
      });
    }}>
      <section className="panel">
        <PanelTitle title="Configuração do turno" description="O plano cobre um único turno e reserva máquina e equipe durante todo o lote." />
        <fieldset className="panel-padding stack" disabled={busy}>
          <div className="form-grid">
            <label className="field field-wide"><span>Nome do turno</span><input required maxLength={120} value={input.name} onChange={(event) => change({ name: event.target.value })} /></label>
            <label className="field"><span>Início do turno</span><input required type="time" value={input.start} onChange={(event) => change({ start: event.target.value, ...(!previous ? { from: event.target.value } : {}) })} /></label>
            <label className="field"><span>Fim do turno</span><input required type="time" value={input.end} onChange={(event) => change({ end: event.target.value })} /></label>
            {previous && <label className="field"><span>Replanejar a partir de</span><input required type="time" min={previous.input.from} value={input.from} onChange={(event) => change({ from: event.target.value })} /></label>}
          </div>
          {previous && <fieldset className="workflow-choices">
            <legend>Alocações preservadas no replanejamento</legend>
            {previous.assignments.map((item) => <label className="workflow-check" key={item.jobId}>
              <input type="checkbox" checked={lockedJobs.has(item.jobId)} disabled={item.start < minutes(input.from) || !input.jobs.some(({ id }) => id === item.jobId)} onChange={(event) => change({
                locked: event.target.checked ? [...input.locked, item.jobId] : input.locked.filter((id) => id !== item.jobId),
              })} />
              {item.name} · {clock(item.start)}–{clock(item.end)} · {item.teamName}{item.start < minutes(input.from) && ' · Já iniciado no plano'}
            </label>)}
          </fieldset>}
        </fieldset>
      </section>
      <section className="panel">
        <PanelTitle title="Equipes e habilitações" description="Selecione as máquinas que cada equipe pode operar.">
          <button type="button" className="button button-secondary" disabled={busy || input.teams.length >= 20} onClick={() => change({ teams: [...input.teams, emptyTeam()] })}><Plus size={16} /> Adicionar equipe</button>
        </PanelTitle>
        <fieldset className="panel-padding stack" disabled={busy}>
          {input.teams.map((team, index) => <div className="workflow-step" key={team.id}>
            <div className="workflow-step-header"><strong>Equipe {index + 1}</strong>
              <button type="button" className="icon-button danger" aria-label={'Remover equipe ' + (index + 1)}
                disabled={input.teams.length === 1 || !!previous?.assignments.some((item) => item.teamId === team.id && lockedJobs.has(item.jobId))}
                onClick={() => change({ teams: input.teams.filter(({ id }) => id !== team.id), blocks: input.blocks.filter(({ kind, resource }) => kind !== 'team' || resource !== team.id) })}><Trash2 size={16} /></button>
            </div>
            <label className="field"><span>Nome da equipe {index + 1}</span><input required value={team.name} maxLength={120} onChange={(event) => changeTeam(team.id, { name: event.target.value })} /></label>
            <MachineChoices label={'Habilitações da equipe ' + (index + 1)} machines={workspace.machines} value={team.machineCodes} onChange={(codes) => changeTeam(team.id, { machineCodes: codes })} />
          </div>)}
        </fieldset>
      </section>
      <section className="panel">
        <PanelTitle title="Pedidos de produção" description="A ficha vigente fornece o tempo por peça. Confirme a compatibilidade das máquinas alternativas.">
          <button type="button" className="button button-secondary" disabled={busy || input.jobs.length >= 50} onClick={() => change({ jobs: [...input.jobs, emptyJob()] })}><Plus size={16} /> Adicionar pedido</button>
        </PanelTitle>
        <div className="panel-padding stack">
          {replacements.size > 0 && <Notice tone="warn">
            <p>Há {replacements.size} pedido(s) pendente(s) com ficha substituída. A atualização usa a máquina da revisão vigente. Confira as alternativas antes de simular.</p>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => change({ jobs: input.jobs.map((job) => {
              const latest = replacements.get(job.id);
              return latest ? { ...job, poId: latest.id, machineCodes: [latest.machine.code] } : job;
            }) })}><RefreshCw size={16} /> Atualizar fichas dos pedidos pendentes</button>
          </Notice>}
          {input.jobs.map((job, index) => {
            const locked = lockedJobs.has(job.id);
            const obsolete = workspace.operations.find(({ id }) => id === job.poId)?.supersededBy;
            const options = locked ? workspace.operations : operations;
            return <fieldset className="workflow-step" key={job.id} disabled={busy || locked}>
              <div className="workflow-step-header"><strong>Pedido {index + 1}{locked && ' · fixado'}</strong>
                <button type="button" className="icon-button danger" aria-label={'Remover pedido ' + (index + 1)} disabled={input.jobs.length === 1}
                  onClick={() => change({ jobs: input.jobs.filter(({ id }) => id !== job.id) })}><Trash2 size={16} /></button>
              </div>
              {obsolete && !locked && <Notice tone="warn">Este pedido usa uma ficha revisada. Selecione a versão vigente.</Notice>}
              <div className="form-grid">
                <label className="field"><span>Identificação do pedido {index + 1}</span><input required maxLength={120} value={job.name} onChange={(event) => changeJob(job.id, { name: event.target.value })} /></label>
                <FicheSelect label={'Ficha do pedido ' + (index + 1)} operations={options} value={obsolete && !locked ? '' : job.poId} onChange={(poId) => {
                  const operation = options.find(({ id }) => id === poId);
                  changeJob(job.id, { poId, machineCodes: operation ? [operation.machine.code] : [] });
                }} />
                <label className="field"><span>Quantidade do pedido {index + 1}</span><input required type="number" min="1" max="1000000" value={job.quantity} onChange={(event) => changeJob(job.id, { quantity: Number(event.target.value) })} /></label>
                <label className="field"><span>Prazo do pedido {index + 1}</span><input required type="time" value={job.deadline} onChange={(event) => changeJob(job.id, { deadline: event.target.value })} /></label>
                <label className="field"><span>Preparação (min) do pedido {index + 1}</span><input required type="number" min="0" max="720" value={job.setup} onChange={(event) => changeJob(job.id, { setup: Number(event.target.value) })} /></label>
              </div>
              <MachineChoices label={'Máquinas compatíveis com o pedido ' + (index + 1)} machines={workspace.machines} value={job.machineCodes} onChange={(machineCodes) => changeJob(job.id, { machineCodes })} />
            </fieldset>;
          })}
        </div>
      </section>
      <section className="panel">
        <PanelTitle title="Indisponibilidades" description="Informe paradas, intervalos ou ausências dentro do turno.">
          <button type="button" className="button button-secondary" disabled={busy || input.blocks.length >= 80} onClick={() => change({
            blocks: [...input.blocks, { kind: 'machine', resource: workspace.machines[0]?.code ?? '', start: input.from, end: input.end }],
          })}><Plus size={16} /> Registrar indisponibilidade</button>
        </PanelTitle>
        <fieldset className="panel-padding stack" disabled={busy}>
          {!input.blocks.length && <p className="workflow-muted">Nenhuma indisponibilidade informada.</p>}
          {input.blocks.map((block, index) => <div className="workflow-step" key={index}>
            <div className="workflow-step-header"><strong>Indisponibilidade {index + 1}</strong>
              <button type="button" className="icon-button danger" aria-label={'Remover indisponibilidade ' + (index + 1)}
                onClick={() => change({ blocks: input.blocks.filter((_, position) => position !== index) })}><Trash2 size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="field"><span>Tipo de recurso {index + 1}</span><select value={block.kind} onChange={(event) => {
                const kind = event.target.value === 'team' ? 'team' : 'machine';
                changeBlock(index, { kind, resource: (kind === 'team' ? input.teams[0]?.id : workspace.machines[0]?.code) ?? '' });
              }}><option value="machine">Máquina</option><option value="team">Equipe</option></select></label>
              <label className="field"><span>Recurso {index + 1}</span><select value={block.resource} onChange={(event) => changeBlock(index, { resource: event.target.value })}>
                <option value="">Selecione</option>
                {block.kind === 'machine' ? workspace.machines.map(({ code, description }) => <option key={code} value={code}>{code} · {description}</option>)
                  : input.teams.map(({ id, name }) => <option key={id} value={id}>{name || 'Equipe sem nome'}</option>)}
              </select></label>
              <label className="field"><span>Início da indisponibilidade {index + 1}</span><input required type="time" value={block.start} onChange={(event) => changeBlock(index, { start: event.target.value })} /></label>
              <label className="field"><span>Fim da indisponibilidade {index + 1}</span><input required type="time" value={block.end} onChange={(event) => changeBlock(index, { end: event.target.value })} /></label>
            </div>
          </div>)}
          <div><button type="submit" className="button button-primary" disabled={busy || !operations.length || replacements.size > 0}>
            {busy ? <Spinner /> : <CalendarClock size={17} />} {previous ? 'Simular replanejamento' : 'Gerar prévia do turno'}
          </button></div>
        </fieldset>
      </section>
    </form>
    {resultPlan && <section className="panel">
      <PanelTitle title={saved ? 'Plano salvo' : 'Prévia do plano'} description={resultPlan.input.name + ' · ' + resultPlan.input.start + '–' + resultPlan.input.end}>
        {saved ? <button className="button button-secondary" disabled={busy} onClick={() => replan(saved)}>Preparar replanejamento</button>
          : <button className="button button-primary" disabled={busy} onClick={() => void run(async () => {
            const plan = await request<SavedPlan>('/plans', 'POST', { input: resultPlan.input, token: resultPlan.token });
            setSaved(plan); setPlans((items) => [plan, ...items]); setHistoryId(plan.id);
          }, true)}><Save size={17} /> Salvar plano</button>}
      </PanelTitle>
      <div className="panel-padding stack">
        {resultPlan.demonstrative && <Notice tone="warn">O plano usa dados demonstrativos.</Notice>}
        <div className="workflow-stats">
          <div><small>Pedidos alocados</small><strong>{resultPlan.assignments.length}</strong></div>
          <div><small>Com atraso</small><strong>{resultPlan.assignments.filter(({ late }) => late > 0).length}</strong></div>
          <div><small>Sem alocação</small><strong>{resultPlan.unassigned.length}</strong></div>
          <div><small>Peças alocadas</small><strong>{resultPlan.assignments.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
          {resultPlan.input.previousId && <div><small>Alocações alteradas</small><strong>{resultPlan.changed}</strong></div>}
        </div>
        {resultPlan.assignments.length > 0 && <div className="workflow-schedule" aria-label="Linha do tempo das máquinas">
          {[...new Set(resultPlan.assignments.map(({ machineCode }) => machineCode))].map((code) => {
            const start = minutes(resultPlan.input.start);
            const span = minutes(resultPlan.input.end) - start;
            return <div className="schedule-lane" key={code}><span>Máq. {code}</span><div className="schedule-track">
              {resultPlan.assignments.filter(({ machineCode }) => machineCode === code).map((item) => <div className={'schedule-slot' + (item.late || item.interrupted ? ' schedule-alert' : '')} key={item.jobId}
                style={{ left: (item.start - start) / span * 100 + '%', width: (item.end - item.start) / span * 100 + '%' }}
                title={item.name + ' · ' + clock(item.start) + '–' + clock(item.end)}>{item.name}</div>)}
            </div></div>;
          })}
        </div>}
        <ScrollTable label="Alocações de pedidos"><table><thead><tr><th>Pedido / Ficha</th><th>Máquina / Equipe</th><th>Início</th><th>Fim</th><th>TP (min)</th><th>Situação</th></tr></thead>
          <tbody>{resultPlan.assignments.map((item) => <tr key={item.jobId}>
            <td><strong>{item.name}</strong><br />{item.poLabel} · {item.quantity} pç.</td>
            <td>{item.machineCode} v{item.machineVersion} · {item.teamName}</td>
            <td>{clock(item.start)}</td><td>{clock(item.end)}</td><td>{decimal(item.unitMinutes)}</td>
            <td>{item.interrupted ? 'Imprevisto em lote fixado. Revisão manual.' : `${item.locked ? 'Fixado · ' : ''}${item.late ? item.late + ' min de atraso' : 'No prazo'}`}<small className="cell-note">{item.reason}</small></td>
          </tr>)}</tbody>
        </table></ScrollTable>
        {resultPlan.unassigned.length > 0 && <Notice tone="warn"><ul className="issues">{resultPlan.unassigned.map(({ jobId, name, reason }) => <li key={jobId}><strong>{name}</strong> · {reason}</li>)}</ul></Notice>}
      </div>
    </section>}
  </div>;
}
