<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getMyRanking } from '$lib/db/rankings';
  import type { RankingEntry, WorkoutCategory } from '$lib/types';
  import { CATEGORY_LABEL, CATEGORY_ICON, fmtDuration } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Badge from '$lib/components/Badge.svelte';

  const uid = $derived(page.params.uid ?? '');
  let ranking = $state<RankingEntry | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    if (!uid) { loading = false; return; }
    try {
      ranking = await getMyRanking(uid);
      if (!ranking || (ranking as unknown as { deleted?: boolean }).deleted) {
        loadError = 'Perfil não disponível ou privado.';
      }
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  });

  function back() {
    if (history.length > 1) history.back();
    else goto('/comunidade');
  }

  // Categorias ordenadas por count desc
  const categoryBreakdown = $derived.by(() => {
    if (!ranking?.byCategory) return [];
    const entries = Object.entries(ranking.byCategory) as [WorkoutCategory, number][];
    const filtered = entries.filter(([, n]) => n > 0);
    filtered.sort((a, b) => b[1] - a[1]);
    const max = filtered[0]?.[1] ?? 1;
    return filtered.map(([cat, count]) => ({ cat, count, pct: (count / max) * 100 }));
  });

  // Quando "há X dias" desde última atividade
  const daysSinceActive = $derived.by(() => {
    if (!ranking?.lastActivityAt) return null;
    const diff = Date.now() - ranking.lastActivityAt;
    return Math.floor(diff / 86_400_000);
  });

  function fmtDistance(meters: number): string {
    if (meters >= 1000) return (meters / 1000).toFixed(1) + 'km';
    return Math.round(meters) + 'm';
  }

  function fmtVolume(kg: number): string {
    if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
    return Math.round(kg) + 'kg';
  }
</script>

<svelte:head>
  <title>{ranking?.displayName ?? 'Atleta'} · FIBRA</title>
</svelte:head>

