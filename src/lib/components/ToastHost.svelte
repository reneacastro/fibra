<script lang="ts">
  /**
   * Container global dos toasts in-app. Renderize 1x no layout root.
   *
   * Posicao: top-center (mobile-first). Stack vertical, ultimo no topo.
   * Cada toast slide-in da direita + fade-out ao dismiss.
   * Tap no toast: dispara onClick (se houver) e dismissa.
   */
  import { toast } from '$lib/stores/toast.svelte';
</script>

<div class="toast-host" aria-live="polite" aria-atomic="true">
  {#each toast.list as t (t.id)}
    <button
      class="toast type-{t.type}"
      onclick={() => {
        if (t.onClick) t.onClick();
        toast.dismiss(t.id);
      }}
      aria-label={t.message}
    >
      {#if t.icon}<span class="toast-ic">{t.icon}</span>{/if}
      <span class="toast-msg">{t.message}</span>
      <span class="toast-x" aria-hidden="true">×</span>
    </button>
  {/each}
</div>

<style>
  .toast-host {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0) + var(--s-3));
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 8px;
    padding: 0 var(--s-3);
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    color: var(--text);
    font-size: var(--fs-sm);
    text-align: left;
    max-width: 480px;
    width: 100%;
    animation: slide-down 240ms var(--ease-spring);
    transition: all var(--dur-fast);
  }
  .toast:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  }
  .toast.type-success {
    border-left: 3px solid var(--success);
  }
  .toast.type-error {
    border-left: 3px solid var(--danger);
  }
  .toast.type-warning {
    border-left: 3px solid var(--warn, #f59e0b);
  }
  .toast.type-info {
    border-left: 3px solid var(--accent);
  }
  .toast-ic {
    font-size: 20px;
    flex-shrink: 0;
    line-height: 1;
  }
  .toast-msg {
    flex: 1;
    font-weight: 600;
    line-height: 1.3;
  }
  .toast-x {
    color: var(--text-mute);
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
  }

  @keyframes slide-down {
    from {
      transform: translateY(-12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
