<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { saveDietPlan } from '$lib/db/diet';
  import type { DietPlan, PlannedMeal, PlannedFoodItem } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  interface Props {
    plan: DietPlan | null;
    onSaved: () => void;
  }

  let { plan, onSaved }: Props = $props();

  let meals = $state<PlannedMeal[]>(plan?.meals ?? [
    { id: 'm1', name: 'Café da manhã', time: '07:00', items: [] },
    { id: 'm2', name: 'Lanche manhã', time: '10:00', items: [] },
    { id: 'm3', name: 'Almoço', time: '12:30', items: [] },
    { id: 'm4', name: 'Lanche tarde', time: '16:00', items: [] },
    { id: 'm5', name: 'Jantar', time: '19:30', items: [] }
  ]);
  let saving = $state(false);

  function addMeal() {
    meals = [...meals, {
      id: 'm_' + Math.random().toString(36).slice(2, 8),
      name: `Refeição ${meals.length + 1}`,
      time: '20:00',
      items: []
    }];
  }

  function removeMeal(idx: number) {
    meals = meals.filter((_, i) => i !== idx);
  }

  function sortByTime() {
    meals = [...meals].sort((a, b) => a.time.localeCompare(b.time));
  }

  async function save() {
    if (!authStore.uid || !plan) return;
    saving = true;
    try {
      sortByTime();
      await saveDietPlan(authStore.uid, {
        ...plan,
        meals,
        active: true
      });
      onSaved();
    } finally {
      saving = false;
    }
  }
</script>

{#if !plan}
  <Card>
    <div class="empty">
      <div class="empty-ic">📅</div>
      <div class="empty-t">Primeiro crie o plano</div>
      <div class="empty-s">A agenda alimentar fica em cima do seu plano de macros.</div>
    </div>
  </Card>
{:else}
  <Card title="Agenda alimentar" icon="schedule">
    <p class="intro">
      Essas refeições viram o template do seu dia — aparecem automaticamente na aba <strong>Hoje</strong>.
    </p>
    <div class="spacer"></div>

    <div class="meals-list">
      {#each meals as meal, idx (meal.id)}
        <div class="meal-card">
          <div class="meal-time-wrap">
            <input
              type="time"
              class="meal-time mono"
              bind:value={meal.time}
            />
          </div>
          <input
            class="meal-name"
            bind:value={meal.name}
            placeholder="Nome da refeição"
          />
          <button class="remove-btn" onclick={() => removeMeal(idx)} aria-label="Remover">
            <span class="mi">close</span>
          </button>
        </div>
      {/each}
    </div>

    <div class="spacer"></div>
    <div class="actions">
      <Button variant="secondary" icon="add" full onclick={addMeal}>Adicionar refeição</Button>
      <Button variant="ghost" icon="sort" onclick={sortByTime}>Ordenar</Button>
    </div>

    <div class="spacer"></div>
    <Button icon="save" variant="success" full loading={saving} onclick={save}>
      Salvar agenda
    </Button>
  </Card>
{/if}

<style>
  .intro {
    color: var(--text-mute);
    font-size: var(--fs-sm);
  }

  .meals-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .meal-card {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .meal-time-wrap {
    background: var(--accent-glow);
    border-radius: var(--r-sm);
    padding: 4px 8px;
  }
  .meal-time {
    background: transparent;
    border: 0;
    color: var(--accent);
    font-weight: 800;
    font-size: var(--fs-sm);
    width: 64px;
    color-scheme: dark;
    padding: 0;
  }
  .meal-time:focus { outline: none; }
  .meal-name {
    flex: 1;
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .meal-name:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }

  .remove-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }
  .remove-btn:hover { background: var(--bg-4); color: var(--danger); }
  .remove-btn .mi { font-size: 18px; }

  .actions { display: flex; gap: var(--s-2); }

  .empty { text-align: center; padding: var(--s-6) var(--s-3); }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-t { font-weight: 700; font-size: var(--fs-md); }
  .empty-s { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .spacer { height: var(--s-3); }
</style>
