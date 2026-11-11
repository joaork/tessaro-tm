import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

export function AudioPreview({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [timeline, setTimeline] = useState({ current: 0, duration: 0 });
  const [failed, setFailed] = useState(false);

  function updateTimeline(element: HTMLAudioElement) {
    setTimeline({ current: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : 0 });
  }

  async function toggle() {
    if (!audio.current) return;
    if (!audio.current.paused) { audio.current.pause(); return; }
    try { await audio.current.play(); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true); }
  }

  return <div className="audio-player" role="group" aria-label={label}>
    <audio ref={audio} src={src} preload="metadata" hidden onLoadStart={() => {
      setTimeline({ current: 0, duration: 0 });
      setPlaying(false);
      setFailed(false);
    }} onLoadedMetadata={(event) => updateTimeline(event.currentTarget)} onDurationChange={(event) => updateTimeline(event.currentTarget)}
      onTimeUpdate={(event) => updateTimeline(event.currentTarget)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setFailed(true); }} />
    <button type="button" className="icon-button" aria-label={(playing ? 'Pausar' : 'Reproduzir') + ' · ' + label}
      disabled={failed} onClick={() => void toggle()}>
      {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
    </button>
    <input type="range" min="0" max={timeline.duration || 1} step="0.1" value={Math.min(timeline.current, timeline.duration)}
      aria-label={'Posição · ' + label} aria-valuetext={clock(timeline.current)} disabled={!timeline.duration || failed}
      onChange={(event) => {
        if (!audio.current) return;
        audio.current.currentTime = Number(event.target.value);
        updateTimeline(audio.current);
      }} />
    <time>{clock(timeline.current)}{timeline.duration > 0 && ' / ' + clock(timeline.duration)}</time>
    {failed && <span className="audio-player-error" role="alert">Não foi possível reproduzir este áudio. Escolha outro arquivo.</span>}
  </div>;
}
