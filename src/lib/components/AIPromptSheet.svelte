<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  interface Props {
    title: string;
    subtitle?: string;
    placeholder: string;
    suggestions?: string[];
    busy?: boolean;
    error?: string | null;
    onSubmit: (prompt: string) => void;
    onClose: () => void;
    /** Opcional: passado quando a geração retorna, pra exibir preview */
    preview?: Snippet;
    /** Callback do botão "Aplicar" quando há preview */
    onAccept?: () => void;
  }

  let {
    title, subtitle, placeholder, suggestions = [], busy = false,
    error = null, onSubmit, onClose, preview, onAccept
  }: Props = $props();

  let prompt = $state('');
  let slowHint = $state(false);
  let elapsedSec = $state(0);

  // Avisa que pode demorar depois de 5s. Depois de 20s, reforça.
  $effect(() => {
    if (!busy) {
      slowHint = false;
      elapsedSec = 0;
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      elapsedSec = Math.floor((Date.now() - start) / 1000);
      if (elapsedSec >= 5) slowHint = true;
    }, 1000);
    return () => clearInterval(timer);
  });

  function submit() {
    if (!prompt.trim() || busy) return;
    onSubmit(prompt.trim());
  }
  function usePreset(s: string) {
    prompt = s;
  }
  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget && !busy) onClose();
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="backdrop" onclick={handleBackdrop} role="presentation">
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="handle"></div>

    <div class="head">
      <div class="head-text">
        <div class="ai-badge">
          <span class="mi">auto_awesome</span>
          IA
        </div>
        <h3>{title}</h3>
        {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      </div>
      <button class="close" onclick={onClose} disabled={busy} aria-label="Fechar">
        <span class="mi">close</span>
      </button>
    </div>

    {#if preview}
      <div class="preview-area">
        {@render preview()}
      </div>
      <div class="actions">
        <Button variant="ghost" onclick={onClose} disabled={busy}>Descartar</Button>
        <Button icon="check_circle" variant="success" full loading={busy} onclick={onAccept}>
          Aplicar
        </Button>
      </div>
    {:else}
      <textarea
        bind:value={prompt}
        placeholder={placeholder}
        disabled={busy}
        rows="4"
      ></textarea>

      {#if suggestions.length > 0}
        <div class="suggestions">
          <div class="sug-lbl">Exemplos</div>
          <div class="sug-list">
            {#each suggestions as s (s)}
              <button class="sug-btn" onclick={() => usePreset(s)} disabled={busy}>{s}</button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="tip">
        <span class="mi">lightbulb</span>
        <span>Prefira prompts curtos e diretos. Quanto mais simples, mais rápido.</span>
      </div>

      {#if error}
        <div class="error-box">
          <span class="mi">error</span>
          <span>{error}</span>
        </div>
      {/if}

      {#if slowHint && busy}
        <div class="slow-box">
          <span class="mi spin">progress_activity</span>
          <div>
            <strong>A IA está pensando…</strong>
            <span class="slow-sub">
              {elapsedSec < 20
                ? 'Pode levar até 30s. Aguarda aí que o resultado sai.'
                : 'Demorou mais que o normal — os modelos grátis tão ocupados. Vou tentar outros automaticamente.'}
            </span>
          </div>
        </div>
      {/if}

      <div class="actions">
        <Button variant="ghost" onclick={onClose} disabled={busy}>Cancelar</Button>
        <Button icon="auto_awesome" full loading={busy} disabled={!prompt.trim()} onclick={submit}>
          {busy ? (elapsedSec > 0 ? `Gerando… ${elapsedSec}s` : 'Gerando…') : 'Gerar'}
        </Button>
      </div>

      <div class="hint">⌘+Enter pra enviar</div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(10px);
    z-index: 300;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    animation: fade 200ms;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .sheet {
    width: 100%;
    max-width: 640px;
    max-height: 90dvh;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: 10px var(--s-4) calc(var(--s-6) + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    animation: slide 320ms var(--ease-spring);
    overflow: hidden;
  }
  @keyframes slide { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .handle {
    width: 40px;
    height: 4px;
    background: var(--bg-4);
    border-radius: var(--r-full);
    margin: 0 auto 10px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .head-text { flex: 1; }

  .ai-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: var(--r-full);
    background: var(--grad-primary);
    color: var(--bg-0);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    margin-bottom: 6px;
  }
  .ai-badge .mi { font-size: 12px; }

  .head h3 {
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .head .sub {
    font-size: var(--fs-sm);
    color: var(--text-mute);
    margin-top: 2px;
  }

  .close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-mute);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .close:hover:not(:disabled) { background: var(--bg-3); color: var(--text); }
  .close:disabled { opacity: 0.3; }

  textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-md);
    line-height: 1.5;
    resize: vertical;
    min-height: 100px;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .suggestions {
    margin-top: var(--s-3);
  }
  .sug-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--s-2);
  }
  .sug-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .sug-btn {
    padding: 8px 12px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    transition: all var(--dur-fast);
    text-align: left;
  }
  .sug-btn:hover:not(:disabled) {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }
  .sug-btn:disabled { opacity: 0.4; }

  .tip {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-top: var(--s-3);
    padding: 8px 12px;
    background: var(--bg-3);
    border-radius: var(--r-md);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    line-height: 1.4;
  }
  .tip .mi { font-size: 16px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }

  .slow-box {
    display: flex;
    gap: var(--s-2);
    align-items: flex-start;
    padding: var(--s-3);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-xs);
    margin-top: var(--s-3);
    line-height: 1.4;
  }
  .slow-box .mi { font-size: 20px; color: var(--accent); flex-shrink: 0; }
  .slow-box strong { display: block; font-weight: 700; margin-bottom: 2px; }
  .slow-sub { color: var(--text-mute); }
  .spin { animation: spin 1.2s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    padding: var(--s-3);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
    border-radius: var(--r-md);
    color: var(--danger);
    font-size: var(--fs-xs);
    margin-top: var(--s-3);
  }

  .actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-4);
  }

  .hint {
    text-align: center;
    font-size: 10px;
    color: var(--text-dim);
    margin-top: var(--s-2);
  }

  .preview-area {
    flex: 1;
    overflow-y: auto;
    max-height: 50dvh;
    padding: var(--s-3);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
</style>
