<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listWorkouts } from '$lib/db/workouts';
  import { listSessions } from '$lib/db/sessions';
  import type { Workout, Session } from '$lib/types';
  import { CATEGORY_ICON, CATEGORY_LABEL, fmtDateRelative } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let workouts = $state<Workout[]>([]);
  let recentSessions = $state<Session[]>([]);
  let loading = $state(true);

  onMount(async () => {
    if (!authStore.uid) return;
    [workouts, recentSessions] = await Promise.all([
      listWorkouts(authStore.uid),
      listSessions(authStore.uid, 10)
    ]);
    loading = false;
  });

  function start(workoutId: string) {
    goto(`/registrar/${workoutId}`);
  }
</script>

<!-- Ação rápida: treino livre -->
<Card accent="gradient" padding="lg">
  <div class="quick">
    <div class="quick-ic">⚡</div>
    <div class="quick-body">
      <div class="quick-title">Treino Livre</div>
      <div class="quick-sub">Registre sem plano definido — escolha exercícios na hora</div>
    </div>
  </div>
  <div class="spacer"></div>
  <Button icon="play_arrow" full onclick={() => goto('/registrar/livre')}>
    Começar treino livre
  </Button>
</Card>

<div class="sec-title">Seus treinos</div>

{#if loading}
  <div class="empty"><span class="mi spin">progress_activity</span></div>
{:else if workouts.length === 0}
  <Card>
    <div class="empty-card">
      <div class="empty-ic">📁</div>
      <div class="empty-title">Nenhum treino montado</div>
      <div class="empty-sub">Monte seu primeiro treino no Banco.</div>
      <div class="spacer"></div>
      <Button icon="library_add" onclick={() => goto('/treinos/novo')}>Montar agora</Button>
    </div>
  </Card>
{:else}
  <div class="wk-grid">
    {#each workouts as w (w.id)}
      <Card onclick={() => start(w.id)} padding="md">
        <div class="wk">
          <Badge category={w.category}>{CATEGORY_ICON[w.category]} {CATEGORY_LABEL[w.category]}</Badge>
          <div class="wk-name">{w.name}</div>
          <div class="wk-meta">
            <span><span class="mi">fitness_center</span> {w.exercises.length} ex</span>
            <span><span class="mi">repeat</span> {w.exercises.reduce((a, e) => a + e.sets.length, 0)} séries</span>
          </div>
          <Button size="sm" icon="play_arrow" full>Começar</Button>
        </div>
      </Card>
    {/each}
  </div>
{/if}

<div class="sec-title">Histórico recente</div>

{#if recentSessions.length === 0 && !loading}
  <div class="empty">
    <span class="mi">history</span>
    <span>Nenhum treino registrado ainda</span>
  </div>
{:else}
  <div class="hist">
    {#each recentSessions as s (s.id)}
      <Card>
        <div class="hist-row">
          <div class="hist-ic">{CATEGORY_ICON[s.workoutCategory]}</div>
          <div class="hist-body">
            <div class="hist-name">{s.workoutName}</div>
            <div class="hist-sub">
              {fmtDateRelative(s.date)}
              {#if s.calories}· 🔥 {s.calories} kcal{/if}
              {#if s.prsEarned && s.prsEarned.length > 0}
                · 🏆 {s.prsEarned.length} {s.prsEarned.length === 1 ? 'recorde' : 'recordes'}
              {/if}
            </div>
          </div>
        </div>
      </Card>
    {/each}
  </div>
{/if}

<style>
  .quick {
    display: flex;
    gap: var(--s-3);
    align-items: center;
  }
  .quick-ic {
    font-size: 32px;
    width: 56px;
    height: 56px;
    border-radius: var(--r-lg);
    background: var(--grad-fire);
    display: grid;
    place-items: center;
  }
  .quick-title {
    font-weight: 800;
    font-size: var(--fs-lg);
    letter-spacing: -0.02em;
  }
  .quick-sub {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-top: 2px;
  }

  .spacer { height: var(--s-3); }

  .sec-title {
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    font-weight: 700;
    margin: var(--s-5) 0 var(--s-2);
  }

  .wk-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  .wk {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .wk-name {
    font-weight: 700;
    font-size: var(--fs-sm);
    line-height: 1.3;
    min-height: 2.6em;
  }
  .wk-meta {
    display: flex;
    gap: var(--s-3);
    font-size: var(--fs-xs);
    color: var(--text-mute);
    margin-bottom: 4px;
  }
  .wk-meta span {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .wk-meta .mi { font-size: 14px; }

  .hist {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .hist-row {
    display: flex;
    gap: var(--s-3);
    align-items: center;
  }
  .hist-ic {
    font-size: 24px;
    width: 40px;
    height: 40px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .hist-body { flex: 1; min-width: 0; }
  .hist-name { font-weight: 700; font-size: var(--fs-sm); }
  .hist-sub { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .empty {
    text-align: center;
    color: var(--text-mute);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
  }
  .empty .mi { font-size: 28px; color: var(--text-dim); }
  .empty-card { text-align: center; padding: var(--s-5); }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-title { font-weight: 700; font-size: var(--fs-md); margin-bottom: 4px; }
  .empty-sub { color: var(--text-mute); font-size: var(--fs-sm); }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
