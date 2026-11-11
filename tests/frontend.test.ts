// GitHub https://github.com/joaork

import { afterEach, expect, it, vi } from 'vitest';
import { request } from '../src/client/api';
import { recordedFile, startRecording } from '../src/client/recording';
import { sectionHref } from '../src/shared/routes';

afterEach(() => vi.unstubAllGlobals());

function microphoneFixture() {
  const recorders: {
    ondataavailable: ((event: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
  }[] = [];
  class TestRecorder {
    static isTypeSupported() { return true; }
    state = 'inactive';
    mimeType = 'audio/webm;codecs=opus';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => this.onstop?.());
    }
  }
  vi.stubGlobal('MediaRecorder', TestRecorder);
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const stop = vi.fn();
  return {
    stream: { getTracks: () => [{ stop }] } as unknown as MediaStream,
    stop,
    send: (data: Blob) => recorders[0]?.ondataavailable?.({ data }),
  };
}

it('entrega a gravação completa e libera o microfone ao parar', async () => {
  const fixture = microphoneFixture();
  const ready = vi.fn<(file: File) => void>();
  const error = vi.fn();
  const recording = startRecording(fixture.stream, { ready, error, frame: vi.fn() });
  fixture.send(new Blob(['primeiro trecho']));
  fixture.send(new Blob([' segundo trecho']));
  expect(ready).not.toHaveBeenCalled();
  recording.stop();
  await Promise.resolve();
  const file = ready.mock.calls[0]?.[0];
  expect(file?.name).toMatch(/\.webm$/);
  expect(await file?.text()).toBe('primeiro trecho segundo trecho');
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(error).not.toHaveBeenCalled();
});

it('libera o dispositivo e descarta o trecho ao sair da captura', async () => {
  const fixture = microphoneFixture();
  const ready = vi.fn();
  const recording = startRecording(fixture.stream, { ready, error: vi.fn(), frame: vi.fn() });
  fixture.send(new Blob(['áudio descartado']));
  recording.dispose();
  await Promise.resolve();
  expect(fixture.stop).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
});

it('usa a extensão M4A para áudio MP4 e rejeita gravações vazias', () => {
  expect(recordedFile([new Blob(['trecho'], { type: 'audio/mp4' })], '').name).toMatch(/\.m4a$/);
  expect(() => recordedFile([], 'audio/webm')).toThrow(/vazia/);
});

it('preserva o contexto das fichas ao converter atalhos antigos em rotas Next.js', () => {
  expect(sectionHref('historico/1234')).toBe('/historico/?po=1234');
  expect(sectionHref('lastro/1234/M%2F2')).toBe('/lastro/?po=1234&maquina=M%2F2');
  expect(sectionHref('importar/maquinas')).toBe('/importar/?tipo=maquinas');
  expect(sectionHref('\\externo.test')).toBe('/');
});

it.each([409, 410])('preserva o status HTTP %i para a tela recuperar uma confirmação inválida', async (status) => {
  const issue = { line: 2, message: 'Confira a origem dos dados.' };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Revise a prévia.', issues: [issue] } }, { status })));
  await expect(request('/confirmar', 'POST', {})).rejects.toMatchObject({ status, message: 'Revise a prévia.', issues: [issue] });
});
