import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Factory, GitBranch, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import type { CatalogKind, Machine, MtmElement, Workspace } from '../shared/contracts';
import { messageFrom, request } from './api';
import type { ApiError } from './api';
import { dateLabel, decimal, Empty, ErrorNotice, Notice, Origin, PageTitle, PanelTitle, ScrollTable, Spinner } from './ui';
import type { Navigate } from './ui';

const catalogCopy = {
  machines: {
    title: 'Máquinas', singular: 'máquina', description: 'Gerencie o equipamento, a rotação padrão e o fator de tempo por metro.',
    icon: Factory, empty: 'Nenhuma máquina cadastrada',
  },
  mtm: {
    title: 'Elementos MTM', singular: 'elemento MTM', description: 'Consulte os códigos, descrições e tempos unitários da matriz de elementos.',
    icon: GitBranch, empty: 'Nenhum elemento cadastrado',
  },
};

type Entry = Machine | MtmElement;

function CatalogForm({ kind, entry, onCancel, onSaved, reload }: {
  kind: CatalogKind;
  entry: Entry | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const machine = entry && 'rpm' in entry ? entry : null;
  const element = entry && 'minutes' in entry ? entry : null;
  const [form, setForm] = useState({
    code: entry?.code ?? '',
    description: entry?.description ?? '',
    rpm: machine ? decimal(machine.rpm) : '',
    factor: machine ? decimal(machine.factor) : '',
    machineType: machine?.machineType ?? '',
    minutes: element ? decimal(element.minutes) : '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const firstEditable = useRef<HTMLInputElement>(null);
  const stale = !!entry && error?.status === 409;

  useEffect(() => { firstEditable.current?.focus({ preventScroll: true }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    setBusy(true);
    setError(null);
    const base = { code: form.code, description: form.description, expectedVersion: entry?.version };
    const body = kind === 'machines'
      ? { ...base, rpm: form.rpm, factor: form.factor, machineType: form.machineType }
      : { ...base, minutes: form.minutes };
    try {
      await request<Entry>('/' + kind, 'PUT', body);
      await onSaved();
    } catch (cause) {
      const issue = messageFrom(cause);
      setError(issue);
      if (entry && issue.status === 409) await reload();
    } finally {
      setBusy(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  return (
    <section className="panel catalog-form-panel">
      <PanelTitle title={(entry ? 'Editar ' : 'Cadastrar ') + catalogCopy[kind].singular}
        description={entry ? 'A alteração gera uma versão para novas fichas. O histórico mantém os valores da emissão.' : 'Inclua os dados técnicos usados no cálculo.'}>
        <button type="button" className="icon-button" onClick={onCancel} disabled={busy} aria-label="Fechar formulário"><X size={18} /></button>
      </PanelTitle>
      <form className="panel-padding" onSubmit={(event) => void submit(event)} noValidate>
        <ErrorNotice error={error} />
        {stale && <Notice>Reabra o cadastro para conferir a versão atual antes de editar.</Notice>}
        <fieldset disabled={busy} className="form-grid">
          <label className="field"><span>Código <span className="required-mark">*</span></span>
            <input ref={!entry ? firstEditable : undefined} value={form.code} readOnly={!!entry} onChange={(event) => update('code', event.target.value)} maxLength={80} required />
          </label>
          <label className="field"><span>{kind === 'machines' ? 'Descrição / modelo' : 'Descrição do elemento'} <span className="required-mark">*</span></span>
            <input ref={entry ? firstEditable : undefined} value={form.description} onChange={(event) => update('description', event.target.value)} maxLength={250} required />
          </label>
          {kind === 'machines' ? <>
            <label className="field"><span>RPM padrão <span className="required-mark">*</span></span>
              <div className="input-unit"><input inputMode="decimal" value={form.rpm} onChange={(event) => update('rpm', event.target.value)} required /><small>rpm</small></div>
            </label>
            <label className="field"><span>Fator de tempo <span className="required-mark">*</span></span>
              <div className="input-unit"><input inputMode="decimal" value={form.factor} onChange={(event) => update('factor', event.target.value)} required /><small>min/m</small></div>
            </label>
            <label className="field"><span>Tipo de equipamento</span>
              <input value={form.machineType} onChange={(event) => update('machineType', event.target.value)} maxLength={150} />
            </label>
          </> : <label className="field"><span>Tempo unitário <span className="required-mark">*</span></span>
            <div className="input-unit"><input inputMode="decimal" value={form.minutes} onChange={(event) => update('minutes', event.target.value)} required /><small>min</small></div>
          </label>}
        </fieldset>
        <div className="button-group form-actions">
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="submit" className="button button-primary" disabled={busy || stale}>{busy && <Spinner />} Salvar cadastro</button>
        </div>
      </form>
    </section>
  );
}

export function Catalog({ kind, workspace, navigate, onSaved, reload }: {
  kind: CatalogKind;
  workspace: Workspace;
  navigate: Navigate;
  onSaved: () => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Entry | 'new' | null>(null);
  const copy = catalogCopy[kind];
  const entries: Entry[] = workspace[kind];
  const keyword = query.trim().toLocaleLowerCase('pt-BR');
  const results = entries.filter((entry) => [entry.code, entry.description, 'machineType' in entry ? entry.machineType : undefined]
    .some((value) => value?.toLocaleLowerCase('pt-BR').includes(keyword)));
  const importPage = kind === 'machines' ? 'importar/maquinas' : 'importar/mtm';

  function open(entry: Entry | 'new') {
    setEditing(entry);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return (
    <div className="stack">
      <PageTitle title={copy.title} description={copy.description}>
        <button className="button button-secondary" onClick={() => navigate(importPage)}><Upload size={16} /> Importar</button>
        <button className="button button-primary" onClick={() => open('new')}><Plus size={17} /> {kind === 'machines' ? 'Nova máquina' : 'Novo elemento'}</button>
      </PageTitle>
      {editing && <CatalogForm key={editing === 'new' ? 'new' : editing.code} kind={kind} entry={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)} reload={reload} onSaved={async () => {
          await onSaved();
          setEditing((current) => current === editing ? null : current);
        }} />}
      <section className="panel catalog-panel">
        <PanelTitle title="Registros cadastrados" description={entries.length + (entries.length === 1 ? ' registro' : ' registros')}>
          {entries.length > 0 && <label className="search"><Search size={17} /><span className="sr-only">Buscar registros</span>
            <input placeholder="Buscar código ou descrição" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>}
        </PanelTitle>
        {results.length ? (
          <ScrollTable label={copy.title}>
            <table>
              <caption className="sr-only">{copy.title}</caption>
              <thead><tr>
                <th scope="col">Código</th><th scope="col">{kind === 'machines' ? 'Descrição / Modelo' : 'Descrição'}</th>
                {kind === 'machines' ? <><th scope="col" className="numeric">RPM padrão</th><th scope="col" className="numeric">Fator (min/m)</th></>
                  : <th scope="col" className="numeric">Tempo (min)</th>}
                <th scope="col">Origem</th><th scope="col">Versão</th><th scope="col"><span className="sr-only">Editar</span></th>
              </tr></thead>
              <tbody>{results.map((entry) => (
                <tr key={entry.code}>
                  <td><span className="code-label">{entry.code}</span></td>
                  <td><strong>{entry.description}</strong>{'rpm' in entry && entry.machineType && <small className="cell-note">{entry.machineType}</small>}</td>
                  {'rpm' in entry ? <><td className="numeric">{decimal(entry.rpm)}</td><td className="numeric">{decimal(entry.factor)}</td></>
                    : <td className="numeric">{decimal(entry.minutes)}</td>}
                  <td><Origin origin={entry.origin} />{entry.source && <small className="cell-note source-note" title={entry.source.sheet + ' · linha ' + entry.source.line}>{entry.source.filename}</small>}</td>
                  <td><span title={'Atualizado em ' + dateLabel(entry.updatedAt)} className="code-label">v{entry.version}</span></td>
                  <td className="table-action"><button className="icon-button" aria-label={'Editar ' + entry.code} onClick={() => open(entry)}><Pencil size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </ScrollTable>
        ) : <Empty icon={copy.icon} title={entries.length ? 'Nenhum registro encontrado' : copy.empty}
          detail={entries.length ? 'Tente buscar por outro código ou descrição.' : 'Adicione registros manualmente ou importe um arquivo com os dados técnicos.'}>
          {!entries.length && <>
            <button className="button button-secondary" onClick={() => navigate(importPage)}><Upload size={16} /> Importar dados</button>
            <button className="button button-text" onClick={() => open('new')}><Plus size={17} /> Cadastrar manualmente</button>
          </>}
        </Empty>}
      </section>
    </div>
  );
}
