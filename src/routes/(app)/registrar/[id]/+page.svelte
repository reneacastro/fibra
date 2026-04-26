<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { getWorkout } from '$lib/db/workouts';
  import { saveSession, newSessionId } from '$lib/db/sessions';
  import { syncRanking } from '$lib/db/rankings';
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
  import ExerciseImageZoom from '$lib/components/ExerciseImageZoom.svelte';
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

  let zoomExId = $state<string | null>(null);
  const zoomExercise = $derived(zoomExId ? catalogStore.byId(zoomExId) : null);

  let workout = $state<Workout | null>(null);
  let loading = $state(true);
  let saving = $state(false);

  // Treino começa só quando o usuário toca em "Iniciar". Evita contar tempo
  // enquanto o usuário está conferindo o plano.
  let started = $state(false);
  let startedAt = $state(Date.now());
  let elapsed = $state(0);
  let elapsedInterval: ReturnType<typeof setInterval>;

  // ─── Persistência da sessão em localStorage ──────
  // Se o usuário bloquear a tela, iOS pode matar o tab; ao voltar,
  // restauramos o progresso (series marcadas, tempo decorrido, etc.)
  const persistKey = $derived(`fibra_active_session_${page.params.id || 'livre'}`);

  function persistSession() {
    if (!started) return;
    try {
      localStorage.setItem(persistKey, JSON.stringify({
        started: true,
        startedAt,
        performed,
        activeExIdx,
        finalCalories,
        finalWeight,
        finalMood,
        finalNotes,
        saveAsTemplate,
        templateName,
        templateCategory,
        // Snapshot do treino na hora que a sessao comecou — pra detectar
        // edicao do template entre o iniciar e o restore. Se mudou,
        // descarta e comeca do zero (caso #2 do bug-list).
        workoutUpdatedAt: workout?.updatedAt ?? 0,
        savedAt: Date.now()
      }));
    } catch {
      // quota/privacy, tudo bem — só perde o restore
    }
  }

  function clearPersistedSession() {
    try { localStorage.removeItem(persistKey); } catch {}
  }

  function tryRestoreSession(): boolean {
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      // Descarta sessao parada ha mais de 12h
      if (Date.now() - data.savedAt > 12 * 3600_000) {
        clearPersistedSession();
        return false;
      }
      // Descarta se o treino foi editado entre o iniciar e o restore
      // (template mudou: exercicios novos, removidos ou reordenados).
      // Sem isso, performed[] referencia exerciseIds desatualizados e
      // o usuario ve dados velhos mesmo apos editar.
      const persistedWorkoutAt = data.workoutUpdatedAt ?? 0;
      const currentWorkoutAt = workout?.updatedAt ?? 0;
      if (persistedWorkoutAt && currentWorkoutAt && persistedWorkoutAt < currentWorkoutAt) {
        clearPersistedSession();
        return false;
      }
      started = data.started;
      startedAt = data.startedAt;
      performed = data.performed;
      activeExIdx = data.activeExIdx ?? 0;
      finalCalories = data.finalCalories ?? '';
      finalWeight = data.finalWeight ?? '';
      finalMood = data.finalMood ?? 4;
      finalNotes = data.finalNotes ?? '';
      saveAsTemplate = data.saveAsTemplate ?? false;
      templateName = data.templateName ?? '';
      templateCategory = data.templateCategory ?? 'superior';
      elapsed = Date.now() - startedAt;
      elapsedInterval = setInterval(() => {
        elapsed = Date.now() - startedAt;
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }

  function startSession() {
    started = true;
    startedAt = Date.now();
    elapsed = 0;
    elapsedInterval = setInterval(() => {
      elapsed = Date.now() - startedAt;
    }, 1000);
    // NoSleep só é ativado dentro do GpsTracker durante a corrida.
    // Pra treino de academia, o usuário pode (e deve) bloquear a tela
    // entre séries sem perder o treino — por isso não forçamos aqui.
    persistSession();
  }

  // Auto-save: dispara quando qualquer estado relevante muda e a sessão
  // já começou. Debounced leve (200ms).
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    // Dependências que queremos persistir
    performed; activeExIdx;
    finalCalories; finalWeight; finalMood; finalNotes;
    saveAsTemplate; templateName; templateCategory;
    if (!started) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistSession, 200);
  });

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
    // NÃO inicia timer no mount — só quando usuário toca "Iniciar treino".
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
        // Tenta restaurar sessão interrompida (lock/unlock killed tab)
        const restored = tryRestoreSession();
        if (!restored) {
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
        }
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
        const restored = tryRestoreSession();
        if (!restored) performed = [];
      }
      loading = false;
    })();

    return () => {
      if (elapsedInterval) clearInterval(elapsedInterval);
    };
  });

  function toggleSet(exIdx: number, setIdx: number) {
    // Update imutavel completo — garante que o $derived (allDone, doneSets)
    // disparam reativamente. Antes usava spread+mutate, mas o Svelte 5 as
    // vezes nao detectava a mudanca em sets aninhados.
    let willComplete = false;
    performed = performed.map((pe, ei) => {
      if (ei !== exIdx) return pe;
      return {
        ...pe,
        sets: pe.sets.map((s, si) => {
          if (si !== setIdx) return s;
          willComplete = !s.completed;
          return { ...s, completed: !s.completed };
        })
      };
    });

    if (willComplete && workout?.exercises[exIdx]?.restSeconds) {
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
  const gpsMet = $derived.by(() => {
    if (!gpsTarget) return 9;
    const pe = performed[gpsTarget.exIdx];
    if (!pe) return 9;
    return catalogStore.byId(pe.exerciseId)?.mets ?? 9;
  });

  function applyGps(result: {
    distanceM: number;
    paceSecPerKm: number;
    durationSec: number;
    calories: number;
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
    // Soma kcal da corrida no total da sessão se o usuário ainda não digitou
    if (result.calories > 0 && !finalCalories) {
      finalCalories = String(result.calories);
    }
    gpsTarget = null;
  }

  function skipExercise(exIdx: number) {
    // Mantido pra retro-compat (sessoes antigas usam skipped).
    // Update imutavel pra reatividade.
    performed = performed.map((pe, i) =>
      i === exIdx ? { ...pe, skipped: !pe.skipped } : pe
    );
  }

  // Concluir exercicio: marca TODAS as series como done de uma vez +
  // colapsa o card (visualmente "fecha o modal" como o user espera).
  // Se ja esta concluido, reverte (uncheck + reabre).
  function toggleCompleteExercise(exIdx: number) {
    const ex = performed[exIdx];
    if (!ex) return;
    const allDoneInThisEx = ex.sets.length > 0 && ex.sets.every((s) => s.completed);
    performed = performed.map((pe, i) => {
      if (i !== exIdx) return pe;
      return {
        ...pe,
        skipped: false, // sempre limpa skipped ao concluir
        sets: pe.sets.map((s) => ({ ...s, completed: !allDoneInThisEx }))
      };
    });
    // Atualiza set de cards expandidos manualmente — usuario pode
    // querer reabrir mesmo que todos os sets estejam done
    const next = new Set(forceExpanded);
    if (allDoneInThisEx) next.add(exIdx); // estava done, agora reabriu, expand
    else next.delete(exIdx);              // estava aberto, agora fechou
    forceExpanded = next;
  }

  // Set de indices que o user expandiu manualmente apesar de estarem done.
  // Por padrao: card colapsa quando allSetsDone. Tap no header expande.
  let forceExpanded = $state<Set<number>>(new Set());
  function toggleExpanded(exIdx: number) {
    const next = new Set(forceExpanded);
    if (next.has(exIdx)) next.delete(exIdx);
    else next.add(exIdx);
    forceExpanded = next;
  }

  // Progresso
  const totalSets = $derived(performed.reduce((a, e) => a + (e.skipped ? 0 : e.sets.length), 0));
  const doneSets = $derived(performed.reduce(
    (a, e) => a + (e.skipped ? 0 : e.sets.filter((s) => s.completed).length), 0
  ));
  const progressPct = $derived(totalSets === 0 ? 0 : Math.round((doneSets / totalSets) * 100));
  // Pra finalizar: TODOS os sets nao-pulados precisam estar marcados,
  // OU o usuario pulou todos os exercicios. So bloqueia se houver sets
  // pendentes em exercicios nao-pulados. Treino totalmente vazio
  // (performed.length === 0) tambem bloqueia.
  const allDone = $derived(
    performed.length > 0 && (totalSets === 0 || doneSets >= totalSets)
  );
  const remainingSets = $derived(Math.max(0, totalSets - doneSets));

  const totalVolume = $derived(performed.reduce(
    (acc, e) => acc + e.sets.reduce(
      (s, st) => s + (st.completed ? (st.weight ?? 0) * (st.reps ?? 0) : 0), 0
    ), 0
  ));

  // Kcal estimada: intensidade do exercício × peso × tempo. Mesma fórmula
  // que Apple Health e Strava usam quando não há frequência cardíaca.
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

      // Sincroniza ranking publico se o usuario optou. Nao bloqueia o fluxo
      // — se falhar, so nao aparece no ranking nessa rodada.
      try {
        const profile = await getProfile(authStore.uid);
        if (profile?.settings?.publicProfile) {
          await syncRanking(authStore.uid, profile, {
            displayName: profile.name || authStore.user?.displayName || 'Atleta',
            avatar: authStore.user?.photoURL || profile.avatar
          });
        }
      } catch (e) {
        console.warn('Ranking nao sincronizou:', e);
      }

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

      // Limpa a sessao persistida
      clearPersistedSession();

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
{:else if workout && !started}
  <!-- Pré-início: usuário ainda não tocou "Iniciar" -->
  <div class="pre-start">
    <Badge category={workout.category}>{CATEGORY_ICON[workout.category]} {CATEGORY_LABEL[workout.category]}</Badge>
    <h1>{workout.name}</h1>
    <div class="pre-stats">
      <div class="pre-stat">
        <div class="ps-v mono">{workout.exercises.length}</div>
        <div class="ps-l">exercícios</div>
      </div>
      <div class="pre-stat">
        <div class="ps-v mono">{totalSets}</div>
        <div class="ps-l">séries</div>
      </div>
    </div>
    <p class="pre-tag">Revise o plano. Quando estiver pronto, bora.</p>
    <Button icon="play_arrow" size="lg" full onclick={startSession}>Iniciar treino</Button>
  </div>
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
      {@const allSetsDone = pe.sets.length > 0 && pe.sets.every((s) => s.completed)}
      {@const collapsed = allSetsDone && !forceExpanded.has(idx)}
      {#if meta && workoutEx}
        <Card accent={collapsed ? 'glow' : (pe.skipped ? 'default' : 'default')}>
          <div class="ex-head" class:dim={pe.skipped}>
            {#if meta.gifUrl}
              <button
                class="ex-gif-btn"
                onclick={() => (zoomExId = pe.exerciseId)}
                aria-label="Ver como fazer"
              >
                <img class="ex-gif" src={meta.gifUrl} alt={meta.name} loading="lazy" />
                <span class="ex-gif-overlay"><span class="mi">zoom_in</span></span>
              </button>
            {/if}
            <button
              class="ex-info"
              onclick={() => collapsed && toggleExpanded(idx)}
              type="button"
              aria-label={collapsed ? 'Expandir exercício' : meta.name}
            >
              <div class="ex-name">
                {idx + 1}. {meta.name}
                {#if collapsed}<span class="ex-done-tag">✓ feito</span>{/if}
              </div>
              <div class="ex-muscle">
                {Array.isArray(meta.muscleGroup) ? meta.muscleGroup.join(' · ') : meta.muscleGroup}
              </div>
            </button>
            <button
              class="skip-btn"
              class:on={allSetsDone}
              onclick={() => toggleCompleteExercise(idx)}
              aria-label={allSetsDone ? 'Reabrir exercício' : 'Concluir exercício (marca todas as séries)'}
              title={allSetsDone ? 'Reabrir' : 'Concluir tudo'}
            >
              <span class="mi">{allSetsDone ? 'restart_alt' : 'done_all'}</span>
            </button>
          </div>

          {#if !pe.skipped && !collapsed}
            <div class="pre-sets">
              <ExerciseHistoryCompact
                exerciseId={pe.exerciseId}
                onOpenDetail={() => goto(`/exercicios/${pe.exerciseId}`)}
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

  <!-- Finalização (UI navega pra /registrar/[id]/finalizar) -->
  {#if true}
    {#if !allDone && remainingSets > 0}
      <div class="finish-blocker">
        <span class="mi">checklist</span>
        <div>
          <div class="fb-t">Faltam {remainingSets} {remainingSets === 1 ? 'série' : 'séries'} pra fechar o treino</div>
          <div class="fb-s">Marca cada série feita ou pula o exercício pra liberar o "Finalizar".</div>
        </div>
      </div>
    {:else if !allDone}
      <div class="finish-blocker">
        <span class="mi">checklist</span>
        <div>
          <div class="fb-t">Adicione pelo menos um exercício</div>
          <div class="fb-s">O treino livre precisa de exercícios pra ser finalizado.</div>
        </div>
      </div>
    {/if}
    <Button
      size="lg"
      icon="check_circle"
      full
      disabled={!allDone}
      onclick={() => {
        // Garante que o estado mais recente foi persistido antes
        // de navegar pra rota de finalizacao (que le do localStorage)
        persistSession();
        goto(`/registrar/${page.params.id}/finalizar`);
      }}
    >
      Finalizar treino
    </Button>
  {/if}
{/if}

{#if zoomExercise}
  <ExerciseImageZoom exercise={zoomExercise} onClose={() => (zoomExId = null)} />
{/if}

{#if gpsTarget}
  <GpsTracker
    onComplete={applyGps}
    onClose={() => (gpsTarget = null)}
    userWeightKg={userBodyWeight}
    exerciseMets={gpsMet}
  />
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }

  .pre-start {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--s-3);
    padding: var(--s-6) var(--s-2);
  }
  .pre-start h1 {
    font-size: var(--fs-3xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-top: var(--s-2);
  }
  .pre-stats {
    display: flex;
    gap: var(--s-5);
    margin: var(--s-3) 0;
  }
  .pre-stat { text-align: center; }
  .ps-v { font-size: var(--fs-3xl); font-weight: 800; color: var(--accent); line-height: 1; }
  .ps-l { font-size: var(--fs-xs); color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }
  .pre-tag { color: var(--text-mute); font-style: italic; margin-bottom: var(--s-3); }

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
  .ex-gif-btn {
    position: relative;
    padding: 0;
    border: 0;
    background: none;
    border-radius: var(--r-md);
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
  }
  .ex-gif-btn:active { transform: scale(0.95); }
  .ex-gif-btn .ex-gif-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.35);
    opacity: 0;
    transition: opacity var(--dur-fast);
    color: #fff;
  }
  .ex-gif-btn:active .ex-gif-overlay { opacity: 1; }
  @media (hover: hover) {
    .ex-gif-btn:hover .ex-gif-overlay { opacity: 1; }
  }
  .ex-gif-overlay .mi { font-size: 22px; }
  .ex-gif {
    width: 56px;
    height: 56px;
    border-radius: var(--r-md);
    object-fit: cover;
    background: var(--bg-3);
    display: block;
  }
  .ex-info {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    padding: 0;
    text-align: left;
    color: inherit;
    cursor: default;
  }
  .ex-name { font-weight: 700; font-size: var(--fs-md); }
  .ex-muscle { font-size: var(--fs-xs); color: var(--text-mute); text-transform: capitalize; margin-top: 2px; }
  .ex-done-tag {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 8px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: var(--r-full);
    font-size: 10px;
    font-weight: 700;
    vertical-align: middle;
  }

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
  /* Bloqueio de finalizacao quando ha series faltando */
  .finish-blocker {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: var(--s-3);
    background: color-mix(in srgb, var(--warn, #f59e0b) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn, #f59e0b) 30%, transparent);
    border-radius: var(--r-md);
    margin-bottom: var(--s-2);
  }
  .finish-blocker .mi {
    font-size: 24px;
    color: var(--warn, #f59e0b);
    flex-shrink: 0;
  }
  .fb-t { font-weight: 700; font-size: var(--fs-sm); margin-bottom: 4px; }
  .fb-s { font-size: var(--fs-xs); color: var(--text-mute); line-height: 1.4; }

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

  .spacer-sm { height: var(--s-2); }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
