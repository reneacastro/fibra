<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { getWorkout } from '$lib/db/workouts';
  import { saveSession, newSessionId } from '$lib/db/sessions';
  import type {
    Workout, Session, PerformedExercise, PerformedSet,
    WorkoutCategory as WCat, WorkoutExercise
  } from '$lib/types';
  import {
    CATEGORY_ICON, CATEGORY_LABEL, todayISO, fmtDuration
  } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Input from '$lib/components/Input.svelte';
  import RestTimer from '$lib/components/RestTimer.svelte';
  import ExerciseHistoryCompact from '$lib/components/ExerciseHistoryCompact.svelte';
  import ExerciseDetailSheet from '$lib/components/ExerciseDetailSheet.svelte';
  import CrossfitTimer from '$lib/components/CrossfitTimer.svelte';
  import GpsTracker from '$lib/components/GpsTracker.svelte';
  import { isDurationBased, isCardio, fmtSec, fmtPace, parsePace } from '$lib/utils/exercise';
  import { suggestNextLoad } from '$lib/db/gemini';
  import { historyForExercise } from '$lib/db/sessions';
  import { getProfile } from '$lib/db/profile';
  import { saveWorkout, newWorkoutId } from '$lib/db/workouts';

  // AI suggest load state
  let suggestingFor = $state<string | null>(null);
  let suggestions = $state<Record<string, { weight: number; reps: number; reason: string }>>({});
  let userGoal = $state<'strength' | 'hypertrophy' | 'endurance'>('hypertrophy');

  async function suggestLoad(exerciseId: string, exerciseName: string) {
    if (!authStore.uid) return;
    suggestingFor = exerciseId;
    try {
      const entries = await historyForExercise(authStore.uid, exerciseId, 5);
      if (entries.length === 0) {
        suggestions[exerciseId] = { weight: 0, reps: 10, reason: 'Sem histórico — comece leve pra testar' };
        return;
      }
      const r = await suggestNextLoad({
        exerciseName,
        lastSessions: entries.map((e) => ({
          date: e.date,
          topSet: e.topSet,
          estimated1RM: e.estimated1RM
        })),
        goal: userGoal
      });
      suggestions[exerciseId] = { weight: r.suggestedWeight, reps: r.suggestedReps, reason: r.reasoning };
    } catch (e) {
      suggestions[exerciseId] = { weight: 0, reps: 0, reason: 'Falha: ' + (e as Error).message };
    } finally {
      suggestingFor = null;
    }
  }

  function applySuggestion(exIdx: number, exerciseId: string) {
    const sug = suggestions[exerciseId];
    if (!sug) return;
    const next = [...performed];
    next[exIdx].sets = next[exIdx].sets.map((s) =>
      s.completed ? s : { ...s, weight: sug.weight, reps: sug.reps }
    );
    performed = next;
  }

  let wodResult = $state<{ elapsedSec: number; rounds?: number } | null>(null);

  let detailExId = $state<string | null>(null);

  let workout = $state<Workout | null>(null);
  let loading = $state(true);
  let saving = $state(false);

  const startedAt = Date.now();
  let elapsed = $state(0);
  let elapsedInterval: ReturnType<typeof setInterval>;

  // Estado do treino em andamento
  let performed = $state<PerformedExercise[]>([]);
  let activeExIdx = $state(0);

  // Timer de descanso (após completar uma série)
  let restingFor = $state<{ exIdx: number; setIdx: number } | null>(null);

  // Finalização
  let showFinish = $state(false);
  let finalCalories = $state<string>('');
  let userBodyWeight = $state<number>(70);
  let finalWeight = $state<string>('');
  let finalMood = $state<1|2|3|4|5>(4);
  let finalNotes = $state('');
  let saveAsTemplate = $state(false);
  let templateName = $state('');
  let templateCategory = $state<WCat>('superior');

  onMount(() => {
    // Interval sempre roda — registra cleanup síncrono
    elapsedInterval = setInterval(() => { elapsed = Date.now() - startedAt; }, 1000);

    // Carregamento async em paralelo
    (async () => {
      await catalogStore.ensure();
      if (!authStore.uid) return;

      const p = await getProfile(authStore.uid);
      if (p?.weight) userBodyWeight = p.weight;
      if (p?.goals.includes('massa')) userGoal = 'hypertrophy';
      else if (p?.goals.includes('performance')) userGoal = 'strength';
      else if (p?.goals.includes('emagrecer') || p?.goals.includes('qualidade')) userGoal = 'endurance';

      const id = page.params.id;
      if (!id) { goto('/registrar'); return; }

      if (id !== 'livre') {
        const w = await getWorkout(authStore.uid, id);
        if (!w) { goto('/registrar'); return; }
        workout = w;
        performed = w.exercises.map((we, idx) => ({
          exerciseId: we.exerciseId,
          exerciseName: catalogStore.byId(we.exerciseId)?.name ?? '',
          order: idx,
          sets: we.sets.map((s) => ({
            reps: s.reps,
            weight: s.weight,
            durationSec: s.durationSec,
            completed: false
          })),
          skipped: false
        }));
      } else {
        workout = {
          id: 'livre',
          name: 'Treino Livre',
          category: 'livre',
          exercises: [],
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        performed = [];
      }
      loading = false;
    })();

    return () => clearInterval(elapsedInterval);
  });

  function toggleSet(exIdx: number, setIdx: number) {
    const next = [...performed];
    const set = next[exIdx].sets[setIdx];
    set.completed = !set.completed;
    performed = next;

    if (set.completed && workout?.exercises[exIdx]?.restSeconds) {
      restingFor = { exIdx, setIdx };
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  function updateSetValue(exIdx: number, setIdx: number, field: 'reps'|'weight'|'durationSec'|'distanceM'|'paceSecPerKm', value: string) {
    const next = [...performed];
    next[exIdx].sets[setIdx][field] = Number(value) || undefined;
    performed = next;
  }

  function updateSetPace(exIdx: number, setIdx: number, value: string) {
    const next = [...performed];
    next[exIdx].sets[setIdx].paceSecPerKm = parsePace(value);
    performed = next;
  }

  function updateSetKm(exIdx: number, setIdx: number, value: string) {
    const next = [...performed];
    const km = Number(value);
    next[exIdx].sets[setIdx].distanceM = km > 0 ? Math.round(km * 1000) : undefined;
    performed = next;
  }

  let gpsTarget = $state<{ exIdx: number; sIdx: number } | null>(null);
  function applyGps(result: {
    distanceM: number;
    paceSecPerKm: number;
    durationSec: number;
    track: { lat: number; lng: number; t: number }[];
  }) {
    if (!gpsTarget) return;
    const { exIdx, sIdx } = gpsTarget;
    const next = [...performed];
    next[exIdx].sets[sIdx] = {
      ...next[exIdx].sets[sIdx],
      distanceM: result.distanceM,
      paceSecPerKm: result.paceSecPerKm,
      durationSec: result.durationSec,
      gpsTrack: result.track.length > 1 ? result.track : undefined,
      completed: true
    };
    performed = next;
    gpsTarget = null;
  }

  function skipExercise(exIdx: number) {
    const next = [...performed];
    next[exIdx].skipped = !next[exIdx].skipped;
    performed = next;
  }

  // Progresso
  const totalSets = $derived(performed.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0));
  const doneSets = $derived(performed.reduce(
    (a, e) => a + (e.skipped ? 0 : e.sets.filter((s) => s.completed).length), 0
  ));
  const progressPct = $derived(totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100));

  const totalVolume = $derived(performed.reduce(
    (acc, e) => acc + e.sets.reduce(
      (s, st) => s + (st.completed ? (st.weight ?? 0) * (st.reps ?? 0) : 0), 0
    ), 0
  ));

  // Estimativa de calorias no estilo Apple Health: MET × peso(kg) × horas.
  // Pra cada exercício com séries concluídas, usa seu MET próprio.
  // Sem HR: é uma estimativa; Apple Watch só é melhor porque mede BPM real.
  const suggestedCalories = $derived.by(() => {
    const weight = Number(finalWeight) || userBodyWeight || 70;
    const totalMinutes = Math.max(1, elapsed / 60000);
    const activeExercises = performed.filter((pe) => !pe.skipped && pe.sets.some((s) => s.completed));
    if (activeExercises.length === 0) return 0;
    // MET médio ponderado pelo número de séries feitas
    let totalSets = 0;
    let metSum = 0;
    for (const pe of activeExercises) {
      const ex = catalogStore.byId(pe.exerciseId);
      const met = ex?.mets ?? 4;
      const done = pe.sets.filter((s) => s.completed).length;
      metSum += met * done;
      totalSets += done;
    }
    const avgMet = totalSets > 0 ? metSum / totalSets : 4;
    return Math.round((avgMet * weight * totalMinutes) / 60);
  });

  // Pré-preenche kcal ao abrir "Finalizar" se o usuário ainda não digitou nada
  $effect(() => {
    if (showFinish && !finalCalories && suggestedCalories > 0) {
      finalCalories = String(suggestedCalories);
    }
  });

  async function finish() {
    if (!authStore.uid || !workout) return;
    saving = true;
    try {
      const duration = Date.now() - startedAt;
      const session: Session = {
        id: newSessionId(),
        date: todayISO(),
        startedAt,
        finishedAt: Date.now(),
        workoutId: workout.id === 'livre' ? undefined : workout.id,
        workoutName: workout.name,
        workoutCategory: workout.category,
        performedExercises: performed,
        totalVolume,
        calories: finalCalories ? Number(finalCalories) : undefined,
        bodyWeight: finalWeight ? Number(finalWeight) : undefined,
        mood: finalMood,
        notes: finalNotes
          ? (wodResult ? `${finalNotes}\n\nWOD: ${wodResult.rounds ?? ''} rounds em ${Math.floor(wodResult.elapsedSec / 60)}:${String(wodResult.elapsedSec % 60).padStart(2, '0')}` : finalNotes)
          : (wodResult ? `WOD: ${wodResult.rounds ?? ''} rounds em ${Math.floor(wodResult.elapsedSec / 60)}:${String(wodResult.elapsedSec % 60).padStart(2, '0')}` : undefined),
        createdAt: Date.now()
      };
      const { prsEarned } = await saveSession(authStore.uid, session);

      // Salvar como template se solicitado (só em treino livre ou "novo")
      if (saveAsTemplate && templateName.trim() && workout.id === 'livre' && performed.length > 0) {
        const workoutExercises: WorkoutExercise[] = performed
          .filter((pe) => !pe.skipped)
          .map((pe, idx) => ({
            exerciseId: pe.exerciseId,
            order: idx,
            sets: pe.sets
              .filter((s) => s.completed)
              .map((s) => ({
                type: 'normal' as const,
                reps: s.reps,
                weight: s.weight,
                durationSec: s.durationSec
              })),
            restSeconds: 60
          }));
        if (workoutExercises.length > 0) {
          const tmpl: Workout = {
            id: newWorkoutId(),
            name: templateName.trim(),
            category: templateCategory,
            exercises: workoutExercises,
            order: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await saveWorkout(authStore.uid, tmpl);
        }
      }

      if (prsEarned.length > 0 && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }

      // Redireciona pra tela de conclusão com os PRs
      const query = new URLSearchParams({
        id: session.id,
        prs: String(prsEarned.length)
      });
      goto(`/registrar/concluido?${query.toString()}`);
    } finally {
      saving = false;
    }
  }

  const MOODS = [
    { v: 1, e: '😵', l: 'Detonado' },
    { v: 2, e: '😓', l: 'Difícil' },
    { v: 3, e: '😐', l: 'Normal' },
    { v: 4, e: '💪', l: 'Bom' },
    { v: 5, e: '🔥', l: 'Na veia' }
  ] as const;
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if workout}
  <!-- Header da sessão -->
  <div class="sess-head">
    <Badge category={workout.category}>{CATEGORY_ICON[workout.category]} {CATEGORY_LABEL[workout.category]}</Badge>
    <h1>{workout.name}</h1>
    <div class="sess-meta">
      <span><span class="mi">schedule</span> {fmtDuration(elapsed)}</span>
      <span>·</span>
      <span class="mono">{doneSets}/{totalSets} séries</span>
      {#if totalVolume > 0}
        <span>·</span>
        <span class="mono">{Math.round(totalVolume)} kg</span>
      {/if}
    </div>
  </div>

  <!-- Progresso -->
  <div class="prog">
    <div class="prog-bar"><div class="prog-fill" style="width:{progressPct}%"></div></div>
    <div class="prog-txt mono">{progressPct}%</div>
  </div>

  <!-- WOD Timer (CrossFit) -->
  {#if workout.category === 'crossfit' && workout.crossfit}
    <div class="wod-wrap">
      <CrossfitTimer
        config={workout.crossfit}
        onFinish={(data) => { wodResult = data; }}
      />
    </div>
  {/if}

  <!-- Rest timer flutuante -->
  {#if restingFor !== null}
    {@const restSec = workout.exercises[restingFor.exIdx]?.restSeconds ?? 60}
    <div class="rest-wrap">
      <div class="rest-label">Descansando…</div>
      <RestTimer
        seconds={restSec}
        onDone={() => (restingFor = null)}
        onCancel={() => (restingFor = null)}
      />
    </div>
  {/if}

  <!-- Exercícios -->
  <div class="ex-stack">
    {#each performed as pe, idx (pe.exerciseId + idx)}
      {@const meta = catalogStore.byId(pe.exerciseId)}
      {@const workoutEx = workout.exercises[idx]}
      {#if meta && workoutEx}
        <Card accent={pe.skipped ? 'default' : (pe.sets.every((s) => s.completed) ? 'glow' : 'default')}>
          <div class="ex-head" class:dim={pe.skipped}>
            {#if meta.gifUrl}
              <img class="ex-gif" src={meta.gifUrl} alt={meta.name} loading="lazy" />
            {/if}
            <div class="ex-info">
              <div class="ex-name">{idx + 1}. {meta.name}</div>
              <div class="ex-muscle">
                {Array.isArray(meta.muscleGroup) ? meta.muscleGroup.join(' · ') : meta.muscleGroup}
              </div>
            </div>
            <button
              class="skip-btn"
              class:on={pe.skipped}
              onclick={() => skipExercise(idx)}
              aria-label={pe.skipped ? 'Retomar' : 'Pular exercício'}
            >
              <span class="mi">{pe.skipped ? 'replay' : 'skip_next'}</span>
            </button>
          </div>

          {#if !pe.skipped}
            <div class="pre-sets">
              <ExerciseHistoryCompact
                exerciseId={pe.exerciseId}
                onOpenDetail={() => (detailExId = pe.exerciseId)}
              />

              {#if !isDurationBased(meta) && !isCardio(meta)}
                {@const sug = suggestions[pe.exerciseId]}
                {#if sug}
                  <div class="sug-card">
                    <div class="sug-head">
                      <span class="mi">auto_awesome</span>
                      <span class="sug-label">Sugestão IA</span>
                      <span class="sug-val mono">{sug.weight}kg × {sug.reps}</span>
                    </div>
                    <div class="sug-reason">{sug.reason}</div>
                    <button class="sug-apply" onclick={() => applySuggestion(idx, pe.exerciseId)}>
                      <span class="mi">download</span> Aplicar nas séries
                    </button>
                  </div>
                {:else}
                  <button
                    class="sug-btn"
                    disabled={suggestingFor === pe.exerciseId}
                    onclick={() => suggestLoad(pe.exerciseId, meta.name)}
                  >
                    {#if suggestingFor === pe.exerciseId}
                      <span class="mi spin">progress_activity</span> Calculando…
                    {:else}
                      <span class="mi">auto_awesome</span> Sugerir carga com IA
                    {/if}
                  </button>
                {/if}
              {/if}
            </div>
            {@const duration = isDurationBased(meta)}
            {@const cardio = isCardio(meta)}
            <div class="sets-list">
              {#each pe.sets as set, sIdx (sIdx)}
                <div class="set-row" class:done={set.completed}>
                  <button class="set-check" class:on={set.completed} onclick={() => toggleSet(idx, sIdx)}>
                    {#if set.completed}<span class="mi">check</span>{:else}<span class="mono">{sIdx + 1}</span>{/if}
                  </button>
                  {#if cardio}
                    <div class="set-inputs">
                      <label class="inp-wrap">
                        <span>km</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputmode="decimal"
                          value={set.distanceM ? (set.distanceM / 1000).toString() : ''}
                          placeholder={workoutEx.sets[sIdx]?.distanceM ? (workoutEx.sets[sIdx].distanceM! / 1000).toString() : '5'}
                          oninput={(e) => updateSetKm(idx, sIdx, e.currentTarget.value)}
                        />
                      </label>
                      <label class="inp-wrap">
                        <span>pace</span>
                        <input
                          type="text"
                          inputmode="numeric"
                          value={fmtPace(set.paceSecPerKm)}
                          placeholder={fmtPace(workoutEx.sets[sIdx]?.paceSecPerKm) || '5:30'}
                          oninput={(e) => updateSetPace(idx, sIdx, e.currentTarget.value)}
                        />
                      </label>
                      <button
                        type="button"
                        class="gps-btn"
                        onclick={() => (gpsTarget = { exIdx: idx, sIdx })}
                        aria-label="Medir com GPS"
                      >
                        <span class="mi">my_location</span>
                        GPS
                      </button>
                    </div>
                    <div class="target mono">
                      {#if workoutEx.sets[sIdx]?.distanceM}
                        alvo: {(workoutEx.sets[sIdx].distanceM! / 1000).toFixed(1)}km{workoutEx.sets[sIdx]?.paceSecPerKm ? ` @ ${fmtPace(workoutEx.sets[sIdx].paceSecPerKm)}` : ''}
                      {:else}—{/if}
                    </div>
                  {:else if duration}
                    <div class="set-inputs">
                      <label class="inp-wrap">
                        <span>segundos</span>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={set.durationSec ?? workoutEx.sets[sIdx]?.durationSec ?? 30}
                          oninput={(e) => updateSetValue(idx, sIdx, 'durationSec', e.currentTarget.value)}
                        />
                      </label>
                    </div>
                    <div class="target mono">
                      alvo: {workoutEx.sets[sIdx]?.durationSec ? fmtSec(workoutEx.sets[sIdx].durationSec!) : '—'}
                    </div>
                  {:else}
                    <div class="set-inputs">
                      <label class="inp-wrap">
                        <span>reps</span>
                        <input
                          type="number"
                          min="0"
                          value={set.reps ?? ''}
                          oninput={(e) => updateSetValue(idx, sIdx, 'reps', e.currentTarget.value)}
                        />
                      </label>
                      <label class="inp-wrap">
                        <span>kg</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={set.weight ?? ''}
                          oninput={(e) => updateSetValue(idx, sIdx, 'weight', e.currentTarget.value)}
                        />
                      </label>
                    </div>
                    <div class="target mono">
                      alvo: {workoutEx.sets[sIdx]?.reps ?? '—'}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </Card>
      {/if}
    {/each}

    {#if performed.length === 0}
      <Card>
        <div class="empty">
          <div>🏃</div>
          <div class="empty-t">Treino livre</div>
          <div class="empty-s">Adicione dados de cardio abaixo, ou só marque como concluído.</div>
        </div>
      </Card>
    {/if}
  </div>

  <!-- Finalização -->
  {#if !showFinish}
    <Button
      size="lg"
      icon="check_circle"
      full
      onclick={() => (showFinish = true)}
    >
      Finalizar treino
    </Button>
  {:else}
    <Card title="Finalizar" icon="flag">
      <Input type="number" label="🔥 Calorias (kcal)" bind:value={finalCalories} placeholder={String(suggestedCalories || 0)} />
      {#if suggestedCalories > 0}
        <div class="kcal-hint">
          <span class="mi">bolt</span>
          <span>Estimado: <strong>{suggestedCalories} kcal</strong> (MET × peso × tempo). Edite se tiver dado real.</span>
        </div>
      {/if}
      <div class="spacer"></div>
      <Input type="number" label="⚖️ Peso corporal hoje (kg)" bind:value={finalWeight} placeholder="0" step="0.1" />
      <div class="spacer"></div>

      <label class="mood-lbl">Como foi o treino?</label>
      <div class="mood-row">
        {#each MOODS as m (m.v)}
          <button
            class="mood-btn"
            class:sel={finalMood === m.v}
            onclick={() => (finalMood = m.v)}
            title={m.l}
          >
            <span class="mood-e">{m.e}</span>
            <span class="mood-l">{m.l}</span>
          </button>
        {/each}
      </div>

      <div class="spacer"></div>
      <label class="notes-lbl">Notas (opcional)</label>
      <textarea
        bind:value={finalNotes}
        placeholder="Como se sentiu? Alguma observação?"
        rows="2"
      ></textarea>

      {#if workout.id === 'livre' && performed.length > 0}
        <div class="spacer"></div>
        <label class="tmpl-toggle">
          <input type="checkbox" bind:checked={saveAsTemplate} />
          <span>
            <span class="tmpl-t">💾 Salvar como treino fixo</span>
            <span class="tmpl-s">Cria um template pra reusar no futuro</span>
          </span>
        </label>

        {#if saveAsTemplate}
          <div class="spacer-sm"></div>
          <Input
            label="Nome do treino"
            bind:value={templateName}
            placeholder="Ex: Peito e tríceps terça"
          />
          <div class="spacer-sm"></div>
          <label class="mood-lbl">Categoria</label>
          <div class="tmpl-cats">
            {#each ['superior','inferior','fullbody','forca','pump','core','funcional','calistenia','crossfit','hiit','cardio','mobilidade','alongamento','livre'] as c (c)}
              <button
                class="tmpl-cat"
                class:on={templateCategory === c}
                onclick={() => (templateCategory = c as WCat)}
              >
                {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      <div class="spacer"></div>
      <div class="finish-btns">
        <Button variant="ghost" onclick={() => (showFinish = false)}>Voltar</Button>
        <Button variant="success" icon="check_circle" full loading={saving} onclick={finish}>
          Salvar e concluir
        </Button>
      </div>
    </Card>
  {/if}
{/if}

{#if detailExId}
  <ExerciseDetailSheet exerciseId={detailExId} onClose={() => (detailExId = null)} />
{/if}

{#if gpsTarget}
  <GpsTracker onComplete={applyGps} onClose={() => (gpsTarget = null)} />
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }

  .sess-head {
    text-align: center;
    margin-bottom: var(--s-3);
  }
  .sess-head h1 {
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-top: var(--s-2);
  }
  .sess-meta {
    display: flex;
    gap: 6px;
    justify-content: center;
    align-items: center;
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-top: var(--s-2);
  }
  .sess-meta .mi { font-size: 16px; vertical-align: middle; }

  .prog {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-bottom: var(--s-4);
  }
  .prog-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    overflow: hidden;
  }
  .prog-fill {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--r-full);
    box-shadow: var(--shadow-glow);
    transition: width var(--dur-slow) var(--ease-spring);
  }
  .prog-txt {
    font-weight: 700;
    color: var(--accent);
    font-size: var(--fs-sm);
    min-width: 42px;
    text-align: right;
  }

  .wod-wrap {
    margin-bottom: var(--s-4);
  }

  .rest-wrap {
    margin-bottom: var(--s-4);
  }
  .rest-label {
    text-align: center;
    font-size: var(--fs-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    margin-bottom: var(--s-2);
  }

  .ex-stack {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-bottom: var(--s-4);
  }

  .ex-head {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-bottom: var(--s-3);
    transition: opacity var(--dur-fast);
  }
  .ex-head.dim { opacity: 0.4; }
  .ex-gif {
    width: 56px;
    height: 56px;
    border-radius: var(--r-md);
    object-fit: cover;
    background: var(--bg-3);
  }
  .ex-info { flex: 1; min-width: 0; }
  .ex-name { font-weight: 700; font-size: var(--fs-md); }
  .ex-muscle { font-size: var(--fs-xs); color: var(--text-mute); text-transform: capitalize; margin-top: 2px; }

  .skip-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-3);
    color: var(--text-mute);
    display: grid;
    place-items: center;
  }
  .skip-btn.on { background: var(--warn); color: var(--bg-0); }
  .skip-btn .mi { font-size: 18px; }

  .pre-sets {
    margin-bottom: var(--s-2);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .sug-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: var(--r-full);
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    font-size: var(--fs-xs);
    font-weight: 700;
    width: 100%;
    transition: all var(--dur-fast);
  }
  .sug-btn:hover:not(:disabled) {
    background: var(--accent);
    color: var(--bg-0);
  }
  .sug-btn:disabled { opacity: 0.7; cursor: progress; }
  .sug-btn .mi { font-size: 16px; }
  .sug-btn .spin { animation: spin 1s linear infinite; }

  .sug-card {
    padding: var(--s-3);
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    border-radius: var(--r-md);
  }
  .sug-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .sug-head .mi { color: var(--accent); font-size: 16px; }
  .sug-label {
    font-size: 10px;
    font-weight: 800;
    color: var(--accent);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .sug-val {
    margin-left: auto;
    font-weight: 800;
    font-size: var(--fs-sm);
    color: var(--text);
  }
  .sug-reason {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    line-height: 1.4;
    margin-bottom: var(--s-2);
  }
  .sug-apply {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: var(--r-full);
    background: var(--accent);
    color: var(--bg-0);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  .sug-apply:hover { filter: brightness(1.1); }
  .sug-apply .mi { font-size: 14px; }

  .sets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .set-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: 8px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    transition: all var(--dur-fast);
  }
  .set-row.done {
    background: color-mix(in srgb, var(--success) 10%, var(--bg-1));
    border-color: color-mix(in srgb, var(--success) 40%, transparent);
  }

  .set-check {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-3);
    color: var(--text-mute);
    display: grid;
    place-items: center;
    font-weight: 800;
    flex-shrink: 0;
  }
  .set-check.on {
    background: var(--success);
    color: var(--bg-0);
  }
  .set-check .mi { font-size: 18px; font-variation-settings: 'FILL' 1, 'wght' 700; }

  .set-inputs {
    display: flex;
    gap: 6px;
    flex: 1;
  }
  .kcal-hint {
    margin-top: 6px;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-left: 3px solid var(--accent);
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
    font-size: 11px;
    color: var(--text-mute);
    line-height: 1.4;
  }
  .kcal-hint .mi { font-size: 14px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }
  .kcal-hint strong { color: var(--text); }

  .gps-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 10px;
    background: var(--grad-primary);
    color: var(--bg-0);
    border-radius: var(--r-md);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }
  .gps-btn .mi { font-size: 18px; }
  .gps-btn:active { transform: scale(0.95); }
  .inp-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }
  .inp-wrap input {
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: 700;
    color: var(--text);
    width: 100%;
  }
  .inp-wrap input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .target {
    font-size: var(--fs-xs);
    color: var(--text-dim);
    min-width: 56px;
    text-align: right;
  }

  .empty {
    text-align: center;
    padding: var(--s-5);
    color: var(--text-mute);
  }
  .empty > div:first-child { font-size: 40px; margin-bottom: var(--s-2); }
  .empty-t { font-weight: 700; font-size: var(--fs-md); color: var(--text); }
  .empty-s { font-size: var(--fs-sm); margin-top: 4px; }

  .spacer { height: var(--s-3); }

  .mood-lbl, .notes-lbl {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: block;
    margin-bottom: 6px;
  }
  .mood-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }
  .mood-btn {
    padding: 10px 6px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: all var(--dur-fast);
  }
  .mood-btn:hover { background: var(--bg-4); }
  .mood-btn.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
    transform: scale(1.05);
  }
  .mood-e { font-size: 22px; }
  .mood-l { font-size: 10px; color: var(--text-mute); }

  textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .finish-btns {
    display: flex;
    gap: var(--s-2);
  }

  .spacer-sm { height: var(--s-2); }

  .tmpl-toggle {
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    cursor: pointer;
  }
  .tmpl-toggle input { margin-top: 4px; accent-color: var(--accent); }
  .tmpl-t { display: block; font-weight: 700; font-size: var(--fs-sm); }
  .tmpl-s { display: block; color: var(--text-mute); font-size: var(--fs-xs); margin-top: 2px; }

  .tmpl-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .tmpl-cat {
    padding: 6px 12px;
    border-radius: var(--r-full);
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--text-mute);
    font-size: 11px;
    font-weight: 700;
  }
  .tmpl-cat.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
