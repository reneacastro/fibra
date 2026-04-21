<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { getSession, deleteSession } from '$lib/db/sessions';
  import { getProfile } from '$lib/db/profile';
  import type { Session, UserProfile } from '$lib/types';
  import { CATEGORY_ICON, CATEGORY_LABEL, fmtDateShort, fmtDuration } from '$lib/utils/format';
  import { fmtPace, isCardio } from '$lib/utils/exercise';
  import { buildStaticMapUrl } from '$lib/utils/mapbox';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import ShareSheet from '$lib/components/ShareSheet.svelte';
  import type { ShareCardData } from '$lib/utils/shareCard';
  import { withTimeout } from '$lib/utils/withTimeout';

  const sessionId = page.params.id!;

  let session = $state<Session | null>(null);
  let profile = $state<UserProfile | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let shareData = $state<ShareCardData | null>(null);

  async function load() {
    if (!authStore.uid) { loading = false; return; }
    loading = true;
    loadError = null;
    try {
      await catalogStore.ensure();
      const [s, p] = await withTimeout(
        Promise.all([getSession(authStore.uid, sessionId), getProfile(authStore.uid)]),
        10_000,
        'carregar sessão'
      );
      session = s;
      profile = p;
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  // Detecta set de cardio (com ou sem GPS)
  const cardioSet = $derived.by(() => {
    if (!session) return null;
    for (const pe of session.performedExercises) {
      for (const s of pe.sets) {
        if (s.distanceM && s.distanceM > 100) {
          return { set: s, exerciseName: pe.exerciseName, exerciseId: pe.exerciseId };
        }
      }
    }
    return null;
  });

  const hasGpsTrack = $derived(
    !!cardioSet?.set.gpsTrack && cardioSet.set.gpsTrack.length > 1
  );

  const mapUrl = $derived.by(() => {
    if (!hasGpsTrack) return null;
    return buildStaticMapUrl({
      track: cardioSet!.set.gpsTrack!.map((p) => ({ lat: p.lat, lng: p.lng })),
      width: 600,
      height: 360,
      style: 'mapbox/outdoors-v12',
      strokeColor: '22d3ee',
      strokeWidth: 5
    });
  });

  const duration = $derived.by(() => {
    if (!session || !session.finishedAt) return 0;
    return Math.floor((session.finishedAt - session.startedAt) / 1000);
  });

  function shareRun() {
    if (!session || !profile || !cardioSet) return;
    const photoAvatar = authStore.user?.photoURL || profile.avatar;
    shareData = {
      template: 'run',
      distanceM: cardioSet.set.distanceM ?? 0,
      paceSecPerKm: cardioSet.set.paceSecPerKm ?? 0,
      durationSec: cardioSet.set.durationSec ?? duration,
      calories: session.calories,
      date: session.date,
      userName: profile.name,
      avatar: photoAvatar,
      track: cardioSet.set.gpsTrack?.map((p) => ({ lat: p.lat, lng: p.lng })) ?? []
    };
  }

  function shareSession() {
    if (!session || !profile) return;
    shareData = {
      template: 'session',
      session,
      userName: profile.name,
      avatar: profile.avatar
    };
  }

  async function remove() {
    if (!session) return;
    if (!confirm(`Apagar esse registro?`)) return;
    await deleteSession(authStore.uid!, session.id);
    goto('/registrar');
  }

  const totalVolume = $derived.by(() => {
    if (!session) return 0;
    return session.performedExercises.reduce(
      (acc, pe) => acc + pe.sets.reduce(
        (s, st) => s + (st.completed ? (st.weight ?? 0) * (st.reps ?? 0) : 0), 0
      ), 0
    );
  });

  const totalSets = $derived.by(() => {
    if (!session) return 0;
    return session.performedExercises.reduce(
      (a, pe) => a + pe.sets.filter((s) => s.completed).length, 0
    );
  });
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if loadError}
  <button class="retry-box" onclick={load}>
    <span class="mi">refresh</span>
    <span>{loadError} — toque pra tentar de novo</span>
  </button>
{:else if !session}
  <div class="empty">
    <div>🔍</div>
    <h2>Registro não encontrado</h2>
    <p>Talvez tenha sido apagado.</p>
    <Button onclick={() => goto('/registrar')}>Voltar</Button>
  </div>
{:else}
  <!-- Hero -->
  <div class="hero">
    <Badge category={session.workoutCategory}>
      {CATEGORY_ICON[session.workoutCategory]} {CATEGORY_LABEL[session.workoutCategory]}
    </Badge>
    <h1>{session.workoutName}</h1>
    <div class="hero-sub">
      {fmtDateShort(session.date)}
      {#if duration > 0}· {fmtDuration(duration * 1000)}{/if}
    </div>
  </div>

  <!-- Mapa (se tiver GPS) -->
  {#if cardioSet && hasGpsTrack && mapUrl}
    <Card padding="sm">
      <div class="map-wrap">
        <img src={mapUrl} alt="Percurso da corrida" class="map-img" />
      </div>
    </Card>
  {:else if cardioSet}
    <Card>
      <div class="no-map">
        <span class="mi">map</span>
        <div>
          <div class="nm-t">Sem rota GPS nesse registro</div>
          <div class="nm-s">
            Essa sessão não tem percurso gravado. Nas próximas corridas, toque em
            <strong>GPS</strong> no set pra rastrear o caminho.
          </div>
        </div>
      </div>
    </Card>
  {/if}

  <!-- Stats de cardio -->
  {#if cardioSet}
    <Card title="Cardio" icon="directions_run">
      <div class="stats-grid">
        <div class="stat">
          <div class="sv mono">{((cardioSet.set.distanceM ?? 0) / 1000).toFixed(2)}</div>
          <div class="sl">km</div>
        </div>
        {#if cardioSet.set.paceSecPerKm}
          <div class="stat">
            <div class="sv mono">{fmtPace(cardioSet.set.paceSecPerKm)}</div>
            <div class="sl">pace /km</div>
          </div>
        {/if}
        {#if cardioSet.set.durationSec}
          <div class="stat">
            <div class="sv mono">{fmtDuration(cardioSet.set.durationSec * 1000)}</div>
            <div class="sl">tempo</div>
          </div>
        {/if}
        {#if session.calories}
          <div class="stat">
            <div class="sv mono">{session.calories}</div>
            <div class="sl">kcal</div>
          </div>
        {/if}
      </div>
    </Card>
  {/if}

  <!-- Resumo geral -->
  <Card title="Resumo" icon="analytics">
    <div class="stats-grid">
      <div class="stat">
        <div class="sv mono">{totalSets}</div>
        <div class="sl">séries</div>
      </div>
      {#if totalVolume > 0}
        <div class="stat">
          <div class="sv mono">{Math.round(totalVolume)}</div>
          <div class="sl">kg totais</div>
        </div>
      {/if}
      {#if session.prsEarned && session.prsEarned.length > 0}
        <div class="stat">
          <div class="sv mono">🏆 {session.prsEarned.length}</div>
          <div class="sl">{session.prsEarned.length === 1 ? 'recorde' : 'recordes'}</div>
        </div>
      {/if}
      {#if session.mood}
        <div class="stat">
          <div class="sv mono">{['😵','😓','😐','💪','🔥'][session.mood - 1]}</div>
          <div class="sl">mood</div>
        </div>
      {/if}
    </div>
    {#if session.notes}
      <div class="notes">{session.notes}</div>
    {/if}
  </Card>

  <!-- Exercícios -->
  <Card title="Exercícios" icon="fitness_center">
    {#each session.performedExercises as pe, i (i)}
      {@const meta = catalogStore.byId(pe.exerciseId)}
      {@const isC = meta ? isCardio(meta) : false}
      <div class="ex-block" class:skipped={pe.skipped}>
        <div class="ex-head">
          <span class="ex-n mono">{i + 1}</span>
          <div>
            <div class="ex-name">{pe.exerciseName}</div>
            {#if pe.skipped}<div class="ex-skip">Pulado</div>{/if}
          </div>
        </div>
        {#if !pe.skipped}
          <div class="sets">
            {#each pe.sets as s, j (j)}
              {#if s.completed}
                <div class="set-line">
                  <span class="set-n mono">Série {j + 1}:</span>
                  <span class="mono">
                    {#if isC && s.distanceM}
                      {(s.distanceM / 1000).toFixed(2)}km{s.paceSecPerKm ? ` @ ${fmtPace(s.paceSecPerKm)}` : ''}
                    {:else if s.durationSec}
                      {s.durationSec}s
                    {:else if s.reps !== undefined}
                      {s.reps}×{s.weight !== undefined ? ` ${s.weight}kg` : ''}
                    {:else}
                      ✓
                    {/if}
                    {#if s.rpe}· RPE {s.rpe}{/if}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </Card>

  <!-- Compartilhar -->
  <div class="share-stack">
    {#if cardioSet}
      <button class="share-row run" onclick={shareRun}>
        <div class="sr-ic">🗺️</div>
        <div class="sr-body">
          <div class="sr-t">Compartilhar a corrida</div>
          <div class="sr-s">{hasGpsTrack ? 'Mapa + stats' : 'Stats em destaque'}</div>
        </div>
        <span class="mi">ios_share</span>
      </button>
    {/if}
    <button class="share-row" onclick={shareSession}>
      <div class="sr-ic">📊</div>
      <div class="sr-body">
        <div class="sr-t">Compartilhar o treino</div>
        <div class="sr-s">Volume + duração + stats</div>
      </div>
      <span class="mi">ios_share</span>
    </button>
  </div>

  <!-- Ações -->
  <div class="footer">
    <Button variant="ghost" icon="arrow_back" onclick={() => goto('/registrar')}>Voltar</Button>
    <Button variant="ghost" icon="delete_outline" onclick={remove}>Apagar</Button>
  </div>
{/if}

{#if shareData}
  <ShareSheet data={shareData} onClose={() => (shareData = null)} />
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

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

  .empty { text-align: center; padding: var(--s-8) var(--s-4); }
  .empty div:first-child { font-size: 64px; margin-bottom: var(--s-3); }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: 6px; }
  .empty p { color: var(--text-mute); margin-bottom: var(--s-4); }

  .hero { text-align: center; margin: var(--s-3) 0; }
  .hero h1 { font-size: var(--fs-2xl); font-weight: 800; margin-top: var(--s-2); letter-spacing: -0.02em; }
  .hero-sub { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .map-wrap { overflow: hidden; border-radius: var(--r-lg); }
  .map-img { width: 100%; display: block; }

  .no-map {
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
    padding: var(--s-2);
  }
  .no-map .mi { font-size: 32px; color: var(--text-dim); flex-shrink: 0; margin-top: 4px; }
  .nm-t { font-weight: 700; font-size: var(--fs-sm); }
  .nm-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 4px; line-height: 1.5; }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-3);
  }
  @media (min-width: 420px) {
    .stats-grid { grid-template-columns: repeat(4, 1fr); }
  }
  .stat { text-align: center; }
  .sv { font-size: var(--fs-2xl); font-weight: 800; color: var(--text); line-height: 1; }
  .sl { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 4px; }

  .notes {
    margin-top: var(--s-3);
    padding: var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .ex-block {
    padding: var(--s-3) 0;
    border-bottom: 1px solid var(--border);
  }
  .ex-block:last-child { border-bottom: 0; }
  .ex-block.skipped { opacity: 0.5; }
  .ex-head { display: flex; gap: var(--s-3); align-items: flex-start; margin-bottom: var(--s-2); }
  .ex-n {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--bg-3);
    display: grid; place-items: center;
    font-size: 13px; font-weight: 700; color: var(--text-mute);
    flex-shrink: 0;
  }
  .ex-name { font-weight: 600; font-size: var(--fs-sm); }
  .ex-skip { font-size: var(--fs-xs); color: var(--text-mute); font-style: italic; }
  .sets { padding-left: 40px; display: flex; flex-direction: column; gap: 4px; }
  .set-line { font-size: var(--fs-xs); color: var(--text-mute); }
  .set-n { color: var(--text-dim); }

  .share-stack {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-top: var(--s-4);
  }
  .share-row {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-3);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    color: var(--text);
    text-align: left;
    transition: all var(--dur-fast);
  }
  .share-row:hover { border-color: var(--accent); background: var(--bg-3); }
  .share-row.run {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
  }
  .sr-ic { font-size: 28px; flex-shrink: 0; }
  .sr-body { flex: 1; }
  .sr-t { font-weight: 700; }
  .sr-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .share-row .mi { color: var(--text-mute); }

  .footer {
    display: flex;
    justify-content: space-between;
    gap: var(--s-2);
    margin-top: var(--s-4);
  }
</style>
