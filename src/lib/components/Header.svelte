<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import Logo from './Logo.svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    showBack?: boolean;
  }

  let { title = 'FIBRA', subtitle, showBack = false }: Props = $props();

  function back() {
    history.length > 1 ? history.back() : goto('/home');
  }
</script>

<header class="hdr">
  {#if showBack}
    <button class="icon-btn" onclick={back} aria-label="Voltar">
      <span class="mi">arrow_back_ios_new</span>
    </button>
  {:else}
    <Logo size={36} glow />
  {/if}

  <div class="hdr-title">
    <div class="t">{title}</div>
    {#if subtitle}<div class="s">{subtitle}</div>{/if}
  </div>

  {#if authStore.user}
    <button class="avatar-btn" onclick={() => goto('/perfil')} aria-label="Perfil">
      {#if authStore.user.photoURL}
        <img src={authStore.user.photoURL} alt="Perfil" referrerpolicy="no-referrer" />
      {:else}
        <span class="mi">account_circle</span>
      {/if}
    </button>
  {/if}
</header>

<style>
  .hdr {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: calc(var(--s-3) + var(--safe-top)) var(--s-4) var(--s-3);
    background: color-mix(in srgb, var(--bg-1) 92%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }

  .icon-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--r-full);
    display: grid;
    place-items: center;
    color: var(--text);
    background: var(--bg-3);
    border: 1px solid var(--border);
    transition: background var(--dur-fast);
  }
  .icon-btn:hover { background: var(--bg-4); }
  .icon-btn .mi { font-size: 20px; }

  .avatar-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    border: 2px solid var(--accent);
    display: grid;
    place-items: center;
    color: var(--text);
    transition: transform var(--dur-fast);
  }
  .avatar-btn:hover { transform: scale(1.05); }
  .avatar-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-btn .mi { font-size: 22px; }

  .hdr-title {
    flex: 1;
    min-width: 0;
  }
  .t {
    font-weight: 800;
    font-size: var(--fs-lg);
    letter-spacing: -0.01em;
  }
  .s {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 500;
  }
</style>
