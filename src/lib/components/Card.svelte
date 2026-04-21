<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    icon?: string;
    accent?: 'default' | 'glow' | 'gradient';
    padding?: 'sm' | 'md' | 'lg';
    onclick?: () => void;
    children?: Snippet;
    action?: Snippet;
  }

  let {
    title,
    icon,
    accent = 'default',
    padding = 'md',
    onclick,
    children,
    action
  }: Props = $props();

  const Tag = $derived(onclick ? 'button' : 'div');
</script>

<svelte:element this={Tag} class="card a-{accent} p-{padding}" class:clickable={!!onclick} {onclick}>
  {#if title}
    <header class="card-head">
      <div class="card-title">
        {#if icon}<span class="mi">{icon}</span>{/if}
        <span>{title}</span>
      </div>
      {#if action}
        <div class="card-action">{@render action()}</div>
      {/if}
    </header>
  {/if}
  {#if children}
    <div class="card-body">{@render children()}</div>
  {/if}
</svelte:element>

<style>
  .card {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-xl);
    display: block;
    width: 100%;
    text-align: left;
    position: relative;
    transition: border-color var(--dur-fast), transform var(--dur-fast) var(--ease-out);
  }
  .card.clickable:hover {
    border-color: var(--border-strong);
  }
  .card.clickable:active {
    transform: scale(0.99);
  }

  .a-glow {
    box-shadow: 0 0 0 1px var(--accent-glow) inset, var(--shadow-md);
  }

  .a-gradient {
    background:
      linear-gradient(var(--bg-2), var(--bg-2)) padding-box,
      var(--grad-primary) border-box;
    border: 1px solid transparent;
  }

  .p-sm { padding: var(--s-3); }
  .p-md { padding: var(--s-4); }
  .p-lg { padding: var(--s-6); }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
    margin-bottom: var(--s-3);
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--text);
  }
  .card-title .mi {
    font-size: 20px;
    color: var(--accent);
  }

  .card-body {
    color: var(--text);
  }
</style>
