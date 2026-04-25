<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { historyStore } from '$lib/stores/history.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { fmtDateRelative, fmtDateShort, fmtKg } from '$lib/utils/format';
  import Sparkline from '$lib/components/Sparkline.svelte';
  import Badge from '$lib/components/Badge.svelte';

  const exerciseId = $derived(page.params.id ?? '');
  const ex = $derived(catalogStore.byId(exerciseId));
  let loading = $state(true);

  onMount(async () => {
    await catalogStore.ensure();
    if (exerciseId) await historyStore.ensure(exerciseId);
    loading = false;
  });

  const entries = $derived(exerciseId ? historyStore.get(exerciseId) : []);

  const values1RM = $derived.by(() =>
    [...entries].reverse().map((e) => e.estimated1RM ?? 0).filter((v) => v > 0)
  );
  const valuesVolume = $derived.by(() =>
    [...entries].reverse().map((e) => e.totalVolume).filter((v) => v > 0)
  );

  const best = $derived.by(() =>
    entries.reduce(
      (best, e) => ((e.estimated1RM ?? 0) > (best?.estimated1RM ?? 0) ? e : best),
      entries[0]
    )
  );

  function back() {
    if (history.length > 1) history.back();
    else goto('/treinos');
  }
</script>

<svelte:head>
  <title>{ex?.name ?? 'Exercício'} · FIBRA</title>
</svelte:head>

