<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    seconds: number;
    onDone?: () => void;
    onCancel?: () => void;
  }

  let { seconds, onDone, onCancel }: Props = $props();

  let remaining = $state(seconds);
  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        // haptic + ding
        if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
        onDone?.();
      }
    }, 1000);
  });

  onDestroy(() => clearInterval(interval));

  const pct = $derived(Math.max(0, Math.min(100, (remaining / seconds) * 100)));
  const mmss = $derived(
    `${Math.floor(Math.max(0, remaining) / 60)}:${String(Math.max(0, remaining) % 60).padStart(2, '0')}`
  );

  function add(s: number) {
    remaining = Math.max(0, remaining + s);
  }
</script>

<div class="rest" role="status" aria-live="polite">
  <div class="rest-ring" style="--pct: {pct}%">
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="44" class="track" />
      <circle
        cx="50" cy="50" r="44"
        class="prog"
        stroke-dasharray="276.46"
        stroke-dashoffset={276.46 * (1 - pct / 100)}
      />
    </svg>
    <div class="time mono">{mmss}</div>
  </div>
  <div class="rest-ctrl">
    <button onclick={() => add(-15)} aria-label="Menos 15s">−15s</button>
    <button onclick={() => add(15)} aria-label="Mais 15s">+15s</button>
    <button class="skip" onclick={onCancel} aria-label="Pular">
      <span class="mi">skip_next</span> Pular
    </button>
  </div>
</div>

<style>
  .rest {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-4);
    padding: var(--s-5);
    background: var(--bg-2);
    border-radius: var(--r-xl);
    border: 1px solid var(--accent);
    box-shadow: var(--shadow-glow);
  }

  .rest-ring {
    position: relative;
    width: 140px;
    height: 140px;
  }
  .rest-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  .track {
    fill: none;
    stroke: var(--bg-3);
    stroke-width: 8;
  }
  .prog {
    fill: none;
    stroke: var(--accent);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
    filter: drop-shadow(0 0 6px var(--accent-glow));
  }
  .time {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: var(--fs-3xl);
    font-weight: 800;
    color: var(--accent);
  }

  .rest-ctrl {
    display: flex;
    gap: var(--s-2);
    align-items: center;
  }
  .rest-ctrl button {
    padding: 10px 16px;
    border-radius: var(--r-full);
    background: var(--bg-3);
    color: var(--text);
    font-weight: 600;
    font-size: var(--fs-sm);
    font-family: var(--font-mono);
  }
  .rest-ctrl button:hover { background: var(--bg-4); }
  .rest-ctrl .skip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-mute);
    font-family: var(--font-sans);
  }
  .rest-ctrl .skip .mi { font-size: 18px; }
</style>
