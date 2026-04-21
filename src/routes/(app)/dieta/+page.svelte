<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getActiveDietPlan, getMealLog, saveMealLog, computeMealLogTotals, newLoggedMealId } from '$lib/db/diet';
  import type { DietPlan, MealLog, LoggedMeal } from '$lib/types';
  import { todayISO, fmtDateShort } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import MacroRing from '$lib/components/MacroRing.svelte';
  import FoodPicker from './FoodPicker.svelte';
  import MealEditor from './MealEditor.svelte';

  let plan = $state<DietPlan | null>(null);
  let today = $state(todayISO());
  let log = $state<MealLog | null>(null);
  let loading = $state(true);
  let editingMealIdx = $state<number | null>(null);
  let adding = $state(false);
  let tab = $state<'hoje' | 'plano' | 'agenda'>('hoje');

  onMount(async () => {
    if (!authStore.uid) return;
    await reload();
  });

  async function reload() {
    if (!authStore.uid) return;
    loading = true;
    try {
      [plan, log] = await Promise.all([
        getActiveDietPlan(authStore.uid),
        getMealLog(authStore.uid, today)
      ]);
      if (!log) {
        // Cria um log vazio usando o template da agenda, se houver
        const meals: LoggedMeal[] = (plan?.meals ?? []).map((pm) => ({
          id: newLoggedMealId(),
          plannedMealId: pm.id,
          name: pm.name,
          time: pm.time,
          items: []
        }));
        log = {
          date: today,
          meals,
          totals: { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }
    } finally {
      loading = false;
    }
  }

  async function persist() {
    if (!authStore.uid || !log) return;
    log.totals = computeMealLogTotals(log.meals);
    await saveMealLog(authStore.uid, log);
  }

  const totals = $derived(log?.totals ?? { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 });

  function addMeal() {
    if (!log) return;
    log.meals = [...log.meals, {
      id: newLoggedMealId(),
      name: `Refeição ${log.meals.length + 1}`,
      time: '12:00',
      items: []
    }];
    editingMealIdx = log.meals.length - 1;
    persist();
  }

  function deleteMeal(idx: number) {
    if (!log || !confirm('Apagar essa refeição do dia?')) return;
    log.meals = log.meals.filter((_, i) => i !== idx);
    persist();
  }
</script>

<div class="tabs-row">
  <button class="tab" class:on={tab === 'hoje'} onclick={() => (tab = 'hoje')}>
    <span class="mi">today</span> Hoje
  </button>
  <button class="tab" class:on={tab === 'plano'} onclick={() => (tab = 'plano')}>
    <span class="mi">target</span> Plano
  </button>
  <button class="tab" class:on={tab === 'agenda'} onclick={() => (tab = 'agenda')}>
    <span class="mi">schedule</span> Agenda
  </button>
</div>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>

{:else if tab === 'hoje'}
  {#if !plan}
    <Card>
      <div class="empty">
        <div class="empty-ic">🎯</div>
        <div class="empty-t">Sem plano ativo</div>
        <div class="empty-s">Crie um plano de macros pra começar a acompanhar</div>
        <div class="spacer"></div>
        <Button icon="add" onclick={() => (tab = 'plano')}>Criar plano</Button>
      </div>
    </Card>
  {:else}
    <!-- Anel principal -->
    <div class="main-ring">
      <MacroRing
        value={totals.kcal}
        target={plan.dailyTargets.kcal}
        unit="kcal"
        size={200}
        strokeWidth={14}
        color="var(--cat-diet)"
      />
    </div>

    <!-- 3 anéis de macro -->
    <div class="macros-row">
      <div class="macro">
        <MacroRing
          value={totals.proteinG}
          target={plan.dailyTargets.proteinG}
          unit="g"
          label="Proteína"
          size={90}
          strokeWidth={8}
          color="#ff5ea0"
        />
      </div>
      <div class="macro">
        <MacroRing
          value={totals.carbG}
          target={plan.dailyTargets.carbG}
          unit="g"
          label="Carbo"
          size={90}
          strokeWidth={8}
          color="#ffb86b"
        />
      </div>
      <div class="macro">
        <MacroRing
          value={totals.fatG}
          target={plan.dailyTargets.fatG}
          unit="g"
          label="Gordura"
          size={90}
          strokeWidth={8}
          color="#58a6ff"
        />
      </div>
    </div>

    <!-- Refeições do dia -->
    <div class="sec-title">Refeições de {fmtDateShort(today)}</div>

    {#if log && log.meals.length > 0}
      <div class="meals">
        {#each log.meals as meal, idx (meal.id)}
          {@const mealTotals = meal.items.reduce(
            (a, i) => ({ kcal: a.kcal + i.kcal, protein: a.protein + i.proteinG }),
            { kcal: 0, protein: 0 }
          )}
          <Card padding="sm">
            <div class="meal-head" onclick={() => (editingMealIdx = idx)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (editingMealIdx = idx)}>
              <div class="meal-time mono">{meal.time}</div>
              <div class="meal-info">
                <div class="meal-name">{meal.name}</div>
                <div class="meal-sub">
                  {#if meal.items.length === 0}
                    <span class="pending">Vazia</span>
                  {:else}
                    <span>{meal.items.length} {meal.items.length === 1 ? 'item' : 'itens'}</span>
                    <span class="dot">·</span>
                    <span class="mono">{Math.round(mealTotals.kcal)} kcal</span>
                    <span class="dot">·</span>
                    <span class="mono">{Math.round(mealTotals.protein)}g prot</span>
                  {/if}
                </div>
              </div>
              <button class="meal-act" onclick={(e) => { e.stopPropagation(); deleteMeal(idx); }} aria-label="Apagar">
                <span class="mi">delete_outline</span>
              </button>
            </div>
            {#if meal.items.length > 0}
              <div class="items-preview">
                {#each meal.items.slice(0, 3) as item (item.id)}
                  <div class="it">
                    <span class="it-n">{item.foodName}</span>
                    <span class="it-g mono">{item.grams}g</span>
                  </div>
                {/each}
                {#if meal.items.length > 3}
                  <div class="it more">+{meal.items.length - 3} mais</div>
                {/if}
              </div>
            {/if}
          </Card>
        {/each}
      </div>
    {/if}

    <Button icon="add" variant="secondary" full onclick={addMeal}>
      Adicionar refeição
    </Button>
  {/if}

  {#if editingMealIdx !== null && log}
    <MealEditor
      meal={log.meals[editingMealIdx]}
      onSave={(updated) => {
        log!.meals[editingMealIdx!] = updated;
        persist();
        editingMealIdx = null;
      }}
      onClose={() => (editingMealIdx = null)}
    />
  {/if}

{:else if tab === 'plano'}
  {#await import('./PlanoEditor.svelte') then M}
    <svelte:component this={M.default} {plan} onSaved={async () => { await reload(); tab = 'hoje'; }} />
  {/await}

{:else if tab === 'agenda'}
  {#await import('./AgendaEditor.svelte') then M}
    <svelte:component this={M.default} {plan} onSaved={async () => { await reload(); }} />
  {/await}
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .tabs-row {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    margin-bottom: var(--s-4);
  }
  .tab {
    flex: 1;
    padding: 10px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-sm);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all var(--dur-fast);
  }
  .tab .mi { font-size: 18px; }
  .tab.on { background: var(--grad-primary); color: var(--bg-0); }

  .main-ring {
    display: flex;
    justify-content: center;
    padding: var(--s-4) 0;
  }

  .macros-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
    margin-bottom: var(--s-5);
  }
  .macro { display: flex; justify-content: center; }

  .sec-title {
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    font-weight: 700;
    margin: 0 0 var(--s-2);
  }

  .meals {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }

  .meal-head {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    cursor: pointer;
  }
  .meal-time {
    width: 56px;
    text-align: center;
    font-weight: 800;
    font-size: var(--fs-sm);
    color: var(--accent);
    padding: 6px;
    background: var(--accent-glow);
    border-radius: var(--r-sm);
  }
  .meal-info { flex: 1; min-width: 0; }
  .meal-name { font-weight: 700; font-size: var(--fs-sm); }
  .meal-sub {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    margin-top: 2px;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .meal-sub .dot { color: var(--text-dim); }
  .meal-sub .pending { color: var(--warn); font-weight: 600; }

  .meal-act {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }
  .meal-act:hover { background: var(--bg-3); color: var(--danger); }
  .meal-act .mi { font-size: 16px; }

  .items-preview {
    margin-top: var(--s-2);
    padding-top: var(--s-2);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .it {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }
  .it-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .it-g { color: var(--text); flex-shrink: 0; }
  .it.more { color: var(--text-dim); }

  .empty {
    text-align: center;
    padding: var(--s-6) var(--s-3);
  }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-t { font-weight: 700; font-size: var(--fs-md); }
  .empty-s { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .spacer { height: var(--s-3); }
</style>
