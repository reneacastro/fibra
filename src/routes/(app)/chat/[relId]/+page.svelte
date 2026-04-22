<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { doc, getDoc } from 'firebase/firestore';
  import { db } from '$lib/firebase';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Relationship } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Chat from '$lib/components/Chat.svelte';

  const relId = page.params.relId!;

  let rel = $state<Relationship | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function load() {
    try {
      const snap = await getDoc(doc(db(), 'relationships', relId));
      if (!snap.exists()) {
        error = 'Conversa não encontrada.';
        return;
      }
      const data = snap.data() as Relationship;
      if (data.trainerUid !== authStore.uid && data.clientUid !== authStore.uid) {
        error = 'Você não faz parte dessa conversa.';
        return;
      }
      rel = data;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if error || !rel}
  <Card>
    <div class="empty">
      <span class="mi">chat_bubble_outline</span>
      <h2>Não foi possível abrir o chat</h2>
      <p>{error ?? 'Conversa não existe.'}</p>
      <Button onclick={() => goto('/home')}>Voltar</Button>
    </div>
  </Card>
{:else}
  <Chat relationship={rel} />
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty { text-align: center; padding: var(--s-4); }
  .empty .mi { font-size: 48px; color: var(--text-dim); margin-bottom: var(--s-3); display: block; }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: 6px; }
  .empty p { color: var(--text-mute); margin-bottom: var(--s-4); }
</style>
