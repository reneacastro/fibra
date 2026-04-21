<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from './Button.svelte';
  import { fmtPace } from '$lib/utils/exercise';
  import { getNoSleep } from '$lib/utils/noSleep';

  interface TrackPoint { lat: number; lng: number; t: number }
  interface Props {
    onComplete: (result: {
      distanceM: number;
      paceSecPerKm: number;
      durationSec: number;
      calories: number;
      track: TrackPoint[];
    }) => void;
    onClose: () => void;
    userWeightKg?: number;
    exerciseMets?: number;
  }
  let { onComplete, onClose, userWeightKg = 70, exerciseMets = 9 }: Props = $props();

  type State = 'idle' | 'running' | 'paused';
  let phase = $state<State>('idle');
  let distanceM = $state(0);
  let elapsedSec = $state(0);
  let accuracy = $state<number | null>(null);
  let error = $state<string | null>(null);

  let watchId: number | null = null;
  let tickTimer: number | null = null;
  let startAt = 0;
  let pausedAccumSec = 0;
  let pausedAt = 0;
  let lastPos: GeolocationPosition | null = null;
  let track: TrackPoint[] = [];

  const paceSecPerKm = $derived(
    distanceM > 50 ? Math.round(elapsedSec / (distanceM / 1000)) : 0
  );
  const currentKm = $derived(distanceM / 1000);
  // Kcal em tempo real: MET × peso × horas. Ajusta MET conforme pace real:
  // corrida lenta (pace 7+) ≈ 6 MET; corrida média (6) ≈ 9; rápida (5-) ≈ 11.
  const dynamicMet = $derived.by(() => {
    if (paceSecPerKm === 0) return exerciseMets;
    const minPerKm = paceSecPerKm / 60;
    if (minPerKm > 9) return 5;   // caminhada
    if (minPerKm > 7) return 7;   // trote
    if (minPerKm > 6) return 9;   // corrida moderada
    if (minPerKm > 5) return 11;  // corrida forte
    return 13;                     // sprint
  });
  const calories = $derived(
    Math.round((dynamicMet * userWeightKg * (elapsedSec / 3600)))
  );

  // Celebration a cada km completo
  let lastCelebratedKm = 0;
  let celebrateKm = $state<number | null>(null);
  $effect(() => {
    const whole = Math.floor(currentKm);
    if (whole > lastCelebratedKm && whole >= 1) {
      lastCelebratedKm = whole;
      celebrateKm = whole;
      if (navigator.vibrate) navigator.vibrate([50, 30, 100]);
      setTimeout(() => { celebrateKm = null; }, 2800);
    }
  });

  function haversine(a: GeolocationPosition, b: GeolocationPosition): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.coords.latitude - a.coords.latitude);
    const dLon = toRad(b.coords.longitude - a.coords.longitude);
    const la1 = toRad(a.coords.latitude);
    const la2 = toRad(b.coords.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }


  function start() {
    if (!('geolocation' in navigator)) {
      error = 'Seu navegador não tem GPS. Use o Safari/Chrome no celular.';
      return;
    }
    error = null;
    phase = 'running';
    startAt = Date.now();
    pausedAccumSec = 0;
    lastPos = null;
    track = [];

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        accuracy = pos.coords.accuracy;
        // Descarta leituras muito imprecisas (> 65m). Em cidade com canyon
        // urbano iOS Safari costuma dar 50-60m de erro, ainda útil.
        if (pos.coords.accuracy > 65) return;
        if (lastPos) {
          const d = haversine(lastPos, pos);
          const dt = (pos.timestamp - lastPos.timestamp) / 1000;
          // Descarta saltos irreais (>15m/s = ~54km/h)
          if (dt > 0 && d / dt < 15) {
            distanceM += d;
            track.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp });
          }
        } else {
          // Primeira leitura aceita — sempre entra no track
          track.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp });
        }
        lastPos = pos;
      },
      (err) => {
        error = 'GPS indisponível: ' + err.message;
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    tickTimer = window.setInterval(() => {
      if (phase === 'running') {
        elapsedSec = pausedAccumSec + Math.floor((Date.now() - startAt) / 1000);
      }
    }, 250);

    getNoSleep().enable();
  }

  function pause() {
    phase = 'paused';
    pausedAt = Date.now();
    pausedAccumSec += Math.floor((pausedAt - startAt) / 1000);
  }

  function resume() {
    phase = 'running';
    startAt = Date.now();
    lastPos = null; // zera pra não contar distância do tempo parado
  }

  function stop() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    getNoSleep().disable();
  }

  function finish() {
    stop();
    if (distanceM < 50) {
      error = 'Distância muito curta. Precisa de pelo menos 50m.';
      phase = 'running';
      return;
    }
    onComplete({
      distanceM: Math.round(distanceM),
      paceSecPerKm,
      durationSec: elapsedSec,
      calories,
      track: [...track]
    });
  }

  function discard() {
    stop();
    onClose();
  }

  onDestroy(() => stop());

  function fmtElapsed(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `${m}:${String(ss).padStart(2, '0')}`;
  }
</script>