<div class="page">
  <header class="top-bar">
    <button class="icon-btn" onclick={back} aria-label="Voltar">
      <span class="mi">arrow_back</span>
    </button>
    <h1 class="title">{ranking?.displayName ?? 'Atleta'}</h1>
    <div style="width: 32px"></div>
  </header>

  {#if loading}
    <div class="loading"><span class="mi spin">progress_activity</span></div>
  {:else if loadError || !ranking}
    <Card>
      <div class="error-state">
        <span class="mi">lock</span>
        <p>{loadError ?? 'Perfil não encontrado'}</p>
      </div>
    </Card>
  {:else}
    <!-- Perfil -->
    <Card>
      <div class="profile">
        <div class="avatar-lg">
          {#if ranking.avatar?.startsWith('http')}
            <img src={ranking.avatar} alt={ranking.displayName} />
          {:else}
            <span class="emo">{ranking.avatar || '🔥'}</span>
          {/if}
        </div>
        <div class="profile-body">
          <h2>{ranking.displayName}</h2>
          {#if daysSinceActive !== null}
            <div class="last-act">
              {#if daysSinceActive === 0}
                Treinou hoje
              {:else if daysSinceActive === 1}
                Treinou ontem
              {:else}
                Último treino há {daysSinceActive} dias
              {/if}
            </div>
          {/if}
          {#if ranking.currentStreak > 0}
            <Badge variant="warn" size="sm">🔥 {ranking.currentStreak} dia{ranking.currentStreak === 1 ? '' : 's'} seguido{ranking.currentStreak === 1 ? '' : 's'}</Badge>
          {/if}
        </div>
      </div>
    </Card>

    <!-- Stats semana / mes -->
    <div class="grid-2">
      <Card>
        <div class="stat">
          <div class="stat-lbl">Essa semana</div>
          <div class="stat-v mono">{ranking.weekSessions}</div>
          <div class="stat-sub">treinos</div>
        </div>
      </Card>
      <Card>
        <div class="stat">
          <div class="stat-lbl">Mês</div>
          <div class="stat-v mono">{ranking.monthSessions}</div>
          <div class="stat-sub">treinos</div>
        </div>
      </Card>
    </div>

    <!-- Totais gerais -->
    <div class="section-title">Totais</div>
    <Card>
      <div class="totals">
        <div class="t-item">
          <span class="mi">fitness_center</span>
          <div class="t-body">
            <div class="t-v mono">{ranking.totalSessions}</div>
            <div class="t-l">treinos no total</div>
          </div>
        </div>
        {#if ranking.totalPRs > 0}
          <div class="t-item">
            <span class="mi">emoji_events</span>
            <div class="t-body">
              <div class="t-v mono">{ranking.totalPRs}</div>
              <div class="t-l">recordes (PRs)</div>
            </div>
          </div>
        {/if}
        {#if ranking.totalVolumeKg > 0}
          <div class="t-item">
            <span class="mi">scale</span>
            <div class="t-body">
              <div class="t-v mono">{fmtVolume(ranking.totalVolumeKg)}</div>
              <div class="t-l">volume movido</div>
            </div>
          </div>
        {/if}
        {#if ranking.totalDistanceM > 0}
          <div class="t-item">
            <span class="mi">directions_run</span>
            <div class="t-body">
              <div class="t-v mono">{fmtDistance(ranking.totalDistanceM)}</div>
              <div class="t-l">percorridos</div>
            </div>
          </div>
        {/if}
        {#if ranking.totalDurationSec > 0}
          <div class="t-item">
            <span class="mi">schedule</span>
            <div class="t-body">
              <div class="t-v mono">{fmtDuration(ranking.totalDurationSec)}</div>
              <div class="t-l">tempo total</div>
            </div>
          </div>
        {/if}
      </div>
    </Card>

    <!-- Breakdown por categoria -->
    {#if categoryBreakdown.length > 0}
      <div class="section-title">Tipos de treino</div>
      <Card>
        <div class="cat-list">
          {#each categoryBreakdown as row (row.cat)}
            <div class="cat-row">
              <div class="cat-head">
                <span class="cat-ic">{CATEGORY_ICON[row.cat] ?? '🔹'}</span>
                <span class="cat-name">{CATEGORY_LABEL[row.cat]}</span>
                <span class="cat-count mono">{row.count}</span>
              </div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: {row.pct}%"></div>
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .page {
    padding: 0 var(--s-4) calc(var(--nav-h) + var(--safe-bottom) + var(--s-5));
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .top-bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-3) 0;
    margin: 0 calc(var(--s-4) * -1);
    padding-left: var(--s-3);
    padding-right: var(--s-3);
    background: color-mix(in srgb, var(--bg-1) 90%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
  }
  .title {
    flex: 1;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text);
    display: grid;
    place-items: center;
  }
  .icon-btn:hover { background: var(--bg-3); }

  .loading { padding: var(--s-8); text-align: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-state {
    text-align: center;
    padding: var(--s-6);
    color: var(--text-mute);
  }
  .error-state .mi { font-size: 40px; color: var(--text-dim); display: block; margin-bottom: 8px; }

  /* Perfil header */
  .profile {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }
  .avatar-lg {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 2px solid var(--border);
    display: grid;
    place-items: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .avatar-lg img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-lg .emo { font-size: 36px; }
  .profile-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .profile-body h2 {
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .last-act {
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }

  /* Grid 2-col */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }

  /* Stats */
  .stat { text-align: center; padding: var(--s-2) 0; }
  .stat-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .stat-v {
    font-size: var(--fs-3xl);
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
    margin: 6px 0 4px;
  }
  .stat-sub { font-size: 10px; color: var(--text-mute); }

  .section-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--s-3) 0 var(--s-1);
  }

  /* Totals list */
  .totals {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .t-item {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }
  .t-item .mi {
    font-size: 24px;
    color: var(--accent);
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    background: var(--accent-glow);
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .t-body { flex: 1; min-width: 0; }
  .t-v {
    font-size: var(--fs-xl);
    font-weight: 800;
    color: var(--text);
    line-height: 1;
  }
  .t-l { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  /* Category breakdown bars */
  .cat-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .cat-row { display: flex; flex-direction: column; gap: 6px; }
  .cat-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-sm);
  }
  .cat-ic { font-size: 16px; }
  .cat-name {
    flex: 1;
    font-weight: 600;
    text-transform: capitalize;
  }
  .cat-count {
    font-weight: 700;
    color: var(--accent);
    font-size: var(--fs-sm);
  }
  .cat-bar-track {
    width: 100%;
    height: 6px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    overflow: hidden;
  }
  .cat-bar-fill {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--r-full);
    transition: width 400ms var(--ease-out);
  }
</style>
