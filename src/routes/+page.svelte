<script lang="ts">
  import Logo from '$lib/components/Logo.svelte';
  // Landing redirecionadora: layout decide pra onde mandar
</script>

<div class="splash">
  <Logo size={96} glow />
  <h1>FIBRA</h1>
  <p>O que te constrói.</p>
</div>

<style>
  .splash {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--s-3);
  }
  h1 {
    font-size: var(--fs-3xl);
    font-weight: 800;
    letter-spacing: 0.24em;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  p { color: var(--text-mute); font-size: var(--fs-sm); }
</style>
