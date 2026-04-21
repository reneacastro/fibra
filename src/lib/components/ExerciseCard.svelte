<script lang="ts">
  import type { Exercise } from '$lib/types';
  import { CATEGORY_ICON } from '$lib/utils/format';
  import ExerciseImageZoom from './ExerciseImageZoom.svelte';

  interface Props {
    exercise: Exercise;
    selected?: boolean;
    onclick?: () => void;
    onInfo?: () => void;
    compact?: boolean;
    /** Quando true, NÃO abre modal de zoom ao clicar na thumb (caller controla) */
    disableZoom?: boolean;
  }

  let { exercise, selected = false, onclick, onInfo, compact = false, disableZoom = false }: Props = $props();

  const primaryCat = $derived(
    Array.isArray(exercise.category) ? exercise.category[0] : exercise.category
  );
  const primaryMuscle = $derived(
    Array.isArray(exercise.muscleGroup) ? exercise.muscleGroup[0] : exercise.muscleGroup
  );

  // Alterna entre 0.jpg e 1.jpg pra simular movimento
  let frame = $state(0);
  let interval: ReturnType<typeof setInterval> | undefined;

  $effect(() => {
    // Inicia ciclo só se houver gifEndUrl
    if (exercise.gifEndUrl && exercise.gifUrl) {
      interval = setInterval(() => {
        frame = frame === 0 ? 1 : 0;
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  });

  const currentSrc = $derived(
    frame === 1 && exercise.gifEndUrl ? exercise.gifEndUrl : exercise.gifUrl
  );

  let zoomOpen = $state(false);

  function handleThumbClick(e: MouseEvent) {
    e.stopPropagation();
    if (!disableZoom && exercise.gifUrl) zoomOpen = true;
  }
</script>

<div
  class="ex-card"
  class:selected
  class:compact
  role={onclick ? 'button' : undefined}
  tabindex={onclick ? 0 : undefined}
  onclick={onclick}
  onkeydown={(e) => { if (onclick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onclick(); } }}
>
  {#if exercise.gifUrl}
    <button
      class="ex-thumb"
      type="button"
      onclick={handleThumbClick}
      aria-label="Ver imagem ampliada"
      disabled={disableZoom}
    >
      <img
        src={currentSrc}
        alt={exercise.name}
        loading="lazy"
        onerror={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          img.style.display = 'none';
          const parent = img.parentElement;
          if (parent) parent.classList.add('placeholder-fallback');
        }}
      />
      <span class="mi placeholder-icon">fitness_center</span>
      {#if exercise.gifEndUrl && !disableZoom}
        <span class="zoom-hint mi">zoom_in</span>
      {/if}
    </button>
  {:else}
    <div class="ex-thumb placeholder">
      <span class="mi">fitness_center</span>
    </div>
  {/if}

  <div class="ex-body">
    <div class="ex-name">{exercise.name}</div>
    <div class="ex-meta">
      <span class="tag">{CATEGORY_ICON[primaryCat] ?? '🔹'} {primaryMuscle}</span>
      <span class="dot">·</span>
      <span class="tag eq">{exercise.equipment}</span>
    </div>
  </div>

  {#if onInfo && !compact}
    <button
      type="button"
      class="info-btn"
      onclick={(e) => { e.stopPropagation(); onInfo(); }}
      aria-label="Detalhes"
    >
      <span class="mi">info</span>
    </button>
  {:else if selected}
    <div class="check">
      <span class="mi">check</span>
    </div>
  {/if}
</div>

{#if zoomOpen && exercise.gifUrl}
  <ExerciseImageZoom
    exercise={exercise}
    onClose={() => (zoomOpen = false)}
  />
{/if}

<style>
  .ex-card {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-2);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    text-align: left;
    width: 100%;
    transition: all var(--dur-fast);
  }
  .ex-card:hover {
    border-color: var(--border-strong);
    background: var(--bg-3);
  }
  .ex-card.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
    box-shadow: 0 0 0 1px var(--accent), var(--shadow-glow);
  }

  .ex-thumb {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    overflow: hidden;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    cursor: zoom-in;
  }
  .ex-thumb:disabled { cursor: default; }
  .ex-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 200ms;
  }
  .placeholder-icon {
    display: none;
  }
  .ex-thumb.placeholder .mi,
  .ex-thumb.placeholder-fallback .placeholder-icon {
    display: inline-block;
    color: var(--text-dim);
    font-size: 28px;
  }

  .zoom-hint {
    position: absolute;
    bottom: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 1px 3px;
    border-radius: 4px;
    font-size: 12px !important;
    line-height: 1;
  }

  .compact .ex-thumb {
    width: 44px;
    height: 44px;
  }
  .compact .zoom-hint { display: none; }

  .ex-body {
    flex: 1;
    min-width: 0;
  }
  .ex-name {
    font-weight: 700;
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }
  .ex-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }
  .tag {
    text-transform: capitalize;
  }
  .dot {
    color: var(--text-dim);
  }

  .info-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-dim);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .info-btn:hover {
    background: var(--bg-4);
    color: var(--text);
  }
  .info-btn .mi { font-size: 18px; }

  .check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--bg-0);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .check .mi { font-size: 18px; font-variation-settings: 'FILL' 1, 'wght' 700; }
</style>
