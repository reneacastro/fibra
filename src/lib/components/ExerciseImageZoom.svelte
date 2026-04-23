<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Exercise } from '$lib/types';
  import { CATEGORY_ICON } from '$lib/utils/format';
  import Button from './Button.svelte';

  interface Props {
    exercise: Exercise;
    onClose: () => void;
    /** Se passada, mostra botão "Adicionar ao treino" */
    onAdd?: () => void;
  }

  let { exercise, onClose, onAdd }: Props = $props();

  // Lock do scroll do body enquanto modal aberto (evita scroll bleed
  // pro picker/pagina atras)
  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  });

  let frame = $state(0);
  let interval: ReturnType<typeof setInterval> | undefined;
  let paused = $state(false);

  $effect(() => {
    if (!exercise.gifEndUrl || paused) {
      if (interval) clearInterval(interval);
      return;
    }
    interval = setInterval(() => {
      frame = frame === 0 ? 1 : 0;
    }, 1100);
    return () => { if (interval) clearInterval(interval); };
  });

  const currentSrc = $derived(
    frame === 1 && exercise.gifEndUrl ? exercise.gifEndUrl : exercise.gifUrl
  );

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === ' ') { e.preventDefault(); paused = !paused; }
  }

  const muscles = $derived(
    Array.isArray(exercise.muscleGroup) ? exercise.muscleGroup : [exercise.muscleGroup]
  );
  const cats = $derived(
    Array.isArray(exercise.category) ? exercise.category : [exercise.category]
  );
</script>

<svelte:window onkeydown={handleKey} />

<div class="backdrop" onclick={handleBackdrop} role="presentation">
  <div class="modal" role="dialog" aria-modal="true">
    <button class="close" onclick={onClose} aria-label="Fechar">
      <span class="mi">close</span>
    </button>

    <div class="img-wrap">
      <img src={currentSrc} alt={exercise.name} />
      {#if exercise.gifEndUrl}
        <div class="frame-indicator">
          <button class="frame-dot" class:on={frame === 0} onclick={() => { paused = true; frame = 0; }} aria-label="Posição inicial"></button>
          <button class="frame-dot" class:on={frame === 1} onclick={() => { paused = true; frame = 1; }} aria-label="Posição final"></button>
        </div>
        <button class="play-pause" onclick={() => (paused = !paused)} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
          <span class="mi">{paused ? 'play_arrow' : 'pause'}</span>
        </button>
      {/if}
    </div>

    <div class="info">
      <h2>{exercise.name}</h2>
      <div class="chips">
        {#each cats as c (c)}
          <span class="chip">{CATEGORY_ICON[c] ?? '🔹'} {c}</span>
        {/each}
        {#each muscles as m (m)}
          <span class="chip muscle">{m}</span>
        {/each}
        <span class="chip eq">{exercise.equipment}</span>
      </div>
      {#if exercise.gifEndUrl}
        <p class="hint">
          <span class="mi">swipe</span>
          Toque nos pontos pra ver início/fim do movimento, ou espaço pra pausar
        </p>
      {/if}
      {#if exercise.instructions}
        <p class="instructions">{exercise.instructions}</p>
      {/if}

      {#if onAdd}
        <div class="add-row">
          <Button icon="add" full size="lg" onclick={() => { onAdd(); onClose(); }}>
            Adicionar ao treino
          </Button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    backdrop-filter: blur(8px);
    z-index: 500;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--s-3);
    animation: fade 200ms;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    width: 100%;
    max-width: 480px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-2xl);
    padding: var(--s-4);
    position: relative;
    animation: pop 240ms var(--ease-spring);
    max-height: 95dvh;
    overflow-y: auto;
  }
  @keyframes pop {
    from { transform: scale(0.92); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .close {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
    z-index: 10;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    display: grid;
    place-items: center;
  }
  .close:hover { background: rgba(0, 0, 0, 0.85); }
  .close .mi { font-size: 20px; }

  .img-wrap {
    position: relative;
    width: 100%;
    max-height: 55dvh;
    background: #000;
    border-radius: var(--r-lg);
    overflow: hidden;
    margin-bottom: var(--s-3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .img-wrap img {
    width: 100%;
    height: auto;
    max-height: 55dvh;
    object-fit: contain;
    display: block;
    transition: opacity 200ms;
  }

  .frame-indicator {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    background: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: var(--r-full);
  }
  .frame-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    transition: all var(--dur-fast);
  }
  .frame-dot.on {
    background: var(--accent);
    transform: scale(1.2);
  }

  .play-pause {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    display: grid;
    place-items: center;
  }
  .play-pause .mi { font-size: 18px; }

  .info h2 {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: var(--s-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: var(--s-3);
  }
  .chip {
    padding: 4px 10px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text);
    text-transform: capitalize;
  }
  .chip.muscle { color: var(--accent); background: var(--accent-glow); }
  .chip.eq { color: var(--text-mute); }

  .hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-xs);
    color: var(--text-mute);
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
    margin-bottom: var(--s-3);
  }
  .hint .mi { font-size: 16px; color: var(--accent); }

  .instructions {
    font-size: var(--fs-sm);
    color: var(--text);
    line-height: 1.5;
    padding: var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
  }

  .add-row {
    margin-top: var(--s-3);
  }
</style>
