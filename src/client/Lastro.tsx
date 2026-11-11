import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ClipboardCheck, FileUp, RefreshCw } from 'lucide-react';
import type { ProcessOperation, Workspace } from '../shared/contracts';
import type { BatchPreview, Impact, RevisionPreview, ScenarioHandoff } from '../shared/workflow';
import { messageFrom, request } from './api';
import type { ApiError } from './api';
import { decimal, ErrorNotice, Notice, PageTitle, PanelTitle, ScrollTable, Spinner } from './ui';
import type { Navigate } from './ui';
import { FicheSelect, ficheLabel } from './WorkflowControls';
import { PoSheet } from './Po';

const batchHeader = 'produto;perimetro;densidade;maquina;roteiro;ficha;operacao';
export const scenarioStorageKey = 'tessaro:cenario-trama';

function restoreScenario(key?: string, id?: string, machine?: string): ScenarioHandoff | undefined {
  if (!key) return undefined;
  try {
    const value = JSON.parse(sessionStorage.getItem(scenarioStorageKey) ?? 'null') as (Partial<ScenarioHandoff> & { key?: string }) | null;
    if (value?.key === key && value.operationId === id && value.machineCode === machine && typeof value.minutes === 'string'
      && Array.isArray(value.route) && value.route.length <= 250 && value.route.every((item) => typeof item === 'string')) return value as ScenarioHandoff;
  } catch { /* A tela pede que o usuário envie a proposta de novo. */ }
  return undefined;
}

