<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth.svelte';
  import { browser } from '$app/environment';
  import Logo from '$lib/components/Logo.svelte';

  let { children } = $props();

  const LOGIN_ONLY_ROUTES = ['/login', '/reset'];

  $effect(() => {
    if (!browser || authStore.loading) return;
    const pathname = page.url.pathname;
    const isLoginOnly = LOGIN_ONLY_ROUTES.includes(pathname);

    if (!authStore.user) {
      if (!isLoginOnly) goto('/login');
    } else {
      if (pathname === '/' || isLoginOnly) goto('/home');
    }
  });

  onMount(() => {
    // Theme color meta update
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#07090d');

    // Tenta travar orientação portrait (funciona em PWAs instalados Android)
    const scr = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    scr?.lock?.('portrait').catch(() => {});

    // Previne pinch-zoom em iOS Safari mesmo se o meta viewport falhar
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
  });
</script>

{#if authStore.loading}
  <div class="boot">
    <Logo size={72} glow />
    <div class="boot-text">FIBRA</div>
    <div class="boot-spinner"></div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .boot {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    gap: var(--s-4);
    justify-items: center;
    background: var(--bg-1);
  }
  .boot-text {
    font-weight: 800;
    font-size: var(--fs-2xl);
    letter-spacing: 0.24em;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .boot-spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 600ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
