<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile } from '$lib/db/profile';
  import { listMyClients, inviteClient, endRelationship, relationshipId } from '$lib/db/relationships';
  import { listRanking } from '$lib/db/rankings';
  import type { Relationship, UserProfile } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { withTimeout } from '$lib/utils/withTimeout';

  let profile = $state<UserProfile | null>(null);
  let clients = $state<Relationship[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  // Role só vale se foi aprovado pelo admin (settings.role setado)
  const role = $derived(profile?.settings?.role ?? 'athlete');
  const roleLabel = $derived(role === 'nutritionist' ? 'Nutricionista' : role === 'trainer' ? 'Personal trainer' : 'Atleta');
  const isTrainerRole = $derived(role === 'trainer' || role === 'nutritionist');
  const isPending = $derived(!!profile?.settings?.rolePending);

  async function load() {
    if (!authStore.uid) { loading = false; return; }
    loading = true;
    loadError = null;
    try {
      const [p, c] = await withTimeout(
        Promise.all([
          getProfile(authStore.uid),
          listMyClients(authStore.uid)
        ]),
        10_000,
        'dashboard trainer'
      );
      profile = p;
      clients = c;
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  // Estatísticas do trainer
  const activeCount = $derived(clients.filter((c) => c.status === 'active').length);
  const pendingCount = $derived(clients.filter((c) => c.status === 'pending').length);

  // Sheet de convite
  let inviteSheetOpen = $state(false);
  let candidates = $state<{ uid: string; name: string; avatar?: string }[]>([]);
  let candidateSearch = $state('');
  let selectedUid = $state('');
  let selectedName = $state('');
  let selectedAvatar = $state<string | undefined>(undefined);
  let inviteScope = $state<Array<'workouts' | 'diet'>>(['workouts']);
  let inviteNote = $state('');
  let inviting = $state(false);
  let inviteMsg = $state<string | null>(null);

  async function openInvite() {
    inviteSheetOpen = true;
    try {
      const ranking = await listRanking({ orderBy: 'totalSessions', max: 200 });
      candidates = ranking
        .filter((r) => r.uid !== authStore.uid && !clients.some((c) => c.clientUid === r.uid))
        .map((r) => ({ uid: r.uid, name: r.displayName, avatar: r.avatar }));
    } catch (e) {
      console.warn('Falha ao carregar candidatos:', e);
    }
  }

  const filteredCandidates = $derived.by(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates.slice(0, 20);
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
  });

  function toggleScope(s: 'workouts' | 'diet') {
    inviteScope = inviteScope.includes(s)
      ? inviteScope.filter((x) => x !== s)
      : [...inviteScope, s];
  }

  async function sendInvite() {
    if (!authStore.uid || !profile || !selectedUid) return;
    if (inviteScope.length === 0) {
      inviteMsg = 'Escolha pelo menos um escopo (treinos ou dieta).';
      return;
    }
    inviting = true;
    inviteMsg = null;
    try {
      await inviteClient({
        trainerUid: authStore.uid,
        trainerName: profile.name || authStore.user?.displayName || 'Profissional',
        trainerAvatar: authStore.user?.photoURL || profile.avatar,
        trainerRole: (role === 'nutritionist' ? 'nutritionist' : 'trainer') as 'trainer' | 'nutritionist',
        clientUid: selectedUid,
        clientName: selectedName,
        clientAvatar: selectedAvatar,
        scope: inviteScope,
        note: inviteNote.trim() || undefined
      });
      inviteMsg = `Convite enviado pra ${selectedName}.`;
      inviteSheetOpen = false;
      selectedUid = '';
      selectedName = '';
      inviteNote = '';
      setTimeout(() => (inviteMsg = null), 4000);
      await load();
    } catch (e) {
      inviteMsg = 'Erro: ' + (e as Error).message;
    } finally {
      inviting = false;
    }
  }

  async function removeClient(c: Relationship) {
    if (!confirm(`Encerrar vínculo com ${c.clientName}?`)) return;
    await endRelationship(c.trainerUid, c.clientUid);
    await load();
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if loadError}
  <button class="retry-box" onclick={load}>
    <span class="mi">refresh</span>
    <span>Falha: {loadError}. Tocar pra tentar de novo.</span>
  </button>
{:else if !isTrainerRole}
  <Card accent="glow">
    <div class="empty-state">
      <div class="emo">👥</div>
      <h2>Você é atleta hoje</h2>
      <p>Essa área é pra personal trainers e nutricionistas. Altere seu papel no Perfil pra liberar.</p>
      <Button icon="account_circle" onclick={() => goto('/perfil')}>Ir pro perfil</Button>
    </div>
  </Card>
{:else}
  <!-- Hero -->
  <div class="hero">
    <Badge variant="accent" icon="workspace_premium">{roleLabel}</Badge>
    <h1>Meus clientes</h1>
    <div class="hero-sub">Assista com treinos e planos direto no app deles</div>
  </div>

  <!-- Stats -->
  <div class="stats">
    <Card>
      <div class="stat">
        <div class="sv mono">{activeCount}</div>
        <div class="sl">ativos</div>
      </div>
    </Card>
    <Card>
      <div class="stat">
        <div class="sv mono">{pendingCount}</div>
        <div class="sl">convites pendentes</div>
      </div>
    </Card>
  </div>

  <!-- CTA convidar -->
  <Button icon="person_add" full size="lg" onclick={openInvite}>Convidar cliente</Button>

  {#if inviteMsg}
    <div class="toast">{inviteMsg}</div>
  {/if}

  <!-- Lista -->
  <div class="sec-title">Clientes</div>

  {#if clients.length === 0}
    <Card>
      <div class="empty-list">
        <span class="mi">group_add</span>
        <div>Nenhum cliente vinculado ainda. Convide alguém acima.</div>
      </div>
    </Card>
  {:else}
    <div class="cli-list">
      {#each clients as c (c.id)}
        <Card onclick={() => c.status === 'active' && goto(`/trainer/cliente/${c.clientUid}`)}>
          <div class="cli-row">
            <div class="cli-avatar">
              {#if c.clientAvatar?.startsWith('http')}
                <img src={c.clientAvatar} alt={c.clientName} />
              {:else}
                <span>{c.clientAvatar || '🔥'}</span>
              {/if}
            </div>
            <div class="cli-body">
              <div class="cli-name">{c.clientName}</div>
              <div class="cli-meta">
                {c.status === 'pending' ? 'Aguardando aceite' : c.status === 'active' ? 'Ativo' : 'Encerrado'}
                · escopo: {c.scope.map((s) => s === 'workouts' ? 'treinos' : 'dieta').join(', ')}
              </div>
            </div>
            {#if c.status === 'active'}
              <span class="mi chev">chevron_right</span>
            {:else if c.status === 'pending'}
              <span class="pill pending">⏳</span>
            {/if}
            <button class="del-btn" onclick={(e) => { e.stopPropagation(); removeClient(c); }} aria-label="Encerrar">
              <span class="mi">close</span>
            </button>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if inviteSheetOpen}
    <div class="inv-backdrop" role="presentation" onclick={() => (inviteSheetOpen = false)}>
      <div class="inv-sheet" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
        <div class="inv-handle"></div>
        <h3>Convidar cliente</h3>
        <p class="inv-desc">Escolha quem vai receber o convite e o que você poderá editar no app dele.</p>

        {#if !selectedUid}
          <input
            type="text"
            placeholder="Buscar pessoa na comunidade…"
            bind:value={candidateSearch}
            class="inv-search"
          />
          {#if candidates.length === 0}
            <div class="inv-hint">Só quem entrou na Comunidade aparece aqui.</div>
          {:else}
            <div class="inv-list">
              {#each filteredCandidates as cand (cand.uid)}
                <button
                  class="inv-item"
                  onclick={() => {
                    selectedUid = cand.uid;
                    selectedName = cand.name;
                    selectedAvatar = cand.avatar;
                  }}
                >
                  <div class="inv-ava">
                    {#if cand.avatar?.startsWith('http')}
                      <img src={cand.avatar} alt={cand.name} />
                    {:else}
                      <span>{cand.avatar || '🔥'}</span>
                    {/if}
                  </div>
                  <span>{cand.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="selected-pill">
            Cliente: <strong>{selectedName}</strong>
            <button onclick={() => { selectedUid = ''; selectedName = ''; }}>
              <span class="mi">close</span>
            </button>
          </div>

          <div class="scope-section">
            <div class="scope-label">Escopo de acesso</div>
            <div class="scope-row">
              <button
                class="scope-btn"
                class:on={inviteScope.includes('workouts')}
                onclick={() => toggleScope('workouts')}
              >
                🏋️ Treinos
              </button>
              <button
                class="scope-btn"
                class:on={inviteScope.includes('diet')}
                onclick={() => toggleScope('diet')}
              >
                🥗 Dieta
              </button>
            </div>
          </div>

          <textarea
            bind:value={inviteNote}
            placeholder="Mensagem opcional pro cliente (ex: 'Oi Renê, vi seu progresso, bora?')"
            rows="3"
            maxlength="300"
          ></textarea>
        {/if}

        <div class="inv-actions">
          <Button variant="ghost" onclick={() => (inviteSheetOpen = false)}>Cancelar</Button>
          <Button icon="send" full loading={inviting} disabled={!selectedUid} onclick={sendInvite}>
            Enviar convite
          </Button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .retry-box {
    width: 100%;
    padding: var(--s-4);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border: 1px solid var(--warning);
    border-radius: var(--r-lg);
    color: var(--warning);
    font-weight: 600;
  }

  .empty-state { text-align: center; padding: var(--s-4); }
  .empty-state .emo { font-size: 64px; margin-bottom: var(--s-3); }
  .empty-state h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: 6px; }
  .empty-state p { color: var(--text-mute); margin-bottom: var(--s-4); }

  .hero { text-align: center; margin: var(--s-3) 0; }
  .hero h1 { font-size: var(--fs-2xl); font-weight: 800; margin-top: var(--s-2); letter-spacing: -0.02em; }
  .hero-sub { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
    margin: var(--s-3) 0;
  }
  .stat { text-align: center; }
  .sv { font-size: var(--fs-3xl); font-weight: 800; color: var(--accent); line-height: 1; }
  .sl { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }

  .sec-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    margin: var(--s-4) 0 var(--s-2);
  }

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

  .empty-list { display: flex; gap: var(--s-2); align-items: center; color: var(--text-mute); }
  .empty-list .mi { font-size: 24px; color: var(--text-dim); }

  .cli-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .cli-row { display: flex; gap: var(--s-3); align-items: center; }
  .cli-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .cli-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cli-avatar span { font-size: 24px; }
  .cli-body { flex: 1; min-width: 0; }
  .cli-name { font-weight: 700; }
  .cli-meta { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .chev { color: var(--text-dim); font-size: 22px; }
  .pill.pending { background: var(--warning); color: #000; padding: 4px 8px; border-radius: var(--r-full); font-size: 12px; }
  .del-btn {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--bg-3);
    color: var(--text-dim);
    display: grid; place-items: center;
  }
  .del-btn .mi { font-size: 14px; }

  .inv-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(10px);
    z-index: 320;
    display: flex; justify-content: center; align-items: flex-end;
  }
  .inv-sheet {
    width: 100%; max-width: 520px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: var(--s-4) var(--s-4) calc(var(--s-6) + var(--safe-bottom));
    max-height: 85dvh;
    overflow-y: auto;
  }
  .inv-handle { width: 40px; height: 4px; background: var(--bg-4); border-radius: var(--r-full); margin: 0 auto var(--s-3); }
  .inv-sheet h3 { font-size: var(--fs-lg); font-weight: 800; margin-bottom: 4px; }
  .inv-desc { color: var(--text-mute); font-size: var(--fs-sm); margin-bottom: var(--s-3); }
  .inv-search {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
  }
  .inv-hint { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 8px; }
  .inv-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 260px; overflow-y: auto; }
  .inv-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    background: var(--bg-3);
    border-radius: var(--r-sm);
    text-align: left;
  }
  .inv-ava { width: 32px; height: 32px; border-radius: 50%; overflow: hidden; background: var(--bg-4); display: grid; place-items: center; flex-shrink: 0; }
  .inv-ava img { width: 100%; height: 100%; object-fit: cover; }

  .selected-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: var(--r-full);
    font-size: var(--fs-sm);
    margin-bottom: var(--s-3);
  }
  .selected-pill button {
    width: 20px; height: 20px;
    display: grid; place-items: center;
    border-radius: 50%;
    color: var(--accent);
  }
  .scope-section { margin: var(--s-3) 0; }
  .scope-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mute); margin-bottom: var(--s-2); }
  .scope-row { display: flex; gap: 8px; }
  .scope-btn {
    flex: 1;
    padding: 10px;
    background: var(--bg-3);
    border: 2px solid transparent;
    border-radius: var(--r-md);
    font-weight: 600;
    color: var(--text-mute);
  }
  .scope-btn.on { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg-3)); }

  textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-md);
    margin-top: var(--s-2);
    resize: vertical;
    min-height: 80px;
  }

  .inv-actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-4);
  }
</style>
