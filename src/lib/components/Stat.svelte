<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    unit?: string;
    delta?: number; // +/- % vs período anterior
    icon?: string;
    accent?: 'accent' | 'success' | 'warn' | 'danger' | 'default';
  }

  let { label, value, unit, delta, icon, accent = 'default' }: Props = $props();
</script>

<div class="stat a-{accent}">
  {#if icon}
    <div class="icon-wrap"><span class="mi">{icon}</span></div>
  {/if}
  <div class="body">
    <div class="val-row">
      <span class="val mono">{value}</span>
      {#if unit}<span class="unit">{unit}</span>{/if}
    </div>
    <div class="lbl">{label}</div>
    {#if delta !== undefined}
      <div class="delta" class:up={delta > 0} class:down={delta < 0}>
        <span class="mi">{delta > 0 ? 'trending_up' : delta < 0 ? 'trending_down' : 'trending_flat'}</span>
        <span class="mono">{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .stat {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: var(--s-4);
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
  }
  .a-accent  { border-color: color-mix(in srgb, var(--accent) 30%, var(--border)); }
  .a-success { border-color: color-mix(in srgb, var(--success) 30%, var(--border)); }
  .a-warn    { border-color: color-mix(in srgb, var(--warn) 30%, var(--border)); }
  .a-danger  { border-color: color-mix(in srgb, var(--danger) 30%, var(--border)); }

  .icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .a-accent .icon-wrap { background: var(--accent-glow); color: var(--accent); }

  .body { flex: 1; min-width: 0; }

  .val-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .val {
    font-size: var(--fs-2xl);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
  .unit {
    font-size: var(--fs-sm);
    color: var(--text-mute);
    font-weight: 600;
  }

  .lbl {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    margin-top: 2px;
  }

  .delta {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: var(--fs-xs);
    margin-top: 6px;
    color: var(--text-mute);
  }
  .delta .mi { font-size: 14px; }
  .delta.up { color: var(--success); }
  .delta.down { color: var(--danger); }
</style>
