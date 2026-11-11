// GitHub https://github.com/joaork

import { Calculator } from 'lucide-react';
import { useState } from 'react';
import type { Workspace } from '../shared/contracts';
import { differenceDecimals, multiplyDecimals } from '../shared/decimal';
import { FicheSelect } from './WorkflowControls';
import { decimal, Notice, PageTitle, PanelTitle } from './ui';

const fields = [
  { key: 'count', label: 'POs elaboradas por mês', unit: 'POs' },
  { key: 'current', label: 'Tempo atual por PO', unit: 'min' },
  { key: 'proposed', label: 'Tempo com a plataforma por PO', unit: 'min' },
  { key: 'cost', label: 'Custo-hora total da equipe', unit: 'R$/h' },
] as const;

const hoursFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function parseNumber(value: string): number {
  return /^\d+(?:[,.]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(',', '.')) : NaN;
}

export function Roi({ workspace, initialId }: { workspace: Workspace; initialId?: string }) {
  const [values, setValues] = useState({ count: '', current: '', proposed: '', cost: '' });
  const [mode, setMode] = useState<'engineering' | 'production'>(initialId ? 'production' : 'engineering');
  const [revisionId, setRevisionId] = useState(initialId ?? '');
  const [volume, setVolume] = useState('');
  const revisions = workspace.operations.filter(({ previousId }) => previousId);
  const revision = revisions.find(({ id }) => id === revisionId);
  const previous = workspace.operations.find(({ id }) => id === revision?.previousId);
  const saving = revision && previous ? differenceDecimals(previous.totalMinutes, revision.totalMinutes) : undefined;
  const units = /^\d{1,9}$/.test(volume.trim()) ? volume.trim() : undefined;
  const productionHours = saving !== undefined && units ? Number(multiplyDecimals(saving.replace(/^-/, ''), units)) / 60 : undefined;
  const count = parseNumber(values.count);
  const current = parseNumber(values.current);
  const proposed = parseNumber(values.proposed);
  const cost = parseNumber(values.cost);
  const hours = (count * (current - proposed)) / 60;
  const amount = hours * cost;
  const ready = Number.isSafeInteger(count) && Number.isFinite(hours);
  const invalidCount = !!values.count.trim() && !Number.isSafeInteger(count);

  return (
    <div className="stack">
      <PageTitle title="Estimativa de ROI" description="Estime o impacto na elaboração das fichas ou na produção por peça." />
      <div className="button-group" role="group" aria-label="Tipo de estimativa">
        <button className={'button ' + (mode === 'engineering' ? 'button-primary' : 'button-secondary')} aria-pressed={mode === 'engineering'} onClick={() => setMode('engineering')}>Engenharia</button>
        <button className={'button ' + (mode === 'production' ? 'button-primary' : 'button-secondary')} aria-pressed={mode === 'production'} onClick={() => setMode('production')}>Produção</button>
      </div>
      {mode === 'engineering' ? <>
      <div className="roi-grid">
        <section className="panel">
          <PanelTitle title="Dados do cenário" description="Preencha os valores medidos ou hipóteses do piloto." />
          <div className="panel-padding form-grid">
            {fields.map(({ key, label, unit }) => {
              const invalid = key === 'count' ? invalidCount : !!values[key].trim() && !Number.isFinite(parseNumber(values[key]));
              return (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <div className="input-unit">
                    <input inputMode={key === 'count' ? 'numeric' : 'decimal'} value={values[key]} placeholder="—"
                      aria-invalid={invalid} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />
                    <small>{unit}</small>
                  </div>
                  {invalid && <small className="input-error">{key === 'count' ? 'Informe uma quantidade inteira dentro do limite de cálculo.' : 'Informe um número válido.'}</small>}
                </label>
              );
            })}
          </div>
        </section>
        <section className="panel roi-results">
          <PanelTitle title="Impacto mensal estimado" description="Resultado baseado nas premissas preenchidas.">
            <span className="metric-icon"><Calculator size={18} /></span>
          </PanelTitle>
          <div className="panel-padding roi-values" aria-live="polite">
            <div><span>Horas técnicas {ready && hours < 0 ? 'adicionais' : 'liberadas'}</span><strong>{ready ? hoursFormat.format(Math.abs(hours)) : '—'} <small>h/mês</small></strong></div>
            <div><span>Valor bruto estimado</span><strong>{ready && Number.isFinite(amount) ? currency.format(amount) : '—'}</strong></div>
          </div>
          <div className="panel-padding roi-formula"><strong>Memória da estimativa</strong><p>Horas = POs/mês × (tempo atual − tempo com a plataforma) ÷ 60</p><p>Valor bruto = horas × custo-hora</p></div>
        </section>
      </div>
      <Notice>Para avaliar o retorno do piloto, inclua custos de implantação, treinamento, manutenção e integração.</Notice>
      </> : <section className="panel">
        <PanelTitle title="Impacto mensal da revisão" description="Compare os tempos emitidos e informe o volume previsto de peças." />
        <div className="panel-padding stack">
          <div className="form-grid">
            <FicheSelect label="Revisão emitida" operations={revisions} value={revisionId} onChange={setRevisionId} />
            <label className="field"><span>Peças previstas por mês</span><input inputMode="numeric" maxLength={9} value={volume} onChange={(event) => setVolume(event.target.value)} />
              {volume && !units && <small className="input-error">Informe uma quantidade inteira.</small>}
            </label>
          </div>
          {revision && previous && <div className="workflow-stats" aria-live="polite">
            <div><small>TP anterior</small><strong>{decimal(previous.totalMinutes)} min</strong></div>
            <div><small>TP aprovado</small><strong>{decimal(revision.totalMinutes)} min</strong></div>
            <div><small>{saving?.startsWith('-') ? 'Horas adicionais estimadas' : 'Horas liberadas estimadas'}</small>
              <strong>{productionHours === undefined ? '—' : hoursFormat.format(productionHours)} h/mês</strong></div>
          </div>}
          <p className="workflow-muted">A projeção multiplica a diferença de tempo por peça pelo volume informado e divide por 60.</p>
        </div>
      </section>}
    </div>
  );
}
