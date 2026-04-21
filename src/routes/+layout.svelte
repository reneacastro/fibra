<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth.svelte';
  import { browser } from '$app/environment';
  import Logo from '$lib/components/Logo.svelte';
  import { APP_VERSION, VERSION_STORAGE_KEY } from '$lib/version';

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

  onMount(async () => {
    // 1) Check de versão REMOTA — fetcha /version.json com no-store.
    //    Se a versão no servidor for diferente da bundled, o client está
    //    rodando código velho (típico de PWA iOS sem F5). Força reload
    //    e limpa cache do browser pra baixar o bundle novo.
    try {
      const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const remote = await res.json() as { version: string };
        if (remote.version && remote.version !== APP_VERSION) {
          console.info(`[FIBRA] servidor tem ${remote.version}, cliente em ${APP_VERSION}. Recarregando…`);
          // Limpa Cache Storage (cobre SW se existir no futuro)
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          // Reload hard, evita voltar ao HTML em cache
          location.reload();
          return;
        }
      }
    } catch {
      // Sem rede — segue com o que tem em cache
    }

    // 2) Check de versão LOCAL — se o APP_VERSION bumpou desde a última
    //    sessão, força re-login pra usuário sair do cache do Firestore.
    try {
      const stored = localStorage.getItem(VERSION_STORAGE_KEY);
      if (stored && stored !== APP_VERSION && authStore.user) {
        console.info(`[FIBRA] app atualizado ${stored} → ${APP_VERSION}, re-login`);
        await authStore.signOut();
      }
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    } catch {
      // localStorage bloqueado — segue sem version gate
    }

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
