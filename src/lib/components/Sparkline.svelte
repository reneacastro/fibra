<script lang="ts">
  interface Props {
    values: number[];
    width?: number;
    height?: number;
    color?: string;
    showDots?: boolean;
    highlightLast?: boolean;
  }

  let {
    values,
    width = 120,
    height = 32,
    color = 'var(--accent)',
    showDots = false,
    highlightLast = true
  }: Props = $props();

  const path = $derived.by(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  });

  const area = $derived.by(() => {
    if (!path) return '';
    return `${path} L ${width} ${height} L 0 ${height} Z`;
  });

  const lastPoint = $derived.by(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const i = values.length - 1;
    return { x: i * step, y: height - ((values[i] - min) / range) * (height - 4) - 2 };
  });
</script>

{#if values.length < 2}
  <div class="no-data" style="width:{width}px;height:{height}px">
    <span class="mi">trending_flat</span>
  </div>
{:else}
  <svg
    width={width}
    height={height}
    viewBox="0 0 {width} {height}"
    style="--line:{color}"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={color} stop-opacity="0.3" />
        <stop offset="100%" stop-color={color} stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d={area} fill="url(#spark-fill)" />
    <path d={path} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    {#if showDots}
      {#each values as v, i (i)}
        {@const min = Math.min(...values)}
        {@const max = Math.max(...values)}
        {@const range = max - min || 1}
        {@const step = width / (values.length - 1)}
        <circle cx={i * step} cy={height - ((v - min) / range) * (height - 4) - 2} r="1.5" fill={color} />
      {/each}
    {/if}
    {#if highlightLast && lastPoint}
      <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={color} />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill={color} fill-opacity="0.2" />
    {/if}
  </svg>
{/if}

<style>
  .no-data {
    display: grid;
    place-items: center;
    color: var(--text-dim);
  }
  .no-data .mi { font-size: 16px; }
</style>
