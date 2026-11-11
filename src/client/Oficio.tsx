import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Download, FileAudio, Mic, Plus, TextCursorInput, Trash2 } from 'lucide-react';
import type { OperationInput, Workspace } from '../shared/contracts';
import { addDecimals, multiplyDecimals } from '../shared/decimal';
import { audioFormats, captureRoute } from '../shared/workflow';
import type { SuggestedStep, Transcript } from '../shared/workflow';
import { ApiError, messageFrom, request } from './api';
import { decimal, ErrorNotice, Notice, PageTitle, PanelTitle, Spinner } from './ui';
import { FicheSelect } from './WorkflowControls';
import { MicrophoneRecorder } from './MicrophoneRecorder';
import { audioSizeLimit } from './recording';
import { AudioPreview } from './AudioPreview';

type Draft = SuggestedStep & { id: number; url?: string };
const acceptedAudio = Object.keys(audioFormats).map((extension) => '.' + extension).join(',');

export function Oficio({ workspace, onDraft }: { workspace: Workspace; onDraft: (input: OperationInput) => void }) {
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState('');
  const [rows, setRows] = useState<Draft[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'transcribe' | 'suggest' | null>(null);
  const [audioStatus, setAudioStatus] = useState<'loading' | 'enabled' | 'disabled' | 'unavailable'>('loading');
  const [mode, setMode] = useState<'text' | 'audio'>('text');
  const [clip, setClip] = useState<{ file: File; url: string }>();
  const [micBusy, setMicBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const urls = useRef(new Set<string>());
  const sequence = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const activeUrls = urls.current;
    let checking = true;
    void request<{ audio: boolean }>('/capture/status').then(({ audio }) => {
      if (checking) setAudioStatus(audio ? 'enabled' : 'disabled');
    }).catch(() => { if (checking) setAudioStatus('unavailable'); });
    return () => {
      checking = false;
      alive.current = false;
      activeUrls.forEach((url) => URL.revokeObjectURL(url));
      activeUrls.clear();
    };
  }, []);

  useEffect(() => {
    const url = clip?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [clip]);

  function selectAudio(file: File) {
    setError(null);
    const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? '';
    if (!file.size || file.size > audioSizeLimit || !Object.hasOwn(audioFormats, extension)) {
      setError(new ApiError('Escolha um arquivo de áudio válido com até 5 MB.'));
      return;
    }
    setConsent(false);
    setTranscript('');
    setClip({ file, url: URL.createObjectURL(file) });
  }

  async function transcribeClip() {
    if (!clip || !consent || audioStatus !== 'enabled' || micBusy || busy) return;
    setBusy('transcribe');
    setError(null);
    try {
      const form = new FormData();
      form.set('consent', 'openai');
      form.set('file', clip.file);
      const result = await request<Transcript>('/capture/transcribe', 'POST', form);
      if (alive.current) setTranscript(result.text);
    } catch (cause) {
      if (alive.current) setError(messageFrom(cause));
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function suggest() {
    const fromAudio = mode === 'audio' ? clip : undefined;
    const content = fromAudio ? transcript : text;
    if (!content.trim() || content.length > 20000 || busy || micBusy) return;
    setBusy('suggest');
    setError(null);
    try {
      const result = await request<SuggestedStep[]>('/capture/suggest', 'POST', { text: content });
      if (!alive.current) return;
      if (!result.length) throw new ApiError('Descreva ao menos uma etapa do método para gerar sugestões.');
      if (rows.length + result.length > 50) throw new Error('Use até 50 trechos por roteiro.');
      const url = fromAudio ? URL.createObjectURL(fromAudio.file) : undefined;
      if (url) urls.current.add(url);
      const added = result.map((step) => ({
        ...step, id: ++sequence.current, url, audioName: fromAudio?.file.name.slice(0, 250),
      }));
      setRows((current) => [...current, ...added]);
      if (fromAudio) { setClip(undefined); setTranscript(''); setConsent(false); }
      else setText('');
    } catch (cause) {
      if (alive.current) setError(messageFrom(cause));
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  function update(id: number, values: Partial<Draft>) {
    setRows((items) => items.map((item) => item.id === id ? { ...item, ...values } : item));
  }

  function remove(row: Draft) {
    const remaining = rows.filter(({ id }) => id !== row.id);
    if (row.url && !remaining.some(({ url }) => url === row.url)) {
      URL.revokeObjectURL(row.url);
      urls.current.delete(row.url);
    }
    setRows(remaining);
  }

  function move(index: number, offset: number) {
    setRows((current) => {
      const next = [...current];
      const target = index + offset;
      const item = next[index];
      if (!item || !next[target]) return current;
      next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  const catalog = new Map(workspace.mtm.map((element) => [element.code, element]));
  const validCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= 250;
  const count = rows.reduce((sum, row) => sum + (validCount(row.count) ? row.count : 0), 0);
  const pending = rows.filter((row) => !catalog.has(row.code) || !row.text.trim() || !validCount(row.count)).length;
  const manual = rows.reduce((sum, row) => {
    const element = catalog.get(row.code);
    return element && validCount(row.count) ? addDecimals(sum, multiplyDecimals(element.minutes, String(row.count))) : sum;
  }, '0');
  const ready = rows.length > 0 && pending === 0 && count <= 250;

  function useDraft() {
    const previous = workspace.operations.find(({ id }) => id === source)?.input;
    const steps = rows.map(({ text, code, count, audioName }) => ({ text, code, count, audioName }));
    onDraft({
      productName: '', perimeter: '', density: '', machineCode: '', ...previous,
      poCode: '', revision: '00', capture: { steps },
      route: captureRoute({ steps }),
    });
  }

  return <div className="stack">
    <PageTitle module="oficio" title="OFÍCIO" description="Capture o método, revise os trechos e monte o roteiro MTM da ficha." />
    <section className="panel">
      <PanelTitle title="Adicionar trechos do método" />
      <fieldset className="panel-padding stack" disabled={!!busy}>
        <div className="capture-tabs" role="group" aria-label="Forma de captura">
          <button className={'button ' + (mode === 'text' ? 'button-primary' : 'button-secondary')} aria-pressed={mode === 'text'} disabled={micBusy} onClick={() => { setMode('text'); setError(null); }}><TextCursorInput size={15} /> Texto</button>
          <button className={'button ' + (mode === 'audio' ? 'button-primary' : 'button-secondary')} aria-pressed={mode === 'audio'} onClick={() => { setMode('audio'); setError(null); }}><Mic size={15} /> Áudio e microfone</button>
        </div>
        {mode === 'text' ? <>
          <label className="field"><span>Descrição da operação</span>
            <textarea rows={4} maxLength={20000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Apanhar a peça e posicionar na mesa; ajeitar a peça duas vezes" />
            <small>Separe as etapas por frases, linhas ou ponto e vírgula.</small>
          </label>
          <ErrorNotice error={error} />
          <div><button className="button button-primary" onClick={() => void suggest()} disabled={!text.trim() || !!busy}>
            {busy === 'suggest' ? <Spinner /> : <Plus size={16} />} Sugerir etapas do texto
          </button></div>
        </> : <div className="stack">
          <MicrophoneRecorder onRecorded={selectAudio} onActivity={setMicBusy} />
          <label className="field"><span>Arquivo de áudio</span>
            <input type="file" disabled={micBusy} accept={acceptedAudio} onChange={(event) => {
              const audio = event.target.files?.[0];
              if (audio) selectAudio(audio);
              event.target.value = '';
            }} />
          </label>
          {clip && !micBusy && <div className="workflow-step">
            <strong>{clip.file.name}</strong>
            <AudioPreview key={clip.url} src={clip.url} label="Prévia do áudio" />
            <div><a className="button button-secondary" href={clip.url} download={clip.file.name}><Download size={16} /> Baixar áudio</a></div>
          </div>}
          {audioStatus === 'enabled' ? <>
            <label className="workflow-check"><input type="checkbox" checked={consent} disabled={!clip || micBusy} onChange={(event) => setConsent(event.target.checked)} />
              Autorizo enviar este áudio à OpenAI para transcrição.
            </label>
            <div><button className="button button-primary" disabled={!clip || !consent || !!busy || micBusy} onClick={() => void transcribeClip()}>
              {busy === 'transcribe' ? <Spinner /> : <FileAudio size={16} />} {busy === 'transcribe' ? 'Transcrevendo…' : 'Transcrever áudio'}
            </button></div>
          </> : <Notice>{audioStatus === 'loading' ? 'Consultando a disponibilidade da transcrição…'
            : audioStatus === 'disabled' ? 'A transcrição automática precisa da chave do servidor. Grave, ouça e revise o trecho por texto.'
              : 'Não foi possível verificar a transcrição. Revise o trecho por texto.'}</Notice>}
          <ErrorNotice error={error} />
          {clip && !micBusy && <>
            <label className="field"><span>Texto da gravação para revisão</span>
              <textarea rows={4} maxLength={20000} value={transcript} onChange={(event) => setTranscript(event.target.value)}
                placeholder="Transcreva o áudio ou escreva aqui o que ouviu." />
              {transcript.length > 20000 && <small className="input-error">Revise o relato em trechos de até 20.000 caracteres.</small>}
            </label>
            <div><button className="button button-secondary" onClick={() => void suggest()} disabled={!transcript.trim() || transcript.length > 20000 || !!busy}>
              {busy === 'suggest' ? <Spinner /> : <Plus size={16} />} Sugerir etapas da gravação
            </button></div>
          </>}
        </div>}
      </fieldset>
    </section>
    <section className="panel">
      <PanelTitle title="Conferir o roteiro">
        <button className="button button-secondary" disabled={!!busy || rows.length >= 50} onClick={() => {
          const id = ++sequence.current;
          setRows((items) => [...items, { id, text: '', code: '', count: 1, matches: [] }]);
        }}><Plus size={16} /> Adicionar etapa</button>
      </PanelTitle>
      {rows.length === 0 ? <div className="panel-padding"><p className="workflow-muted">Adicione etapas manualmente ou gere sugestões a partir do relato.</p></div>
        : <fieldset className="panel-padding stack" disabled={!!busy}>
          <div className="workflow-stats">
            <div><small>Ocorrências</small><strong>{count}</strong></div>
            <div><small>Etapas pendentes</small><strong>{pending}</strong></div>
            <div><small>Tempo MTM selecionado</small><strong>{decimal(manual)} min</strong></div>
          </div>
          {count > 250 && <Notice tone="warn">Reduza o roteiro para no máximo 250 ocorrências.</Notice>}
          {rows.map((row, index) => <div className="workflow-step" key={row.id}>
            <div className="workflow-step-header"><strong>Etapa {index + 1}</strong>
              <div className="row-actions">
                <button className="icon-button" disabled={index === 0} aria-label={'Subir etapa ' + (index + 1)} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                <button className="icon-button" disabled={index === rows.length - 1} aria-label={'Descer etapa ' + (index + 1)} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                <button className="icon-button danger" aria-label={'Remover etapa ' + (index + 1)} onClick={() => remove(row)}><Trash2 size={16} /></button>
              </div>
            </div>
            <label className="field"><span>Trecho de origem {index + 1}</span><textarea rows={2} maxLength={1500} value={row.text} onChange={(event) => update(row.id, { text: event.target.value })} /></label>
            {row.url && !rows.slice(0, index).some(({ url }) => url === row.url) && <AudioPreview src={row.url} label={'Gravação de origem da etapa ' + (index + 1)} />}
            <div className="form-grid">
              <label className="field"><span>Elemento MTM da etapa {index + 1}</span>
                <select value={row.code} onChange={(event) => update(row.id, { code: event.target.value })}>
                  <option value="">Escolha no catálogo</option>
                  {workspace.mtm.map(({ code, description, minutes }) => <option key={code} value={code}>{code} · {description} · {decimal(minutes)} min</option>)}
                </select>
              </label>
              <label className="field"><span>Ocorrências da etapa {index + 1}</span>
                <input type="number" min="1" max="250" value={row.count || ''} onChange={(event) => update(row.id, { count: Number(event.target.value) })} />
              </label>
            </div>
            {!row.code && <small>{row.matches.length ? 'Confira as correspondências ' + row.matches.join(', ') + '.' : 'Selecione o elemento cadastrado que representa esta etapa.'}</small>}
          </div>)}
          <FicheSelect label="Reaproveitar parâmetros de uma ficha (opcional)" operations={workspace.operations.filter(({ supersededBy }) => !supersededBy)} value={source} onChange={setSource} />
          <div><button className="button button-primary" disabled={!ready || !!busy || micBusy} onClick={useDraft}>Continuar na operação <ArrowRight size={16} /></button></div>
        </fieldset>}
    </section>
  </div>;
}
