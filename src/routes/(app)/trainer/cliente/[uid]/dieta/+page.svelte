<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getRelationship } from '$lib/db/relationships';
  import { getActiveDietPlan } from '$lib/db/diet';
  import type { Relationship, DietPlan } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { withTimeout } from '$lib/utils/withTimeout';
  import PlanoEditor from '../../../../dieta/PlanoEditor.svelte';

  const clientUid = page.params.uid!;

  let rel = $state<Relationship | null>(null);
  let plan = $state<DietPlan | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let savedTick = $state(false);

  async function load() {
    if (!authStore.uid) return;
    loading = true;
    loadError = null;
    try {
      const r = await getRelationship(authStore.uid, clientUid);
      if (!r || r.status !== 'active') {
        loadError = 'Vínculo inativo.';
        return;
      }
      if (!r.scope.includes('diet')) {
        loadError = 'Sem permissão de dieta. Peça pro cliente aceitar escopo "dieta".';
        return;
      }
      rel = r;
      plan = await withTimeout(getActiveDietPlan(clientUid), 10_000, 'plano do cliente');
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  async function handleSaved() {
    savedTick = true;
    setTimeout(() => (savedTick = false), 2400);
    // recarrega o plano atualizado
    if (rel) plan = await getActiveDietPlan(clientUid);
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if loadError || !rel}
  <Card>
    <div class="empty">
      <span class="mi">error</span>
      <h2>Não foi possível abrir a dieta</h2>
      <p>{loadError ?? 'Vínculo inexistente.'}</p>
      <Button onclick={() => goto(`/trainer/cliente/${clientUid}`)}>Voltar</Button>
    </div>
  </Card>
{:else}
  <div class="hero">
    <div class="avatar">
      {#if rel.clientAvatar?.startsWith('http')}
        <img src={rel.clientAvatar} alt={rel.clientName} />
      {:else}
        <span>{rel.clientAvatar || '🔥'}</span>
      {/if}
    </div>
    <div>
      <h1>Dieta de {rel.clientName}</h1>
      <Badge variant="accent">🥗 Escopo: dieta</Badge>
    </div>
  </div>

  {#if savedTick}
    <div class="toast">✓ Plano salvo no app do cliente</div>
  {/if}

  <div class="note">
    <span class="mi">info</span>
    <span>Você está editando o plano alimentar no app de <strong>{rel.clientName}</strong>.
      Ele vai ver as mudanças na hora no /dieta dele.</span>
  </div>

  <PlanoEditor {plan} targetUid={clientUid} onSaved={handleSaved} />

  <div class="footer-back">
    <Button variant="ghost" icon="arrow_back" onclick={() => goto(`/trainer/cliente/${clientUid}`)}>
      Voltar pro cliente
    </Button>
  </div>
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty { text-align: center; padding: var(--s-4); }
  .empty .mi { font-size: 48px; color: var(--text-dim); margin-bottom: var(--s-3); display: block; }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: 6px; }
  .empty p { color: var(--text-mute); margin-bottom: var(--s-4); }

  .hero {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    margin: var(--s-3) 0;
  }
  .avatar {
    width: 72px; height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar span { font-size: 36px; }
  .hero h1 { font-size: var(--fs-xl); font-weight: 800; margin-bottom: 6px; letter-spacing: -0.02em; }

  .toast {
    padding: var(--s-3);
    background: color-mix(in srgb, var(--success) 15%, transparent);
    border: 1px solid var(--success);
    border-radius: var(--r-md);
    color: var(--success);
    margin-top: var(--s-2);
    text-align: center;
    font-size: var(--fs-sm);
  }

  .note {
    display: flex;
    gap: var(--s-2);
    align-items: flex-start;
    padding: var(--s-3);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-left: 3px solid var(--accent);
    border-radius: 0 var(--r-md) var(--r-md) 0;
    font-size: var(--fs-xs);
    color: var(--text-mute);
    line-height: 1.5;
    margin: var(--s-3) 0;
  }
  .note .mi { font-size: 16px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }
  .note strong { color: var(--text); }

  .footer-back { margin-top: var(--s-5); }
</style>
