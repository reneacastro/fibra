<script lang="ts">
  import type { LoggedMeal, Food } from '$lib/types';
  import { computeItemMacros, newLoggedItemId } from '$lib/db/diet';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import FoodPicker from './FoodPicker.svelte';

  interface Props {
    meal: LoggedMeal;
    onSave: (updated: LoggedMeal) => void;
    onClose: () => void;
  }

  let { meal, onSave, onClose }: Props = $props();

  // $state.snapshot desserializa proxies do Svelte 5 antes de clonar
  // (structuredClone direto em $state da DataCloneError).
  let local = $state<LoggedMeal>(structuredClone($state.snapshot(meal)) as LoggedMeal);
  // Modo: 'editor' | 'picker' — in-place swap, sem popup-em-popup
  let mode = $state<'editor' | 'picker'>('editor');

  function addFood(food: Food, grams: number) {
    const macros = computeItemMacros(food, grams);
    local.items = [...local.items, {
      id: newLoggedItemId(),
      foodId: food.id,
      foodName: food.name,
      grams,
      ...macros
    }];
    mode = 'editor';
  }

  function removeItem(id: string) {
    local.items = local.items.filter((i) => i.id !== id);
  }

  const totals = $derived(local.items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      p: a.p + i.proteinG,
      c: a.c + i.carbG,
      g: a.g + i.fatG
    }),
    { kcal: 0, p: 0, c: 0, g: 0 }
  ));

  function save() {
    onSave(local);
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      if (mode === 'picker') mode = 'editor';
      else onClose();
    }
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (mode === 'picker') mode = 'editor';
      else onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

<div class="backdrop" onclick={handleBackdrop} role="presentation">
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="handle"></div>

    {#if mode === 'picker'}
      <!-- Modo PICKER (in-place, sem popup-em-popup) -->
      <div class="picker-head">
        <button class="close" onclick={() => (mode = 'editor')} aria-label="Voltar">
          <span class="mi">arrow_back</span>
        </button>
        <h3>Adicionar alimento</h3>
        <button class="close" onclick={onClose} aria-label="Fechar">
          <span class="mi">close</span>
        </button>
      </div>
      <div class="picker-wrap">
        <FoodPicker
          inline
          onPick={addFood}
          onClose={() => (mode = 'editor')}
        />
      </div>
    {:else}
      <!-- Modo EDITOR -->
      <div class="head">
        <div class="head-fields">
          <input
            class="name-inp"
            bind:value={local.name}
            placeholder="Nome da refeição"
          />
          <input
            type="time"
            class="time-inp mono"
            bind:value={local.time}
          />
        </div>
        <button class="close" onclick={onClose} aria-label="Fechar"><span class="mi">close</span></button>
      </div>

      <!-- Items -->
      <div class="items">
        {#if local.items.length === 0}
          <div class="empty">
            <span class="mi">restaurant</span>
            <p>Adicione alimentos a essa refeição</p>
          </div>
        {:else}
          {#each local.items as item (item.id)}
            <div class="item">
              <div class="item-main">
                <div class="item-name">{item.foodName}</div>
                <div class="item-meta mono">
                  <span>{item.grams}g</span>
                  <span class="dot">·</span>
                  <span>{item.kcal} kcal</span>
                  <span class="dot">·</span>
                  <span>P{item.proteinG} C{item.carbG} G{item.fatG}</span>
                </div>
              </div>
              <button class="remove-btn" onclick={() => removeItem(item.id)} aria-label="Remover">
                <span class="mi">close</span>
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <Button icon="add" variant="secondary" full onclick={() => (mode = 'picker')}>
        Adicionar alimento
      </Button>

      <!-- Totals -->
      {#if local.items.length > 0}
        <div class="totals">
          <div class="t-main mono">{Math.round(totals.kcal)}<span>kcal</span></div>
          <div class="t-macros">
            <div><span class="l">P</span><span class="v mono">{Math.round(totals.p)}g</span></div>
            <div><span class="l">C</span><span class="v mono">{Math.round(totals.c)}g</span></div>
            <div><span class="l">G</span><span class="v mono">{Math.round(totals.g)}g</span></div>
          </div>
        </div>
      {/if}

      <div class="spacer"></div>
      <div class="btns">
        <Button variant="ghost" onclick={onClose}>Cancelar</Button>
        <Button icon="save" variant="success" full onclick={save}>Salvar refeição</Button>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 250;
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
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .head-fields { flex: 1; display: flex; gap: var(--s-2); }
  .name-inp {
    flex: 1;
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-md);
    font-weight: 700;
    font-family: inherit;
  }
  .name-inp:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .time-inp {
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 700;
    color-scheme: dark;
  }
  .time-inp:focus { outline: none; border-color: var(--accent); }

  .close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-mute);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .close:hover { background: var(--bg-3); color: var(--text); }

  .items {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: var(--s-3);
  }
  .empty {
    text-align: center;
    padding: var(--s-6);
    color: var(--text-mute);
  }
  .empty .mi { font-size: 32px; color: var(--text-dim); }
  .empty p { font-size: var(--fs-sm); margin-top: var(--s-2); }

  .item {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
  }
  .item-main { flex: 1; min-width: 0; }
  .item-name {
    font-weight: 600;
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-meta {
    font-size: 10px;
    color: var(--text-mute);
    margin-top: 2px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .item-meta .dot { color: var(--text-dim); }

  .remove-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }
  .remove-btn:hover { background: var(--bg-4); color: var(--danger); }
  .remove-btn .mi { font-size: 16px; }

  .totals {
    padding: var(--s-3);
    background: var(--accent-glow);
    border-radius: var(--r-md);
    text-align: center;
    margin-top: var(--s-2);
  }
  .t-main {
    font-size: var(--fs-2xl);
    font-weight: 800;
    color: var(--accent);
  }
  .t-main span {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
    margin-left: 4px;
  }
  .t-macros {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
    margin-top: var(--s-2);
  }
  .t-macros > div { display: flex; flex-direction: column; gap: 2px; }
  .t-macros .l { font-size: 10px; color: var(--text-dim); font-weight: 700; }
  .t-macros .v { font-weight: 700; }

  .btns { display: flex; gap: var(--s-2); }
  .spacer { height: var(--s-3); }

  /* Modo picker inline */
  .picker-head {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .picker-head h3 {
    flex: 1;
    font-size: var(--fs-lg);
    font-weight: 800;
    text-align: center;
  }
  .picker-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  /* FoodPicker em modo inline: o :global e necessario pq o FoodPicker
     define suas classes em style local; aqui garantimos que usem o
     espaco do wrapper */
  .picker-wrap :global(.list) {
    flex: 1;
  }
</style>
