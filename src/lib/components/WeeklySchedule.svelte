<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listWorkouts } from '$lib/db/workouts';
  import { getSchedule, saveSchedule, emptySchedule } from '$lib/db/schedule';
  import type { Schedule, Workout } from '$lib/types';
  import { DAYS_PT, DAYS_PT_FULL, CATEGORY_ICON } from '$lib/utils/format';
  import Button from './Button.svelte';

  let schedule = $state<Schedule>(emptySchedule());
  let workouts = $state<Workout[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let dirty = $state(false);
  let openDay = $state<number | null>(null);

  onMount(async () => {
    if (!authStore.uid) return;
    const [s, ws] = await Promise.all([
      getSchedule(authStore.uid),
      listWorkouts(authStore.uid)
    ]);
    if (s) schedule = s;
    workouts = ws;
    loading = false;
  });

  function toggleWorkout(day: number, workoutId: string) {
    const d = schedule.days[day];
    const next = { ...d };
    if (next.workoutIds.includes(workoutId)) {
      next.workoutIds = next.workoutIds.filter((id) => id !== workoutId);
    } else {
      next.workoutIds = [...next.workoutIds, workoutId];
    }
    next.rest = next.workoutIds.length === 0;
    schedule = { ...schedule, days: { ...schedule.days, [day]: next } };
    dirty = true;
  }

  function setRest(day: number) {
    schedule = {
      ...schedule,
      days: { ...schedule.days, [day]: { workoutIds: [], rest: true } }
    };
    dirty = true;
  }

  async function save() {
    if (!authStore.uid || !dirty) return;
    saving = true;
    try {
      await saveSchedule(authStore.uid, schedule);
      dirty = false;
    } finally {
      saving = false;
    }
  }

  const today = new Date().getDay();

  function workoutName(id: string) {
    return workouts.find((w) => w.id === id)?.name ?? 'Treino removido';
  }
  function workoutCat(id: string) {
    return workouts.find((w) => w.id === id)?.category ?? 'livre';
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else}
  <div class="grid">
    {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}
      {@const day = schedule.days[d]}
      {@const isToday = d === today}
      <button
        class="day"
        class:today={isToday}
        class:rest={day.rest}
        class:open={openDay === d}
        onclick={() => (openDay = openDay === d ? null : d)}
      >
        <div class="day-label">{DAYS_PT[d]}</div>
        {#if day.rest}
          <div class="day-content rest-txt">
            <span class="mi">hotel</span>
            <span>Descanso</span>
          </div>
        {:else}
          <div class="day-content">
            {#each day.workoutIds as wid (wid)}
              <span class="chip">{CATEGORY_ICON[workoutCat(wid)]} {workoutName(wid)}</span>
            {/each}
          </div>
        {/if}
      </button>
    {/each}
  </div>

  {#if openDay !== null}
    <div class="picker">
      <div class="picker-head">
        <h4>{DAYS_PT_FULL[openDay]}</h4>
        <button class="close-btn" onclick={() => (openDay = null)} aria-label="Fechar">
          <span class="mi">close</span>
        </button>
      </div>

      <button class="opt-rest" class:sel={schedule.days[openDay].rest} onclick={() => setRest(openDay!)}>
        <span class="mi">hotel</span>
        <span>Dia de descanso</span>
      </button>

      {#if workouts.length === 0}
        <div class="no-w">Monte um treino antes pra agendar aqui.</div>
      {:else}
        <div class="opts">
          {#each workouts as w (w.id)}
            {@const sel = schedule.days[openDay].workoutIds.includes(w.id)}
            <button class="opt" class:sel onclick={() => toggleWorkout(openDay!, w.id)}>
              <span class="ic">{CATEGORY_ICON[w.category]}</span>
              <span class="lbl">{w.name}</span>
              {#if sel}<span class="mi check">check</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if dirty}
    <div class="save-row">
      <Button icon="save" full loading={saving} onclick={save}>Salvar grade</Button>
    </div>
  {/if}
{/if}

<style>
  .loading { padding: var(--s-4); text-align: center; }
  .loading .mi { font-size: 24px; color: var(--accent); animation: spin 1s linear infinite; }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  /* Em mobile narrow, vira scroll horizontal pra não cortar dias */
  @media (max-width: 480px) {
    .grid {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .grid::-webkit-scrollbar { display: none; }
    .day {
      flex: 0 0 calc((100% - 24px) / 4);
      scroll-snap-align: start;
    }
  }
  .day {
    padding: var(--s-2);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 80px;
    transition: all var(--dur-fast);
    color: var(--text);
  }
  .day:hover { background: var(--bg-4); }
  .day.open { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .day.today {
    background: color-mix(in srgb, var(--accent) 12%, var(--bg-3));
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  }
  .day.rest { opacity: 0.7; }

  .day-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    text-align: center;
  }
  .today .day-label { color: var(--accent); }

  .day-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    align-items: center;
    min-height: 40px;
  }
  .rest-txt {
    color: var(--text-dim);
    font-size: 10px;
    gap: 2px;
  }
  .rest-txt .mi { font-size: 14px; }

  .chip {
    font-size: 10px;
    padding: 2px 4px;
    border-radius: var(--r-sm);
    background: var(--bg-2);
    color: var(--text);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .picker {
    margin-top: var(--s-3);
    padding: var(--s-4);
    background: var(--bg-3);
    border: 1px solid var(--accent);
    border-radius: var(--r-lg);
  }
  .picker-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
  }
  .picker-head h4 { font-weight: 700; font-size: var(--fs-md); }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: var(--text-mute);
  }
  .close-btn .mi { font-size: 18px; }

  .opt-rest, .opt {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-3);
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 500;
    margin-bottom: 4px;
    text-align: left;
    transition: all var(--dur-fast);
  }
  .opt-rest:hover, .opt:hover { background: var(--bg-4); }
  .opt-rest.sel, .opt.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }
  .opt .ic { font-size: 18px; }
  .opt .lbl { flex: 1; }
  .opt .check { color: var(--accent); font-weight: 800; }

  .no-w {
    padding: var(--s-3);
    text-align: center;
    color: var(--text-mute);
    font-size: var(--fs-sm);
  }

  .save-row {
    margin-top: var(--s-3);
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