<div class="backdrop" role="presentation">
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="head">
      <h3>Corrida GPS</h3>
      <button class="close" onclick={discard} aria-label="Fechar">
        <span class="mi">close</span>
      </button>
    </div>

    {#if phase === 'idle'}
      <div class="intro">
        <span class="mi big">location_on</span>
        <p class="title">Pronto pra medir distância + pace</p>
        <p class="sub">
          O FIBRA usa o GPS do celular pra rastrear sua corrida.
          Deixe o app aberto e o celular com a tela ligada (vamos tentar segurar ela pra você).
        </p>
        <Button icon="play_arrow" full size="lg" onclick={start}>Iniciar</Button>
        {#if error}<div class="error">{error}</div>{/if}
      </div>
    {:else}
      <div class="live">
        <div class="big-stat">
          <div class="l">Distância</div>
          <div class="v mono">{currentKm.toFixed(2)}<span class="u">km</span></div>
        </div>

        <div class="mini-row tri">
          <div class="mini">
            <div class="l">Tempo</div>
            <div class="v mono">{fmtElapsed(elapsedSec)}</div>
          </div>
          <div class="mini">
            <div class="l">Pace</div>
            <div class="v mono">{paceSecPerKm > 0 ? fmtPace(paceSecPerKm) : '—'}<span class="u">/km</span></div>
          </div>
          <div class="mini">
            <div class="l">Kcal</div>
            <div class="v mono">{calories}</div>
          </div>
        </div>

        {#if accuracy !== null}
          <div class="acc" class:weak={accuracy > 20}>
            <span class="mi">gps_fixed</span>
            <span>Precisão: {accuracy.toFixed(0)}m {accuracy > 30 ? '— pontos serão ignorados' : ''}</span>
          </div>
        {/if}

        <div class="controls">
          {#if phase === 'running'}
            <Button icon="pause" variant="ghost" onclick={pause}>Pausar</Button>
          {:else}
            <Button icon="play_arrow" variant="secondary" onclick={resume}>Continuar</Button>
          {/if}
          <Button icon="stop" variant="success" full onclick={finish}>Concluir</Button>
        </div>

        {#if error}<div class="error">{error}</div>{/if}
      </div>
    {/if}
  </div>

  {#if celebrateKm}
    <div class="celebrate">
      <div class="confetti">🎉</div>
      <div class="km-big">{celebrateKm} km</div>
      <div class="km-sub">batido!</div>
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 320;
    display: flex; justify-content: center; align-items: flex-end;
    animation: fade 200ms;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .sheet {
    width: 100%; max-width: 520px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: var(--s-4) var(--s-4) calc(var(--s-6) + var(--safe-bottom));
    animation: slide 320ms var(--ease-spring);
  }
  @keyframes slide { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: var(--s-3);
  }
  .head h3 { font-size: var(--fs-lg); font-weight: 800; }
  .close {
    width: 32px; height: 32px; border-radius: 50%;
    color: var(--text-mute); display: grid; place-items: center;
  }
  .close:hover { background: var(--bg-3); color: var(--text); }

  .intro { text-align: center; padding: var(--s-3) 0; }
  .intro .big { font-size: 56px; color: var(--accent); display: block; margin-bottom: var(--s-3); }
  .intro .title { font-size: var(--fs-lg); font-weight: 700; margin-bottom: 6px; }
  .intro .sub { color: var(--text-mute); font-size: var(--fs-sm); line-height: 1.5; margin-bottom: var(--s-4); }

  .live { display: flex; flex-direction: column; gap: var(--s-3); }

  .big-stat {
    text-align: center;
    padding: var(--s-4) 0;
    background: var(--grad-primary);
    border-radius: var(--r-lg);
    color: var(--bg-0);
  }
  .big-stat .l { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.8; }
  .big-stat .v { font-size: 56px; font-weight: 800; line-height: 1; margin-top: 4px; }
  .big-stat .u { font-size: 20px; margin-left: 6px; opacity: 0.8; }

  .mini-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .mini-row.tri { grid-template-columns: 1fr 1fr 1fr; }
  .mini {
    background: var(--bg-3);
    border-radius: var(--r-md);
    padding: var(--s-3);
    text-align: center;
  }
  .mini .l { font-size: var(--fs-xs); color: var(--text-mute); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
  .mini .v { font-size: var(--fs-xl); font-weight: 700; margin-top: 4px; }
  .mini .u { font-size: 13px; color: var(--text-mute); margin-left: 4px; }

  .acc {
    display: flex; gap: 6px; align-items: center; justify-content: center;
    font-size: var(--fs-xs); color: var(--success);
  }
  .acc.weak { color: var(--warning); }
  .acc .mi { font-size: 16px; }

  .controls { display: flex; gap: var(--s-2); margin-top: var(--s-2); }

  .celebrate {
    position: fixed;
    inset: 0;
    z-index: 330;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent) 20%, rgba(0,0,0,0.7));
    animation: fade-in 240ms ease, fade-out 300ms ease 2.5s forwards;
    pointer-events: none;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fade-out { to { opacity: 0; } }
  .confetti { font-size: 120px; animation: pop 500ms var(--ease-spring); }
  @keyframes pop { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
  .km-big {
    font-size: 96px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 24px rgba(0,0,0,0.4);
    animation: slide-up 400ms var(--ease-spring);
  }
  .km-sub {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    margin-top: 8px;
  }
  @keyframes slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .error {
    margin-top: var(--s-2);
    padding: var(--s-2) var(--s-3);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid var(--danger);
    border-radius: var(--r-md);
    color: var(--danger);
    font-size: var(--fs-xs);
    text-align: center;
  }
</style>
