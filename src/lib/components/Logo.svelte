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
    <defs>
      <linearGradient id="fibra-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00e5ff" />
        <stop offset="60%" stop-color="#7c3aed" />
        <stop offset="100%" stop-color="#ff3da8" />
      </linearGradient>
    </defs>
    <g transform="translate(2 0) skewX(-9)">
      <!-- Stem do F: mais grosso em cima, afila embaixo -->
      <path d="M 9 7 Q 10 6 13 6 L 17 6 Q 17 8 16.5 9 L 15 40 Q 14 42 12 42 Q 10 42 10 40 Z" fill="url(#fibra-grad)" />
      <!-- Braço superior (mais longo, acento em brasa no fim) -->
      <rect x="10" y="6" width="30" height="7" rx="3.5" fill="url(#fibra-grad)" />
      <!-- Braço do meio (mais curto, inset, energético) -->
      <rect x="11" y="19" width="20" height="7" rx="3.5" fill="url(#fibra-grad)" opacity="0.95" />
      <!-- Risco oblíquo entre os braços — "fibra" em movimento -->
      <rect x="32" y="17" width="4" height="2.2" rx="1" fill="#ff3da8" opacity="0.9" transform="rotate(-20 34 18)" />
    </g>
    <!-- Spark orbital no canto superior direito -->
    <circle cx="40" cy="9" r="2.4" fill="#00e5ff" />
    <circle cx="40" cy="9" r="5.5" fill="#00e5ff" opacity="0.25" />
  </svg>
{:else}
  <div class="logo-full" class:glow>
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="fibra-grad-f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#00e5ff" />
          <stop offset="60%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#ff3da8" />
        </linearGradient>
      </defs>
      <g transform="translate(2 0) skewX(-9)">
        <path d="M 9 7 Q 10 6 13 6 L 17 6 Q 17 8 16.5 9 L 15 40 Q 14 42 12 42 Q 10 42 10 40 Z" fill="url(#fibra-grad-f)" />
        <rect x="10" y="6" width="30" height="7" rx="3.5" fill="url(#fibra-grad-f)" />
        <rect x="11" y="19" width="20" height="7" rx="3.5" fill="url(#fibra-grad-f)" opacity="0.95" />
        <rect x="32" y="17" width="4" height="2.2" rx="1" fill="#ff3da8" opacity="0.9" transform="rotate(-20 34 18)" />
      </g>
      <circle cx="40" cy="9" r="2.4" fill="#00e5ff" />
      <circle cx="40" cy="9" r="5.5" fill="#00e5ff" opacity="0.25" />
    </svg>
    <span class="wordmark">FIBRA</span>
  </div>
{/if}

<style>
  .logo-mark {
    display: block;
  }
  .glow {
    filter: drop-shadow(0 0 12px rgba(0, 229, 255, 0.4));
  }
  .logo-full {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
  }
  .wordmark {
    font-weight: 800;
    font-size: var(--fs-xl);
    letter-spacing: 0.2em;
    background: linear-gradient(135deg, #00e5ff, #7c3aed);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
</style>
