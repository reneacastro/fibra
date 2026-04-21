<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { checkIsAdmin } from '$lib/admin';
  import { getProfile } from '$lib/db/profile';
  import { listAllRoleRequests, approveRoleRequest, rejectRoleRequest } from '$lib/db/roleRequests';
  import type { RoleRequest, UserProfile } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';

  let loading = $state(true);
  let isAdminUser = $state(false);
  let requests = $state<RoleRequest[]>([]);
  let processing = $state<string | null>(null);

  async function load() {
    loading = true;
    try {
      if (!authStore.uid) return;
      isAdminUser = await checkIsAdmin(authStore.uid);
      if (!isAdminUser) return;
      requests = await listAllRoleRequests();
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  async function approve(req: RoleRequest) {
    if (!authStore.uid) return;
    if (!confirm(`Aprovar ${req.name} como ${req.requestedRole === 'trainer' ? 'Personal trainer' : 'Nutricionista'}?`)) return;
    processing = req.uid;
    try {
      const userProfile = await getProfile(req.uid);
      if (!userProfile) throw new Error('Perfil do usuário não encontrado.');
      await approveRoleRequest(req, authStore.uid, userProfile);
      requests = requests.filter((r) => r.uid !== req.uid);
    } catch (e) {
      alert('Falha: ' + (e as Error).message);
    } finally {
      processing = null;
    }
  }

  async function reject(req: RoleRequest) {
    if (!confirm(`Rejeitar pedido de ${req.name}?`)) return;
    processing = req.uid;
    try {
      await rejectRoleRequest(req.uid);
      requests = requests.filter((r) => r.uid !== req.uid);
    } finally {
      processing = null;
    }
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if !isAdminUser}
  <Card>
    <div class="empty">
      <span class="mi">lock</span>
      <div>
        <h2>Acesso restrito</h2>
        <p>Essa área é só pra admins. Pra virar admin, crie o doc
        <code>admins/{'{seuUid}'}</code> direto no Firebase Console.</p>
      </div>
      <Button onclick={() => goto('/home')}>Voltar</Button>
    </div>
  </Card>
{:else}
  <div class="hero">
    <h1>Aprovações pendentes</h1>
    <div class="sub">Pedidos pra virar personal trainer ou nutricionista.</div>
  </div>

  {#if requests.length === 0}
    <Card>
      <div class="empty">
        <span class="mi">inbox</span>
        <div>Nenhum pedido pendente.</div>
      </div>
    </Card>
  {:else}
    <div class="req-list">
      {#each requests as r (r.uid)}
        <Card>
          <div class="req-head">
            <div class="req-ava">
              {#if r.avatar?.startsWith('http')}
                <img src={r.avatar} alt={r.name} />
              {:else}
                <span>{r.avatar || '🔥'}</span>
              {/if}
            </div>
            <div class="req-body">
              <div class="req-name">{r.name}</div>
              <div class="req-role">
                Quer virar: <strong>{r.requestedRole === 'trainer' ? 'Personal trainer' : 'Nutricionista'}</strong>
              </div>
              <div class="req-date">{new Date(r.createdAt).toLocaleString('pt-BR')}</div>
            </div>
          </div>
          {#if r.note}
            <div class="req-note">"{r.note}"</div>
          {/if}
          <div class="req-actions">
            <Button variant="ghost" onclick={() => reject(r)} disabled={processing === r.uid}>
              Rejeitar
            </Button>
            <Button icon="check_circle" full variant="success" loading={processing === r.uid} onclick={() => approve(r)}>
              Aprovar
            </Button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty {
    text-align: center;
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-3);
  }
  .empty .mi { font-size: 48px; color: var(--text-dim); }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; }
  .empty p { color: var(--text-mute); font-size: var(--fs-sm); }
  .empty code { background: var(--bg-3); padding: 2px 6px; border-radius: 4px; font-size: var(--fs-xs); }

  .hero { margin-bottom: var(--s-3); }
  .hero h1 { font-size: var(--fs-2xl); font-weight: 800; letter-spacing: -0.02em; }
  .sub { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .req-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .req-head {
    display: flex;
    gap: var(--s-3);
    align-items: center;
  }
  .req-ava {
    width: 48px; height: 48px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
  }
  .req-ava img { width: 100%; height: 100%; object-fit: cover; }
  .req-ava span { font-size: 28px; }
  .req-body { flex: 1; min-width: 0; }
  .req-name { font-weight: 700; font-size: var(--fs-md); }
  .req-role { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .req-date { font-size: 10px; color: var(--text-dim); margin-top: 2px; }
  .req-note {
    margin-top: var(--s-2);
    padding: var(--s-2);
    background: var(--bg-3);
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    color: var(--text);
    font-style: italic;
    line-height: 1.5;
  }
  .req-actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-3);
  }
</style>
