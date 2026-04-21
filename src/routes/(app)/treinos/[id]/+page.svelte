<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import {
    getWorkout, saveWorkout, deleteWorkout, newWorkoutId, saveWorkoutForClient
  } from '$lib/db/workouts';
  import type {
    Workout, WorkoutCategory, WorkoutExercise, ExerciseSet
  } from '$lib/types';
  import { CATEGORY_LABEL, CATEGORY_ICON } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import ExerciseCard from '$lib/components/ExerciseCard.svelte';
  import Tabs from '$lib/components/Tabs.svelte';
  import ExerciseHistoryCompact from '$lib/components/ExerciseHistoryCompact.svelte';
  import ExerciseDetailSheet from '$lib/components/ExerciseDetailSheet.svelte';
  import CrossfitEditor from '$lib/components/CrossfitEditor.svelte';
  import NewExerciseSheet from '$lib/components/NewExerciseSheet.svelte';
  import Sortable from 'sortablejs';
  import { isDurationBased, isCardio, fmtSec, fmtPace, parsePace } from '$lib/utils/exercise';
  import type { Exercise } from '$lib/types';

  let newExOpen = $state(false);

  const isNew = $derived(page.params.id === 'novo');

  let loading = $state(true);
  let saving = $state(false);
  let workout = $state<Workout>({
    id: newWorkoutId(),
    name: '',
    category: 'superior',
    exercises: [],
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false
  });

  // Picker de exercícios
  let pickerOpen = $state(false);
  let pickerCat = $state<WorkoutCategory>('superior');
  let pickerSearch = $state('');

  // Modal de histórico
  let detailExId = $state<string | null>(null);

  // Drag-n-drop
  let stackEl = $state<HTMLDivElement | null>(null);
  let sortable: Sortable | null = null;

  $effect(() => {
    const el = stackEl;
    if (!el) return;
    const s = Sortable.create(el, {
      animation: 180,
      handle: '.drag-handle',
      ghostClass: 'dragging',
      onEnd: (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
        if (evt.oldIndex === evt.newIndex) return;
        const { item, oldIndex, newIndex } = evt;

        // Desfaz a mutação do Sortable — Svelte renderiza da ordem do state.
        const refNode = el.children[oldIndex] || null;
        el.insertBefore(item, refNode);

        const next = [...workout.exercises];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        next.forEach((e, i) => (e.order = i));
        workout = { ...workout, exercises: next };
      }
    });
    sortable = s;
    return () => {
      s.destroy();
      sortable = null;
    };
  });

  // Trainer mode: editando o workout de um cliente
  const targetUid = $derived(page.url.searchParams.get('clientUid') || authStore.uid || '');
  const isClientMode = $derived(!!page.url.searchParams.get('clientUid'));

  onMount(async () => {
    try {
      await catalogStore.ensure();
      if (!isNew && targetUid && page.params.id) {
        const w = await getWorkout(targetUid, page.params.id);
        if (w) workout = w;
        else goto(isClientMode ? `/trainer/cliente/${targetUid}` : '/treinos');
      }
    } catch (e) {
      console.error('Falha ao carregar treino:', e);
    } finally {
      loading = false;
    }
  });

  const CATS: WorkoutCategory[] = [
    'superior','inferior','fullbody','forca','pump','core',
    'funcional','calistenia','crossfit','hiit',
    'cardio','mobilidade','alongamento','livre'
  ];

  // Quando há busca, procura em TODAS as categorias. Sem busca, filtra só pela ativa.
  const pickerResults = $derived.by(() => {
    const q = pickerSearch.trim().toLowerCase();
    const list = q ? catalogStore.all : catalogStore.byCategory(pickerCat);
    const already = new Set(workout.exercises.map((e) => e.exerciseId));
    const filtered = list.filter((e) => !already.has(e.id) && (!q || e.name.toLowerCase().includes(q)));
    return filtered.slice(0, 100);
  });
  const pickerTotal = $derived.by(() => {
    const q = pickerSearch.trim().toLowerCase();
    const list = q ? catalogStore.all : catalogStore.byCategory(pickerCat);
    const already = new Set(workout.exercises.map((e) => e.exerciseId));
    return list.filter((e) => !already.has(e.id) && (!q || e.name.toLowerCase().includes(q))).length;
  });

  function addExercise(exerciseId: string) {
    const ex = catalogStore.byId(exerciseId);
    let set: ExerciseSet;
    let seriesCount = 3;
    let rest = 60;
    if (ex && isDurationBased(ex)) {
      set = { type: 'isométrica', durationSec: 30 };
      rest = 30;
    } else if (ex && isCardio(ex)) {
      // Cardio: 1 "série" (volta) com distância + pace alvo
      set = { type: 'normal', distanceM: 5000, paceSecPerKm: 360 };
      seriesCount = 1;
      rest = 0;
    } else {
      set = { type: 'normal', reps: 10, weight: 0 };
    }
    const we: WorkoutExercise = {
      exerciseId,
      order: workout.exercises.length,
      sets: Array.from({ length: seriesCount }, () => ({ ...set })),
      restSeconds: rest
    };
    workout = { ...workout, exercises: [...workout.exercises, we] };
  }

  function removeExercise(idx: number) {
    const next = [...workout.exercises];
    next.splice(idx, 1);
    next.forEach((e, i) => (e.order = i));
    workout = { ...workout, exercises: next };
  }

  function addSet(exIdx: number) {
    const next = [...workout.exercises];
    const last = next[exIdx].sets[next[exIdx].sets.length - 1];
    next[exIdx].sets = [...next[exIdx].sets, { ...last }];
    workout = { ...workout, exercises: next };
  }

  function removeSet(exIdx: number, setIdx: number) {
    const next = [...workout.exercises];
    next[exIdx].sets = next[exIdx].sets.filter((_, i) => i !== setIdx);
    if (next[exIdx].sets.length === 0) next[exIdx].sets = [{ type: 'normal', reps: 10, weight: 0 }];
    workout = { ...workout, exercises: next };
  }

  function updateSet(exIdx: number, setIdx: number, patch: Partial<ExerciseSet>) {
    const next = [...workout.exercises];
    next[exIdx].sets[setIdx] = { ...next[exIdx].sets[setIdx], ...patch };
    workout = { ...workout, exercises: next };
  }

  const canSave = $derived(workout.name.trim().length > 0 && workout.exercises.length > 0);

  let saveError = $state<string | null>(null);

  // Compartilhar com a comunidade — 2 modos: público ou direto pra alguém
  let publishing = $state(false);
  let publishDescription = $state('');
  let publishSheetOpen = $state(false);
  let publishedMsg = $state<string | null>(null);
  let publishMode = $state<'public' | 'targeted'>('public');
  let recipientUid = $state<string>('');
  let recipientName = $state<string>('');
  let recipientSearch = $state<string>('');
  let recipients = $state<{ uid: string; name: string; avatar?: string }[]>([]);

  async function loadRecipients() {
    if (recipients.length > 0) return;
    try {
      const { listRanking } = await import('$lib/db/rankings');
      const all = await listRanking({ orderBy: 'totalSessions', max: 200 });
      recipients = all
        .filter((r) => r.uid !== authStore.uid)
        .map((r) => ({ uid: r.uid, name: r.displayName, avatar: r.avatar }));
    } catch (e) {
      console.warn('Falha ao carregar destinatários:', e);
    }
  }

  const filteredRecipients = $derived.by(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return recipients.slice(0, 20);
    return recipients.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 20);
  });

  async function openPublishSheet() {
    publishSheetOpen = true;
    loadRecipients();
  }

  async function publish() {
    if (!authStore.uid || !workout.name.trim() || workout.exercises.length === 0) return;
    if (publishMode === 'targeted' && !recipientUid) {
      publishedMsg = 'Escolha um destinatário.';
      return;
    }
    publishing = true;
    try {
      const [{ publishShared, newSharedId }, { getProfile }] = await Promise.all([
        import('$lib/db/sharedWorkouts'),
        import('$lib/db/profile')
      ]);
      const profile = await getProfile(authStore.uid);
      await publishShared({
        id: newSharedId(),
        sourceWorkoutId: workout.id,
        ownerUid: authStore.uid,
        ownerName: profile?.name || authStore.user?.displayName || 'Atleta',
        ownerAvatar: authStore.user?.photoURL || profile?.avatar,
        name: workout.name,
        category: workout.category,
        exercises: workout.exercises,
        crossfit: workout.crossfit,
        description: publishDescription.trim() || undefined,
        visibility: publishMode,
        targetUid: publishMode === 'targeted' ? recipientUid : undefined,
        targetName: publishMode === 'targeted' ? recipientName : undefined,
        clonedCount: 0,
        likes: 0,
        publishedAt: Date.now(),
        updatedAt: Date.now()
      });
      publishedMsg = publishMode === 'public'
        ? 'Treino público! Aparece pra todos em Comunidade.'
        : `Treino enviado pra ${recipientName}. Vai aparecer em "Recebidos" pra ela.`;
      publishSheetOpen = false;
      publishDescription = '';
      recipientUid = '';
      recipientName = '';
      setTimeout(() => (publishedMsg = null), 4000);
    } catch (e) {
      publishedMsg = 'Erro: ' + (e as Error).message;
    } finally {
      publishing = false;
    }
  }

  async function save() {
    if (!authStore.uid) return;
    if (!workout.name.trim()) {
      saveError = 'Dê um nome ao treino antes de salvar.';
      return;
    }
    if (workout.exercises.length === 0) {
      saveError = 'Adicione pelo menos 1 exercício.';
      return;
    }
    saving = true;
    saveError = null;
    try {
      if (isClientMode) {
        await saveWorkoutForClient(targetUid, workout);
        goto(`/trainer/cliente/${targetUid}`);
      } else {
        await saveWorkout(authStore.uid!, workout);
        if (page.url.searchParams.get('then') === 'register') {
          goto(`/registrar/${workout.id}`);
        } else {
          goto('/treinos');
        }
      }
    } catch (e) {
      saveError = 'Erro ao salvar: ' + (e as Error).message;
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!authStore.uid || isNew) return;
    if (!confirm(`Apagar "${workout.name}"?`)) return;
    await deleteWorkout(targetUid, workout.id);
    goto(isClientMode ? `/trainer/cliente/${targetUid}` : '/treinos');
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else}
  <Card>
    <Input label="Nome do treino" icon="edit" bind:value={workout.name} placeholder="Ex: Superior A Pesado" />
    <div class="spacer"></div>
    <label class="cat-label">Categoria</label>
    <div class="cat-grid">
      {#each CATS as c (c)}
        <button
          class="cat-btn"
          class:on={workout.category === c}
          onclick={() => (workout.category = c)}
        >
          <span class="ic">{CATEGORY_ICON[c]}</span>
          <span class="lbl">{CATEGORY_LABEL[c]}</span>
        </button>
      {/each}
    </div>
  </Card>

  {#if workout.category === 'crossfit'}
    <Card title="Configuração do WOD" icon="bolt">
      <CrossfitEditor
        value={workout.crossfit ?? { format: 'amrap', durationMin: 20 }}
        onChange={(v) => (workout = { ...workout, crossfit: v })}
      />
    </Card>
  {/if}

  <div class="sec">
    <div class="sec-title">
      <span>Exercícios</span>
      <Badge variant="default">{workout.exercises.length}</Badge>
    </div>

    {#if workout.exercises.length === 0}
      <Card>
        <div class="empty-ex">
          <span class="mi">add_circle</span>
          <p>Adicione exercícios ao seu treino</p>
        </div>
      </Card>
    {:else}
      <div class="ex-stack" bind:this={stackEl}>
        {#each workout.exercises as we, idx (we.exerciseId)}
          {@const meta = catalogStore.byId(we.exerciseId)}
          {#if meta}
            <div class="we-wrap" data-id={we.exerciseId}>
            <Card padding="sm">
              <div class="we-head">
                <button class="drag-handle" aria-label="Arrastar para reordenar">
                  <span class="mi">drag_indicator</span>
                </button>
                <div class="we-order mono">{idx + 1}</div>
                <div class="we-info">
                  <div class="we-name">{meta.name}</div>
                  <div class="we-muscle">{Array.isArray(meta.muscleGroup) ? meta.muscleGroup.join(' · ') : meta.muscleGroup}</div>
                </div>
                <div class="we-ctrl">
                  <button class="icon-btn sm danger" onclick={() => removeExercise(idx)} aria-label="Remover"><span class="mi">close</span></button>
                </div>
              </div>

              <ExerciseHistoryCompact
                exerciseId={we.exerciseId}
                onOpenDetail={() => (detailExId = we.exerciseId)}
              />
              <div class="spacer-sm"></div>

              {@const duration = isDurationBased(meta)}
              {@const cardio = isCardio(meta)}
              <div class="sets">
                {#if cardio}
                  <div class="set-head cardio">
                    <span>Série</span>
                    <span>Distância</span>
                    <span>Pace</span>
                    <span></span>
                  </div>
                {:else if duration}
                  <div class="set-head dur">
                    <span>Série</span>
                    <span>Duração</span>
                    <span></span>
                  </div>
                {:else}
                  <div class="set-head">
                    <span>Série</span>
                    <span>Reps</span>
                    <span>Carga</span>
                    <span>RPE</span>
                    <span></span>
                  </div>
                {/if}
                {#each we.sets as set, sIdx (sIdx)}
                  {#if cardio}
                    <div class="set-row cardio">
                      <span class="set-num mono">{sIdx + 1}</span>
                      <div class="dur-input">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputmode="decimal"
                          value={set.distanceM ? (set.distanceM / 1000).toString() : ''}
                          placeholder="5"
                          oninput={(e) => {
                            const v = Number(e.currentTarget.value);
                            updateSet(idx, sIdx, { distanceM: v > 0 ? Math.round(v * 1000) : undefined });
                          }}
                        />
                        <span class="suf">km</span>
                      </div>
                      <div class="dur-input">
                        <input
                          type="text"
                          inputmode="numeric"
                          pattern="[0-9:]*"
                          value={fmtPace(set.paceSecPerKm)}
                          placeholder="5:30"
                          oninput={(e) => updateSet(idx, sIdx, { paceSecPerKm: parsePace(e.currentTarget.value) })}
                        />
                        <span class="suf">/km</span>
                      </div>
                      <button class="set-del" onclick={() => removeSet(idx, sIdx)} aria-label="Remover série">
                        <span class="mi">remove</span>
                      </button>
                    </div>
                  {:else if duration}
                    <div class="set-row dur">
                      <span class="set-num mono">{sIdx + 1}</span>
                      <div class="dur-input">
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={set.durationSec ?? 30}
                          oninput={(e) => updateSet(idx, sIdx, { durationSec: Number(e.currentTarget.value) || 0 })}
                        />
                        <span class="suf">seg</span>
                      </div>
                      <button class="set-del" onclick={() => removeSet(idx, sIdx)} aria-label="Remover série">
                        <span class="mi">remove</span>
                      </button>
                    </div>
                  {:else}
                    <div class="set-row">
                      <span class="set-num mono">{sIdx + 1}</span>
                      <input
                        type="number"
                        min="0"
                        value={set.reps ?? ''}
                        oninput={(e) => updateSet(idx, sIdx, { reps: Number(e.currentTarget.value) || undefined })}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={set.weight ?? ''}
                        oninput={(e) => updateSet(idx, sIdx, { weight: Number(e.currentTarget.value) || undefined })}
                      />
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={set.rpeTarget ?? ''}
                        placeholder="—"
                        oninput={(e) => updateSet(idx, sIdx, { rpeTarget: Number(e.currentTarget.value) || undefined })}
                      />
                      <button class="set-del" onclick={() => removeSet(idx, sIdx)} aria-label="Remover série">
                        <span class="mi">remove</span>
                      </button>
                    </div>
                  {/if}
                {/each}
                <button class="add-set" onclick={() => addSet(idx)}>
                  <span class="mi">add</span> Adicionar série
                </button>
              </div>

              <div class="rest-row">
                <span class="rest-lbl">Descanso entre séries</span>
                <div class="rest-input">
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={we.restSeconds}
                    oninput={(e) => {
                      workout.exercises[idx].restSeconds = Number(e.currentTarget.value) || 0;
                    }}
                  />
                  <span class="suf">seg</span>
                </div>
              </div>
            </Card>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <Button icon="add" variant="secondary" full onclick={() => (pickerOpen = true)}>
      Adicionar exercício
    </Button>
  </div>

  {#if saveError}
    <div class="save-error">
      <span class="mi">error</span>
      <span>{saveError}</span>
    </div>
  {/if}

  {#if publishedMsg}
    <div class="save-error" style="background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); border-color: var(--success);">
      <span class="mi">check_circle</span>
      <span>{publishedMsg}</span>
    </div>
  {/if}

  {#if !isNew && canSave}
    <Card>
      <div class="publish-row">
        <div>
          <div class="pub-t">Compartilhar</div>
          <div class="pub-s">Publique pra todos ou envie direto pra alguém específico.</div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon="ios_share"
          onclick={openPublishSheet}
        >
          Compartilhar
        </Button>
      </div>
    </Card>
  {/if}

  <div class="footer">
    {#if !isNew}
      <Button variant="ghost" icon="delete" onclick={remove}>Apagar</Button>
    {/if}
    <Button icon="save" full loading={saving} onclick={save}>
      {isNew ? 'Criar treino' : 'Salvar alterações'}
    </Button>
  </div>

  {#if publishSheetOpen}
    <div class="pub-backdrop" role="presentation" onclick={() => (publishSheetOpen = false)}>
      <div class="pub-sheet" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
        <div class="pub-handle"></div>
        <h3>Compartilhar "{workout.name}"</h3>

        <!-- Modo: público vs direto -->
        <div class="mode-row">
          <button
            class="mode-btn"
            class:on={publishMode === 'public'}
            onclick={() => (publishMode = 'public')}
          >
            <span class="mi">public</span>
            <div class="mb-body">
              <div class="mb-t">Público</div>
              <div class="mb-s">Qualquer pessoa vê e pode pegar o treino</div>
            </div>
          </button>
          <button
            class="mode-btn"
            class:on={publishMode === 'targeted'}
            onclick={() => (publishMode = 'targeted')}
          >
            <span class="mi">send</span>
            <div class="mb-body">
              <div class="mb-t">Enviar pra alguém</div>
              <div class="mb-s">Só essa pessoa vai receber</div>
            </div>
          </button>
        </div>

        {#if publishMode === 'targeted'}
          <div class="recipient-wrap">
            {#if recipientUid}
              <div class="recipient-pill">
                Pra: <strong>{recipientName}</strong>
                <button onclick={() => { recipientUid = ''; recipientName = ''; }}>
                  <span class="mi">close</span>
                </button>
              </div>
            {:else}
              <input
                type="text"
                placeholder="Buscar pessoa na comunidade…"
                bind:value={recipientSearch}
                class="rec-search"
              />
              {#if recipients.length === 0}
                <div class="rec-hint">Só usuários que entraram na Comunidade aparecem aqui.</div>
              {:else}
                <div class="rec-list">
                  {#each filteredRecipients as r (r.uid)}
                    <button
                      class="rec-item"
                      onclick={() => { recipientUid = r.uid; recipientName = r.name; recipientSearch = ''; }}
                    >
                      <div class="rec-ava">
                        {#if r.avatar?.startsWith('http')}
                          <img src={r.avatar} alt={r.name} />
                        {:else}
                          <span>{r.avatar || '🔥'}</span>
                        {/if}
                      </div>
                      <span class="rec-name">{r.name}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <p class="pub-desc">Descrição (opcional — pra quem serve, dicas).</p>
        <textarea
          bind:value={publishDescription}
          placeholder={publishMode === 'targeted'
            ? `Ex: Fiz esse ontem, é bom pra ${recipientName || 'você'}, tenta.`
            : 'Ex: Treino superior pesado pra quem já tem base. 45min.'}
          rows="3"
          maxlength="400"
        ></textarea>

        <div class="pub-actions">
          <Button variant="ghost" onclick={() => (publishSheetOpen = false)}>Cancelar</Button>
          <Button
            icon={publishMode === 'public' ? 'public' : 'send'}
            full
            loading={publishing}
            onclick={publish}
          >
            {publishMode === 'public' ? 'Publicar' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<!-- Detail sheet -->
{#if detailExId}
  <ExerciseDetailSheet
    exerciseId={detailExId}
    onClose={() => (detailExId = null)}
  />
{/if}

{#if newExOpen}
  <NewExerciseSheet
    defaultCategory={pickerCat}
    onCreated={(ex: Exercise) => {
      addExercise(ex.id);
      newExOpen = false;
      pickerOpen = false;
    }}
    onClose={() => (newExOpen = false)}
  />
{/if}

<!-- Picker modal -->
{#if pickerOpen}
  <div
    class="sheet-backdrop"
    onclick={() => (pickerOpen = false)}
    onkeydown={(e) => e.key === 'Escape' && (pickerOpen = false)}
    role="button"
    tabindex="-1"
  >
    <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <div class="sheet-head">
        <h3>Adicionar exercício</h3>
        <div class="sheet-actions">
          <button class="icon-btn" onclick={() => (newExOpen = true)} aria-label="Criar novo">
            <span class="mi">add_circle</span>
          </button>
          <button class="icon-btn" onclick={() => (pickerOpen = false)}><span class="mi">close</span></button>
        </div>
      </div>

      <Tabs
        tabs={CATS.map((c) => ({
          id: c,
          label: CATEGORY_LABEL[c],
          icon: CATEGORY_ICON[c],
          count: catalogStore.byCategory(c).length
        }))}
        value={pickerCat}
        onChange={(id) => (pickerCat = id as WorkoutCategory)}
      />

      <div class="spacer"></div>
      <Input icon="search" placeholder="Buscar…" bind:value={pickerSearch} />
      <div class="spacer"></div>

      {#if pickerTotal > pickerResults.length}
        <div class="picker-hint">
          Mostrando {pickerResults.length} de {pickerTotal}. Refine a busca pra ver mais.
        </div>
      {/if}

      <div class="picker-list">
        {#each pickerResults as ex (ex.id)}
          <ExerciseCard
            exercise={ex}
            compact
            disableZoom
            onclick={() => { addExercise(ex.id); pickerOpen = false; }}
          />
        {:else}
          <div class="empty"><span class="mi">search_off</span>Nenhum exercício disponível</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .loading {
    min-height: 40vh;
    display: grid;
    place-content: center;
  }
  .loading .mi {
    font-size: 32px;
    color: var(--accent);
    animation: spin 1s linear infinite;
  }

  .spacer { height: var(--s-3); }

  .cat-label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--s-2);
    display: block;
  }
  .cat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  @media (max-width: 420px) {
    .cat-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .cat-btn {
    padding: 10px 6px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .cat-btn .ic { font-size: 18px; }
  .cat-btn.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .sec {
    margin: var(--s-4) 0;
  }
  .sec-title {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    font-weight: 700;
    margin-bottom: var(--s-2);
  }

  .empty-ex {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-5);
    color: var(--text-mute);
  }
  .empty-ex .mi { font-size: 32px; color: var(--text-dim); }

  .ex-stack {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .we-wrap {
    transition: opacity var(--dur-fast);
  }
  .we-wrap.dragging {
    opacity: 0.4;
  }
  .drag-handle {
    width: 28px;
    height: 28px;
    border-radius: var(--r-sm);
    display: grid;
    place-items: center;
    color: var(--text-dim);
    cursor: grab;
    touch-action: none;
  }
  .drag-handle:hover { background: var(--bg-3); color: var(--text-mute); }
  .drag-handle:active { cursor: grabbing; }
  .drag-handle .mi { font-size: 20px; }

  .spacer-sm { height: var(--s-2); }

  .we-head {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .we-order {
    width: 28px;
    height: 28px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--fs-sm);
  }
  .we-info { flex: 1; min-width: 0; }
  .we-name { font-weight: 700; font-size: var(--fs-sm); }
  .we-muscle { font-size: var(--fs-xs); color: var(--text-mute); text-transform: capitalize; }
  .we-ctrl { display: flex; gap: 2px; }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    display: grid;
    place-items: center;
    color: var(--text-mute);
    transition: all var(--dur-fast);
  }
  .icon-btn:hover:not(:disabled) { background: var(--bg-4); color: var(--text); }
  .icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .icon-btn.danger:hover { color: var(--danger); }
  .icon-btn .mi { font-size: 16px; }
  .icon-btn.sm { width: 28px; height: 28px; }
  .icon-btn.sm .mi { font-size: 14px; }

  .sets {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-2);
  }
  .set-head, .set-row {
    display: grid;
    grid-template-columns: 36px 1fr 1fr 1fr 28px;
    gap: 6px;
    align-items: center;
  }
  .set-head.dur, .set-row.dur {
    grid-template-columns: 36px 1fr 28px;
  }
  .set-head.cardio, .set-row.cardio {
    grid-template-columns: 36px 1fr 1fr 28px;
  }
  .dur-input {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding-right: 8px;
  }
  .dur-input input {
    flex: 1;
    padding: 8px;
    background: transparent;
    border: 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
  }
  .dur-input input:focus { outline: none; }
  .dur-input:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .dur-input .suf {
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }
  .set-head {
    font-size: var(--fs-xs);
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 0;
    font-weight: 600;
  }
  .set-head span:not(:first-child) { text-align: center; }

  .set-row { padding: 4px 0; }
  .set-num {
    text-align: center;
    color: var(--accent);
    font-weight: 700;
  }
  .set-row input {
    padding: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
    width: 100%;
  }
  .set-row input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .set-del {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }
  .set-del:hover { background: var(--bg-3); color: var(--danger); }
  .set-del .mi { font-size: 14px; }

  .add-set {
    margin-top: var(--s-2);
    padding: 6px;
    width: 100%;
    border: 1px dashed var(--border);
    border-radius: var(--r-sm);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .add-set:hover { color: var(--accent); border-color: var(--accent); }
  .add-set .mi { font-size: 14px; }

  .rest-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--s-2);
    padding-top: var(--s-2);
    border-top: 1px solid var(--border);
  }
  .rest-lbl { font-size: var(--fs-xs); color: var(--text-mute); }
  .rest-input {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .rest-input input {
    width: 60px;
    padding: 4px 8px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--text);
    font-family: var(--font-mono);
    text-align: center;
    font-size: var(--fs-xs);
  }
  .rest-input .suf { font-size: var(--fs-xs); color: var(--text-mute); }

  .publish-row {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    justify-content: space-between;
  }
  .pub-t { font-weight: 700; font-size: var(--fs-sm); }
  .pub-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .pub-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(10px);
    z-index: 320;
    display: flex; justify-content: center; align-items: flex-end;
    animation: fade 200ms;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .pub-sheet {
    width: 100%; max-width: 520px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: var(--s-4) var(--s-4) calc(var(--s-6) + var(--safe-bottom));
  }
  .pub-handle {
    width: 40px; height: 4px;
    background: var(--bg-4);
    border-radius: var(--r-full);
    margin: 0 auto var(--s-3);
  }
  .pub-sheet h3 { font-size: var(--fs-lg); font-weight: 800; margin-bottom: 4px; }
  .pub-desc { color: var(--text-mute); font-size: var(--fs-sm); margin-bottom: var(--s-3); }
  .pub-sheet textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-md);
    line-height: 1.5;
    resize: vertical;
    min-height: 120px;
  }
  .pub-actions {
    display: flex; gap: var(--s-2);
    margin-top: var(--s-3);
  }

  .mode-row {
    display: flex;
    gap: var(--s-2);
    margin-bottom: var(--s-3);
  }
  .mode-btn {
    flex: 1;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 2px solid transparent;
    border-radius: var(--r-md);
    text-align: left;
    transition: border-color var(--dur-fast);
  }
  .mode-btn.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-3));
  }
  .mode-btn .mi { color: var(--accent); font-size: 22px; flex-shrink: 0; }
  .mb-t { font-weight: 700; font-size: var(--fs-sm); }
  .mb-s { font-size: 11px; color: var(--text-mute); margin-top: 2px; line-height: 1.4; }

  .recipient-wrap { margin-bottom: var(--s-3); }
  .recipient-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: var(--r-full);
    font-size: var(--fs-sm);
  }
  .recipient-pill button {
    width: 20px; height: 20px;
    display: grid; place-items: center;
    border-radius: 50%;
    color: var(--accent);
  }
  .rec-search {
    width: 100%;
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
  }
  .rec-hint { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 8px; }
  .rec-list {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }
  .rec-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--bg-3);
    border-radius: var(--r-sm);
    text-align: left;
  }
  .rec-ava {
    width: 32px; height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-4);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .rec-ava img { width: 100%; height: 100%; object-fit: cover; }
  .rec-name { font-size: var(--fs-sm); color: var(--text); }

  .save-error {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) var(--s-3);
    margin: var(--s-2) 0;
    background: color-mix(in oklab, var(--warning) 15%, transparent);
    border: 1px solid var(--warning);
    border-radius: var(--r-2);
    color: var(--warning);
    font-size: .875rem;
  }
  .footer {
    position: sticky;
    bottom: calc(var(--nav-h) + var(--safe-bottom) + var(--s-3));
    display: flex;
    gap: var(--s-2);
    padding: var(--s-3) 0;
    background: linear-gradient(to top, var(--bg-1) 60%, transparent);
    margin-top: var(--s-5);
  }

  /* Sheet */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade 200ms var(--ease-out);
  }
  .sheet {
    width: 100%;
    max-width: 640px;
    max-height: 85dvh;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: var(--s-3) var(--s-4) calc(var(--s-6) + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    animation: slide-up 300ms var(--ease-spring);
    overflow: hidden;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    background: var(--bg-4);
    border-radius: var(--r-full);
    margin: 0 auto var(--s-3);
    flex-shrink: 0;
  }
  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
  }
  .sheet-head h3 {
    font-size: var(--fs-lg);
    font-weight: 800;
  }
  .sheet-actions { display: flex; gap: 4px; }
  .picker-hint {
    font-size: 11px;
    color: var(--text-mute);
    text-align: center;
    margin-bottom: 6px;
  }
  .picker-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    overflow-y: auto;
    flex: 1;
    padding-bottom: var(--s-4);
  }
  .empty {
    text-align: center;
    color: var(--text-mute);
    padding: var(--s-6);
  }
  .empty .mi { font-size: 32px; color: var(--text-dim); display: block; margin-bottom: 8px; }

  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
