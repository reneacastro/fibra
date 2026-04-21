<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { WorkoutCategory } from '$lib/types';

  interface Props {
    variant?: 'default' | 'success' | 'warn' | 'danger' | 'info' | 'accent';
    category?: WorkoutCategory;
    size?: 'sm' | 'md';
    icon?: string;
    children?: Snippet;
  }

  let {
    variant = 'default',
    category,
    size = 'md',
    icon,
    children
  }: Props = $props();

  const style = $derived.by(() => {
    if (!category) return '';
    const map: Record<WorkoutCategory, string> = {
      superior: 'var(--cat-upper)',
      inferior: 'var(--cat-lower)',
      fullbody: 'var(--cat-full)',
      livre: 'var(--cat-free)',
      alongamento: 'var(--cat-stretch)',
      funcional: 'var(--cat-func)',
      crossfit: 'var(--cat-crossfit)',
      hiit: 'var(--cat-fire, var(--warn))'
    };
    const color = map[category];
    return `--badge-color:${color};background:color-mix(in srgb, ${color} 18%, transparent);color:${color};`;
  });
</script>

<span class="badge v-{variant} s-{size}" {style}>
  {#if icon}<span class="mi">{icon}</span>{/if}
  {#if children}{@render children()}{/if}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1;
    white-space: nowrap;
  }

  .s-sm { font-size: var(--fs-xs); padding: 3px 8px; }
  .s-md { font-size: var(--fs-sm); padding: 5px 12px; }

  .badge .mi {
    font-size: 14px;
  }

  .v-default { background: var(--bg-3); color: var(--text-mute); }
  .v-success { background: color-mix(in srgb, var(--success) 18%, transparent); color: var(--success); }
  .v-warn    { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .v-danger  { background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); }
  .v-info    { background: color-mix(in srgb, var(--info) 18%, transparent); color: var(--info); }
  .v-accent  { background: var(--accent-glow); color: var(--accent); }
</style>
