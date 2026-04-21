<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Logo from '$lib/components/Logo.svelte';

  let mode = $state<'signin' | 'signup'>('signin');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);

  async function google() {
    busy = true;
    try { await authStore.signInGoogle(); } finally { busy = false; }
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    try {
      if (mode === 'signin') {
        await authStore.signInEmail(email, password);
      } else {
        await authStore.signUpEmail(email, password);
      }
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap">
  <div class="card">
    <div class="mark-wrap"><Logo size={72} glow /></div>
    <h1>FIBRA</h1>
    <p class="tagline">O que te constrói.</p>
    <p class="sub">
      {mode === 'signin' ? 'Entre pra continuar com fibra' : 'Crie sua conta e comece agora'}
    </p>

    <Button variant="secondary" icon="login" size="lg" full disabled={busy} onclick={google}>
      Continuar com Google
    </Button>

    <div class="sep"><span>ou com e-mail</span></div>

    <form onsubmit={submit} class="form">
      <Input
        type="email"
        label="E-mail"
        icon="mail"
        placeholder="voce@email.com"
        bind:value={email}
        required
        autocomplete="email"
      />
      <Input
        type="password"
        label="Senha"
        icon="lock"
        placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
        bind:value={password}
        required
        minlength={6}
        autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
      />

      {#if authStore.error}
        <div class="err">{authStore.error}</div>
      {/if}

      <Button type="submit" size="lg" full loading={busy}>
        {mode === 'signin' ? 'Entrar' : 'Criar conta'}
      </Button>
    </form>

    <button class="toggle" onclick={() => (mode = mode === 'signin' ? 'signup' : 'signin')}>
      {mode === 'signin' ? 'Não tem conta? Criar agora' : 'Já tenho conta, entrar'}
    </button>
  </div>
</div>

<style>
  .wrap {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--s-6) var(--s-4);
    background: var(--grad-hero), var(--bg-1);
  }

  .card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-2xl);
    padding: var(--s-8) var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    box-shadow: var(--shadow-lg);
  }

  .mark-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: var(--s-2);
  }

  h1 {
    text-align: center;
    font-size: var(--fs-3xl);
    font-weight: 800;
    letter-spacing: 0.24em;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tagline {
    text-align: center;
    color: var(--text-mute);
    font-size: var(--fs-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .sub {
    text-align: center;
    color: var(--text-mute);
    margin: var(--s-3) 0 var(--s-2);
  }

  .sep {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    color: var(--text-dim);
    font-size: var(--fs-xs);
    margin: var(--s-2) 0;
  }
  .sep::before,
  .sep::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .err {
    padding: var(--s-3);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
    font-size: var(--fs-sm);
    text-align: center;
  }

  .toggle {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    text-align: center;
    padding: var(--s-2);
    margin-top: var(--s-2);
  }
  .toggle:hover { color: var(--accent); }
</style>
