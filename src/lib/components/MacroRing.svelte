<script lang="ts">
  interface Props {
    value: number;
    target: number;
    unit?: string;
    label?: string;
    color?: string;
    size?: number;
    strokeWidth?: number;
    showCenter?: boolean;
  }

  let {
    value, target, unit = '', label = '', color = 'var(--accent)',
    size = 120, strokeWidth = 10, showCenter = true
  }: Props = $props();

  const r = $derived(size / 2 - strokeWidth / 2);
  const c = $derived(2 * Math.PI * r);
  const pct = $derived(Math.min(1, target > 0 ? value / target : 0));
  const offset = $derived(c * (1 - pct));
  const remaining = $derived(Math.max(0, target - value));
  const over = $derived(value > target);
</script>

<div class="ring-wrap" style="--size:{size}px">
  <svg viewBox="0 0 {size} {size}" width={size} height={size}>
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke="var(--bg-3)"
      stroke-width={strokeWidth}
    />
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={over ? 'var(--warn)' : color}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={offset}
      transform="rotate(-90 {size / 2} {size / 2})"
      style="transition: stroke-dashoffset 600ms var(--ease-spring); filter: drop-shadow(0 0 6px color-mix(in srgb, {color} 40%, transparent));"
    />
  </svg>
  {#if showCenter}
    <div class="center">
      <div class="val mono">{Math.round(value)}<span class="unit">{unit}</span></div>
      <div class="target mono">/ {target}</div>
      {#if label}<div class="label">{label}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .ring-wrap {
    position: relative;
    width: var(--size);
    height: var(--size);
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 2px;
  }
  .val {
    font-size: calc(var(--size) / 5);
    font-weight: 800;
    line-height: 1;
  }
  .val .unit {
    font-size: calc(var(--size) / 10);
    color: var(--text-mute);
    font-weight: 600;
  }
  .target {
    font-size: calc(var(--size) / 12);
    color: var(--text-dim);
  }
  .label {
    font-size: calc(var(--size) / 14);
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-top: 2px;
  }
</style>