export function Lastro({ workspace, initialId, initialMachine, scenarioKey, initialScenario, onSaved, reload, navigate }: {
  workspace: Workspace; initialId?: string; initialMachine?: string; onSaved: (operation: ProcessOperation, showDetail: boolean) => void;
  scenarioKey?: string; initialScenario?: ScenarioHandoff;
  reload: () => Promise<void>; navigate: Navigate;
}) {
  const [id, setId] = useState(initialId ?? '');
  const [machineCode, setMachineCode] = useState(initialMachine ?? '');
  const [scenario] = useState(() => initialScenario ?? restoreScenario(scenarioKey, initialId, initialMachine));
  const [usingScenario, setUsingScenario] = useState(!!scenarioKey);
  const [impact, setImpact] = useState<Impact[] | null>();
  const [proposal, setProposal] = useState<RevisionPreview>();
  const [batch, setBatch] = useState<BatchPreview>();
  const [csv, setCsv] = useState('');
  const [tab, setTab] = useState<'revisions' | 'batch'>('revisions');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const current = workspace.operations.filter(({ supersededBy }) => !supersededBy);
  const operation = current.find((item) => item.id === id);
  const selectedScenario = usingScenario && scenario?.operationId === id ? scenario : undefined;
  const missingScenario = usingScenario && !selectedScenario;

  useEffect(() => {
    let alive = true;
    void request<Impact[]>('/revisions/impact').then((items) => { if (alive) setImpact(items); })
      .catch(() => { if (alive) setImpact(null); });
    return () => { alive = false; };
  }, []);

  async function run(action: () => Promise<void>, invalidate?: () => void) {
    setBusy(true);
    setError(null);
    setMessage('');
    try { await action(); }
    catch (cause) {
      const issue = messageFrom(cause);
      setError(issue);
      if (invalidate && (issue.status === 409 || issue.status === 422)) {
        invalidate();
        await reload();
      }
    }
    finally { setBusy(false); }
  }

  const revisionPath = '/operations/' + id + '/revision';
  const revisionBody = { machineCode: machineCode || undefined, route: selectedScenario?.route };

  function selectFiche(value: string) {
    setId(value);
    setMachineCode('');
    setProposal(undefined);
    setUsingScenario(false);
  }

  function selectTab(value: 'revisions' | 'batch') {
    setTab(value);
    setError(null);
    setMessage('');
  }

  return <div className="stack" ref={pageRef}>
    <PageTitle module="lastro" title="LASTRO" description="Localize fichas afetadas, confira revisões e emita operações em lote." />
    <div className="button-group" role="group" aria-label="Funções do LASTRO">
      <button className={'button ' + (tab === 'revisions' ? 'button-primary' : 'button-secondary')} aria-pressed={tab === 'revisions'} disabled={busy} onClick={() => selectTab('revisions')}>Impacto e revisão</button>
      <button className={'button ' + (tab === 'batch' ? 'button-primary' : 'button-secondary')} aria-pressed={tab === 'batch'} disabled={busy} onClick={() => selectTab('batch')}>Emissão em lote</button>
    </div>
    <ErrorNotice error={error} />
    {message && <div role="status"><Notice tone="success">{message}</Notice></div>}
    {tab === 'revisions' ? <>
      <section className="panel">
        <PanelTitle title="Fichas afetadas" description="Compara as versões gravadas nas fichas vigentes com os cadastros atuais.">
          <button className="button button-secondary" disabled={busy || impact === undefined} onClick={() => void run(async () => setImpact(await request<Impact[]>('/revisions/impact')))}>
            <RefreshCw size={16} /> Atualizar impacto
          </button>
        </PanelTitle>
        {!impact?.length ? <div className="panel-padding" role="status"><Notice tone={impact === null ? 'warn' : 'info'}>
          {impact === undefined ? 'Consultando o impacto nos cadastros…' : impact === null
            ? 'A consulta de impacto falhou. Use Atualizar impacto para tentar novamente.' : 'Nenhuma ficha vigente com cadastros alterados.'}
        </Notice></div> : <ScrollTable label="Fichas afetadas por mudanças nos cadastros"><table>
            <thead><tr><th>Ficha</th><th>Alterações</th><th>Antes (min)</th><th>Proposto (min)</th><th>Ação</th></tr></thead>
            <tbody>{impact.map((item) => {
              const affected = current.find((entry) => entry.id === item.id);
              return <tr key={item.id}>
              <td>{affected ? ficheLabel(affected) : 'Atualize a lista de fichas'}</td>
              <td>{item.changes.join(' · ')}</td><td>{decimal(item.before)}</td><td>{decimal(item.after)}</td>
              <td><button className="button button-secondary" disabled={busy} onClick={() => selectFiche(item.id)}>Selecionar</button></td>
            </tr>;
            })}</tbody>
          </table></ScrollTable>}
      </section>
      <section className="panel">
        <PanelTitle title="Preparar revisão" description="A revisão usa os cadastros atuais e conserva a emissão anterior no histórico." />
        <fieldset className="panel-padding stack" disabled={busy}>
          <div className="form-grid">
            <FicheSelect operations={current} value={id} onChange={selectFiche} />
            <label className="field"><span>Máquina compatível para a revisão</span>
              <select value={machineCode} onChange={(event) => { setMachineCode(event.target.value); setProposal(undefined); }}>
                <option value="">Manter a máquina da ficha</option>
                {workspace.machines.map(({ code, description }) => <option key={code} value={code}>{code} · {description}</option>)}
              </select>
            </label>
          </div>
          {missingScenario && <Notice tone="warn">A proposta do TRAMA está indisponível nesta aba. Envie a simulação novamente ou selecione uma ficha para revisão manual.</Notice>}
          {selectedScenario && <div className="workflow-step">
            <strong>Proposta recebida do TRAMA</strong>
            <span className="workflow-format">{selectedScenario.route.join(' → ') || 'Roteiro sem elementos MTM'}</span>
            <small>TP simulado em {selectedScenario.machineCode} · {decimal(selectedScenario.minutes)} min</small>
            <div><button className="button button-text" onClick={() => { setUsingScenario(false); setProposal(undefined); }}>Usar roteiro da ficha emitida</button></div>
          </div>}
          <div><button className="button button-primary" disabled={!operation || busy || missingScenario} onClick={() => void run(async () => {
            setProposal(undefined);
            setProposal(await request<RevisionPreview>(revisionPath + '/preview', 'POST', revisionBody));
          })}>{busy ? <Spinner /> : <ClipboardCheck size={17} />} Calcular prévia da revisão</button></div>
          {proposal && <>
            <div className="workflow-stats">
              <div><small>Revisão proposta</small><strong>{proposal.preview.input.revision}</strong></div>
              <div><small>Tempo proposto</small><strong>{decimal(proposal.preview.totalMinutes)} min</strong></div>
              <div><small>Variação</small><strong>{decimal(proposal.difference)} min</strong></div>
            </div>
            <Notice>{proposal.changes.join(' · ')}</Notice>
            {selectedScenario && selectedScenario.machineCode === proposal.preview.machine.code && selectedScenario.minutes !== proposal.preview.totalMinutes
              && <Notice tone="warn">O TP recalculado difere do cenário do TRAMA. Confira os cadastros e a ficha proposta antes de aprovar.</Notice>}
            <details className="workflow-details"><summary>Conferir a ficha proposta</summary><div className="workflow-detail-body"><PoSheet result={proposal.preview} /></div></details>
            <div><button className="button button-primary" disabled={busy} onClick={() => void run(async () => {
              const record = await request<ProcessOperation>(revisionPath, 'POST', { ...revisionBody, token: proposal.token });
              onSaved(record, pageRef.current !== null);
            }, () => setProposal(undefined))}>Aprovar e emitir revisão <ArrowRight size={16} /></button></div>
          </>}
        </fieldset>
      </section>
    </> : <section className="panel">
      <PanelTitle title="Emitir fichas a partir de um CSV" description="Cole ou abra um arquivo separado por ponto e vírgula. Use vírgulas entre os códigos do roteiro." />
      <fieldset className="panel-padding stack" disabled={busy}>
        <p className="workflow-format">{batchHeader}</p>
        <label className="field"><span>Arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void run(async () => { if (file.size > 65000) throw new Error('Use um CSV de até 65 KB.'); setCsv(await file.text()); setBatch(undefined); });
          }} />
        </label>
        <label className="field"><span>Conteúdo do lote</span><textarea rows={6} value={csv} maxLength={65000} placeholder={batchHeader}
          onChange={(event) => { setCsv(event.target.value); setBatch(undefined); }} /></label>
        <div><button className="button button-primary" disabled={!csv.trim() || busy} onClick={() => void run(async () => {
          setBatch(await request<BatchPreview>('/operations/batch/preview', 'POST', { text: csv }));
        })}><FileUp size={17} /> Validar lote</button></div>
        {batch && <>
          <Notice tone={batch.issues.length ? 'warn' : 'success'}>
            {batch.rows.length} ficha(s) válida(s). {batch.issues.length} linha(s) para corrigir.
            {batch.issues.length > 0 && <ul className="issues">{batch.issues.map(({ line, message }) => <li key={line}>Linha {line} · {message}</li>)}</ul>}
          </Notice>
          <ScrollTable label="Fichas da prévia do lote"><table><thead><tr><th>Linha</th><th>Produto</th><th>TP (min)</th></tr></thead>
            <tbody>{batch.rows.map(({ line, input, totalMinutes }) => <tr key={line}><td>{line}</td><td>{input.productName}</td><td>{decimal(totalMinutes)}</td></tr>)}</tbody>
          </table></ScrollTable>
          <div className="button-group">
            <button className="button button-primary" disabled={busy || batch.issues.length > 0 || !batch.rows.length} onClick={() => void run(async () => {
              const saved = await request<ProcessOperation[]>('/operations/batch', 'POST', { text: csv, token: batch.token });
              await reload();
              setBatch(undefined); setCsv(''); setMessage(saved.length + ' ficha(s) emitida(s) e disponíveis no histórico.');
            }, () => setBatch(undefined))}>Emitir lote</button>
            <button className="button button-secondary" onClick={() => navigate('historico')}>Abrir histórico</button>
          </div>
        </>}
      </fieldset>
    </section>}
  </div>;
}
