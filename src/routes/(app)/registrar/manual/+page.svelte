<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { listWorkouts, getWorkout } from '$lib/db/workouts';
  import { getProfile } from '$lib/db/profile';
  import { saveSession, newSessionId } from '$lib/db/sessions';
  import { syncRanking } from '$lib/db/rankings';
  import type {
    Workout, Session, PerformedExercise, PerformedSet, ExerciseSet
  } from '$lib/types';
  import { todayISO, CATEGORY_ICON, CATEGORY_LABEL } from '$lib/utils/format';
  import { isCardio, isDurationBased, fmtPace, parsePace } from '$lib/utils/exercise';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';

  // Estado: 'pick' (escolhe template) ou 'form' (preenche)
  let workouts = $state<Workout[]>([]);
  let selectedWorkout = $state<Workout | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  // Form fields
  let date = $state(todayISO()); // YYYY-MM-DD
  let calories = $state<string>('');
  let mood = $state<1|2|3|4|5>(4);
  let notes = $state('');
  let performed = $state<PerformedExercise[]>([]);

  onMount(async () => {
    if (!authStore.uid) return;
    try {
      await catalogStore.ensure();
      const wid = page.url.searchParams.get('wid');
      const ws = await listWorkouts(authStore.uid);
      workouts = ws;
      if (wid) {
        const w = ws.find((x) => x.id === wid) || await getWorkout(authStore.uid, wid);
        if (w) selectWorkout(w);
      }
    } finally {
      loading = false;
    }
  });

  function selectWorkout(w: Workout) {
    selectedWorkout = w;
    // Pre-popula performed com sets vazios pra preencher
    performed = w.exercises.map((we, idx) => {
      const meta = catalogStore.byId(we.exerciseId);
      return {
        exerciseId: we.exerciseId,
        exerciseName: meta?.name ?? '?',
        order: idx,
        sets: we.sets.map((s) => ({
          ...s,
          completed: true // em modo manual, todas marcadas como feitas
        } as PerformedSet))
      };
    });
  }

  function updateSet(exIdx: number, sIdx: number, patch: Partial<PerformedSet>) {
    performed[exIdx].sets[sIdx] = { ...performed[exIdx].sets[sIdx], ...patch };
  }

  // Total de volume
  const totalVolume = $derived.by(() => {
    return performed.reduce((acc, pe) => acc + pe.sets.reduce(
      (s, st) => s + (st.completed ? (st.weight ?? 0) * (st.reps ?? 0) : 0), 0
    ), 0);
  });

  async function save() {
    if (!authStore.uid || !selectedWorkout) return;
    saving = true;
    saveError = null;
    try {
      const ts = new Date(date + 'T12:00:00').getTime();
      const session: Session = {
        id: newSessionId(),
        date,
        startedAt: ts,
        finishedAt: ts, // manual: zerado proposital
        workoutId: selectedWorkout.id,
        workoutName: selectedWorkout.name,
        workoutCategory: selectedWorkout.category,
        performedExercises: performed,
        totalVolume,
        calories: calories ? Number(calories) : undefined,
        mood,
        notes: notes.trim() || undefined,
        recording: 'manual', // marca como nao-cronometrada
        createdAt: Date.now()
      };
      await saveSession(authStore.uid, session);
      // Re-sync ranking respeitando publicProfile
      try {
        const profile = await getProfile(authStore.uid);
        if (profile?.settings?.publicProfile) {
          await syncRanking(authStore.uid, profile, {
            displayName: profile.name || authStore.user?.displayName || 'Atleta',
            avatar: authStore.user?.photoURL || profile.avatar,
            force: true
          });
        }
      } catch (e) {
        console.warn('Falha ressync ranking:', e);
      }
      goto(`/sessao/${session.id}`);
    } catch (e) {
      saveError = (e as Error).message;
    } finally {
      saving = false;
    }
  }

  function back() {
    if (selectedWorkout) {
      selectedWorkout = null;
      performed = [];
    } else if (history.length > 1) history.back();
    else goto('/registrar');
  }

  const canSave = $derived(!!selectedWorkout && performed.length > 0 && !!date);
</script>

<svelte:head>
  <title>Registrar treino antigo · FIBRA</title>
</svelte:head>

