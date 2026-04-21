<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile } from '$lib/db/profile';
  import { getRelationship } from '$lib/db/relationships';
  import { listWorkouts, saveWorkoutForClient, newWorkoutId } from '$lib/db/workouts';
  import { listSessions } from '$lib/db/sessions';
  import { listBodyComp } from '$lib/db/bodyComp';
  import type { Relationship, UserProfile, Workout, Session, BodyComp } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { CATEGORY_LABEL, CATEGORY_ICON, fmtDateRelative } from '$lib/utils/format';
  import { withTimeout } from '$lib/utils/withTimeout';

  const clientUid = page.params.uid!;

  let rel = $state<Relationship | null>(null);
  let clientProfile = $state<UserProfile | null>(null);
  let clientWorkouts = $state<Workout[]>([]);
  let clientSessions = $state<Session[]>([]);
  let clientBody = $state<BodyComp[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  async function load() {
    if (!authStore.uid) return;
    loading = true;
    loadError = null;
    try {
      const r = await getRelationship(authStore.uid, clientUid);
      if (!r || r.status !== 'active') {
        loadError = 'Vínculo não está ativo.';
        return;
      }
      rel = r;

      // Tenta carregar dados do cliente. Rules já permitem se a relação tem scope.
      const [p, w, s, b] = await withTimeout(
        Promise.all([
          getProfile(clientUid),
          r.scope.includes('workouts') ? listWorkouts(clientUid) : Promise.resolve<Workout[]>([]),
          listSessions(clientUid, 10).catch(() => [] as Session[]),
          listBodyComp(clientUid, 5).catch(() => [] as BodyComp[])
        ]),
        10_000,
        'dados do cliente'
      );
      clientProfile = p;
      clientWorkouts = w;
      clientSessions = s;
      clientBody = b;
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  // Criar um novo workout VAZIO pro cliente e redirecionar pro editor
  // (que vai escrever em users/{clientUid}/workouts/{id}).
  async function createWorkoutForClient() {
    if (!rel || !authStore.uid) return;
    if (!rel.scope.includes('workouts')) {
      alert('Você não tem acesso a treinos desse cliente. Peça pra ampliar o escopo.');
      return;
    }
    const id = newWorkoutId();
    const stub: Workout = {
      id,
      name: 'Novo treino',
      category: 'fullbody',
      exercises: [],
      order: clientWorkouts.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false
    };
    await saveWorkoutForClient(clientUid, {
      ...stub,
      createdByUid: authStore.uid,
      createdByName: rel.trainerName
    });
    // Edita direto: passamos ?clientUid= no query pra reusar /treinos/[id]
    goto(`/treinos/${id}?clientUid=${clientUid}`);
  }

  const latestWeight = $derived(clientBody[0]?.peso);
  const latestBodyDate = $derived(clientBody[0]?.date);
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if loadError || !rel}
  <Card>
    <div class="empty">
      <span class="mi">error</span>
      <div>
        <h2>Não foi possível abrir o cliente</h2>
        <p>{loadError ?? 'Vínculo inexistente ou inativo.'}</p>
        <Button onclick={() => goto('/trainer')}>Voltar</Button>
      </div>
    </div>
  </Card>
{:else}
  <!-- Header -->
  <div class="hero">
    <div class="avatar">
      {#if rel.clientAvatar?.startsWith('http')}
        <img src={rel.clientAvatar} alt={rel.clientName} />
      {:else}
        <span>{rel.clientAvatar || '🔥'}</span>
      {/if}
    </div>
    <div>
      <h1>{rel.clientName}</h1>
      <div class="scope-pills">
        {#each rel.scope as s (s)}
          <Badge variant="accent">
            {s === 'workouts' ? '🏋️ Treinos' : '🥗 Dieta'}
          </Badge>
        {/each}
      </div>
    </div>
  </div>

  <!-- Stats -->
  {#if clientProfile}
    <Card title="Cliente" icon="person">
      <div class="client-grid">
        {#if clientProfile.height}
          <div class="stat-mini">
            <div class="sm-l">Altura</div>
            <div class="sm-v mono">{clientProfile.height}cm</div>
          </div>
        {/if}
        {#if latestWeight}
          <div class="stat-mini">
            <div class="sm-l">Peso recente</div>
            <div class="sm-v mono">{latestWeight}kg</div>
          </div>
        {/if}
        {#if clientProfile.goals?.length}
          <div class="stat-mini wide">
            <div class="sm-l">Objetivos</div>
            <div class="sm-v">{clientProfile.goals.join(', ')}</div>
          </div>
        {/if}
      </div>
    </Card>
  {/if}

  {#if latestBodyDate}
    <div class="hint">Avaliação corporal mais recente: {fmtDateRelative(latestBodyDate)}</div>
  {/if}

  <!-- Treinos atribuídos -->
  {#if rel.scope.includes('workouts')}
    <div class="sec-title">Treinos no app dele</div>
    {#if clientWorkouts.length === 0}
      <Card>
        <div class="empty-list">
          <span class="mi">fitness_center</span>
          <div>Sem treinos ainda. Crie o primeiro abaixo.</div>
        </div>
      </Card>
    {:else}
      <div class="wk-list">
        {#each clientWorkouts as w (w.id)}
          <Card onclick={() => goto(`/treinos/${w.id}?clientUid=${clientUid}`)}>
            <div class="wk-row">
              <div class="wk-body">
                <Badge category={w.category}>{CATEGORY_ICON[w.category]} {CATEGORY_LABEL[w.category]}</Badge>
                <div class="wk-name">{w.name}</div>
                <div class="wk-meta">
                  {w.exercises.length} exercícios · {w.exercises.reduce((a, e) => a + e.sets.length, 0)} séries
                </div>
              </div>
              <span class="mi chev">chevron_right</span>
            </div>
          </Card>
        {/each}
      </div>
    {/if}

    <Button icon="add" full size="lg" onclick={createWorkoutForClient}>
      Criar novo treino pro cliente
    </Button>
  {/if}

  <!-- Histórico de sessões -->
  {#if clientSessions.length > 0}
    <div class="sec-title">Últimos treinos feitos</div>
    <div class="sess-list">
      {#each clientSessions.slice(0, 5) as s (s.id)}
        <Card>
          <div class="sess-row">
            <div class="sess-ic">{CATEGORY_ICON[s.workoutCategory]}</div>
            <div class="sess-body">
              <div class="sess-name">{s.workoutName}</div>
              <div class="sess-sub">
                {fmtDateRelative(s.date)}
                {#if s.calories}· 🔥 {s.calories} kcal{/if}
              </div>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  <div class="footer-back">
    <Button variant="ghost" icon="arrow_back" onclick={() => goto('/trainer')}>Voltar pro dashboard</Button>
  </div>
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty { text-align: center; padding: var(--s-4); }
  .empty .mi { font-size: 48px; color: var(--text-dim); margin-bottom: var(--s-3); display: block; }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: 6px; }
  .empty p { color: var(--text-mute); margin-bottom: var(--s-4); }

  .hero {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    margin: var(--s-3) 0;
  }
  .avatar {
    width: 72px; height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar span { font-size: 36px; }
  .hero h1 { font-size: var(--fs-xl); font-weight: 800; margin-bottom: 6px; }
  .scope-pills { display: flex; gap: 6px; flex-wrap: wrap; }

  .client-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  .stat-mini {
    padding: var(--s-2);
    background: var(--bg-3);
    border-radius: var(--r-sm);
  }
  .stat-mini.wide { grid-column: 1 / -1; }
  .sm-l { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: var(--text-mute); text-transform: uppercase; }
  .sm-v { font-size: var(--fs-md); color: var(--text); margin-top: 4px; font-weight: 700; }

  .hint { font-size: var(--fs-xs); color: var(--text-mute); margin: var(--s-2) 0 var(--s-3); text-align: center; }

  .sec-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    text-transform: uppercase;
    margin: var(--s-4) 0 var(--s-2);
  }

  .empty-list { display: flex; gap: var(--s-2); align-items: center; color: var(--text-mute); }
  .empty-list .mi { font-size: 24px; color: var(--text-dim); }

  .wk-list, .sess-list { display: flex; flex-direction: column; gap: var(--s-2); margin-bottom: var(--s-3); }
  .wk-row, .sess-row { display: flex; gap: var(--s-3); align-items: center; }
  .wk-body, .sess-body { flex: 1; min-width: 0; }
  .wk-name { font-weight: 700; font-size: var(--fs-md); margin-top: 6px; }
  .wk-meta, .sess-sub { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .chev { color: var(--text-dim); font-size: 22px; }
  .sess-ic { font-size: 24px; flex-shrink: 0; }
  .sess-name { font-weight: 600; font-size: var(--fs-sm); }

  .footer-back { margin-top: var(--s-5); }
</style>
