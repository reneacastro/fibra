<script lang="ts">
  interface Tab {
    id: string;
    label: string;
    icon?: string;
    count?: number;
  }

  interface Props {
    tabs: Tab[];
    value: string;
    onChange: (id: string) => void;
  }

  let { tabs, value, onChange }: Props = $props();
</script>

<div class="tabs" role="tablist">
  {#each tabs as t (t.id)}
    <button
      class="tab"
      class:on={value === t.id}
      role="tab"
      aria-selected={value === t.id}
      onclick={() => onChange(t.id)}
    >
      {#if t.icon}<span class="ic">{t.icon}</span>{/if}
      <span class="lbl">{t.label}</span>
      {#if t.count !== undefined}
        <span class="count">{t.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scroll-behavior: smooth;
    padding: 4px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
    transition: all var(--dur-fast);
  }
  .tab:hover:not(.on) {
    background: var(--bg-3);
    color: var(--text);
  }
  .tab.on {
    background: var(--grad-primary);
    color: var(--bg-0);
    box-shadow: var(--shadow-glow);
  }

  .ic { font-size: 14px; }
  .count {
    font-size: var(--fs-xs);
    padding: 2px 7px;
    border-radius: var(--r-full);
    background: rgba(0, 0, 0, 0.2);
    font-family: var(--font-mono);
  }
  .tab:not(.on) .count {
    background: var(--bg-3);
    color: var(--text-dim);
  }
</style>
