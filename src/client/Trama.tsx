import { useState } from 'react';
import { ArrowRight, Calculator, Plus } from 'lucide-react';
import type { Workspace } from '../shared/contracts';
import type { ScenarioHandoff, Simulation } from '../shared/workflow';
import { splitRoute } from '../shared/workflow';
import { messageFrom, request } from './api';
import type { ApiError } from './api';
import { decimal, ErrorNotice, Notice, PageTitle, PanelTitle, ScrollTable, Spinner } from './ui';
import { FicheSelect, MachineChoices } from './WorkflowControls';

export function Trama({ workspace, initialId, onScenario }: { workspace: Workspace; initialId?: string; onScenario: (scenario: ScenarioHandoff) => void }) {
  const [id, setId] = useState(initialId ?? '');
  const [goal, setGoal] = useState('15');
  const initialOperation = workspace.operations.find(({ id }) => id === initialId);
  const [codes, setCodes] = useState<string[]>(() => initialOperation ? [initialOperation.machine.code] : []);
  const [routeText, setRouteText] = useState(() => initialOperation?.input.route.join(', ') ?? '');
  const [elementCode, setElementCode] = useState('');
  const [result, setResult] = useState<Simulation>();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = workspace.operations.find((item) => item.id === id);
  const route = splitRoute(routeText);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(undefined);
    try {
      setResult(await request<Simulation>('/operations/' + id + '/simulate', 'POST', { goal, machineCodes: codes, route }));
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    <PageTitle module="trama" title="TRAMA" description="Teste alterações no roteiro MTM e na máquina antes de revisar uma ficha." />
    <ErrorNotice error={error} />
    <section className="panel">
      <PanelTitle title="Montar cenário" description="A ficha emitida serve de referência. A proposta usa os tempos e fatores dos cadastros vigentes." />
      <fieldset className="panel-padding stack" disabled={busy}>
        <div className="form-grid">
          <FicheSelect operations={workspace.operations} value={id} onChange={(value) => {
            const selected = workspace.operations.find(({ id }) => id === value);
            setId(value);
            setCodes(selected ? [selected.machine.code] : []);
            setRouteText(selected?.input.route.join(', ') ?? '');
            setResult(undefined);
          }} />
          <label className="field"><span>Meta de redução (%)</span><input inputMode="decimal" value={goal} onChange={(event) => { setGoal(event.target.value); setResult(undefined); }} /></label>
        </div>
        {operation && <div className="workflow-step">
          <label className="field"><span>Roteiro MTM proposto</span>
            <textarea rows={3} maxLength={24000} value={routeText} onChange={(event) => { setRouteText(event.target.value); setResult(undefined); }} />
            <small>{route.length} ocorrência(s). Separe códigos por vírgula ou linha e mantenha a ordem. Um roteiro vazio simula apenas a costura.</small>
          </label>
          <div className="route-controls">
            <label className="field route-select"><span className="sr-only">Elemento MTM para o cenário</span>
              <select value={elementCode} onChange={(event) => setElementCode(event.target.value)}>
                <option value="">Selecione um elemento para adicionar</option>
                {workspace.mtm.map(({ code, description }) => <option key={code} value={code}>{code} · {description}</option>)}
              </select>
            </label>
            <button className="button button-secondary" disabled={!elementCode || route.length >= 250} onClick={() => {
              setRouteText([...route, elementCode].join(', ')); setResult(undefined);
            }}><Plus size={16} /> Adicionar ao cenário</button>
            <button className="button button-text" onClick={() => { setRouteText(operation.input.route.join(', ')); setResult(undefined); }}>Restaurar roteiro da ficha</button>
          </div>
        </div>}
        <MachineChoices machines={workspace.machines} value={codes} onChange={(values) => { setCodes(values); setResult(undefined); }} label="Máquinas cuja compatibilidade foi conferida" />
        {route.length > 250 && <Notice tone="warn">Use até 250 ocorrências no roteiro proposto.</Notice>}
        <div><button className="button button-primary" disabled={!operation || !codes.length || !goal.trim() || route.length > 250 || busy} onClick={() => void run()}>
          {busy ? <Spinner /> : <Calculator size={17} />} Simular meta
        </button></div>
      </fieldset>
    </section>
    {result && <section className="panel">
      <PanelTitle title="Resultados da simulação" description="Cenários calculados por peça. Valores simulados não alteram a PO emitida." />
      <div className="panel-padding stack">
        <div className="workflow-stats">
          <div><small>Tempo da ficha</small><strong>{decimal(result.baseline)} min</strong></div>
          <div><small>Tempo desejado</small><strong>{decimal(result.target)} min</strong></div>
          <div><small>MTM da ficha</small><strong>{decimal(result.baselineManualMinutes)} min</strong></div>
          <div><small>MTM proposto</small><strong>{decimal(result.manualMinutes)} min</strong></div>
        </div>
        {result.maximumFactor === null || result.target === result.manualMinutes ? (
          <Notice tone="warn">A meta exige rever o método. A parcela manual já consome o tempo desejado ou o excede.</Notice>
        ) : result.maximumFactor === '0' ? (
          <Notice>O fator necessário é inferior a 0,0000000001 min/m.</Notice>
        ) : <Notice>Com o roteiro proposto, a meta pede um fator de até <strong>{decimal(result.maximumFactor)} min/m</strong>.</Notice>}
        <ScrollTable label="Comparação de cenários por máquina"><table>
          <thead><tr><th>Máquina</th><th>FIXO (min)</th><th>MTM (min)</th><th>TP (min)</th><th>Variação (min)</th><th>Redução</th><th>Meta</th><th>Ação</th></tr></thead>
          <tbody>{result.results.map((item) => <tr key={item.machineCode}>
            <td>{item.machineCode} · {item.description}</td><td>{decimal(item.fixedMinutes)}</td><td>{decimal(item.mtmMinutes)}</td><td>{decimal(item.minutes)}</td><td>{decimal(item.difference)}</td>
            <td>{decimal(item.reduction)}%</td><td>{item.reachesGoal ? 'Atingida' : 'Acima do tempo desejado'}</td>
            <td>{!operation?.supersededBy && <button className="button button-secondary" onClick={() => onScenario({
              operationId: id, machineCode: item.machineCode, route: result.route, minutes: item.minutes,
            })}>
              Revisar PO <ArrowRight size={15} />
            </button>}</td>
          </tr>)}</tbody>
        </table></ScrollTable>
      </div>
    </section>}
  </div>;
}
