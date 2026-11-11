// GitHub https://github.com/joaork

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { microphoneTimeLimit, startRecording, stopMicrophone } from './recording';
import type { Recording } from './recording';
import { Notice, Spinner } from './ui';

const rest = Array.from({ length: 18 }, () => .08);

function clock(seconds: number): string {
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

function microphoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'A permissão do microfone foi negada. Libere o microfone nas configurações do site e tente novamente.';
    if (error.name === 'NotFoundError') return 'Nenhum microfone disponível. Conecte um dispositivo ou escolha um arquivo.';
    if (error.name === 'OverconstrainedError') return 'O microfone selecionado está indisponível. Selecione outro dispositivo.';
    if (error.name === 'NotReadableError') return 'Não foi possível abrir o microfone. Verifique se outro aplicativo está usando o dispositivo.';
  }
  return 'Não foi possível iniciar a gravação neste navegador.';
}

export function MicrophoneRecorder({ onRecorded, onActivity }: { onRecorded: (file: File) => void; onActivity: (active: boolean) => void }) {
  const [status, setStatus] = useState<'idle' | 'permission' | 'recording' | 'stopping'>('idle');
  const [frame, setFrame] = useState({ seconds: 0, levels: rest });
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [activeDevice, setActiveDevice] = useState('');
  const recording = useRef<Recording | undefined>(undefined);
  const generation = useRef(0);

  useEffect(() => {
    const media = navigator.mediaDevices;
    let alive = true;
    function refresh() {
      void media?.enumerateDevices().then((list) => {
        if (!alive) return;
        const inputs = list.filter(({ kind, deviceId }) => kind === 'audioinput' && deviceId && deviceId !== 'default' && deviceId !== 'communications');
        setDevices(inputs);
        setDeviceId((current) => inputs.some((item) => item.deviceId === current) ? current : '');
      }).catch(() => undefined);
    }
    refresh();
    media?.addEventListener('devicechange', refresh);
    return () => { alive = false; media?.removeEventListener('devicechange', refresh); };
  }, []);

  useEffect(() => {
    return () => {
      generation.current += 1;
      recording.current?.dispose();
      onActivity(false);
    };
  }, [onActivity]);

  function reset() {
    recording.current = undefined;
    setStatus('idle');
    onActivity(false);
  }

  async function start() {
    setError('');
    setFrame({ seconds: 0, levels: rest });
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('A gravação precisa de um navegador compatível e de um endereço seguro. Use o endereço local do Tessaro ou importe um arquivo.');
      return;
    }
    const requestId = ++generation.current;
    setStatus('permission');
    onActivity(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      } });
      if (requestId !== generation.current) { stopMicrophone(stream); return; }
      setActiveDevice(stream.getAudioTracks()[0]?.label ?? '');
      void navigator.mediaDevices.enumerateDevices().then((list) => {
        if (requestId !== generation.current) return;
        setDevices(list.filter((item) => item.kind === 'audioinput' && item.deviceId && item.deviceId !== 'default' && item.deviceId !== 'communications'));
      }).catch(() => undefined);
      recording.current = startRecording(stream, {
        frame: (seconds, levels) => setFrame({ seconds, levels }),
        ready: (file) => { reset(); onRecorded(file); },
        error: (message) => { reset(); setError(message); },
      });
      setStatus('recording');
    } catch (cause) {
      if (stream) stopMicrophone(stream);
      if (requestId !== generation.current) return;
      reset();
      setError(microphoneError(cause));
    }
  }

  function cancel() {
    generation.current += 1;
    recording.current?.dispose();
    reset();
    setFrame({ seconds: 0, levels: rest });
  }

  const label = { idle: 'Microfone', permission: 'Aguardando permissão', recording: 'Gravando', stopping: 'Finalizando gravação' }[status];
  return <div className="audio-recorder">
    <div className="recorder-display">
      <span className={'recorder-dot' + (status === 'recording' ? ' recording' : '')} aria-hidden="true" />
      <strong role="status">{label}</strong>
      <time aria-label="Duração da gravação">{clock(frame.seconds)}</time>
    </div>
    <div className="recorder-wave" aria-hidden="true">
      {frame.levels.map((level, index) => <span key={index} style={{ transform: 'scaleY(' + level + ')' }} />)}
    </div>
    {status === 'idle' && devices.length > 0 && <label className="field"><span>Dispositivo de entrada</span>
      <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
        <option value="">Microfone padrão</option>
        {devices.map((item, index) => <option key={item.deviceId} value={item.deviceId}>{item.label || 'Microfone ' + (index + 1)}</option>)}
      </select>
    </label>}
    {status === 'recording' && <p className="workflow-muted">{activeDevice && `${activeDevice} · `}Fale e confira se o medidor reage.</p>}
    <div className="button-group">
      {status === 'idle' && <button type="button" className="button button-primary" onClick={() => void start()}><Mic size={16} /> Gravar do microfone</button>}
      {status === 'permission' && <button type="button" className="button button-secondary" onClick={cancel}><X size={16} /> Cancelar solicitação</button>}
      {status === 'recording' && <>
        <button type="button" className="button button-primary" onClick={() => { setStatus('stopping'); recording.current?.stop(); }}><Square size={15} /> Parar gravação</button>
        <button type="button" className="button button-secondary" onClick={cancel}>Descartar</button>
      </>}
      {status === 'stopping' && <Spinner />}
      <small>Até {microphoneTimeLimit / 60} minutos por gravação</small>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
  </div>;
}
