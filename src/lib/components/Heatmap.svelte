<script lang="ts">
  interface Props {
    /** Mapa { 'YYYY-MM-DD': intensidade (0-4) } */
    data: Record<string, number>;
    weeks?: number;
  }

  let { data, weeks = 17 }: Props = $props();

  const grid = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Alinha sábado no fim
    const end = new Date(today);
    const days: { date: string; value: number; isToday: boolean }[] = [];
    const totalDays = weeks * 7;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        value: data[iso] ?? 0,
        isToday: iso === today.toISOString().slice(0, 10)
      });
    }
    // Agrupa em colunas de 7 (semanas)
    const cols: { date: string; value: number; isToday: boolean }[][] = [];
    for (let w = 0; w < weeks; w++) {
      cols.push(days.slice(w * 7, (w + 1) * 7));
    }
    return cols;
  });

  const monthLabels = $derived.by(() => {
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const seen = new Set<number>();
    return grid.map((col) => {
      const d = new Date(col[0]?.date ?? '');
      const m = d.getMonth();
      if (!seen.has(m) && d.getDate() <= 7) {
        seen.add(m);
        return MONTHS[m];
      }
      return '';
    });
  });
</script>

<div class="heat">
  <div class="head-row">
    {#each monthLabels as m, i (i)}
      <span class="month" style="grid-column: {i + 1}">{m}</span>
    {/each}
  </div>
  <div class="grid" style="grid-template-columns: repeat({weeks}, 1fr)">
    {#each grid as col, ci (ci)}
      <div class="col">
        {#each col as d (d.date)}
          <div
            class="cell v-{d.value}"
            class:today={d.isToday}
            title="{d.date} — {d.value > 0 ? d.value + ' treino' + (d.value > 1 ? 's' : '') : 'nenhum treino'}"
          ></div>
        {/each}
      </div>
    {/each}
  </div>
  <div class="legend">
    <span class="l-lbl">Menos</span>
    <div class="cell v-0"></div>
    <div class="cell v-1"></div>
    <div class="cell v-2"></div>
    <div class="cell v-3"></div>
    <div class="cell v-4"></div>
    <span class="l-lbl">Mais</span>
  </div>
</div>

<style>
  .heat { width: 100%; }

  .head-row {
    display: grid;
    grid-auto-flow: column;
    margin-bottom: 4px;
  }
  .month {
    font-size: 10px;
    color: var(--text-dim);
    font-weight: 600;
  }

  .grid {
    display: grid;
    gap: 3px;
  }
  .col {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
  }

  .cell {
    aspect-ratio: 1;
    border-radius: 3px;
    background: var(--bg-3);
    transition: transform var(--dur-fast);
  }
  .cell:hover { transform: scale(1.4); cursor: pointer; }

  .cell.v-0 { background: var(--bg-3); }
  .cell.v-1 { background: color-mix(in srgb, var(--accent) 30%, var(--bg-3)); }
  .cell.v-2 { background: color-mix(in srgb, var(--accent) 55%, var(--bg-3)); }
  .cell.v-3 { background: color-mix(in srgb, var(--accent) 80%, var(--bg-3)); }
  .cell.v-4 { background: var(--accent); }

  .cell.today {
    box-shadow: 0 0 0 1.5px var(--text);
  }

  .legend {
    display: flex;
    gap: 3px;
    align-items: center;
    justify-content: flex-end;
    margin-top: var(--s-2);
  }
  .legend .cell { width: 12px; aspect-ratio: 1; }
  .l-lbl { font-size: 10px; color: var(--text-dim); }
</style>
