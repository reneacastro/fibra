<script lang="ts">
  interface Props {
    size?: number;
    variant?: 'mark' | 'full';
    glow?: boolean;
  }
  let { size = 40, variant = 'mark', glow = false }: Props = $props();
</script>

{#if variant === 'mark'}
  <svg
    class="logo-mark"
    class:glow
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    aria-label="FIBRA"
  >
    <!-- F bold, cor chapada ciano, com slight italic pra energia -->
    <g transform="translate(1 0) skewX(-6)">
      <!-- Stem bem grosso -->
      <rect x="11" y="6" width="10" height="36" rx="1" fill="#00e5ff" />
      <!-- Braço superior, longo -->
      <rect x="11" y="6" width="28" height="10" rx="1" fill="#00e5ff" />
      <!-- Braço do meio, médio -->
      <rect x="11" y="21" width="20" height="9" rx="1" fill="#00e5ff" />
    </g>
  </svg>
{:else}
  <div class="logo-full" class:glow>
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <g transform="translate(1 0) skewX(-6)">
        <rect x="11" y="6" width="10" height="36" rx="1" fill="#00e5ff" />
        <rect x="11" y="6" width="28" height="10" rx="1" fill="#00e5ff" />
        <rect x="11" y="21" width="20" height="9" rx="1" fill="#00e5ff" />
      </g>
    </svg>
    <span class="wordmark">FIBRA</span>
  </div>
{/if}

<style>
  .logo-mark {
    display: block;
  }
  .glow {
    filter: drop-shadow(0 0 10px rgba(0, 229, 255, 0.6))
            drop-shadow(0 0 20px rgba(0, 229, 255, 0.25));
  }
  .logo-full {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
  }
  .wordmark {
    font-weight: 800;
    font-size: var(--fs-xl);
    letter-spacing: 0.18em;
    color: #00e5ff;
  }
</style>
