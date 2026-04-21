<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listSessions } from '$lib/db/sessions';
  import { getProfile } from '$lib/db/profile';
  import type { Session, UserProfile } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import ShareSheet from '$lib/components/ShareSheet.svelte';
  import type { ShareCardData } from '$lib/utils/shareCard';

  const sessionId = page.url.searchParams.get('id') ?? '';
  const prs = Number(page.url.searchParams.get('prs') ?? 0);

  let session = $state<Session | null>(null);
  let profile = $state<UserProfile | null>(null);
  let show = $state(false);
  let shareData = $state<ShareCardData | null>(null);

  onMount(async () => {
    if (authStore.uid) {
      const [sessions, p] = await Promise.all([
        listSessions(authStore.uid, 3),
        getProfile(authStore.uid)
      ]);
      session = sessions.find((s) => s.id === sessionId) ?? sessions[0] ?? null;
      profile = p;
    }
    setTimeout(() => (show = true), 80);
  });

  // Detecta se tem set de cardio com GPS gravado
  const gpsCardioSet = $derived.by(() => {
    if (!session) return null;
    for (const pe of session.performedExercises) {
      for (const s of pe.sets) {
        if (s.gpsTrack && s.gpsTrack.length > 5 && s.distanceM && s.distanceM > 100) {
          return { set: s, exerciseName: pe.exerciseName };
        }
      }
    }
    return null;
  });

  function shareRun() {
    if (!session || !profile || !gpsCardioSet) return;
    shareData = {
      template: 'run',
      distanceM: gpsCardioSet.set.distanceM ?? 0,
      paceSecPerKm: gpsCardioSet.set.paceSecPerKm ?? 0,
      durationSec: gpsCardioSet.set.durationSec ?? 0,
      calories: session.calories,
      date: session.date,
      userName: profile.name,
      avatar: profile.avatar,
      track: gpsCardioSet.set.gpsTrack!.map((p) => ({ lat: p.lat, lng: p.lng }))
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

  function sharePR() {
    if (!session || !profile || !session.prsEarned?.length) return;
    const firstPRExerciseId = session.prsEarned[0];
    const pe = session.performedExercises.find((e) => e.exerciseId === firstPRExerciseId);
    if (!pe) return;
    const topSet = pe.sets
      .filter((s) => s.completed && s.weight && s.reps)
      .reduce((best, cur) => {
        const cs = (cur.weight ?? 0) * (cur.reps ?? 0);
        const bs = (best.weight ?? 0) * (best.reps ?? 0);
        return cs > bs ? cur : best;
      }, pe.sets[0]);

    shareData = {
      template: 'pr',
      exerciseName: pe.exerciseName,
      weight: topSet.weight ?? 0,
      reps: topSet.reps ?? 0,
      prevBest: null,
      userName: profile.name,
      avatar: profile.avatar,
      date: session.date
    };
  }
</script>

<div class="wrap" class:show>
  <div class="emoji">{prs > 0 ? '🏆' : '🎉'}</div>
  <h1>Treino concluído!</h1>

  {#if prs > 0}
    <div class="pr-badge">
      <span class="mi">military_tech</span>
      <span>{prs} {prs === 1 ? 'novo recorde' : 'novos recordes'} pessoal{prs > 1 ? 'is' : ''}!</span>
    </div>
    <p class="tagline">Sua fibra subiu de nível. 🔥</p>
  {:else}
    <p class="tagline">Cada fibra conta. Continua assim.</p>
  {/if}

  {#if session && profile}
    <div class="share-stack">
      {#if gpsCardioSet}
        <button class="share-row run" onclick={shareRun}>
          <div class="sr-ic">🗺️</div>
          <div class="sr-body">
            <div class="sr-t">Compartilhar a corrida</div>
            <div class="sr-s">Mapa do percurso + km + pace + tempo</div>
          </div>
          <span class="mi">ios_share</span>
        </button>
      {/if}
      {#if prs > 0}
        <button class="share-row pr" onclick={sharePR}>
          <div class="sr-ic">🏆</div>
          <div class="sr-body">
            <div class="sr-t">Compartilhar o recorde</div>
            <div class="sr-s">Card dedicado pro seu novo recorde</div>
          </div>
          <span class="mi">ios_share</span>
        </button>
      {/if}
      <button class="share-row" onclick={shareSession}>
        <div class="sr-ic">📊</div>
        <div class="sr-body">
          <div class="sr-t">Compartilhar o treino</div>
          <div class="sr-s">Stats + volume + duração</div>
        </div>
        <span class="mi">ios_share</span>
      </button>
    </div>
  {/if}

  <div class="btns">
    <Button variant="ghost" onclick={() => goto('/progresso')}>Ver progresso</Button>
    <Button icon="home" full onclick={() => goto('/home')}>Voltar pra home</Button>
  </div>
</div>

{#if shareData}
  <ShareSheet data={shareData} onClose={() => (shareData = null)} />
{/if}

<style>
  .wrap {
    min-height: 70dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    opacity: 0;
    transform: translateY(20px);
    transition: all 500ms var(--ease-spring);
    padding-top: var(--s-6);
  }
  .wrap.show { opacity: 1; transform: translateY(0); }

  .emoji {
    font-size: 88px;
    animation: pop 600ms var(--ease-spring);
    margin-bottom: var(--s-3);
  }
  @keyframes pop {
    0%   { transform: scale(0); }
    60%  { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  h1 {
    font-size: var(--fs-3xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .pr-badge {
    margin-top: var(--s-3);
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: 10px 18px;
    border-radius: var(--r-full);
    background: var(--grad-fire);
    color: #fff;
    font-weight: 700;
    box-shadow: 0 8px 24px color-mix(in srgb, #ee0979 40%, transparent);
  }

  .tagline {
    color: var(--text-mute);
    margin: var(--s-2) 0 var(--s-5);
    font-style: italic;
  }

  .share-stack {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    width: 100%;
    max-width: 480px;
    margin-bottom: var(--s-4);
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
  .share-row:hover {
    border-color: var(--accent);
    background: var(--bg-3);
  }
  .share-row.pr {
    border-color: var(--warn);
    background: color-mix(in srgb, var(--warn) 8%, var(--bg-2));
  }
  .share-row.run {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-2));
  }
  .sr-ic { font-size: 28px; }
  .sr-body { flex: 1; }
  .sr-t { font-weight: 700; }
  .sr-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .share-row .mi { color: var(--text-mute); }

  .btns {
    display: flex;
    gap: var(--s-2);
    width: 100%;
    max-width: 480px;
  }
</style>