<div class="page">
  {#if ex}
    <div class="head">
      {#if ex.gifUrl}
        <img class="gif" src={ex.gifUrl} alt={ex.name} />
      {/if}
      <div class="head-info">
        <div class="muscle">
          {Array.isArray(ex.muscleGroup) ? ex.muscleGroup.join(' · ') : ex.muscleGroup}
        </div>
        <div class="tags">
          <Badge size="sm" variant="default">{ex.equipment}</Badge>
          {#if ex.tags}
            {#each ex.tags.slice(0, 3) as t (t)}
              <Badge size="sm" variant="default">{t}</Badge>
            {/each}
          {/if}
        </div>
        {#if ex.instructions}
          <p class="instructions">{ex.instructions}</p>
        {/if}
      </div>
    </div>

    <div class="body">
      {#if loading}
        <div class="loading"><span class="mi spin">progress_activity</span></div>
      {:else if entries.length === 0}
        <div class="empty-h">
          <span class="mi">history</span>
          <p>Sem histórico ainda. Comece um treino pra registrar.</p>
        </div>
      {:else}
        <div class="summary">
          <div class="sum-item">
            <div class="sum-lbl">Melhor 1RM</div>
            <div class="sum-val mono">{fmtKg(best?.estimated1RM)}<span>kg</span></div>
            <div class="sum-sub">
              {best?.topSet.weight}kg × {best?.topSet.reps}
              {#if best?.isPR}<span class="pr-chip">🏆 PR</span>{/if}
            </div>
          </div>
          <div class="sum-item">
            <div class="sum-lbl">Sessões</div>
            <div class="sum-val mono">{entries.length}</div>
            <div class="sum-sub">total</div>
          </div>
          <div class="sum-item">
            <div class="sum-lbl">Última</div>
            <div class="sum-val-sm">{fmtDateRelative(entries[0].date)}</div>
            <div class="sum-sub">{fmtDateShort(entries[0].date)}</div>
          </div>
        </div>

        {#if values1RM.length >= 2}
          <div class="chart-block">
            <div class="chart-head">
              <span>1RM estimado ao longo do tempo</span>
              <span class="mono">{fmtKg(values1RM[values1RM.length - 1])}kg</span>
            </div>
            <Sparkline values={values1RM} width={600} height={80} showDots />
          </div>
        {/if}

        {#if valuesVolume.length >= 2}
          <div class="chart-block">
            <div class="chart-head">
              <span>Volume por sessão (reps × carga)</span>
              <span class="mono">{Math.round(valuesVolume[valuesVolume.length - 1])} kg</span>
            </div>
            <Sparkline values={valuesVolume} width={600} height={60} color="var(--info)" showDots />
          </div>
        {/if}

        <div class="section-title">Histórico</div>
        <div class="log-list">
          {#each entries as e (e.id)}
            <div class="log-row" class:pr={e.isPR}>
              <div class="log-date">
                <div class="log-date-rel">{fmtDateRelative(e.date)}</div>
                <div class="log-date-iso">{fmtDateShort(e.date)}</div>
              </div>
              <div class="log-main">
                <div class="log-top mono">
                  <span class="lw">{e.topSet.weight}<span>kg</span></span>
                  <span class="lx">×</span>
                  <span class="lr">{e.topSet.reps}</span>
                </div>
                <div class="log-meta">
                  <span>1RM ~ {fmtKg(e.estimated1RM)}kg</span>
                  <span class="dot">·</span>
                  <span>vol {Math.round(e.totalVolume)}</span>
                </div>
              </div>
              {#if e.isPR}
                <div class="pr-badge-small">🏆 PR</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if !loading}
    <div class="empty-h">
      <span class="mi">error_outline</span>
      <p>Exercício não encontrado.</p>
    </div>
  {/if}
</div>

<style>
  .page {
    padding-bottom: calc(var(--nav-h) + var(--safe-bottom) + var(--s-5));
  }

  .head {
    display: flex;
    gap: var(--s-3);
    padding: 0 var(--s-4) var(--s-3);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--s-4);
  }
  .gif {
    width: 80px;
    height: 80px;
    border-radius: var(--r-md);
    object-fit: cover;
    flex-shrink: 0;
  }
  .head-info { flex: 1; min-width: 0; }
  .muscle {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    text-transform: capitalize;
    margin-bottom: 6px;
  }
  .tags { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: var(--s-2); }
  .instructions {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    line-height: 1.4;
  }

  .body {
    padding: 0 var(--s-4);
  }

  .loading {
    padding: var(--s-8);
    text-align: center;
  }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-h {
    text-align: center;
    padding: var(--s-8) var(--s-3);
    color: var(--text-mute);
  }
  .empty-h .mi { font-size: 40px; color: var(--text-dim); }
  .empty-h p { margin-top: var(--s-2); font-size: var(--fs-sm); }

  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
    margin-bottom: var(--s-5);
  }
  @media (max-width: 420px) {
    .summary { grid-template-columns: 1fr 1fr; }
  }
  .sum-item {
    padding: var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
  }
  .sum-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .sum-val {
    font-size: var(--fs-xl);
    font-weight: 800;
    color: var(--text);
    line-height: 1.1;
    margin: 4px 0 2px;
  }
  .sum-val span {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
  }
  .sum-val-sm {
    font-size: var(--fs-sm);
    font-weight: 700;
    margin: 4px 0 2px;
  }
  .sum-sub {
    font-size: 10px;
    color: var(--text-mute);
  }
  .pr-chip {
    display: inline-block;
    padding: 1px 6px;
    border-radius: var(--r-full);
    background: color-mix(in srgb, var(--warn) 20%, transparent);
    color: var(--warn);
    font-size: 9px;
    font-weight: 700;
    margin-left: 4px;
  }

  .chart-block {
    background: var(--bg-3);
    border-radius: var(--r-md);
    padding: var(--s-3);
    margin-bottom: var(--s-3);
  }
  .chart-block > :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }
  .chart-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--fs-xs);
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-bottom: var(--s-2);
  }
  .chart-head .mono { color: var(--accent); font-size: var(--fs-sm); }

  .section-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--s-5) 0 var(--s-2);
  }

  .log-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .log-row {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
    border: 1px solid transparent;
  }
  .log-row.pr {
    border-color: color-mix(in srgb, var(--warn) 40%, transparent);
    background: color-mix(in srgb, var(--warn) 8%, var(--bg-3));
  }
  .log-date { min-width: 80px; }
  .log-date-rel {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--text);
  }
  .log-date-iso {
    font-size: 10px;
    color: var(--text-mute);
    margin-top: 2px;
  }
  .log-main { flex: 1; }
  .log-top {
    font-size: var(--fs-md);
    font-weight: 800;
  }
  .log-top span { font-size: var(--fs-xs); color: var(--text-mute); }
  .log-top .lx { margin: 0 6px; color: var(--text-dim); }
  .log-top .lr { color: var(--accent); }
  .log-meta {
    font-size: 10px;
    color: var(--text-mute);
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }
  .log-meta .dot { color: var(--text-dim); }

  .pr-badge-small {
    background: var(--grad-fire);
    color: #fff;
    padding: 4px 10px;
    border-radius: var(--r-full);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
</style>
