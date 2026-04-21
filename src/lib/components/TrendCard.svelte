<script lang="ts">
  import Sparkline from './Sparkline.svelte';

  interface Props {
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    trend?: number[];
    delta?: number;
    color?: string;
    accent?: 'default' | 'accent' | 'success' | 'warn' | 'danger';
  }

  let {
    label, value, unit, icon, trend, delta, color, accent = 'default'
  }: Props = $props();

  const color_ = $derived(color ?? 'var(--accent)');
</script>

<div class="card a-{accent}">
  <div class="head">
    {#if icon}
      <div class="icon-wrap">
        <span class="mi">{icon}</span>
      </div>
    {/if}
    <div class="lbl">{label}</div>
  </div>

  <div class="val-row">
    <span class="val mono">{value}</span>
    {#if unit}<span class="unit">{unit}</span>{/if}
  </div>

  {#if delta !== undefined}
    <div class="delta" class:up={delta > 0} class:down={delta < 0}>
      <span class="mi">{delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'trending_flat'}</span>
      <span class="mono">{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
    </div>
  {/if}

  {#if trend && trend.length >= 2}
    <div class="spark">
      <Sparkline values={trend} width={100} height={28} color={color_} highlightLast={false} />
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: var(--s-3);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
  }
  .a-accent  { border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); }
  .a-success { border-color: color-mix(in srgb, var(--success) 30%, var(--border)); }
  .a-warn    { border-color: color-mix(in srgb, var(--warn) 30%, var(--border)); }
  .a-danger  { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }

  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-mute);
  }
  .icon-wrap {
    width: 24px;
    height: 24px;
    border-radius: var(--r-sm);
    background: var(--bg-3);
    display: grid;
    place-items: center;
  }
  .a-accent .icon-wrap { background: var(--accent-glow); color: var(--accent); }
  .a-success .icon-wrap { background: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); }
  .a-warn .icon-wrap { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .a-danger .icon-wrap { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }

  .icon-wrap .mi { font-size: 14px; }

  .lbl {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .val-row {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }
  .val {
    font-size: var(--fs-xl);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .unit {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
  }

  .delta {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 10px;
    color: var(--text-mute);
    margin-top: 2px;
  }
  .delta .mi { font-size: 13px; }
  .delta.up { color: var(--success); }
  .delta.down { color: var(--danger); }

  .spark {
    margin-top: auto;
    padding-top: 6px;
  }
  .spark :global(svg) {
    width: 100%;
    height: auto;
    max-width: 100%;
  }
</style>
