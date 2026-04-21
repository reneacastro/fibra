<script lang="ts">
  import { onMount } from 'svelte';
  import { historyStore } from '$lib/stores/history.svelte';
  import { fmtDateRelative, fmtKg } from '$lib/utils/format';
  import Sparkline from './Sparkline.svelte';

  interface Props {
    exerciseId: string;
    onOpenDetail?: () => void;
  }

  let { exerciseId, onOpenDetail }: Props = $props();

  onMount(() => { historyStore.ensure(exerciseId); });

  const entries = $derived(historyStore.get(exerciseId));

  const last = $derived(entries[0]);
  const best1RM = $derived.by(() => {
    return entries.reduce((max, e) => Math.max(max, e.estimated1RM ?? 0), 0);
  });
  const pr = $derived(entries.find((e) => e.isPR));
  const sparklineValues = $derived.by(() => {
    return [...entries]
      .slice(0, 20)
      .reverse()
      .map((e) => e.estimated1RM ?? e.topSet.weight ?? 0)
      .filter((v) => v > 0);
  });

  const delta = $derived.by(() => {
    if (entries.length < 2) return null;
    const newest = entries[0].estimated1RM ?? 0;
    const older = entries[1].estimated1RM ?? 0;
    if (!older) return null;
    return ((newest - older) / older) * 100;
  });
</script>

{#if entries.length === 0}
  <div class="hist empty">
    <span class="mi">history</span>
    <span>Primeira vez — sem histórico ainda</span>
  </div>
{:else}
  <button class="hist" onclick={onOpenDetail} disabled={!onOpenDetail}>
    <div class="hist-stats">
      <div class="stat">
        <div class="stat-lbl">Último</div>
        <div class="stat-val mono">
          {fmtKg(last.topSet.weight)}<span class="unit">kg</span>
          <span class="reps">×{last.topSet.reps}</span>
        </div>
        <div class="stat-sub">{fmtDateRelative(last.date)}</div>
      </div>

      {#if best1RM > 0}
        <div class="stat">
          <div class="stat-lbl">Melhor 1RM</div>
          <div class="stat-val mono">
            {fmtKg(best1RM)}<span class="unit">kg</span>
            {#if pr}<span class="trophy">🏆</span>{/if}
          </div>
          <div class="stat-sub">
            {#if delta !== null}
              <span class:up={delta > 0.1} class:down={delta < -0.1}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs anterior
              </span>
            {:else}
              estimado
            {/if}
          </div>
        </div>
      {/if}
    </div>

    {#if sparklineValues.length >= 2}
      <div class="hist-spark">
        <Sparkline values={sparklineValues} width={100} height={36} />
      </div>
    {/if}

    {#if onOpenDetail}
      <span class="mi chev">chevron_right</span>
    {/if}
  </button>
{/if}

<style>
  .hist {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-3);
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    width: 100%;
    text-align: left;
    transition: background var(--dur-fast);
  }
  .hist:not(:disabled):hover {
    background: var(--bg-3);
    border-color: var(--border-strong);
  }
  .hist:disabled { cursor: default; }

  .hist.empty {
    color: var(--text-mute);
    font-size: var(--fs-xs);
    gap: var(--s-2);
    padding: var(--s-2) var(--s-3);
  }
  .hist.empty .mi { font-size: 16px; }

  .hist-stats {
    display: flex;
    gap: var(--s-5);
    flex: 1;
    min-width: 0;
  }

  .stat { min-width: 0; }
  .stat-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 2px;
  }
  .stat-val {
    font-size: var(--fs-lg);
    font-weight: 800;
    color: var(--text);
    line-height: 1.1;
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .stat-val .unit {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
  }
  .stat-val .reps {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
    margin-left: 4px;
  }
  .stat-val .trophy { font-size: 14px; margin-left: 4px; }
  .stat-sub {
    font-size: 10px;
    color: var(--text-mute);
    margin-top: 2px;
  }
  .stat-sub .up { color: var(--success); font-weight: 600; }
  .stat-sub .down { color: var(--danger); font-weight: 600; }

  .hist-spark {
    flex-shrink: 0;
  }

  .chev {
    color: var(--text-dim);
    font-size: 18px;
    flex-shrink: 0;
  }
</style>