<div class="page">
  <header class="top-bar">
    <button class="icon-btn" onclick={back} aria-label="Voltar">
      <span class="mi">arrow_back</span>
    </button>
    <h1 class="title">Registrar treino antigo</h1>
    <div style="width: 32px"></div>
  </header>

  {#if loading}
    <div class="loading"><span class="mi spin">progress_activity</span></div>
  {:else if !selectedWorkout}
    <!-- Estado 1: escolher template -->
    <Card>
      <div class="intro">
        <span class="mi">history_edu</span>
        <div>
          <div class="intro-t">Treino feito mas não cronometrou?</div>
          <div class="intro-s">Escolha o template e preencha pesos/reps. O treino conta no seu histórico, mas <strong>não suja sua média de tempo</strong> (registros manuais ficam de fora desse agregado).</div>
        </div>
      </div>
    </Card>

    {#if workouts.length === 0}
      <Card>
        <div class="empty">
          <span class="mi">folder_off</span>
          <p>Você ainda não tem treinos salvos. Crie um em <strong>Treinos</strong> primeiro.</p>
          <Button onclick={() => goto('/treinos/novo')}>Criar treino</Button>
        </div>
      </Card>
    {:else}
      <div class="sec-title">Escolha o treino</div>
      <div class="wk-list">
        {#each workouts as w (w.id)}
          <Card onclick={() => selectWorkout(w)}>
            <div class="wk">
              <Badge category={w.category}>{CATEGORY_ICON[w.category]} {CATEGORY_LABEL[w.category]}</Badge>
              <div class="wk-body">
                <div class="wk-name">{w.name}</div>
                <div class="wk-meta">
                  <span>{w.exercises.length} ex</span>
                  <span class="dot">·</span>
                  <span>{w.exercises.reduce((a, e) => a + e.sets.length, 0)} séries</span>
                </div>
              </div>
              <span class="mi chev">chevron_right</span>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Estado 2: form de registro -->
    <Card>
      <div class="picked">
        <Badge category={selectedWorkout.category}>{CATEGORY_ICON[selectedWorkout.category]} {CATEGORY_LABEL[selectedWorkout.category]}</Badge>
        <div class="picked-name">{selectedWorkout.name}</div>
        <button class="picked-change" onclick={() => { selectedWorkout = null; performed = []; }}>Trocar</button>
      </div>
    </Card>

    <Card>
      <label class="field">
        <span class="field-lbl">Data do treino</span>
        <input type="date" bind:value={date} max={todayISO()} class="dt-inp" />
      </label>
    </Card>

    <div class="sec-title">Exercícios</div>
    {#each performed as pe, exIdx (exIdx)}
      {@const meta = catalogStore.byId(pe.exerciseId)}
      <Card>
        <div class="ex-row">
          {#if meta?.gifUrl}
            <img class="ex-thumb" src={meta.gifUrl} alt={pe.exerciseName} loading="lazy" />
          {/if}
          <div class="ex-body">
            <div class="ex-name">{pe.exerciseName}</div>
            <div class="ex-mu">
              {meta && (Array.isArray(meta.muscleGroup) ? meta.muscleGroup.join(' · ') : meta.muscleGroup)}
            </div>
          </div>
        </div>

        {@const cardio = meta && isCardio(meta)}
        {@const dur = meta && isDurationBased(meta)}
        <div class="sets">
          {#if cardio}
            <div class="set-head"><span>Série</span><span>Distância</span><span>Pace</span></div>
          {:else if dur}
            <div class="set-head"><span>Série</span><span>Duração</span></div>
          {:else}
            <div class="set-head"><span>Série</span><span>Reps</span><span>Carga</span></div>
          {/if}
          {#each pe.sets as set, sIdx (sIdx)}
            <div class="set-row">
              <span class="set-num mono">{sIdx + 1}</span>
              {#if cardio}
                <input
                  type="number" step="0.1" min="0" placeholder="km"
                  value={set.distanceM ? (set.distanceM / 1000).toString() : ''}
                  oninput={(e) => updateSet(exIdx, sIdx, { distanceM: Number(e.currentTarget.value) > 0 ? Math.round(Number(e.currentTarget.value) * 1000) : undefined })}
                />
                <input
                  type="text" inputmode="numeric" placeholder="5:30"
                  value={fmtPace(set.paceSecPerKm)}
                  oninput={(e) => updateSet(exIdx, sIdx, { paceSecPerKm: parsePace(e.currentTarget.value) })}
                />
              {:else if dur}
                <input
                  type="number" min="0" step="5" placeholder="seg"
                  value={set.durationSec ?? ''}
                  oninput={(e) => updateSet(exIdx, sIdx, { durationSec: Number(e.currentTarget.value) || undefined })}
                />
              {:else}
                <input
                  type="number" min="0" placeholder="reps"
                  value={set.reps ?? ''}
                  oninput={(e) => updateSet(exIdx, sIdx, { reps: Number(e.currentTarget.value) || undefined })}
                />
                <input
                  type="number" min="0" step="0.5" placeholder="kg"
                  value={set.weight ?? ''}
                  oninput={(e) => updateSet(exIdx, sIdx, { weight: Number(e.currentTarget.value) || undefined })}
                />
              {/if}
            </div>
          {/each}
        </div>
      </Card>
    {/each}

    <div class="sec-title">Detalhes (opcional)</div>
    <Card>
      <label class="field">
        <span class="field-lbl">Calorias gastas (kcal)</span>
        <input type="number" bind:value={calories} placeholder="—" min="0" class="num-inp" />
      </label>

      <label class="field">
        <span class="field-lbl">Como foi?</span>
        <div class="mood-row">
          {#each [1, 2, 3, 4, 5] as v (v)}
            <button class="mood" class:on={mood === v} onclick={() => (mood = v as 1|2|3|4|5)}>
              {['😩', '😟', '😐', '🙂', '🤩'][v - 1]}
            </button>
          {/each}
        </div>
      </label>

      <label class="field">
        <span class="field-lbl">Notas</span>
        <textarea bind:value={notes} rows="3" placeholder="Como se sentiu, observações…"></textarea>
      </label>
    </Card>

    {#if totalVolume > 0}
      <Card>
        <div class="vol-summary">
          <span class="vol-lbl">Volume total</span>
          <span class="vol-v mono">{Math.round(totalVolume)}<span>kg</span></span>
        </div>
      </Card>
    {/if}

    {#if saveError}
      <Card>
        <div class="error">
          <span class="mi">error</span>
          <span>{saveError}</span>
        </div>
      </Card>
    {/if}

    <div class="footer">
      <Button variant="ghost" onclick={() => { selectedWorkout = null; performed = []; }}>Voltar</Button>
      <Button icon="save" variant="success" full loading={saving} disabled={!canSave} onclick={save}>
        Registrar treino
      </Button>
    </div>
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
  .loading { padding: var(--s-8); text-align: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .intro { display: flex; gap: var(--s-3); align-items: flex-start; }
  .intro .mi {
    font-size: 32px;
    color: var(--accent);
    flex-shrink: 0;
  }
  .intro-t { font-weight: 700; font-size: var(--fs-md); margin-bottom: 4px; }
  .intro-s { font-size: var(--fs-xs); color: var(--text-mute); line-height: 1.5; }

  .sec-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--s-3) 0 0;
  }

  .wk-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .wk { display: flex; align-items: center; gap: var(--s-3); }
  .wk-body { flex: 1; min-width: 0; }
  .wk-name { font-weight: 700; font-size: var(--fs-sm); }
  .wk-meta { font-size: var(--fs-xs); color: var(--text-mute); display: flex; gap: 6px; margin-top: 2px; }
  .wk-meta .dot { color: var(--text-dim); }
  .chev { color: var(--text-dim); font-size: 20px; }

  .empty { text-align: center; padding: var(--s-5); color: var(--text-mute); }
  .empty .mi { font-size: 40px; color: var(--text-dim); display: block; margin-bottom: 8px; }
  .empty p { margin-bottom: var(--s-3); font-size: var(--fs-sm); }

  .picked { display: flex; align-items: center; gap: var(--s-2); }
  .picked-name { flex: 1; font-weight: 700; font-size: var(--fs-md); }
  .picked-change {
    background: var(--bg-3);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    padding: 4px 12px;
    font-size: var(--fs-xs);
    font-weight: 600;
  }

  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--s-3); }
  .field:last-child { margin-bottom: 0; }
  .field-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .dt-inp, .num-inp, .field textarea {
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
    font-family: inherit;
    color-scheme: dark;
  }
  .field textarea { resize: vertical; min-height: 60px; }
  .dt-inp:focus, .num-inp:focus, .field textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .ex-row { display: flex; gap: var(--s-2); margin-bottom: var(--s-3); }
  .ex-thumb { width: 44px; height: 44px; border-radius: var(--r-md); object-fit: cover; flex-shrink: 0; }
  .ex-body { flex: 1; min-width: 0; }
  .ex-name { font-weight: 700; font-size: var(--fs-sm); }
  .ex-mu { font-size: var(--fs-xs); color: var(--text-mute); text-transform: capitalize; }

  .sets { display: flex; flex-direction: column; gap: 4px; }
  .set-head, .set-row {
    display: grid;
    grid-template-columns: 32px 1fr 1fr;
    gap: 6px;
    align-items: center;
  }
  .set-head {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 4px;
  }
  .set-num { color: var(--text-mute); font-weight: 700; text-align: center; }
  .set-row input {
    padding: var(--s-1) var(--s-2);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--text);
    font-size: var(--fs-sm);
    font-family: var(--font-mono);
    text-align: center;
  }
  .set-row input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-glow);
  }

  .mood-row { display: flex; gap: 4px; }
  .mood {
    flex: 1;
    padding: 8px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    font-size: 22px;
    line-height: 1;
    transition: all var(--dur-fast);
  }
  .mood.on { background: var(--accent-glow); border-color: var(--accent); }

  .vol-summary { display: flex; align-items: center; justify-content: space-between; }
  .vol-lbl { font-size: var(--fs-sm); color: var(--text-mute); font-weight: 600; }
  .vol-v { font-size: var(--fs-2xl); font-weight: 800; color: var(--accent); }
  .vol-v span { font-size: var(--fs-xs); color: var(--text-mute); margin-left: 4px; }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--danger);
    font-size: var(--fs-sm);
  }

  .footer {
    position: sticky;
    bottom: calc(var(--nav-h) + var(--safe-bottom));
    display: flex;
    gap: var(--s-2);
    padding: var(--s-3) 0;
    background: linear-gradient(to top, var(--bg-1) 60%, transparent);
    margin-top: var(--s-3);
  }
</style>
