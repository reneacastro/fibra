<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  type Size = 'sm' | 'md' | 'lg';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    icon?: string;
    iconRight?: string;
    loading?: boolean;
    full?: boolean;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    full = false,
    disabled,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  class="btn v-{variant} s-{size}"
  class:full
  class:loading
  disabled={disabled || loading}
  {...rest}
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {:else if icon}
    <span class="mi">{icon}</span>
  {/if}
  {#if children}<span class="label">{@render children()}</span>{/if}
  {#if iconRight && !loading}
    <span class="mi right">{iconRight}</span>
  {/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    border-radius: var(--r-full);
    font-weight: 700;
    letter-spacing: 0.01em;
    transition: transform var(--dur-fast) var(--ease-out),
                background var(--dur-fast),
                box-shadow var(--dur-fast);
    white-space: nowrap;
    user-select: none;
  }
  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.full {
    width: 100%;
  }

  /* Sizes */
  .s-sm { padding: 8px 16px; font-size: var(--fs-sm); }
  .s-md { padding: 12px 22px; font-size: var(--fs-md); }
  .s-lg { padding: 16px 28px; font-size: var(--fs-lg); }

  /* Variants */
  .v-primary {
    background: var(--grad-primary);
    color: var(--bg-0);
    box-shadow: var(--shadow-md), 0 0 0 0 transparent;
  }
  @media (hover: hover) {
    .v-primary:hover:not(:disabled) {
      box-shadow: var(--shadow-lg), var(--shadow-glow);
    }
  }

  .v-secondary {
    background: var(--bg-3);
    color: var(--text);
    border: 1px solid var(--border);
  }
  @media (hover: hover) {
    .v-secondary:hover:not(:disabled) {
      background: var(--bg-4);
      border-color: var(--border-strong);
    }
  }

  .v-ghost {
    background: transparent;
    color: var(--text-mute);
  }
  @media (hover: hover) {
    .v-ghost:hover:not(:disabled) {
      background: var(--bg-3);
      color: var(--text);
    }
  }

  .v-danger {
    background: var(--danger);
    color: #fff;
  }

  .v-success {
    background: var(--grad-green);
    color: var(--bg-0);
  }

  .mi.right { margin-left: auto; }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
