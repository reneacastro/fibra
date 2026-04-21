<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    label?: string;
    hint?: string;
    error?: string;
    icon?: string;
    suffix?: string;
    value?: string | number;
  }

  let {
    label,
    hint,
    error,
    icon,
    suffix,
    value = $bindable(),
    type = 'text',
    ...rest
  }: Props = $props();
</script>

<div class="inp-group" class:has-error={!!error}>
  {#if label}<label>{label}</label>{/if}
  <div class="inp-wrap">
    {#if icon}<span class="mi inp-icon">{icon}</span>{/if}
    <input {type} bind:value {...rest} />
    {#if suffix}<span class="inp-suffix">{suffix}</span>{/if}
  </div>
  {#if error}
    <span class="inp-msg err">{error}</span>
  {:else if hint}
    <span class="inp-msg">{hint}</span>
  {/if}
</div>

<style>
  .inp-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;  /* crítico pra grid — permite o item encolher */
  }

  label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.25;
    /* Labels longos quebram em 2 linhas em vez de estourar */
    overflow-wrap: anywhere;
    min-height: calc(var(--fs-xs) * 1.25);
  }

  .inp-wrap {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    transition: border-color var(--dur-fast), box-shadow var(--dur-fast);
  }
  .inp-wrap:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .has-error .inp-wrap {
    border-color: var(--danger);
  }

  .inp-icon {
    margin-left: var(--s-3);
    color: var(--text-mute);
    font-size: 20px;
  }

  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 14px var(--s-3);
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text);
    font-size: var(--fs-md);
    font-family: inherit;
  }

  input::placeholder {
    color: var(--text-dim);
  }

  .inp-suffix {
    padding-right: var(--s-3);
    padding-left: 2px;
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .inp-msg {
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }
  .inp-msg.err {
    color: var(--danger);
  }

  input[type='date'] {
    color-scheme: dark;
  }
</style>
