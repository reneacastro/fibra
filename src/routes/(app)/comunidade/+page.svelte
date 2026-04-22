<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { getProfile, saveProfile } from '$lib/db/profile';
  import { listRanking, type RankingOrder } from '$lib/db/rankings';
  import { listPublicShared, listReceived, cloneToWorkout } from '$lib/db/sharedWorkouts';
  import { listPendingForMe, acceptInvite, deleteInvite } from '$lib/db/relationships';
  import { listMyGroups, listPublicGroups } from '$lib/db/groups';
  import type { Relationship, Group } from '$lib/types';
  import { listWorkouts, saveWorkout, newWorkoutId } from '$lib/db/workouts';
  import type { RankingEntry, SharedWorkout, WorkoutCategory, UserProfile } from '$lib/types';
  import { CATEGORY_LABEL, CATEGORY_ICON } from '$lib/utils/format';
  import { withTimeout } from '$lib/utils/withTimeout';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ShareSheet from '$lib/components/ShareSheet.svelte';
  import type { ShareCardData } from '$lib/utils/shareCard';

  type TabId = 'ranking' | 'grupos' | 'publicos' | 'recebidos' | 'convites';
  let active = $state<TabId>('ranking');

  let profile = $state<UserProfile | null>(null);
  let ranking = $state<RankingEntry[]>([]);
  let publicShared = $state<SharedWorkout[]>([]);
  let received = $state<SharedWorkout[]>([]);
  let pendingInvites = $state<Relationship[]>([]);
  let myGroups = $state<Group[]>([]);
  let featuredGroups = $state<Group[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  // Filtros do ranking
  const ORDERS: { id: RankingOrder; label: string; unit?: string }[] = [
    { id: 'totalSessions',  label: 'Mais treinos',      unit: 'treinos' },
    { id: 'weekSessions',   label: 'Semana',            unit: 'na semana' },
    { id: 'currentStreak',  label: 'Sequência',         unit: 'dias' },
    { id: 'totalPRs',       label: 'Recordes',          unit: 'PRs' },
    { id: 'totalDistanceM', label: 'Distância',         unit: 'metros' }
  ];
  let orderBy = $state<RankingOrder>('totalSessions');
  let filterCategory = $state<WorkoutCategory | ''>('');

  const categories: WorkoutCategory[] = [
    'superior', 'inferior', 'fullbody', 'forca', 'pump', 'core',
    'funcional', 'calistenia', 'crossfit', 'hiit', 'cardio',
    'mobilidade', 'alongamento', 'livre'
  ];

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [p, r, pub, rec, inv, mg, fg] = await withTimeout(
        Promise.all([
          authStore.uid ? getProfile(authStore.uid) : Promise.resolve(null),
          listRanking({ orderBy, category: filterCategory || undefined, max: 50 }),
          listPublicShared({ max: 50 }),
          authStore.uid ? listReceived(authStore.uid, 50) : Promise.resolve([]),
          authStore.uid ? listPendingForMe(authStore.uid) : Promise.resolve([]),
          authStore.uid ? listMyGroups(authStore.uid) : Promise.resolve([]),
          listPublicGroups(20)
        ]),
        12_000,
        'comunidade'
      );
      profile = p;
      ranking = r;
      publicShared = pub;
      received = rec;
      pendingInvites = inv;
      myGroups = mg;
      const myIds = new Set(mg.map((g) => g.id));
      featuredGroups = fg.filter((g) => !myIds.has(g.id));
      await catalogStore.ensure();
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  $effect(() => {
    // Recarrega ranking quando o filtro muda
    orderBy; filterCategory;
    if (!loading) reloadRanking();
  });

  async function reloadRanking() {
    try {
      ranking = await listRanking({ orderBy, category: filterCategory || undefined, max: 50 });
    } catch (e) {
      console.warn('Falha ao carregar ranking:', e);
    }
  }

  async function optIn() {
    if (!profile || !authStore.uid) return;
    const next = {
      ...profile,
      settings: { ...profile.settings, publicProfile: true }
    };
    await saveProfile(authStore.uid, next);
    profile = next;
    alert('Você entrou na comunidade. O ranking aparece depois do próximo treino que você salvar.');
  }

  // Clone a shared workout
  let cloningId = $state<string | null>(null);
  async function clone(s: SharedWorkout) {
    if (!authStore.uid) return;
    cloningId = s.id;
    try {
      const existing = await listWorkouts(authStore.uid);
      const w = cloneToWorkout(s, newWorkoutId(), existing.length);
      await saveWorkout(authStore.uid, w);
      if (confirm(`"${w.name}" foi adicionado aos seus treinos. Ir ver?`)) {
        goto(`/treinos/${w.id}`);
      }
    } catch (e) {
      alert('Falha ao clonar: ' + (e as Error).message);
    } finally {
      cloningId = null;
    }
  }

  function fmtMetric(e: RankingEntry, ord: RankingOrder): string {
    switch (ord) {
      case 'totalSessions':  return String(e.totalSessions);
      case 'weekSessions':   return String(e.weekSessions);
      case 'currentStreak':  return String(e.currentStreak);
      case 'totalPRs':       return String(e.totalPRs);
      case 'totalDistanceM': return `${(e.totalDistanceM / 1000).toFixed(1)} km`;
      default:               return '—';
    }
  }

  /** Sub-texto abaixo do nome, contextual ao filtro atual. */
  function fmtSubtext(e: RankingEntry): string {
    // Filtro por categoria cardio: mostra distância + pace médio
    if (filterCategory === 'cardio') {
      const km = (e.totalDistanceM / 1000).toFixed(1);
      const avgPace = e.totalDistanceM > 100 && e.totalDurationSec > 0
        ? Math.round(e.totalDurationSec / (e.totalDistanceM / 1000))
        : 0;
      if (avgPace > 0) {
        const m = Math.floor(avgPace / 60);
        const s = avgPace % 60;
        return `${km} km · pace ${m}:${String(s).padStart(2, '0')}/km`;
      }
      return `${km} km totais`;
    }
    // Outras categorias: contagem por categoria + streak
    if (filterCategory) {
      const count = e.byCategory?.[filterCategory] ?? 0;
      return `${count} treinos de ${filterCategory}`;
    }
    // Sem filtro: só total de treinos
    return `${e.totalSessions} treinos`;
  }

  function rankMedal(i: number): string {
    return ['🥇', '🥈', '🥉'][i] ?? '';
  }

  // Share status no top 3
  let shareData = $state<ShareCardData | null>(null);
  function shareRank(r: RankingEntry, position: number) {
    shareData = {
      template: 'rank',
      position,
      metricLabel: ORDERS.find((o) => o.id === orderBy)?.label ?? 'Ranking',
      metricValue: fmtMetric(r, orderBy),
      userName: r.displayName,
      avatar: r.avatar
    };
  }

  const iOptedIn = $derived(profile?.settings?.publicProfile === true);

  const tabs = $derived([
    { id: 'ranking',   label: 'Ranking' },
    { id: 'grupos',    label: 'Grupos' },
    { id: 'publicos',  label: 'Públicos' },
    { id: 'recebidos', label: received.length > 0 ? `Recebidos (${received.length})` : 'Recebidos' },
    ...(pendingInvites.length > 0 ? [{ id: 'convites', label: `Convites (${pendingInvites.length})` }] : [])
  ]);

  async function acceptInv(r: Relationship) {
    if (!confirm(`Aceitar convite de ${r.trainerName}? Ele poderá editar ${r.scope.map((s) => s === 'workouts' ? 'treinos' : 'dieta').join(' e ')} no seu app.`)) return;
    await acceptInvite(r.trainerUid, r.clientUid);
    pendingInvites = pendingInvites.filter((x) => x.id !== r.id);
  }

  async function rejectInv(r: Relationship) {
    if (!confirm(`Rejeitar convite de ${r.trainerName}?`)) return;
    await deleteInvite(r.trainerUid, r.clientUid);
    pendingInvites = pendingInvites.filter((x) => x.id !== r.id);
  }
</script>

<Tabs {tabs} value={active} onChange={(id) => (active = id as TabId)} />

<div class="spacer"></div>

{#if !iOptedIn && !loading && profile}
  <Card accent="glow">
    <div class="opt-in">
      <div class="opt-ic">🫂</div>
      <div>
        <div class="opt-t">Entra na comunidade</div>
        <div class="opt-s">
          Seu nome + foto + stats agregadas (treinos, sequência, PRs) aparecem no ranking público.
          Nenhum dado privado (bioimpedância, dieta, fotos) é exposto.
        </div>
        <div class="spacer-sm"></div>
        <Button icon="group_add" onclick={optIn}>Quero entrar</Button>
      </div>
    </div>
  </Card>
{/if}

{#if loadError}
  <button class="retry-box" onclick={load}>
    <span class="mi">refresh</span>
    <span>Falha ao carregar. Toque pra tentar de novo.</span>
  </button>
{:else if loading}
  <div class="empty"><span class="mi spin">progress_activity</span>Carregando…</div>
{:else if active === 'ranking'}

  <!-- Filtros do ranking -->
  <Card>
    <div class="filter-head">Ordenar por</div>
    <div class="chips">
      {#each ORDERS as o (o.id)}
        <button class="chip" class:on={orderBy === o.id} onclick={() => (orderBy = o.id)}>
          {o.label}
        </button>
      {/each}
    </div>
    <div class="spacer-sm"></div>
    <div class="filter-head">Categoria</div>
    <div class="chips">
      <button class="chip" class:on={filterCategory === ''} onclick={() => (filterCategory = '')}>
        Todas
      </button>
      {#each categories as c (c)}
        <button class="chip" class:on={filterCategory === c} onclick={() => (filterCategory = c)}>
          {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
        </button>
      {/each}
    </div>
  </Card>

  {#if ranking.length === 0}
    <div class="empty">
      <span class="mi">emoji_people</span>
      <div>
        <div class="empty-t">Ranking vazio ainda</div>
        <div class="empty-s">Seja o primeiro: registre um treino e você aparece aqui.</div>
      </div>
    </div>
  {:else}
    <div class="rank-list">
      {#each ranking as r, i (r.uid)}
        <Card>
          <div class="rank-row" class:me={r.uid === authStore.uid}>
            <div class="rank-pos">
              {#if rankMedal(i)}
                <span class="medal">{rankMedal(i)}</span>
              {:else}
                <span class="pos-n">{i + 1}</span>
              {/if}
            </div>
            <div class="rank-avatar">
              {#if r.avatar?.startsWith('http')}
                <img src={r.avatar} alt={r.displayName} />
              {:else}
                <span class="emo">{r.avatar || '🔥'}</span>
              {/if}
            </div>
            <div class="rank-body">
              <div class="rank-name">{r.displayName}</div>
              <div class="rank-sub">{fmtSubtext(r)}</div>
            </div>
            <div class="rank-metric">
              <div class="m-v mono">{fmtMetric(r, orderBy)}</div>
              {#if i < 3 && r.uid === authStore.uid}
                <button
                  class="rank-share"
                  onclick={(e) => { e.stopPropagation(); shareRank(r, i + 1); }}
                  aria-label="Compartilhar posição"
                >
                  <span class="mi">ios_share</span>
                </button>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

{:else if active === 'grupos'}
  <div class="grp-head">
    <div class="grp-head-t">Comunidades dentro da comunidade</div>
    <Button size="sm" icon="add" onclick={() => goto('/grupos')}>Criar / ver todos</Button>
  </div>

  {#if myGroups.length > 0}
    <div class="sec-title">Meus grupos</div>
    <div class="grp-list">
      {#each myGroups as g (g.id)}
        <Card onclick={() => goto(`/grupos/${g.id}`)} padding="md">
          <div class="gr-row">
            <div class="gr-ic">{g.emoji || '🔥'}</div>
            <div class="gr-body">
              <div class="gr-name">{g.name}</div>
              <div class="gr-sub">{g.memberUids.length} {g.memberUids.length === 1 ? 'membro' : 'membros'}</div>
            </div>
            <span class="mi">chevron_right</span>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if featuredGroups.length > 0}
    <div class="sec-title">Descobrir</div>
    <div class="grp-list">
      {#each featuredGroups as g (g.id)}
        <Card onclick={() => goto(`/grupos/${g.id}`)} padding="md">
          <div class="gr-row">
            <div class="gr-ic">{g.emoji || '🔥'}</div>
            <div class="gr-body">
              <div class="gr-name">{g.name}</div>
              <div class="gr-sub">{g.memberUids.length} membros · por {g.ownerName}</div>
            </div>
            <span class="mi">chevron_right</span>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if myGroups.length === 0 && featuredGroups.length === 0}
    <div class="empty">
      <span class="mi">groups</span>
      <div>
        <div class="empty-t">Nenhum grupo ainda</div>
        <div class="empty-s">Toque em "Criar / ver todos" pra começar.</div>
      </div>
    </div>
  {/if}
{:else if active === 'convites'}
  {#if pendingInvites.length === 0}
    <div class="empty">
      <span class="mi">inbox</span>
      <div>
        <div class="empty-t">Nenhum convite pendente</div>
        <div class="empty-s">Convites de personal trainers ou nutricionistas aparecem aqui.</div>
      </div>
    </div>
  {:else}
    <div class="shared-list">
      {#each pendingInvites as inv (inv.id)}
        <Card>
          <div class="sh-head">
            <div class="sh-avatar">
              {#if inv.trainerAvatar?.startsWith('http')}
                <img src={inv.trainerAvatar} alt={inv.trainerName} />
              {:else}
                <span class="emo">{inv.trainerAvatar || '💪'}</span>
              {/if}
            </div>
            <div class="sh-by">
              <div class="sh-by-n">{inv.trainerName}</div>
              <div class="sh-by-d">
                {inv.trainerRole === 'nutritionist' ? 'Nutricionista' : 'Personal trainer'}
              </div>
            </div>
          </div>
          <div class="sh-name">Convidou você pra assessoria</div>
          <div class="sh-meta">
            Vai poder editar:
            <strong>
              {inv.scope.map((s) => s === 'workouts' ? 'treinos' : 'dieta').join(' e ')}
            </strong>
          </div>
          {#if inv.note}
            <div class="sh-desc">"{inv.note}"</div>
          {/if}
          <div class="spacer-sm"></div>
          <div class="inv-actions">
            <Button variant="ghost" onclick={() => rejectInv(inv)}>Recusar</Button>
            <Button icon="check_circle" full variant="success" onclick={() => acceptInv(inv)}>
              Aceitar
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{:else}
  <!-- Treinos compartilhados: públicos ou recebidos direto -->
  {@const list = active === 'publicos' ? publicShared : received}
  {@const isReceived = active === 'recebidos'}
  {#if list.length === 0}
    <div class="empty">
      <span class="mi">{isReceived ? 'inbox' : 'fitness_center'}</span>
      <div>
        {#if isReceived}
          <div class="empty-t">Nenhum treino recebido</div>
          <div class="empty-s">
            Quando alguém enviar um treino direto pra você, ele aparece aqui.
          </div>
        {:else}
          <div class="empty-t">Nenhum treino público ainda</div>
          <div class="empty-s">
            Em <strong>Treinos</strong>, abra um dos seus e toque em <strong>Compartilhar → Público</strong>.
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="shared-list">
      {#each list as s (s.id)}
        <Card>
          <div class="sh-head">
            <div class="sh-avatar">
              {#if s.ownerAvatar?.startsWith('http')}
                <img src={s.ownerAvatar} alt={s.ownerName} />
              {:else}
                <span class="emo">{s.ownerAvatar || '🔥'}</span>
              {/if}
            </div>
            <div class="sh-by">
              <div class="sh-by-n">
                {#if isReceived}✉ {s.ownerName} enviou pra você{:else}{s.ownerName}{/if}
              </div>
              <div class="sh-by-d">{new Date(s.publishedAt).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>
          <Badge category={s.category}>{CATEGORY_ICON[s.category]} {CATEGORY_LABEL[s.category]}</Badge>
          <div class="sh-name">{s.name}</div>
          <div class="sh-meta">
            {s.exercises.length} exercícios ·
            {s.exercises.reduce((a, e) => a + e.sets.length, 0)} séries
          </div>
          {#if s.description}
            <div class="sh-desc">{s.description}</div>
          {/if}
          <div class="spacer-sm"></div>
          <Button
            icon="add_circle"
            full
            variant="secondary"
            loading={cloningId === s.id}
            onclick={() => clone(s)}
          >
            Adicionar aos meus treinos
          </Button>
        </Card>
      {/each}
    </div>
  {/if}
{/if}

{#if shareData}
  <ShareSheet data={shareData} onClose={() => (shareData = null)} />
{/if}

<style>
  .spacer { height: var(--s-3); }
  .spacer-sm { height: var(--s-2); }

  .opt-in { display: flex; gap: var(--s-3); align-items: flex-start; }
  .opt-ic { font-size: 40px; flex-shrink: 0; }
  .opt-t { font-weight: 800; font-size: var(--fs-md); margin-bottom: 4px; }
  .opt-s { font-size: var(--fs-xs); color: var(--text-mute); line-height: 1.5; }

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

  .filter-head {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    margin-bottom: var(--s-2);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 8px 12px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
  }
  .chip.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-8) var(--s-3);
    color: var(--text-mute);
    text-align: center;
  }
  .empty .mi { font-size: 32px; color: var(--text-dim); }
  .empty-t { font-weight: 700; color: var(--text); font-size: var(--fs-md); }
  .empty-s { font-size: var(--fs-sm); }

  .rank-list, .shared-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-top: var(--s-3);
  }

  .rank-row {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    position: relative;
  }
  /* Destaque "eu" usando box-shadow inset — não corta como outline */
  :global(.card:has(> .rank-row.me)) {
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .rank-pos { width: 38px; text-align: center; flex-shrink: 0; }
  .medal { font-size: 24px; }
  .pos-n { font-family: var(--font-mono); font-weight: 700; color: var(--text-mute); font-size: var(--fs-md); }

  .rank-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    border: 1px solid var(--border);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .rank-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .rank-avatar .emo { font-size: 24px; }

  .rank-body { flex: 1; min-width: 0; }
  .rank-name {
    font-weight: 700;
    font-size: var(--fs-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .rank-sub {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    margin-top: 2px;
  }

  .rank-metric { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .m-v { font-weight: 800; color: var(--accent); font-size: var(--fs-md); }
  .rank-share {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--accent-glow);
    color: var(--accent);
    display: grid;
    place-items: center;
  }
  .rank-share .mi { font-size: 16px; }

  /* Shared workouts */
  .sh-head {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    margin-bottom: var(--s-2);
  }
  .sh-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .sh-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .sh-by-n { font-size: var(--fs-xs); font-weight: 700; }
  .sh-by-d { font-size: 10px; color: var(--text-mute); }
  .sh-name { font-weight: 800; font-size: var(--fs-md); margin-top: 6px; }
  .sh-meta { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 4px; }
  .sh-desc {
    margin-top: var(--s-2);
    padding: var(--s-2);
    background: var(--bg-3);
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    color: var(--text);
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .inv-actions { display: flex; gap: var(--s-2); }

  .grp-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--s-3);
    margin-bottom: var(--s-2);
  }
  .grp-head-t { font-size: var(--fs-sm); color: var(--text-mute); font-style: italic; }
  .grp-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .gr-row { display: flex; gap: var(--s-3); align-items: center; }
  .gr-ic {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--bg-3);
    display: grid; place-items: center;
    font-size: 24px;
    flex-shrink: 0;
  }
  .gr-body { flex: 1; min-width: 0; }
  .gr-name { font-weight: 700; }
  .gr-sub { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
</style>
