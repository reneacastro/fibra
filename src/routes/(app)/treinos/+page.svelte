<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { listWorkouts, deleteWorkout } from '$lib/db/workouts';
  import type { Workout, WorkoutCategory } from '$lib/types';
  import { CATEGORY_LABEL, CATEGORY_ICON } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ExerciseCard from '$lib/components/ExerciseCard.svelte';
  import Input from '$lib/components/Input.svelte';
  import AIPromptSheet from '$lib/components/AIPromptSheet.svelte';
  import { buildWorkoutFromPrompt, type WorkoutBlueprint } from '$lib/db/gemini';
  import { saveWorkout, newWorkoutId } from '$lib/db/workouts';
  import { historyForExercise } from '$lib/db/sessions';
  import { getProfile } from '$lib/db/profile';
  import { listBodyComp } from '$lib/db/bodyComp';

  type TabId = 'meus' | WorkoutCategory;

  let active = $state<TabId>('meus');
  let workouts = $state<Workout[]>([]);
  let search = $state('');
  let loading = $state(true);

  onMount(async () => {
    await catalogStore.ensure();
    await reloadWorkouts();
  });

  async function reloadWorkouts() {
    if (!authStore.uid) return;
    loading = true;
    try {
      workouts = await listWorkouts(authStore.uid);
    } finally {
      loading = false;
    }
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (active === 'meus') return [];
    const list = catalogStore.byCategory(active);
    if (!q) return list;
    return list.filter((e) => e.name.toLowerCase().includes(q));
  });

  const CATS: { id: WorkoutCategory; label: string; icon: string }[] = [
    { id: 'superior',    label: 'Superior',    icon: '💪' },
    { id: 'inferior',    label: 'Inferior',    icon: '🦵' },
    { id: 'fullbody',    label: 'Full Body',   icon: '🔥' },
    { id: 'funcional',   label: 'Funcional',   icon: '🤸' },
    { id: 'crossfit',    label: 'CrossFit',    icon: '⚡' },
    { id: 'alongamento', label: 'Alongamento', icon: '🧘' },
    { id: 'hiit',        label: 'HIIT',        icon: '💥' },
    { id: 'livre',       label: 'Cardio',      icon: '🏃' }
  ];

  const tabs = $derived([
    { id: 'meus' as const, label: 'Meus', icon: '📁', count: workouts.length },
    ...CATS.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      count: catalogStore.byCategory(c.id).length
    }))
  ]);

  async function remove(w: Workout) {
    if (!authStore.uid) return;
    if (!confirm(`Apagar o treino "${w.name}"?`)) return;
    await deleteWorkout(authStore.uid, w.id);
    await reloadWorkouts();
  }

  // ─── AI Workout Builder ─────────────────────────────
  let aiOpen = $state(false);
  let aiBusy = $state(false);
  let aiError = $state<string | null>(null);
  let aiPreview = $state<WorkoutBlueprint | null>(null);

  async function generateWorkout(prompt: string) {
    if (!authStore.uid) return;
    aiBusy = true;
    aiError = null;
    try {
      const [profile, body] = await Promise.all([
        getProfile(authStore.uid),
        listBodyComp(authStore.uid, 1)
      ]);
      const latestWeight = body[0]?.peso ?? profile?.weight;

      // Última carga por exercício (top-20)
      const recentHistory = await Promise.all(
        catalogStore.all.slice(0, 20).map(async (ex) => {
          if (!authStore.uid) return null;
          const entries = await historyForExercise(authStore.uid, ex.id, 1);
          return entries[0]
            ? { exerciseId: ex.id, lastTopSet: entries[0].topSet }
            : null;
        })
      );

      const blueprint = await buildWorkoutFromPrompt({
        userPrompt: prompt,
        userProfile: {
          name: profile?.name ?? 'atleta',
          goals: profile?.goals ?? [],
          latestWeight,
          activityLevel: profile?.activityLevel
        },
        catalog: catalogStore.all.map((e) => ({
          id: e.id, name: e.name,
          category: e.category, muscleGroup: e.muscleGroup, equipment: e.equipment
        })),
        recentHistory: recentHistory.filter((x): x is NonNullable<typeof x> => x !== null)
      });

      // Valida IDs
      const validIds = new Set(catalogStore.all.map((e) => e.id));
      blueprint.exercises = blueprint.exercises.filter((ex) => validIds.has(ex.exerciseId));
      if (blueprint.exercises.length === 0) {
        throw new Error('IA não retornou exercícios válidos. Tenta reformular.');
      }
      aiPreview = blueprint;
    } catch (e) {
      aiError = (e as Error).message;
    } finally {
      aiBusy = false;
    }
  }

  async function acceptAIWorkout() {
    if (!authStore.uid || !aiPreview) return;
    aiBusy = true;
    try {
      const w: Workout = {
        id: newWorkoutId(),
        name: aiPreview.name,
        category: aiPreview.category as WorkoutCategory,
        order: workouts.length,
        exercises: aiPreview.exercises.map((ex, i) => ({
          exerciseId: ex.exerciseId,
          order: i,
          sets: ex.sets.map((s) => ({ type: 'normal', ...s })),
          restSeconds: ex.restSeconds,
          notes: ex.notes
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false
      };
      await saveWorkout(authStore.uid, w);
      aiOpen = false;
      aiPreview = null;
      await reloadWorkouts();
      goto(`/treinos/${w.id}`);
    } finally {
      aiBusy = false;
    }
  }

  function closeAI() {
    if (aiBusy) return;
    aiOpen = false;
    aiPreview = null;
    aiError = null;
  }
</script>

<div class="actions">
  <Button icon="add" onclick={() => goto('/treinos/novo')} full size="lg">
    Montar treino
  </Button>
  <Button icon="auto_awesome" variant="secondary" size="lg" onclick={() => (aiOpen = true)}>
    Gerar com IA
  </Button>
</div>

<Tabs {tabs} value={active} onChange={(id) => (active = id as TabId)} />

<div class="spacer"></div>

{#if active === 'meus'}
  {#if loading}
    <div class="empty"><span class="mi spin">progress_activity</span>Carregando…</div>
  {:else if workouts.length === 0}
    <Card>
      <div class="empty-card">
        <div class="empty-ic">📁</div>
        <div class="empty-title">Nenhum treino montado ainda</div>
        <div class="empty-sub">
          Monte seu primeiro treino escolhendo exercícios das categorias acima.
        </div>
      </div>
    </Card>
  {:else}
    <div class="wk-list">
      {#each workouts as w (w.id)}
        <Card onclick={() => goto(`/treinos/${w.id}`)}>
          <div class="wk">
            <div class="wk-main">
              <div class="wk-badge-row">
                <Badge category={w.category} icon={CATEGORY_ICON[w.category]}>
                  {CATEGORY_LABEL[w.category]}
                </Badge>
                {#if w.favorite}<Badge variant="warn" icon="star">Favorito</Badge>{/if}
              </div>
              <div class="wk-name">{w.name}</div>
              <div class="wk-meta">
                <span>{w.exercises.length} exercícios</span>
                <span class="dot">·</span>
                <span>
                  {w.exercises.reduce((acc, e) => acc + e.sets.length, 0)} séries
                </span>
              </div>
            </div>
            <div class="wk-actions">
              <button class="icon-btn" onclick={(e) => { e.stopPropagation(); goto(`/treinos/${w.id}`); }} aria-label="Editar">
                <span class="mi">edit</span>
              </button>
              <button class="icon-btn danger" onclick={(e) => { e.stopPropagation(); remove(w); }} aria-label="Apagar">
                <span class="mi">delete</span>
              </button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{:else}
  <Input icon="search" placeholder="Buscar exercício…" bind:value={search} />
  <div class="spacer"></div>

  {#if catalogStore.loading}
    <div class="empty"><span class="mi spin">progress_activity</span>Carregando catálogo…</div>
  {:else if filtered.length === 0}
    <div class="empty"><span class="mi">search_off</span>Nada encontrado</div>
  {:else}
    <div class="ex-list">
      {#each filtered as ex (ex.id)}
        <ExerciseCard exercise={ex} />
      {/each}
    </div>
  {/if}
{/if}

{#if aiOpen}
  <AIPromptSheet
    title="Monte um treino"
    subtitle="Descreva o que você quer — a IA monta com os exercícios do seu catálogo."
    placeholder="Ex: Treino superior A pesado com foco em peito e tríceps, 50 min"
    suggestions={[
      'Superior A pesado com foco em peito',
      'Inferior pro bumbum, sem leg press',
      'Funcional rápido de 20 min',
      'WOD AMRAP de 15 min'
    ]}
    busy={aiBusy}
    error={aiError}
    onSubmit={generateWorkout}
    onClose={closeAI}
    preview={aiPreview ? previewSnippet : undefined}
    onAccept={acceptAIWorkout}
  />
{/if}

{#snippet previewSnippet()}
  {#if aiPreview}
    <div class="ai-preview">
      <div class="ap-title">{aiPreview.name}</div>
      <div class="ap-cat">{CATEGORY_ICON[aiPreview.category] ?? '🔹'} {CATEGORY_LABEL[aiPreview.category] ?? aiPreview.category}</div>
      <div class="ap-why">{aiPreview.reasoning}</div>
      <div class="ap-exs">
        {#each aiPreview.exercises as ex, idx (ex.exerciseId + idx)}
          {@const meta = catalogStore.byId(ex.exerciseId)}
          {#if meta}
            <div class="ap-ex">
              <div class="ap-ex-num mono">{idx + 1}</div>
              <div class="ap-ex-body">
                <div class="ap-ex-name">{meta.name}</div>
                <div class="ap-ex-sets mono">
                  {ex.sets.length}× {ex.sets[0]?.reps ?? '—'}{ex.sets[0]?.weight ? ` @ ${ex.sets[0].weight}kg` : ''}
                  {#if ex.restSeconds} · rest {ex.restSeconds}s{/if}
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<style>
  .actions {
    display: flex;
    gap: var(--s-2);
    margin-bottom: var(--s-4);
  }
  @media (max-width: 420px) {
    .actions { flex-direction: column; }
  }
  .spacer { height: var(--s-3); }

  .wk-list, .ex-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .wk {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }
  .wk-main { flex: 1; min-width: 0; }
  .wk-badge-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .wk-name {
    font-weight: 700;
    font-size: var(--fs-md);
    margin-bottom: 2px;
  }
  .wk-meta {
    display: flex;
    gap: 4px;
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }
  .dot { color: var(--text-dim); }

  .wk-actions { display: flex; gap: 4px; }

  .icon-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    display: grid;
    place-items: center;
    color: var(--text-mute);
  }
  .icon-btn:hover { background: var(--bg-4); color: var(--text); }
  .icon-btn.danger:hover { color: var(--danger); }
  .icon-btn .mi { font-size: 18px; }

  .empty {
    text-align: center;
    color: var(--text-mute);
    padding: var(--s-8) var(--s-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
  }
  .empty .mi { font-size: 32px; color: var(--text-dim); }

  .empty-card {
    text-align: center;
    padding: var(--s-6);
  }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-title { font-weight: 700; font-size: var(--fs-md); margin-bottom: 4px; }
  .empty-sub { color: var(--text-mute); font-size: var(--fs-sm); }

  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .ai-preview { display: flex; flex-direction: column; gap: var(--s-3); }
  .ap-title { font-size: var(--fs-lg); font-weight: 800; letter-spacing: -0.01em; }
  .ap-cat {
    display: inline-block;
    padding: 4px 10px;
    border-radius: var(--r-full);
    background: var(--accent-glow);
    color: var(--accent);
    font-size: var(--fs-xs);
    font-weight: 700;
    width: fit-content;
  }
  .ap-why {
    padding: var(--s-2) var(--s-3);
    background: var(--bg-2);
    border-left: 3px solid var(--accent);
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    color: var(--text-mute);
    font-style: italic;
    line-height: 1.5;
  }
  .ap-exs { display: flex; flex-direction: column; gap: 4px; }
  .ap-ex {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    padding: var(--s-2);
    background: var(--bg-2);
    border-radius: var(--r-sm);
  }
  .ap-ex-num {
    width: 24px;
    height: 24px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: var(--fs-xs);
    flex-shrink: 0;
  }
  .ap-ex-body { flex: 1; min-width: 0; }
  .ap-ex-name { font-weight: 600; font-size: var(--fs-sm); }
  .ap-ex-sets { font-size: 11px; color: var(--text-mute); margin-top: 2px; }
</style>
