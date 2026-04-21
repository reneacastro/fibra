<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  const tabs = [
    { href: '/home',      icon: 'home',            label: 'Início' },
    { href: '/treinos',   icon: 'fitness_center',  label: 'Treinos' },
    { href: '/registrar', icon: 'add',             label: 'Registrar', center: true },
    { href: '/dieta',     icon: 'restaurant',      label: 'Dieta' },
    { href: '/progresso', icon: 'insights',        label: 'Progresso' }
  ];

  function isActive(href: string) {
    return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
  }
</script>

<nav class="bnav" aria-label="Navegação principal">
  <div class="bnav-inner">
    {#each tabs as t (t.href)}
      {@const active = isActive(t.href)}
      <button
        class="bnav-btn"
        class:active
        class:center={t.center}
        onclick={() => goto(t.href)}
        aria-label={t.label}
        aria-current={active ? 'page' : undefined}
      >
        <span class="mi" class:filled={active}>{t.icon}</span>
        <span class="lbl">{t.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  .bnav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 100;
    padding: var(--s-2) var(--s-3) calc(var(--s-2) + var(--safe-bottom));
    background: linear-gradient(to top, var(--bg-1) 60%, transparent);
    pointer-events: none;
  }
  .bnav-inner {
    pointer-events: auto;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    gap: 4px;
    max-width: 560px;
    margin: 0 auto;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    padding: 6px;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(20px);
  }

  .bnav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 8px 4px;
    border-radius: var(--r-full);
    color: var(--text-dim);
    transition: color var(--dur-fast), background var(--dur-fast), transform var(--dur-fast);
    min-height: 52px;
  }
  .bnav-btn .mi {
    font-size: 22px;
  }
  .bnav-btn .lbl {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .bnav-btn:hover {
    color: var(--text-mute);
  }
  .bnav-btn.active {
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .bnav-btn.active .mi {
    font-variation-settings: 'FILL' 1, 'wght' 600;
  }

  .bnav-btn.center {
    position: relative;
    background: var(--grad-primary);
    color: var(--bg-0);
    transform: translateY(-16px);
    width: 56px;
    height: 56px;
    justify-self: center;
    box-shadow: var(--shadow-lg), var(--shadow-glow);
  }
  .bnav-btn.center .mi {
    font-size: 28px;
  }
  .bnav-btn.center .lbl {
    position: absolute;
    bottom: -18px;
    color: var(--text-mute);
  }
  .bnav-btn.center.active {
    background: var(--grad-primary);
    color: var(--bg-0);
  }
</style>
