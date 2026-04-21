<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Series {
    label: string;
    data: number[];
    color?: string;
    fill?: boolean;
  }

  interface Props {
    labels: string[];
    series: Series[];
    height?: number;
    yMin?: number;
    yMax?: number;
  }

  let { labels, series, height = 220, yMin, yMax }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: any = null;

  async function draw() {
    if (!canvas) return;
    const Chart = (await import('chart.js/auto')).default;
    chart?.destroy();
    const datasets = series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color ?? '#00e5ff',
      backgroundColor: s.fill ? toRGBA(s.color ?? '#00e5ff', 0.2) : 'transparent',
      fill: s.fill ?? false,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: s.color ?? '#00e5ff'
    }));

    chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: series.length > 1,
            labels: { color: '#8b949e', font: { size: 11, family: 'Plus Jakarta Sans' } }
          },
          tooltip: {
            backgroundColor: '#161b22',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6e7681', font: { size: 10 } }
          },
          y: {
            min: yMin,
            max: yMax,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6e7681', font: { size: 10 } }
          }
        }
      }
    });
  }

  function toRGBA(hex: string, a: number) {
    if (hex.startsWith('rgb')) return hex;
    const h = hex.replace('#', '');
    const b = h.length === 3
      ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return `rgba(${b[0]},${b[1]},${b[2]},${a})`;
  }

  onMount(draw);
  $effect(() => {
    // Redesenha quando labels ou series mudam
    labels; series;
    if (chart) draw();
  });
  onDestroy(() => chart?.destroy());
</script>

<div class="chart-wrap" style="height:{height}px">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-wrap {
    position: relative;
    width: 100%;
  }
</style>
