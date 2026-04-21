<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CrossfitConfig } from '$lib/types';
  import Button from './Button.svelte';

  interface Props {
    config: CrossfitConfig;
    onFinish: (data: { elapsedSec: number; rounds?: number }) => void;
  }

  let { config, onFinish }: Props = $props();

  type State = 'idle' | 'countdown' | 'running' | 'paused' | 'done';
  let state = $state<State>('idle');
  let elapsed = $state(0);
  let countdown = $state(10);
  let rounds = $state(0);
  let currentMinute = $state(0);
  let interval: ReturnType<typeof setInterval> | null = null;
  let lastBeep = $state(-1);

  const totalSec = $derived.by(() => {
    if (config.format === 'amrap' || config.format === 'emom') {
      return (config.durationMin ?? 20) * 60;
    }
    if (config.format === 'tabata') return 8 * 30;
    if (config.timeCap) return config.timeCap * 60;
    return 3600; // 1h max
  });

  const remaining = $derived(Math.max(0, totalSec - elapsed));

  const display = $derived.by(() => {
    const t = state === 'countdown' ? countdown : remaining;
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  // EMOM: soa beep a cada minuto novo
  $effect(() => {
    if (config.format === 'emom' && state === 'running') {
      const m = Math.floor(elapsed / 60);
      if (m !== lastBeep && elapsed > 0) {
        lastBeep = m;
        currentMinute = m + 1;
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      }
    }
  });

  function start() {
    state = 'countdown';
    countdown = 10;
    const cdInterval = setInterval(() => {
      countdown -= 1;
      if (navigator.vibrate) navigator.vibrate(40);
      if (countdown <= 0) {
        clearInterval(cdInterval);
        state = 'running';
        if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 200]);
        tick();
      }
    }, 1000);
  }

  function tick() {
    interval = setInterval(() => {
      if (state !== 'running') return;
      elapsed += 1;
      if (remaining === 0 && config.format !== 'fortime' && config.format !== 'chipper') {
        done();
      }
    }, 1000);
  }

  function pause() { state = 'paused'; }
  function resume() { state = 'running'; }
  function tap() { rounds += 1; if (navigator.vibrate) navigator.vibrate(50); }

  function done() {
    state = 'done';
    if (interval) clearInterval(interval);
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    onFinish({ elapsedSec: elapsed, rounds: rounds || undefined });
  }

  onDestroy(() => { if (interval) clearInterval(interval); });

  const showTapper = $derived(
    state === 'running' && (config.format === 'amrap' || config.format === 'rft')
  );
</script>

<div class="wod">
  <div class="fmt-header">
    <div class="fmt-badge">⚡ {config.format.toUpperCase()}</div>
    {#if config.format === 'amrap' || config.format === 'emom'}
      <div class="fmt-info">{config.durationMin} min</div>
    {:else if config.format === 'rft'}
      <div class="fmt-info">{config.rounds} rounds</div>
    {:else if config.timeCap}
      <div class="fmt-info">cap {config.timeCap} min</div>
    {/if}
  </div>

  {#if config.notes}
    <div class="script">{config.notes}</div>
  {/if}

  <div class="clock" class:countdown={state === 'countdown'} class:running={state === 'running'}>
    {#if state === 'countdown'}
      <div class="cd-label">Começando em</div>
      <div class="cd-num mono">{countdown}</div>
    {:else}
      <div class="time mono">{display}</div>
      {#if config.format === 'emom'}
        <div class="emom-min">Minuto {currentMinute} / {config.durationMin}</div>
      {/if}
    {/if}
  </div>

  {#if showTapper}
    <button class="tapper" onclick={tap}>
      <div class="tap-num mono">{rounds}</div>
      <div class="tap-lbl">{config.format === 'amrap' ? 'ROUNDS' : 'ROUND'} — TOQUE PRA +1</div>
    </button>
  {/if}

  <div class="ctrl">
    {#if state === 'idle'}
      <Button icon="play_arrow" size="lg" full onclick={start}>Começar WOD</Button>
    {:else if state === 'running'}
      <Button variant="secondary" icon="pause" full onclick={pause}>Pausar</Button>
      <Button variant="success" icon="stop" full onclick={done}>Encerrar</Button>
    {:else if state === 'paused'}
      <Button variant="secondary" icon="play_arrow" full onclick={resume}>Continuar</Button>
      <Button variant="success" icon="stop" full onclick={done}>Encerrar</Button>
    {/if}
  </div>
</div>

<style>
  .wod {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }

  .fmt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .fmt-badge {
    padding: 6px 14px;
    border-radius: var(--r-full);
    background: var(--cat-crossfit);
    color: var(--bg-0);
    font-weight: 800;
    letter-spacing: 0.1em;
    font-size: var(--fs-sm);
  }
  .fmt-info {
    color: var(--text-mute);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .script {
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    white-space: pre-wrap;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--text);
  }

  .clock {
    text-align: center;
    padding: var(--s-8) var(--s-4);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-xl);
    transition: all var(--dur-fast);
  }
  .clock.running {
    border-color: var(--cat-crossfit);
    box-shadow: 0 0 24px color-mix(in srgb, var(--cat-crossfit) 30%, transparent);
  }

  .cd-label {
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  .cd-num {
    font-size: 120px;
    font-weight: 800;
    color: var(--warn);
    line-height: 1;
    margin-top: var(--s-3);
    animation: pop 1s ease-out infinite;
  }
  @keyframes pop {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.08); }
  }

  .time {
    font-size: 88px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .running .time {
    background: linear-gradient(135deg, var(--cat-crossfit), var(--warn));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .emom-min {
    margin-top: var(--s-3);
    color: var(--cat-crossfit);
    font-weight: 700;
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .tapper {
    width: 100%;
    padding: var(--s-8) var(--s-4);
    background: var(--grad-fire);
    border-radius: var(--r-xl);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: transform var(--dur-fast) var(--ease-spring);
    box-shadow: 0 12px 40px rgba(238, 9, 121, 0.3);
  }
  .tapper:active { transform: scale(0.96); }
  .tap-num {
    font-size: 72px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .tap-lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    opacity: 0.9;
  }

  .ctrl {
    display: flex;
    gap: var(--s-2);
  }
</style>
