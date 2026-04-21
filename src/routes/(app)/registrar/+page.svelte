<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listWorkouts } from '$lib/db/workouts';
  import { listSessions, deleteSession } from '$lib/db/sessions';
  import { withTimeout } from '$lib/utils/withTimeout';
  import type { Workout, Session } from '$lib/types';
  import { CATEGORY_ICON, CATEGORY_LABEL, fmtDateRelative } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let workouts = $state<Workout[]>([]);
  let recentSessions = $state<Session[]>([]);
  let loading = $state(true);

  let loadError = $state<string | null>(null);

  async function load() {
    if (!authStore.uid) { loading = false; return; }
    loading = true;
    loadError = null;
    try {
      [workouts, recentSessions] = await withTimeout(
        Promise.all([
          listWorkouts(authStore.uid),
          listSessions(authStore.uid, 10)
        ]),
        10_000,
        'carregar treinos'
      );
    } catch (e) {
      console.error('Falha ao carregar /registrar:', e);
      loadError = 'Falha ao carregar. Toque pra tentar de novo.';
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  function start(workoutId: string) {
    goto(`/registrar/${workoutId}`);
  }

  async function removeSession(sessionId: string, label: string) {
    if (!authStore.uid) return;
    if (!confirm(`Apagar registro: "${label}"?\n\nIsso também remove os recordes desse treino do seu histórico.`)) return;
    await deleteSession(authStore.uid, sessionId);
    recentSessions = recentSessions.filter((s) => s.id !== sessionId);
  }
</script>

<!-- Ação principal: montar treino novo -->
<Card padding="md" onclick={() => goto('/treinos/novo?then=register')} accent="gradient">
  <div class="quick">
    <div class="quick-ic">📝</div>
    <div class="quick-body">
      <div class="quick-title">Montar treino novo</div>
      <div class="quick-sub">Monte agora, salve no banco e já começa</div>
    </div>
    <span class="mi chev">chevron_right</span>
  </div>
</Card>

<div class="sec-title">Ou escolha um treino salvo</div>

{#if loading}
  <div class="empty"><span class="mi spin">progress_activity</span></div>
{:else if loadError}
  <button class="retry-box" onclick={load}>
    <span class="mi">refresh</span>
    <span>{loadError}</span>
  </button>
{:else if workouts.length === 0}
  <Card>
    <div class="empty-card">
      <div class="empty-ic">📁</div>
      <div class="empty-title">Sem treinos salvos ainda</div>
      <div class="empty-sub">Use uma das opções acima. Ao fim, você pode salvar o que fez como um treino reutilizável.</div>
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
          <button
            class="hist-del"
            onclick={() => removeSession(s.id, s.workoutName)}
            aria-label="Apagar registro"
          >
            <span class="mi">delete_outline</span>
          </button>
        </div>
      </Card>
    {/each}
  </div>
{/if}

<style>
  .actions-top {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-bottom: var(--s-4);
  }
  .quick {
    display: flex;
    gap: var(--s-3);
    align-items: center;
  }
  .quick-ic {
    font-size: 24px;
    width: 44px;
    height: 44px;
    border-radius: var(--r-md);
    background: var(--grad-fire);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .quick-ic.alt {
    background: var(--grad-primary);
  }
  .quick-body { flex: 1; min-width: 0; }
  .quick-title {
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: -0.01em;
  }
  .quick-sub {
    color: var(--text-mute);
    font-size: var(--fs-xs);
    margin-top: 2px;
    line-height: 1.3;
  }
  .chev { color: var(--text-dim); flex-shrink: 0; }

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

  .hist-del {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    color: var(--text-dim);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .hist-del:hover { background: var(--bg-3); color: var(--danger); }
  .hist-del .mi { font-size: 18px; }

  .empty {
    text-align: center;
    color: var(--text-mute);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
  }
  .retry-box {
    width: 100%;
    display: flex;
    gap: var(--s-2);
    align-items: center;
    justify-content: center;
    padding: var(--s-4);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border: 1px solid var(--warning);
    border-radius: var(--r-lg);
    color: var(--warning);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .retry-box .mi { font-size: 20px; }
  .empty .mi { font-size: 28px; color: var(--text-dim); }
  .empty-card { text-align: center; padding: var(--s-5); }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-title { font-weight: 700; font-size: var(--fs-md); margin-bottom: 4px; }
  .empty-sub { color: var(--text-mute); font-size: var(--fs-sm); }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
