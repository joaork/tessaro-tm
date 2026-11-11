import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Calculator, ClipboardPaste, Factory,
  FileText, FlaskConical, GitBranch, Plus, RotateCcw, Save, Trash2, Upload,
} from 'lucide-react';
import type { OperationInput, PoPreview, ProcessOperation, Workspace } from '../shared/contracts';
import { splitRoute } from '../shared/workflow';
import { ApiError, messageFrom, request } from './api';
import { Calculation, PoSheet } from './Po';
import { decimal, Empty, ErrorNotice, Notice, PageTitle, PanelTitle, Spinner, StepTitle } from './ui';
import type { Navigate } from './ui';

const emptyInput = { productName: '', perimeter: '', density: '', machineCode: '', route: [] };
const routeLimit = 250;
type RouteRow = { key: number; code: string };
type ConfirmablePreview = PoPreview & { token: string };

export function OperationEditor({ workspace, navigate, onSaved, loadDemo, demoBusy, initialInput, onDraftChange, reload }: {
  workspace: Workspace;
  navigate: Navigate;
  onSaved: (operation: ProcessOperation, showDetail: boolean, submittedDraft: OperationInput) => void;
  loadDemo: () => Promise<void>;
  demoBusy: boolean;
  initialInput?: OperationInput;
  onDraftChange: (input: OperationInput) => void;
  reload: () => Promise<void>;
}) {
  const [input, setInput] = useState<OperationInput>(initialInput ?? emptyInput);
  const [route, setRoute] = useState<RouteRow[]>(() => (initialInput?.route ?? []).map((code, index) => ({ key: index + 1, code })));
  const [selectedCode, setSelectedCode] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [preview, setPreview] = useState<ConfirmablePreview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'preview' | 'save' | 'demand' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const rowId = useRef(initialInput?.route.length ?? 0);
  const { machines, mtm } = workspace;
  const elements = new Map(mtm.map((element) => [element.code, element]));
  const machine = machines.find((item) => item.code === input.machineCode);
  const hasDemo = [...machines, ...mtm].some((item) => item.origin === 'demo');
  const selectedDemo = machine?.origin === 'demo' || route.some(({ code }) => elements.get(code)?.origin === 'demo');
  const draft = useMemo(() => ({ ...input, route: route.map(({ code }) => code) }), [input, route]);
  const hasDraft = draft.route.length > 0 || Object.entries(input).some(([key, value]) => key !== 'route' && Boolean(value));

  useEffect(() => { onDraftChange(draft); }, [draft, onDraftChange]);

  function invalidate() {
    setPreview(null);
    setError(null);
    setMessage('');
  }

  function update(key: Exclude<keyof OperationInput, 'route' | 'capture'>, value: string) {
    setInput((current) => ({ ...current, [key]: value }));
    invalidate();
  }

  function clearDraft() {
    setInput(emptyInput);
    setRoute([]);
    setSelectedCode('');
    setPaste('');
    setPasteOpen(false);
    invalidate();
  }

  function row(code: string): RouteRow {
    return { key: ++rowId.current, code };
  }

  function add(code: string) {
    if (!code || route.length >= routeLimit) return;
    setRoute([...route, row(code)]);
    invalidate();
  }

  function move(index: number, offset: number) {
    const next = [...route];
    const from = next[index];
    const target = index + offset;
    if (!from || !next[target]) return;
    next.splice(index, 1);
    next.splice(target, 0, from);
    setRoute(next);
    invalidate();
  }

  function addPasted() {
    const codes = splitRoute(paste);
    if (!codes.length) {
      setError(new ApiError('Cole ao menos um código MTM para adicionar ao roteiro.'));
      return;
    }
    if (codes.length + route.length > routeLimit) {
      setError(new ApiError('O roteiro aceita até 250 ocorrências.'));
      return;
    }
    setRoute([...route, ...codes.map(row)]);
    setPaste('');
    setPasteOpen(false);
    invalidate();
    setMessage(codes.length + (codes.length === 1 ? ' ocorrência adicionada.' : ' ocorrências adicionadas na ordem informada.'));
  }

  function fillDemo() {
    const demoMachine = machines.find((item) => item.origin === 'demo');
    const demoElements = mtm.filter((item) => item.origin === 'demo').slice(0, 3);
    const firstElement = demoElements[0];
    if (!demoMachine || !firstElement) {
      setError(new ApiError('Carregue os cadastros demonstrativos para montar o exemplo.'));
      return;
    }
    setInput({ ...emptyInput, productName: 'Peça de teste · Demonstração', perimeter: '4,20', density: '2,50', machineCode: demoMachine.code });
    setRoute([...demoElements, firstElement].map((element) => row(element.code)));
    invalidate();
    setMessage('Exemplo demonstrativo preenchido. Confira os dados e calcule a prévia.');
  }

  async function importDemand(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('demand');
    invalidate();
    try {
      const form = new FormData();
      form.append('file', file);
      const parsed = await request<OperationInput>('/demands/parse', 'POST', form);
      setInput(parsed);
      setRoute(parsed.route.map(row));
      setMessage('Dados da demanda preenchidos. Confira a máquina e o roteiro antes de calcular.');
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(null);
    }
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('preview');
    setError(null);
    setMessage('');
    setPreview(null);
    try {
      setPreview(await request<ConfirmablePreview>('/operations/preview', 'POST', draft));
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview || busy) return;
    setBusy('save');
    setError(null);
    try {
      const record = await request<ProcessOperation>('/operations', 'POST', { ...preview.input, token: preview.token });
      onSaved(record, previewRef.current !== null, draft);
    } catch (cause) {
      const issue = messageFrom(cause);
      setError(issue);
      if (issue.status === 409 || issue.status === 422) {
        setPreview(null);
        await reload();
      }
    } finally {
      setBusy(null);
    }
  }

  const ready = machines.length > 0 && mtm.length > 0;
  return (
    <div className="stack editor-page">
      <PageTitle title="Nova operação" description="Preencha os dados da peça, selecione a máquina e monte o roteiro MTM.">
        {hasDraft && <button type="button" className="button button-text" onClick={clearDraft} disabled={!!busy}>
          <RotateCcw size={16} /> Limpar rascunho
        </button>}
        <input className="sr-only" type="file" accept=".txt,text/plain" ref={fileInput} onChange={(event) => void importDemand(event)} tabIndex={-1} aria-hidden="true" />
        <button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>
          {busy === 'demand' ? <Spinner /> : <Upload size={17} />} Importar demanda TXT
        </button>
      </PageTitle>

      {!ready && (
        <section className="panel">
          <Empty heading="h2" icon={Factory} title="Prepare os cadastros de apoio" detail="Cadastre ao menos uma máquina e os elementos necessários ao roteiro. Uma operação com somente o tempo fixo também pode ser calculada quando houver máquina cadastrada.">
            <button className="button button-primary" onClick={() => navigate('importar')}><Upload size={17} /> Importar bases</button>
            <button className="button button-secondary" onClick={() => void loadDemo()} disabled={demoBusy}>
              {demoBusy ? <Spinner /> : <FlaskConical size={17} />} Carregar dados demonstrativos
            </button>
          </Empty>
        </section>
      )}
      {message && <div role="status"><Notice tone="success">{message}</Notice></div>}
      {input.capture && <Notice>Rascunho do OFÍCIO. Confira os parâmetros e o roteiro antes de calcular. Os trechos de origem ficarão na ficha.</Notice>}
      {!preview && <ErrorNotice error={error} />}

      <div className="editor-grid">
        <form className="stack editor-form" onSubmit={(event) => void calculate(event)} noValidate>
          <fieldset disabled={!!busy}>
            <section className="panel form-panel">
              <StepTitle step="01" title="Identificação da peça" description="Informe os parâmetros técnicos do produto e do equipamento." />
              <div className="form-grid">
                <label className="field field-wide"><span>Nome da peça / agrupamento <span className="required-mark">*</span></span>
                  <input value={input.productName} onChange={(event) => update('productName', event.target.value)} placeholder="Informe o nome da peça" maxLength={250} required />
                </label>
                <label className="field"><span>Perímetro de costura <span className="required-mark">*</span></span>
                  <div className="input-unit"><input value={input.perimeter} onChange={(event) => update('perimeter', event.target.value)} inputMode="decimal" placeholder="0,00" required /><small>m</small></div>
                </label>
                <label className="field"><span>Densidade de pontos <span className="required-mark">*</span></span>
                  <div className="input-unit"><input value={input.density} onChange={(event) => update('density', event.target.value)} inputMode="decimal" placeholder="0,00" required /><small>pontos/cm</small></div>
                </label>
                <label className="field field-wide"><span>Máquina <span className="required-mark">*</span></span>
                  <select value={input.machineCode} onChange={(event) => update('machineCode', event.target.value)} required>
                    <option value="">Selecione o equipamento</option>
                    {input.machineCode && !machine && <option value={input.machineCode}>{input.machineCode} · Código ausente na base</option>}
                    {machines.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}{item.origin === 'demo' ? ' (demo)' : ''}</option>)}
                  </select>
                </label>
              </div>
              {machine && <div className="machine-meta"><Factory size={16} /><span>{machine.machineType ? machine.machineType + ' · ' : ''}{decimal(machine.rpm)} rpm</span><span>{decimal(machine.factor)} min/m</span></div>}
              <details className="optional-fields" open={input.poCode || input.operationName || input.revision || input.size || input.dimensions || input.author || input.notes ? true : undefined}>
                <summary>Identificação complementar e observações</summary>
                <div className="form-grid">
                  <label className="field"><span>Código da ficha</span><input value={input.poCode ?? ''} onChange={(event) => update('poCode', event.target.value)} maxLength={80} /></label>
                  <label className="field"><span>Revisão</span><input value={input.revision ?? ''} onChange={(event) => update('revision', event.target.value)} maxLength={30} /></label>
                  <label className="field field-wide"><span>Nome da operação</span><input value={input.operationName ?? ''} onChange={(event) => update('operationName', event.target.value)} maxLength={250} /></label>
                  <label className="field"><span>Tamanho</span><input value={input.size ?? ''} onChange={(event) => update('size', event.target.value)} maxLength={100} /></label>
                  <label className="field"><span>Medidas</span><input value={input.dimensions ?? ''} onChange={(event) => update('dimensions', event.target.value)} maxLength={100} /></label>
                  <label className="field field-wide"><span>Responsável</span><input value={input.author ?? ''} onChange={(event) => update('author', event.target.value)} maxLength={150} /></label>
                  <label className="field field-wide"><span>Observações</span><textarea rows={2} value={input.notes ?? ''} onChange={(event) => update('notes', event.target.value)} maxLength={4000} /></label>
                </div>
              </details>
            </section>

            <section className="panel form-panel">
              <StepTitle step="02" title="Roteiro de elementos MTM" description="A ordem informada será mantida na ficha. Cada ocorrência soma seu tempo." />
              <div className="route-controls">
                <label className="field route-select"><span className="sr-only">Elemento a adicionar</span>
                  <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
                    <option value="">Selecione um elemento MTM</option>
                    {mtm.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.description}{item.origin === 'demo' ? ' (demo)' : ''}</option>)}
                  </select>
                </label>
                <button type="button" className="button button-secondary" disabled={!selectedCode || route.length >= routeLimit} onClick={() => add(selectedCode)}><Plus size={17} /> Adicionar</button>
                <button type="button" className="button button-secondary" onClick={() => setPasteOpen(!pasteOpen)} aria-expanded={pasteOpen}><ClipboardPaste size={16} /> Colar códigos</button>
              </div>
              {pasteOpen && <div className="paste-box">
                <label className="field"><span>Códigos na ordem desejada</span><textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="Exemplo: 2.1, 1.1, 3.1" rows={3} /></label>
                <small>Separe por vírgula, espaço ou quebra de linha.</small>
                <button type="button" className="button button-primary" onClick={addPasted}>Adicionar ao roteiro <ArrowRight size={15} /></button>
              </div>}

              {route.length === 0 ? (
                <div className="route-empty"><GitBranch size={18} /><div><strong>Roteiro vazio</strong><small>Adicione elementos ou calcule apenas o tempo fixo.</small></div></div>
              ) : <ol className="route-list">
                {route.map(({ key, code }, index) => {
                  const element = elements.get(code);
                  return (
                    <li className={'route-row' + (element ? '' : ' route-invalid')} key={key}>
                      <span className="route-position">{String(index + 1).padStart(2, '0')}</span>
                      <div className="route-element"><strong>{element?.description ?? 'Código ausente na base'}</strong><small>{code}{element?.origin === 'demo' ? ' · Demo' : ''}</small></div>
                      <span className="route-time">{element ? decimal(element.minutes) + ' min' : '—'}</span>
                      <div className="row-actions">
                        <button type="button" className="icon-button" aria-label={'Subir ocorrência ' + (index + 1)} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                        <button type="button" className="icon-button" aria-label={'Descer ocorrência ' + (index + 1)} disabled={index === route.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                        <button type="button" className="icon-button danger" aria-label={'Remover ocorrência ' + (index + 1)} onClick={() => { setRoute(route.filter((item) => item.key !== key)); invalidate(); }}><Trash2 size={15} /></button>
                      </div>
                    </li>
                  );
                })}
              </ol>}
            </section>
          </fieldset>

          <div className="editor-actions">
            <button className="button button-text" type="button" onClick={() => navigate('inicio')}><ArrowLeft size={16} /> Voltar</button>
            <button className="button button-primary" type="submit" disabled={!!busy}>
              {busy === 'preview' ? <Spinner /> : <Calculator size={17} />} Calcular prévia
            </button>
          </div>
        </form>

        <aside className="stack editor-aside" aria-label="Apoio à operação">
          <section className="panel">
            <PanelTitle title="Memória de cálculo" description="Composição do tempo da operação." />
            <div className="panel-padding">
              {preview
                ? <Calculation result={preview} />
                : <div className="formula-guide">
                    <div><span>01</span><div><strong>Tempo FIXO</strong><small>Perímetro × fator da máquina</small></div></div>
                    <div><span>02</span><div><strong>Tempos MTM</strong><small>Soma das ocorrências do roteiro</small></div></div>
                    <div><span>03</span><div><strong>Tempo total (TP)</strong><small>FIXO + MTM</small></div></div>
                  </div>}
              <p className="formula-footnote">RPM e densidade de pontos são dados de referência da ficha.</p>
              {preview && <button type="button" className="button button-text" onClick={() => {
                previewRef.current?.focus({ preventScroll: true });
                previewRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
              }}>Ver prévia da ficha <ArrowDown size={15} /></button>}
            </div>
          </section>
          {selectedDemo && <Notice tone="warn">A ficha será marcada como demonstrativa porque usa dados de exemplo.</Notice>}
          {hasDemo && (
            <button className="button button-secondary" type="button" disabled={!!busy} onClick={fillDemo}>
              <FlaskConical size={17} /> Preencher exemplo demonstrativo
            </button>
          )}
        </aside>
      </div>

      {preview && <div className="stack preview-section" ref={previewRef} tabIndex={-1} role="region" aria-label="Prévia da ficha">
        <div className="preview-toolbar">
          <div><FileText size={18} /><strong>Prévia da ficha</strong></div>
          <button className="button button-primary" type="button" disabled={!!busy} onClick={() => void save()}>
            {busy === 'save' ? <Spinner /> : <Save size={17} />} Salvar ficha PO
          </button>
        </div>
        <ErrorNotice error={error} />
        <PoSheet result={preview} />
      </div>}
    </div>
  );
}
