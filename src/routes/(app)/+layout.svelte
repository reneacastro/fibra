<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { page } from '$app/state';

  let { children } = $props();

  const TITLES: Record<string, { t: string; s?: string; back?: boolean }> = {
    '/home':        { t: 'FIBRA', s: 'O que te constrói.' },
    '/treinos':     { t: 'Treinos', s: 'Seus planos e o banco de exercícios' },
    '/registrar':   { t: 'Registrar', s: 'Começar ou salvar um treino' },
    '/progresso':   { t: 'Progresso', s: 'Suas fibras em números' },
    '/corpo':       { t: 'Composição', s: 'Bioimpedância e medidas', back: true },
    '/dieta':       { t: 'Dieta', s: 'Macros e rotina alimentar' },
    '/instalar':    { t: 'Instalar app', s: 'Salvar na tela inicial', back: true },
    '/perfil':      { t: 'Perfil', s: 'Seus dados e ajustes', back: true }
  };

  const meta = $derived.by(() => {
    const p = page.url.pathname;
    if (p === '/treinos/novo') return { t: 'Novo treino', s: 'Monte seu plano', back: true };
    if (p.startsWith('/treinos/')) return { t: 'Editar treino', s: 'Ajustes e exercícios', back: true };
    if (p.startsWith('/sessao/')) return { t: 'Detalhes do treino', s: 'Revisar e compartilhar', back: true };
    if (p.startsWith('/registrar/')) return { t: 'Treino em andamento', s: 'Foco total', back: true };
    return TITLES[p] ?? { t: 'FIBRA' };
  });
</script>

<div class="app-shell">
  <Header title={meta.t} subtitle={meta.s} showBack={meta.back} />
  <main class="app-main">
    {@render children()}
  </main>
  <BottomNav />
</div>

<style>
  .app-shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
  .app-main {
    flex: 1;
    padding: var(--s-4) var(--s-4) calc(var(--nav-h) + var(--s-8) + var(--safe-bottom));
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
  }
</style>
