// GitHub https://github.com/joaork

export const audioSizeLimit = 5 * 1024 * 1024;
export const microphoneTimeLimit = 120;

const recordingTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/wav'];

export interface Recording {
  stop: () => void;
  dispose: () => void;
}

interface RecordingFeedback {
  frame: (seconds: number, levels: number[]) => void;
  ready: (file: File) => void;
  error: (message: string) => void;
}

export function stopMicrophone(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function recordedFile(chunks: Blob[], mimeType: string): File {
  const size = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  if (!size) throw new Error('A gravação está vazia. Tente novamente.');
  if (size > audioSizeLimit) throw new Error('A gravação excede 5 MB. Grave um trecho mais curto.');
  const type = (mimeType || chunks.find(({ type }) => type)?.type || '').split(';')[0];
  const extension = type === 'audio/webm' ? 'webm'
    : type === 'audio/mp4' || type === 'video/mp4' ? 'm4a'
      : type === 'audio/wav' || type === 'audio/x-wav' ? 'wav' : undefined;
  if (!extension) throw new Error('O navegador gravou em um formato incompatível. Envie um arquivo MP3, M4A, WAV ou WEBM.');
  return new File(chunks, 'gravacao-' + Date.now() + '.' + extension, { type });
}

export function startRecording(stream: MediaStream, feedback: RecordingFeedback): Recording {
  const mimeType = recordingTypes.find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 });
  let context: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let samples: Uint8Array<ArrayBuffer> | undefined;
  try {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    samples = new Uint8Array(analyser.frequencyBinCount);
    void context.resume().catch(() => undefined);
  } catch {
    // O navegador pode gravar mesmo quando a análise do áudio está indisponível.
  }

  const chunks: Blob[] = [];
  let bytes = 0;
  let done = false;
  let animation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startedAt = performance.now();
  let lastFrame = -100;

  function release() {
    if (timer !== undefined) clearTimeout(timer);
    cancelAnimationFrame(animation);
    stopMicrophone(stream);
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
  }

  function dispose() {
    if (done) return;
    done = true;
    if (recorder.state !== 'inactive') recorder.stop();
    release();
  }

  function stop() {
    if (recorder.state !== 'inactive') recorder.stop();
  }

  function readFrame(now: number) {
    if (done) return;
    if (now - lastFrame >= 65) {
      lastFrame = now;
      const levels = Array.from({ length: 18 }, () => .08);
      if (analyser && samples) {
        analyser.getByteFrequencyData(samples);
        for (let index = 0; index < levels.length; index++) {
          const sample = samples[Math.floor(index * samples.length / levels.length)] ?? 0;
          levels[index] = Math.max(.08, sample / 255);
        }
      }
      feedback.frame(Math.floor((now - startedAt) / 1000), levels);
    }
    animation = requestAnimationFrame(readFrame);
  }

  recorder.ondataavailable = ({ data }) => {
    if (done || !data.size) return;
    bytes += data.size;
    if (bytes > audioSizeLimit) {
      dispose();
      feedback.error('A gravação excedeu 5 MB. Grave um trecho mais curto.');
      return;
    }
    chunks.push(data);
  };
  recorder.onerror = () => {
    dispose();
    feedback.error('A gravação foi interrompida. Confira o microfone e tente novamente.');
  };
  recorder.onstop = () => {
    if (done) return;
    done = true;
    release();
    try { feedback.ready(recordedFile(chunks, recorder.mimeType)); }
    catch (error) { feedback.error(error instanceof Error ? error.message : 'Não foi possível concluir a gravação.'); }
  };

  try {
    recorder.start(250);
    timer = setTimeout(stop, microphoneTimeLimit * 1000);
    animation = requestAnimationFrame(readFrame);
  } catch (error) {
    dispose();
    throw error;
  }
  return { stop, dispose };
}
