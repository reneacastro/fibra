<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listUserFoods, saveFood, newFoodId } from '$lib/db/diet';
  import { searchFoods, TACO_BASICS } from '$lib/db/openFoodFacts';
  import type { Food } from '$lib/types';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  interface Props {
    onPick: (food: Food, grams: number) => void;
    onClose: () => void;
    /** Quando true, renderiza sem backdrop/sheet (pra uso inline dentro
        de outro container). Evita popup-em-popup. */
    inline?: boolean;
  }

  let { onPick, onClose, inline = false }: Props = $props();

  let search = $state('');
  let searching = $state(false);
  let ownFoods = $state<Food[]>([]);
  let offResults = $state<Food[]>([]);
  let activeTab = $state<'favoritos' | 'basicos' | 'off' | 'criar'>('basicos');
  let picked = $state<Food | null>(null);
  let grams = $state(100);
  let units = $state(1);
  let inputMode = $state<'gramas' | 'unidades'>('gramas');

  // Form de criação
  let newFood = $state<Partial<Food>>({
    name: '', servingSize: 100, kcalPer100g: 0, proteinPer100g: 0, carbPer100g: 0, fatPer100g: 0
  });
  let savingCustom = $state(false);

  onMount(async () => {
    if (!authStore.uid) return;
    ownFoods = await listUserFoods(authStore.uid);
  });

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const q = search.trim();
    if (searchTimer) clearTimeout(searchTimer);
    if (activeTab !== 'off' || q.length < 3) { offResults = []; return; }
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        offResults = await searchFoods(q, 20);
      } catch {
        offResults = [];
      } finally {
        searching = false;
      }
    }, 400);
  });

  const basicsFiltered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TACO_BASICS;
    return TACO_BASICS.filter((f) => f.name.toLowerCase().includes(q));
  });

  const favsFiltered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ownFoods;
    return ownFoods.filter((f) => f.name.toLowerCase().includes(q));
  });

  function pick(f: Food) {
    picked = f;
    grams = f.servingSize ?? 100;
    units = 1;
    inputMode = f.unit ? 'unidades' : 'gramas';
  }

  // Sincroniza gramas ↔ unidades quando input muda
  $effect(() => {
    if (inputMode === 'unidades' && picked?.servingSize) {
      grams = Math.round(units * picked.servingSize);
    }
  });

  function confirm() {
    if (!picked) return;
    onPick(picked, grams);
    onClose();
  }

  async function saveCustom() {
    if (!authStore.uid) return;
    if (!newFood.name || !newFood.kcalPer100g) return;
    savingCustom = true;
    try {
      const food: Food = {
        id: newFoodId(),
        name: newFood.name!,
        servingSize: newFood.servingSize ?? 100,
        kcalPer100g: Number(newFood.kcalPer100g),
        proteinPer100g: Number(newFood.proteinPer100g ?? 0),
        carbPer100g: Number(newFood.carbPer100g ?? 0),
        fatPer100g: Number(newFood.fatPer100g ?? 0),
        source: 'custom',
        custom: true
      };
      await saveFood(authStore.uid, food);
      ownFoods = await listUserFoods(authStore.uid);
      pick(food);
      activeTab = 'favoritos';
    } finally {
      savingCustom = false;
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const preview = $derived.by(() => {
    if (!picked) return null;
    const f = grams / 100;
    return {
      kcal: Math.round(picked.kcalPer100g * f),
      p: Math.round(picked.proteinPer100g * f * 10) / 10,
      c: Math.round(picked.carbPer100g * f * 10) / 10,
      g: Math.round(picked.fatPer100g * f * 10) / 10
    };
  });
</script>

<svelte:window onkeydown={(e) => !inline && handleKey(e)} />

{#snippet bodyContent()}
    {#if !inline}
      <div class="head">
        <h3>Adicionar alimento</h3>
        <button class="close" onclick={onClose} aria-label="Fechar"><span class="mi">close</span></button>
      </div>
    {/if}

    {#if picked}
      <!-- Escolhido -->
      <div class="picked">
        <div class="picked-name">{picked.name}</div>
        <div class="picked-meta">
          {picked.kcalPer100g} kcal · P {picked.proteinPer100g}g · C {picked.carbPer100g}g · G {picked.fatPer100g}g / 100g
        </div>
      </div>

      {#if picked.unit}
        <div class="mode-toggle">
          <button class="mt-btn" class:on={inputMode === 'unidades'} onclick={() => (inputMode = 'unidades')}>
            {picked.unit}{inputMode === 'unidades' ? '' : 's'}
          </button>
          <button class="mt-btn" class:on={inputMode === 'gramas'} onclick={() => (inputMode = 'gramas')}>
            gramas
          </button>
        </div>
      {/if}

      <div class="grams-row">
        {#if inputMode === 'unidades' && picked.unit}
          <Input
            type="number" label="Quantidade" suffix={picked.unit === 'colher de sopa' ? 'col' : picked.unit} step="0.5" min="0.5"
            value={String(units)}
            oninput={(e) => (units = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
          <div class="quick-grams">
            {#each [1, 2, 3, 4] as u (u)}
              <button class="qg" class:on={units === u} onclick={() => (units = u)}>{u}</button>
            {/each}
          </div>
        {:else}
          <Input
            type="number" label="Quantidade" suffix="g" step="5" min="1"
            value={String(grams)}
            oninput={(e) => (grams = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
          <div class="quick-grams">
            {#each [50, 100, 150, 200] as g (g)}
              <button class="qg" class:on={grams === g} onclick={() => (grams = g)}>{g}g</button>
            {/each}
          </div>
        {/if}
      </div>

      {#if inputMode === 'unidades' && picked.unit}
        <div class="gram-equiv">≈ {grams}g</div>
      {/if}

      {#if preview}
        <div class="preview">
          <div class="pv-kcal mono">{preview.kcal}</div>
          <div class="pv-kcal-l">kcal</div>
          <div class="pv-macros">
            <div><span class="m-l">P</span><span class="m-v mono">{preview.p}g</span></div>
            <div><span class="m-l">C</span><span class="m-v mono">{preview.c}g</span></div>
            <div><span class="m-l">G</span><span class="m-v mono">{preview.g}g</span></div>
          </div>
        </div>
      {/if}

      <div class="btns">
        <Button variant="ghost" onclick={() => (picked = null)}>Trocar</Button>
        <Button icon="check" full onclick={confirm}>Adicionar à refeição</Button>
      </div>

    {:else}
      <!-- Tabs de origem -->
      <div class="tabs">
        <button class="t" class:on={activeTab === 'favoritos'} onclick={() => (activeTab = 'favoritos')}>
          ⭐ <span class="c">{ownFoods.length}</span>
        </button>
        <button class="t" class:on={activeTab === 'basicos'} onclick={() => (activeTab = 'basicos')}>
          🇧🇷 Básicos
        </button>
        <button class="t" class:on={activeTab === 'off'} onclick={() => (activeTab = 'off')}>
          🔎 Buscar
        </button>
        <button class="t" class:on={activeTab === 'criar'} onclick={() => (activeTab = 'criar')}>
          ➕ Criar
        </button>
      </div>

      {#if activeTab !== 'criar'}
        <Input icon="search" placeholder={activeTab === 'off' ? 'Buscar Open Food Facts...' : 'Filtrar...'} bind:value={search} />
        <div class="spacer-sm"></div>
      {/if}

      {#if activeTab === 'favoritos'}
        {#if favsFiltered.length === 0}
          <div class="empty-q">
            <span class="mi">star_border</span>
            <p>Seus alimentos criados aparecem aqui</p>
          </div>
        {:else}
          <div class="list">
            {#each favsFiltered as f (f.id)}
              <button class="f-row" onclick={() => pick(f)}>
                <div class="f-body">
                  <div class="f-name">{f.name}</div>
                  <div class="f-macro mono">{f.kcalPer100g} kcal · P{f.proteinPer100g} C{f.carbPer100g} G{f.fatPer100g} /100g</div>
                </div>
                <span class="mi">chevron_right</span>
              </button>
            {/each}
          </div>
        {/if}

      {:else if activeTab === 'basicos'}
        <div class="list">
          {#each basicsFiltered as f (f.id)}
            <button class="f-row" onclick={() => pick(f)}>
              <div class="f-body">
                <div class="f-name">
                  {f.name}
                  {#if f.unit}<span class="unit-chip">{f.unit}</span>{/if}
                </div>
                <div class="f-macro mono">{f.kcalPer100g} kcal · P{f.proteinPer100g} C{f.carbPer100g} G{f.fatPer100g} /100g</div>
              </div>
              <span class="mi">chevron_right</span>
            </button>
          {/each}
        </div>

      {:else if activeTab === 'off'}
        {#if searching}
          <div class="loading-inline"><span class="mi spin">progress_activity</span> Buscando…</div>
        {:else if search.trim().length < 3}
          <div class="empty-q">
            <span class="mi">search</span>
            <p>Digite pelo menos 3 letras pra buscar no Open Food Facts</p>
          </div>
        {:else if offResults.length === 0}
          <div class="empty-q">
            <span class="mi">search_off</span>
            <p>Nada encontrado</p>
          </div>
        {:else}
          <div class="list">
            {#each offResults as f (f.id)}
              <button class="f-row" onclick={() => pick(f)}>
                <div class="f-body">
                  <div class="f-name">{f.name}{f.brand ? ` · ${f.brand}` : ''}</div>
                  <div class="f-macro mono">{f.kcalPer100g} kcal · P{f.proteinPer100g} C{f.carbPer100g} G{f.fatPer100g} /100g</div>
                </div>
                <span class="mi">chevron_right</span>
              </button>
            {/each}
          </div>
        {/if}

      {:else if activeTab === 'criar'}
        <Input label="Nome" placeholder="Ex: Meu shake de proteína"
          value={newFood.name ?? ''}
          oninput={(e) => (newFood.name = (e.currentTarget as HTMLInputElement).value)}
        />
        <div class="spacer-sm"></div>
        <div class="grid-2">
          <Input type="number" label="Porção (g)" step="1" min="1"
            value={String(newFood.servingSize ?? 100)}
            oninput={(e) => (newFood.servingSize = Number((e.currentTarget as HTMLInputElement).value) || 100)}
          />
          <Input type="number" label="Kcal/100g" step="1" min="0"
            value={String(newFood.kcalPer100g ?? 0)}
            oninput={(e) => (newFood.kcalPer100g = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
        </div>
        <div class="spacer-sm"></div>
        <div class="grid-3">
          <Input type="number" label="Prot." suffix="g" step="0.1"
            value={String(newFood.proteinPer100g ?? 0)}
            oninput={(e) => (newFood.proteinPer100g = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
          <Input type="number" label="Carb." suffix="g" step="0.1"
            value={String(newFood.carbPer100g ?? 0)}
            oninput={(e) => (newFood.carbPer100g = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
          <Input type="number" label="Gord." suffix="g" step="0.1"
            value={String(newFood.fatPer100g ?? 0)}
            oninput={(e) => (newFood.fatPer100g = Number((e.currentTarget as HTMLInputElement).value) || 0)}
          />
        </div>
        <div class="spacer"></div>
        <Button icon="save" full loading={savingCustom} disabled={!newFood.name} onclick={saveCustom}>
          Salvar nos meus alimentos
        </Button>
      {/if}
    {/if}
{/snippet}

{#if inline}
  {@render bodyContent()}
{:else}
  <div class="backdrop" onclick={handleBackdrop} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="handle"></div>
      {@render bodyContent()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
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
    align-items: center;
    margin-bottom: var(--s-3);
  }
  .head h3 { font-size: var(--fs-lg); font-weight: 800; }
  .close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-mute);
    display: grid;
    place-items: center;
  }
  .close:hover { background: var(--bg-3); color: var(--text); }

  .picked {
    padding: var(--s-3);
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    border-radius: var(--r-md);
    margin-bottom: var(--s-3);
  }
  .picked-name { font-weight: 700; color: var(--accent); }
  .picked-meta { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 4px; font-family: var(--font-mono); }

  .grams-row { margin-bottom: var(--s-2); }

  .mode-toggle {
    display: flex;
    gap: 4px;
    padding: 3px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    margin-bottom: var(--s-2);
  }
  .mt-btn {
    flex: 1;
    padding: 6px 12px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 700;
    text-transform: capitalize;
  }
  .mt-btn.on {
    background: var(--accent);
    color: var(--bg-0);
  }

  .gram-equiv {
    text-align: center;
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-family: var(--font-mono);
    margin-bottom: var(--s-2);
  }
  .quick-grams {
    display: flex;
    gap: 4px;
    margin-top: var(--s-2);
  }
  .qg {
    flex: 1;
    padding: 8px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
  }
  .qg.on { background: var(--accent); color: var(--bg-0); border-color: var(--accent); }

  .preview {
    text-align: center;
    padding: var(--s-4);
    background: var(--bg-3);
    border-radius: var(--r-lg);
    margin-bottom: var(--s-3);
  }
  .pv-kcal {
    font-size: var(--fs-3xl);
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
  }
  .pv-kcal-l {
    font-size: 10px;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 4px;
  }
  .pv-macros {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
    margin-top: var(--s-3);
  }
  .pv-macros > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pv-macros .m-l {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 700;
  }
  .pv-macros .m-v {
    font-weight: 700;
    color: var(--text);
  }

  .btns { display: flex; gap: var(--s-2); }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    margin-bottom: var(--s-3);
  }
  .t {
    flex: 1;
    padding: 8px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }
  .t.on { background: var(--bg-0); color: var(--text); }
  .t .c {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--r-full);
    background: var(--bg-4);
    font-family: var(--font-mono);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    flex: 1;
    padding-bottom: var(--s-3);
  }
  .f-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    text-align: left;
    color: var(--text);
  }
  .f-row:hover {
    background: var(--bg-4);
    border-color: var(--border-strong);
  }
  .f-body { flex: 1; min-width: 0; }
  .f-name {
    font-weight: 600;
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .unit-chip {
    padding: 1px 6px;
    font-size: 9px;
    font-weight: 700;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: var(--r-full);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .f-macro {
    font-size: 10px;
    color: var(--text-mute);
    margin-top: 2px;
  }

  .empty-q {
    text-align: center;
    padding: var(--s-6) var(--s-3);
    color: var(--text-mute);
  }
  .empty-q .mi { font-size: 32px; color: var(--text-dim); }
  .empty-q p { font-size: var(--fs-sm); margin-top: var(--s-2); }

  .loading-inline {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-5);
    color: var(--text-mute);
  }
  .loading-inline .mi { color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }

  .spacer { height: var(--s-3); }
  .spacer-sm { height: var(--s-2); }
</style>
