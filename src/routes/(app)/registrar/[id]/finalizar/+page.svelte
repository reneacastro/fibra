<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { getWorkout, saveWorkout, newWorkoutId } from '$lib/db/workouts';
  import { saveSession, newSessionId } from '$lib/db/sessions';
  import { getProfile } from '$lib/db/profile';
  import { syncRanking } from '$lib/db/rankings';
  import { todayISO, fmtDuration, CATEGORY_ICON, CATEGORY_LABEL } from '$lib/utils/format';
  import type {
    Session, Workout, WorkoutCategory as WCat, WorkoutExercise, PerformedExercise
  } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { toast } from '$lib/stores/toast.svelte';

  // Estado restaurado do localStorage (vindo de /registrar/[id])
  type Persisted = {
    started: boolean;
    startedAt: number;
    performed: PerformedExercise[];
    activeExIdx: number;
    finalCalories: string;
    finalWeight: string;
    finalMood: 1|2|3|4|5;
    finalNotes: string;
    saveAsTemplate: boolean;
    templateName: string;
    templateCategory: WCat;
    workoutUpdatedAt?: number;
    savedAt: number;
  };

  const persistKey = $derived(`fibra_active_session_${page.params.id || 'livre'}`);
  let workout = $state<Workout | null>(null);
  let persisted = $state<Persisted | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Form fields (vem do persisted, salva de volta on input)
  let finalCalories = $state<string>('');
  let finalWeight = $state<string>('');
  let finalMood = $state<1|2|3|4|5>(4);
  let finalNotes = $state('');
  let saveAsTemplate = $state(false);
  let templateName = $state('');
  let templateCategory = $state<WCat>('superior');

  onMount(async () => {
    if (!authStore.uid) {
      goto('/login');
      return;
    }
    try {
      await catalogStore.ensure();
      // Carrega workout (treino livre se id === 'livre')
      const wid = page.params.id;
      if (!wid) { goto('/registrar'); return; }
      if (wid === 'livre') {
        workout = {
          id: 'livre',
          name: 'Treino livre',
          category: 'livre' as WCat,
          exercises: [],
          order: 0,
          createdAt: 0,
          updatedAt: 0
        };
      } else {
        const w = await getWorkout(authStore.uid, wid);
        if (!w) { goto('/registrar'); return; }
        workout = w;
      }
      // Carrega sessao persistida
      const raw = localStorage.getItem(persistKey);
      if (!raw) {
        // Sem sessao ativa — volta pra registrar
        goto(`/registrar/${wid}`);
        return;
      }
      const data = JSON.parse(raw) as Persisted;
      if (!data.started || !data.performed) {
        goto(`/registrar/${wid}`);
        return;
      }
      persisted = data;
      finalCalories = data.finalCalories || '';
      finalWeight = data.finalWeight || '';
      finalMood = data.finalMood || 4;
      finalNotes = data.finalNotes || '';
      saveAsTemplate = data.saveAsTemplate || false;
      templateName = data.templateName || '';
      templateCategory = data.templateCategory || 'superior';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  });

  // Persiste mudancas no form de volta no localStorage
  $effect(() => {
    if (!persisted) return;
    const updated: Persisted = {
      ...persisted,
      finalCalories,
      finalWeight,
      finalMood,
      finalNotes,
      saveAsTemplate,
      templateName,
      templateCategory,
      savedAt: Date.now()
    };
    try { localStorage.setItem(persistKey, JSON.stringify(updated)); } catch {}
  });

  // Computados a partir do persisted
  const totalVolume = $derived.by(() => {
    if (!persisted) return 0;
    return persisted.performed.reduce(
      (acc, e) => acc + e.sets.reduce(
        (s, st) => s + (st.completed ? (st.weight ?? 0) * (st.reps ?? 0) : 0), 0
      ), 0
    );
  });
  const totalDoneSets = $derived(
    persisted ? persisted.performed.reduce(
      (a, e) => a + (e.skipped ? 0 : e.sets.filter((s) => s.completed).length), 0
    ) : 0
  );
  const elapsed = $derived(
    persisted ? Date.now() - persisted.startedAt : 0
  );

  const MOODS = [
    { v: 1 as const, e: '😵', l: 'Detonado' },
    { v: 2 as const, e: '😩', l: 'Pesado' },
    { v: 3 as const, e: '🙂', l: 'Bom' },
    { v: 4 as const, e: '💪', l: 'Forte' },
    { v: 5 as const, e: '🔥', l: 'Fogo' }
  ];

  function back() {
    goto(`/registrar/${page.params.id}`);
  }

  async function finish() {
    if (!authStore.uid || !workout || !persisted) return;
    saving = true;
    error = null;
    try {
      const session: Session = {
        id: newSessionId(),
        date: todayISO(),
        startedAt: persisted.startedAt,
        finishedAt: Date.now(),
        workoutId: workout.id === 'livre' ? undefined : workout.id,
        workoutName: workout.name,
        workoutCategory: workout.category,
        performedExercises: persisted.performed,
        totalVolume,
        calories: finalCalories ? Number(finalCalories) : undefined,
        bodyWeight: finalWeight ? Number(finalWeight) : undefined,
        mood: finalMood,
        notes: finalNotes.trim() || undefined,
        recording: 'realtime',
        createdAt: Date.now()
      };
      const { prsEarned } = await saveSession(authStore.uid, session);

      // Sincroniza ranking publico se o usuario optou
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

      // Salvar como template se solicitado (so em treino livre)
      if (saveAsTemplate && templateName.trim() && workout.id === 'livre' && persisted.performed.length > 0) {
        const workoutExercises: WorkoutExercise[] = persisted.performed
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
          toast.success('Treino salvo como template');
        }
      }

      if (prsEarned.length > 0 && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }

      // Limpa sessao persistida
      try { localStorage.removeItem(persistKey); } catch {}

      // Vai pra tela de conclusao
      const query = new URLSearchParams({
        id: session.id,
        prs: String(prsEarned.length)
      });
      goto(`/registrar/concluido?${query.toString()}`);
    } catch (e) {
      error = (e as Error).message;
      toast.error('Falha ao salvar: ' + error);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Finalizar treino · FIBRA</title>
</svelte:head>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if !persisted || !workout}
  <Card>
    <div class="empty">
      <span class="mi" style="font-size: 40px;">error_outline</span>
      <p>Sessão não encontrada. Volte e comece o treino.</p>
      <Button onclick={() => goto('/registrar')}>Ir pra registrar</Button>
    </div>
  </Card>
{:else}
  <div class="page">
    <!-- Hero: resumo do que foi feito -->
    <div class="hero">
      <div class="hero-emoji">🏁</div>
      <h2>Você está quase lá</h2>
      <p>Confira os números e finalize.</p>
    </div>

    <Card>
      <div class="recap-row">
        <Badge category={workout.category}>
          {CATEGORY_ICON[workout.category]} {CATEGORY_LABEL[workout.category]}
        </Badge>
        <span class="recap-name">{workout.name}</span>
      </div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-v mono">{fmtDuration(elapsed)}</div>
          <div class="stat-l">duração</div>
        </div>
        <div class="stat">
          <div class="stat-v mono">{totalDoneSets}</div>
          <div class="stat-l">{totalDoneSets === 1 ? 'série feita' : 'séries feitas'}</div>
        </div>
        {#if totalVolume > 0}
          <div class="stat">
            <div class="stat-v mono">{Math.round(totalVolume)}<span>kg</span></div>
            <div class="stat-l">volume</div>
          </div>
        {/if}
      </div>
    </Card>

    <!-- Calorias -->
    <Card>
      <Input type="number" label="🔥 Calorias gastas (kcal)" bind:value={finalCalories} placeholder="0" />
    </Card>

    <!-- Peso -->
    <Card>
      <Input type="number" label="⚖️ Peso corporal hoje (kg)" bind:value={finalWeight} placeholder="0" step="0.1" />
    </Card>

    <!-- Mood -->
    <Card>
      <div class="mood-lbl">Como foi o treino?</div>
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
    </Card>

    <!-- Notas -->
    <Card>
      <label class="notes-lbl">📝 Notas (opcional)</label>
      <textarea
        bind:value={finalNotes}
        placeholder="Como se sentiu? Alguma observação?"
        rows="3"
      ></textarea>
    </Card>

    <!-- Save as template (só treino livre) -->
    {#if workout.id === 'livre' && persisted.performed.length > 0}
      <Card>
        <label class="tmpl-toggle">
          <input type="checkbox" bind:checked={saveAsTemplate} />
          <span>
            <span class="tmpl-t">💾 Salvar como treino fixo</span>
            <span class="tmpl-s">Cria um template pra reusar no futuro</span>
          </span>
        </label>

        {#if saveAsTemplate}
          <div class="spacer"></div>
          <Input label="Nome do treino" bind:value={templateName} placeholder="Ex: Peito e tríceps terça" />
          <div class="spacer"></div>
          <div class="mood-lbl">Categoria</div>
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
      </Card>
    {/if}

    {#if error}
      <Card>
        <div class="error">
          <span class="mi">error</span>
          <span>{error}</span>
        </div>
      </Card>
    {/if}

    <!-- Footer sticky -->
    <div class="footer">
      <Button variant="ghost" onclick={back} disabled={saving}>Voltar</Button>
      <Button variant="success" icon="check_circle" full loading={saving} onclick={finish}>
        Salvar e concluir
      </Button>
    </div>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    padding-bottom: calc(var(--nav-h) + var(--safe-bottom) + var(--s-5));
  }
  .loading { padding: var(--s-8); text-align: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty { text-align: center; padding: var(--s-5); color: var(--text-mute); }
  .empty p { margin: var(--s-2) 0 var(--s-3); font-size: var(--fs-sm); }

  .hero {
    text-align: center;
    padding: var(--s-3) 0 var(--s-2);
  }
  .hero-emoji {
    font-size: 56px;
    margin-bottom: var(--s-2);
  }
  .hero h2 {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .hero p {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-top: 4px;
  }

  .recap-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
    flex-wrap: wrap;
  }
  .recap-name { font-weight: 700; font-size: var(--fs-md); }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
  }
  @media (max-width: 380px) {
    .stats-grid { grid-template-columns: 1fr 1fr; }
  }
  .stat {
    text-align: center;
    padding: var(--s-2);
    background: var(--bg-3);
    border-radius: var(--r-md);
  }
  .stat-v {
    font-size: var(--fs-xl);
    font-weight: 800;
    color: var(--accent);
    line-height: 1.1;
  }
  .stat-v span { font-size: var(--fs-xs); color: var(--text-mute); margin-left: 2px; }
  .stat-l {
    font-size: 10px;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 2px;
  }

  .mood-lbl, .notes-lbl {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: var(--s-2);
  }
  .mood-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }
  .mood-btn {
    padding: 8px 4px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: all var(--dur-fast);
  }
  .mood-btn.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
  }
  .mood-e { font-size: 24px; line-height: 1; }
  .mood-l { font-size: 9px; color: var(--text-mute); font-weight: 600; }

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
    min-height: 60px;
  }
  textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .tmpl-toggle {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }
  .tmpl-toggle input[type='checkbox'] {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .tmpl-t { display: block; font-weight: 700; font-size: var(--fs-sm); }
  .tmpl-s { display: block; font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .tmpl-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tmpl-cat {
    padding: 4px 10px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: capitalize;
  }
  .tmpl-cat.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .spacer { height: var(--s-2); }

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
