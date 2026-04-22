<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { saveSession, newSessionId, getSession } from '$lib/db/sessions';
  import type { Session } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';

  let status = $state<'idle' | 'seeding' | 'done' | 'error'>('idle');
  let newSessionId_ = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);
  let verifyResult = $state<string | null>(null);
  let savedTrackLength = $state<number | null>(null);

  async function seed() {
    if (!authStore.uid) return;
    status = 'seeding';
    errorMsg = null;
    try {
      // 100 pontos GPS fake circulando o Parque Villa Lobos (SP)
      const track: { lat: number; lng: number; t: number }[] = [];
      const startLat = -23.5441;
      const startLng = -46.7319;
      const startTime = Date.now() - 30 * 60 * 1000; // 30min atrás
      for (let i = 0; i < 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        track.push({
          lat: startLat + Math.sin(angle) * 0.006 + (Math.random() - 0.5) * 0.0003,
          lng: startLng + Math.cos(angle) * 0.01 + (Math.random() - 0.5) * 0.0003,
          t: startTime + i * 18_000 // espacados ~18s
        });
      }

      const id = newSessionId();
      const now = Date.now();
      const session: Session = {
        id,
        date: new Date().toISOString().slice(0, 10),
        startedAt: startTime,
        finishedAt: now,
        workoutName: 'Corrida teste (seed)',
        workoutCategory: 'cardio',
        totalVolume: 0,
        calories: 387,
        createdAt: now,
        performedExercises: [{
          exerciseId: 'corrida',
          exerciseName: 'Corrida',
          order: 0,
          sets: [{
            distanceM: 5234,
            paceSecPerKm: 345,
            durationSec: 1805,
            gpsTrack: track,
            completed: true
          }]
        }]
      };

      await saveSession(authStore.uid, session);
      newSessionId_ = id;

      // VERIFICA: re-fetch e conta os pontos salvos
      const savedBack = await getSession(authStore.uid, id);
      const firstSet = savedBack?.performedExercises?.[0]?.sets?.[0];
      savedTrackLength = firstSet?.gpsTrack?.length ?? 0;
      if (savedTrackLength === 100) {
        verifyResult = `✅ Persistência OK — ${savedTrackLength} pontos salvos no Firestore.`;
      } else if (savedTrackLength === 0) {
        verifyResult = `❌ Track NÃO persistiu. Firestore aceitou doc mas sem gpsTrack. Bug no cleanUndefined ou rule.`;
      } else {
        verifyResult = `⚠ Parcial: salvou ${savedTrackLength} de 100 pontos.`;
      }

      status = 'done';
    } catch (e) {
      errorMsg = (e as Error).message;
      status = 'error';
    }
  }
</script>

<Card>
  <h2 style="font-size:var(--fs-xl); font-weight:800; margin-bottom:8px;">🧪 Seed de corrida teste</h2>
  <p style="color:var(--text-mute); font-size:var(--fs-sm); line-height:1.5; margin-bottom:var(--s-3);">
    Cria uma sessão fake <strong>5.23km</strong> no Parque Villa Lobos (SP) com <strong>100 pontos GPS</strong>
    gravados. Depois abre a tela da sessão pra você testar o compartilhamento com o mapa.
  </p>

  {#if status === 'idle'}
    <Button icon="science" full onclick={seed}>Criar sessão teste</Button>
  {:else if status === 'seeding'}
    <div style="display:flex;gap:8px;align-items:center;color:var(--text-mute);">
      <span class="mi spin">progress_activity</span>
      <span>Criando...</span>
    </div>
  {:else if status === 'done' && newSessionId_}
    <div style="padding:var(--s-3); background:color-mix(in srgb, var(--success) 12%, transparent); border:1px solid var(--success); border-radius:var(--r-md); color:var(--success); margin-bottom:var(--s-2);">
      ✔ Sessão criada. ID: <code>{newSessionId_}</code>
    </div>
    {#if verifyResult}
      <div style="padding:var(--s-3); background:var(--bg-3); border:1px solid var(--border); border-radius:var(--r-md); margin-bottom:var(--s-3); font-size:var(--fs-sm); line-height:1.5;">
        {verifyResult}
      </div>
    {/if}
    <Button icon="visibility" full onclick={() => goto(`/sessao/${newSessionId_}`)}>
      Abrir sessão e testar compartilhamento
    </Button>
    <div class="spacer-sm" style="height:8px"></div>
    <Button variant="ghost" full onclick={() => { status = 'idle'; newSessionId_ = null; verifyResult = null; savedTrackLength = null; }}>
      Criar outra
    </Button>
  {:else if status === 'error'}
    <div style="padding:var(--s-3); background:color-mix(in srgb, var(--danger) 12%, transparent); border:1px solid var(--danger); border-radius:var(--r-md); color:var(--danger); margin-bottom:var(--s-3);">
      Erro: {errorMsg}
    </div>
    <Button variant="ghost" onclick={() => { status = 'idle'; errorMsg = null; }}>Tentar de novo</Button>
  {/if}
</Card>

<style>
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  code { background: var(--bg-3); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
</style>
