<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile } from '$lib/db/profile';
  import { getGroup, subscribePosts, createPost, deletePost, leaveGroup, deleteGroup, addMember } from '$lib/db/groups';
  import { listRanking } from '$lib/db/rankings';
  import type { Group, GroupPost, UserProfile } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';

  const groupId = page.params.id!;

  let group = $state<Group | null>(null);
  let profile = $state<UserProfile | null>(null);
  let posts = $state<GroupPost[]>([]);
  let newPost = $state('');
  let posting = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let unsub: (() => void) | null = null;

  // Adicionar membro (owner)
  let addSheetOpen = $state(false);
  let candidates = $state<{ uid: string; name: string; avatar?: string }[]>([]);
  let candidateSearch = $state('');

  const isOwner = $derived(!!group && group.ownerUid === authStore.uid);
  const isMember = $derived(!!group && !!authStore.uid && group.memberUids.includes(authStore.uid));

  async function load() {
    if (!authStore.uid) return;
    loading = true;
    try {
      const [g, p] = await Promise.all([
        getGroup(groupId),
        getProfile(authStore.uid)
      ]);
      if (!g) { error = 'Grupo não encontrado.'; return; }
      group = g;
      profile = p;

      if (isMember || g.isPublic) {
        unsub = subscribePosts(groupId, (ps) => (posts = ps));
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });
  onDestroy(() => unsub?.());

  async function post() {
    const t = newPost.trim();
    if (!t || posting || !authStore.uid || !profile) return;
    posting = true;
    try {
      await createPost(groupId, {
        authorUid: authStore.uid,
        authorName: profile.name || authStore.user?.displayName || 'Atleta',
        authorAvatar: authStore.user?.photoURL || profile.avatar,
        text: t,
        createdAt: Date.now()
      });
      newPost = '';
    } catch (e) {
      alert('Erro: ' + (e as Error).message);
    } finally {
      posting = false;
    }
  }

  async function removePost(p: GroupPost) {
    if (!confirm('Apagar esse post?')) return;
    await deletePost(groupId, p.id);
  }

  async function doLeave() {
    if (!group || !authStore.uid) return;
    if (!confirm(`Sair de "${group.name}"?`)) return;
    await leaveGroup(group, authStore.uid);
    goto('/grupos');
  }

  async function doDelete() {
    if (!group) return;
    if (!confirm(`Apagar o grupo "${group.name}"? Isso é irreversível.`)) return;
    await deleteGroup(group.id);
    goto('/grupos');
  }

  async function openAddSheet() {
    addSheetOpen = true;
    try {
      const ranking = await listRanking({ orderBy: 'totalSessions', max: 50 });
      const existing = new Set(group?.memberUids ?? []);
      candidates = ranking
        .filter((r) => !existing.has(r.uid))
        .map((r) => ({ uid: r.uid, name: r.displayName, avatar: r.avatar }));
    } catch {
      candidates = [];
    }
  }

  const filteredCandidates = $derived.by(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates.slice(0, 20);
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20);
  });

  async function addMemberClick(uid: string) {
    if (!group) return;
    await addMember(group, uid);
    group = await getGroup(groupId);
    candidates = candidates.filter((c) => c.uid !== uid);
  }

  function fmtTime(ts: number): string {
    const d = new Date(ts);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const md = new Date(d);
    md.setHours(0, 0, 0, 0);
    if (md.getTime() === today.getTime()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if error || !group}
  <Card>
    <div class="empty">
      <span class="mi">group_off</span>
      <h2>{error ?? 'Grupo não encontrado'}</h2>
      <Button onclick={() => goto('/grupos')}>Voltar</Button>
    </div>
  </Card>
{:else}
  <!-- Hero -->
  <div class="hero">
    <div class="emo-big">{group.emoji || '🔥'}</div>
    <h1>{group.name}</h1>
    {#if group.description}
      <div class="desc">{group.description}</div>
    {/if}
    <div class="meta">
      {group.memberUids.length} {group.memberUids.length === 1 ? 'membro' : 'membros'}
      · {group.isPublic ? '🌎 público' : '🔒 privado'}
    </div>
  </div>

  <!-- Ações -->
  <div class="actions-row">
    {#if isOwner}
      <Button size="sm" variant="secondary" icon="person_add" onclick={openAddSheet}>
        Adicionar membro
      </Button>
      <Button size="sm" variant="ghost" icon="delete" onclick={doDelete}>Apagar</Button>
    {:else if isMember}
      <Button size="sm" variant="ghost" icon="logout" onclick={doLeave}>Sair</Button>
    {/if}
  </div>

  {#if !isMember && group.isPublic}
    <Card>
      <div class="info">
        <span class="mi">info</span>
        <span>Só o dono do grupo pode aprovar entrada. Peça pro <strong>{group.ownerName}</strong> te adicionar.</span>
      </div>
    </Card>
  {/if}

  <!-- Mural -->
  {#if isMember}
    <div class="sec-title">Mural de incentivo</div>

    <Card>
      <textarea
        bind:value={newPost}
        placeholder="Escreva algo pro time… (incentive, comemore, convide pra treinar)"
        rows="2"
        maxlength="400"
      ></textarea>
      <div class="post-actions">
        <Button icon="send" disabled={!newPost.trim()} loading={posting} onclick={post}>
          Publicar
        </Button>
      </div>
    </Card>
  {/if}

  {#if posts.length === 0 && isMember}
    <div class="mural-empty">
      <span class="mi">forum</span>
      <div>Nenhum post ainda. Seja o primeiro a motivar a galera.</div>
    </div>
  {:else}
    <div class="post-list">
      {#each posts as p (p.id)}
        <Card>
          <div class="post-head">
            <div class="post-ava">
              {#if p.authorAvatar?.startsWith('http')}
                <img src={p.authorAvatar} alt={p.authorName} />
              {:else}
                <span>{p.authorAvatar || '🔥'}</span>
              {/if}
            </div>
            <div class="post-meta">
              <div class="post-author">{p.authorName}</div>
              <div class="post-time">{fmtTime(p.createdAt)}</div>
            </div>
            {#if p.authorUid === authStore.uid || isOwner}
              <button class="post-del" onclick={() => removePost(p)} aria-label="Apagar">
                <span class="mi">close</span>
              </button>
            {/if}
          </div>
          <div class="post-text">{p.text}</div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if addSheetOpen}
    <div class="backdrop" role="presentation" onclick={() => (addSheetOpen = false)}>
      <div class="sheet" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
        <div class="handle"></div>
        <h3>Adicionar membro</h3>
        <input type="text" bind:value={candidateSearch} placeholder="Buscar…" class="search" />
        {#if candidates.length === 0}
          <div class="info" style="margin-top:12px">Só usuários que entraram na Comunidade aparecem aqui.</div>
        {:else}
          <div class="cand-list">
            {#each filteredCandidates as c (c.uid)}
              <button class="cand-item" onclick={() => addMemberClick(c.uid)}>
                <div class="cand-ava">
                  {#if c.avatar?.startsWith('http')}
                    <img src={c.avatar} alt={c.name} />
                  {:else}
                    <span>{c.avatar || '🔥'}</span>
                  {/if}
                </div>
                <span>{c.name}</span>
                <span class="mi">add_circle</span>
              </button>
            {/each}
          </div>
        {/if}
        <div class="actions">
          <Button variant="ghost" full onclick={() => (addSheetOpen = false)}>Fechar</Button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty { text-align: center; padding: var(--s-4); }
  .empty .mi { font-size: 48px; color: var(--text-dim); margin-bottom: var(--s-3); display: block; }
  .empty h2 { font-size: var(--fs-xl); font-weight: 700; margin-bottom: var(--s-3); }

  .hero { text-align: center; margin: var(--s-3) 0; }
  .emo-big { font-size: 72px; }
  .hero h1 { font-size: var(--fs-2xl); font-weight: 800; letter-spacing: -0.02em; margin-top: var(--s-2); }
  .desc { color: var(--text-mute); font-size: var(--fs-sm); margin-top: var(--s-2); }
  .meta { font-size: var(--fs-xs); color: var(--text-dim); margin-top: var(--s-2); }

  .actions-row { display: flex; gap: var(--s-2); justify-content: center; margin-bottom: var(--s-3); }

  .info { display: flex; gap: 8px; align-items: flex-start; font-size: var(--fs-sm); color: var(--text-mute); }
  .info .mi { font-size: 18px; color: var(--accent); flex-shrink: 0; }
  .info strong { color: var(--text); }

  .sec-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-mute); margin: var(--s-4) 0 var(--s-2); }

  textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    line-height: 1.4;
    resize: vertical;
    min-height: 60px;
  }
  .post-actions { display: flex; justify-content: flex-end; margin-top: var(--s-2); }

  .mural-empty { display: flex; gap: var(--s-2); align-items: center; justify-content: center; padding: var(--s-6); color: var(--text-mute); }
  .mural-empty .mi { font-size: 32px; color: var(--text-dim); }

  .post-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .post-head { display: flex; gap: var(--s-2); align-items: center; }
  .post-ava {
    width: 36px; height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .post-ava img { width: 100%; height: 100%; object-fit: cover; }
  .post-ava span { font-size: 20px; }
  .post-meta { flex: 1; }
  .post-author { font-weight: 700; font-size: var(--fs-sm); }
  .post-time { font-size: 10px; color: var(--text-mute); }
  .post-del {
    width: 24px; height: 24px;
    border-radius: 50%;
    color: var(--text-dim);
    display: grid; place-items: center;
  }
  .post-del .mi { font-size: 14px; }
  .post-text {
    margin-top: 8px;
    font-size: var(--fs-sm);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(10px);
    z-index: 320;
    display: flex; justify-content: center; align-items: flex-end;
  }
  .sheet {
    width: 100%; max-width: 520px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: var(--s-4) var(--s-4) calc(var(--s-6) + var(--safe-bottom));
    max-height: 80dvh;
    overflow-y: auto;
  }
  .handle { width: 40px; height: 4px; background: var(--bg-4); border-radius: var(--r-full); margin: 0 auto var(--s-3); }
  .sheet h3 { font-size: var(--fs-lg); font-weight: 800; margin-bottom: var(--s-3); }
  .search {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
  }
  .cand-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 50dvh; overflow-y: auto; }
  .cand-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px;
    background: var(--bg-3);
    border-radius: var(--r-sm);
    text-align: left;
  }
  .cand-item span:nth-child(2) { flex: 1; }
  .cand-item .mi { color: var(--accent); }
  .cand-ava {
    width: 32px; height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-4);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .cand-ava img { width: 100%; height: 100%; object-fit: cover; }
  .actions { display: flex; margin-top: var(--s-3); }
</style>
