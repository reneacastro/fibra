<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile } from '$lib/db/profile';
  import { listMyGroups, listPublicGroups, createGroup, newGroupId } from '$lib/db/groups';
  import type { Group, UserProfile } from '$lib/types';
  import { withTimeout } from '$lib/utils/withTimeout';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';

  let profile = $state<UserProfile | null>(null);
  let mine = $state<Group[]>([]);
  let publicGroups = $state<Group[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  // Criar grupo
  let createOpen = $state(false);
  let newName = $state('');
  let newDesc = $state('');
  let newEmoji = $state('🔥');
  let newIsPublic = $state(true);
  let creating = $state(false);

  async function load() {
    if (!authStore.uid) return;
    loading = true;
    loadError = null;
    try {
      const [p, m, pg] = await withTimeout(
        Promise.all([
          getProfile(authStore.uid),
          listMyGroups(authStore.uid),
          listPublicGroups(30)
        ]),
        10_000,
        'grupos'
      );
      profile = p;
      mine = m;
      // Remove da lista pública os grupos que eu já tô
      const myIds = new Set(m.map((g) => g.id));
      publicGroups = pg.filter((g) => !myIds.has(g.id));
    } catch (e) {
      loadError = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  async function doCreate() {
    if (!authStore.uid || !profile || !newName.trim()) return;
    creating = true;
    try {
      const id = newGroupId();
      const g: Group = {
        id,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        emoji: newEmoji,
        ownerUid: authStore.uid,
        ownerName: profile.name || authStore.user?.displayName || 'Atleta',
        memberUids: [authStore.uid],
        isPublic: newIsPublic,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await createGroup(g);
      createOpen = false;
      newName = '';
      newDesc = '';
      goto(`/grupos/${id}`);
    } catch (e) {
      alert('Erro: ' + (e as Error).message);
    } finally {
      creating = false;
    }
  }

  const emojis = ['🔥', '💪', '🏃', '🏋️', '🥇', '⚡', '🎯', '🌟', '🚀', '🌱'];
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else if loadError}
  <button class="retry" onclick={load}>
    <span class="mi">refresh</span>
    <span>Falha: {loadError}</span>
  </button>
{:else}
  <div class="hero">
    <h1>Grupos</h1>
    <div class="sub">Comunidades pra treinar junto e motivar.</div>
  </div>

  <Button icon="group_add" full size="lg" onclick={() => (createOpen = true)}>
    Criar um grupo
  </Button>

  {#if mine.length > 0}
    <div class="sec-title">Meus grupos</div>
    <div class="grp-list">
      {#each mine as g (g.id)}
        <Card onclick={() => goto(`/grupos/${g.id}`)} padding="md">
          <div class="grp-row">
            <div class="grp-ic">{g.emoji || '🔥'}</div>
            <div class="grp-body">
              <div class="grp-name">{g.name}</div>
              <div class="grp-meta">
                {g.memberUids.length} {g.memberUids.length === 1 ? 'membro' : 'membros'}
                · {g.isPublic ? 'público' : 'privado'}
              </div>
            </div>
            <span class="mi chev">chevron_right</span>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if publicGroups.length > 0}
    <div class="sec-title">Grupos públicos</div>
    <div class="grp-list">
      {#each publicGroups as g (g.id)}
        <Card onclick={() => goto(`/grupos/${g.id}`)} padding="md">
          <div class="grp-row">
            <div class="grp-ic">{g.emoji || '🔥'}</div>
            <div class="grp-body">
              <div class="grp-name">{g.name}</div>
              <div class="grp-meta">
                {g.memberUids.length} {g.memberUids.length === 1 ? 'membro' : 'membros'}
                · por {g.ownerName}
              </div>
              {#if g.description}
                <div class="grp-desc">{g.description}</div>
              {/if}
            </div>
            <span class="mi chev">chevron_right</span>
          </div>
        </Card>
      {/each}
    </div>
  {/if}

  {#if mine.length === 0 && publicGroups.length === 0}
    <Card>
      <div class="empty" style="flex-direction: column; text-align: center; gap: var(--s-2);">
        <span class="mi" style="font-size: 40px;">groups</span>
        <div>
          <div class="empty-t">Nenhum grupo ainda</div>
          <div class="empty-s" style="margin-bottom: var(--s-3);">Crie o primeiro e convide amigos pra competir.</div>
        </div>
        <Button icon="add" onclick={() => (createOpen = true)}>Criar grupo</Button>
      </div>
    </Card>
  {/if}

  {#if createOpen}
    <div class="backdrop" role="presentation" onclick={() => (createOpen = false)}>
      <div class="sheet" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
        <div class="handle"></div>
        <h3>Criar grupo</h3>

        <label>
          <span class="lbl">Emoji</span>
          <div class="emoji-row">
            {#each emojis as e (e)}
              <button class="emoji-btn" class:on={newEmoji === e} onclick={() => (newEmoji = e)}>{e}</button>
            {/each}
          </div>
        </label>

        <label>
          <span class="lbl">Nome</span>
          <input type="text" bind:value={newName} placeholder="Ex: Galera da corrida" maxlength="60" />
        </label>

        <label>
          <span class="lbl">Descrição (opcional)</span>
          <textarea bind:value={newDesc} rows="2" maxlength="200" placeholder="Sobre o que é esse grupo"></textarea>
        </label>

        <label class="toggle">
          <input type="checkbox" bind:checked={newIsPublic} />
          <div>
            <div class="t-t">Público</div>
            <div class="t-s">Qualquer um pode ver e pedir pra entrar. Desmarque pra grupo privado (só por convite direto do owner).</div>
          </div>
        </label>

        <div class="actions">
          <Button variant="ghost" onclick={() => (createOpen = false)}>Cancelar</Button>
          <Button icon="add" full loading={creating} disabled={!newName.trim()} onclick={doCreate}>
            Criar
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

  .retry {
    width: 100%;
    padding: var(--s-4);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border: 1px solid var(--warning);
    border-radius: var(--r-lg);
    color: var(--warning);
    font-weight: 600;
    display: flex; gap: 8px; justify-content: center; align-items: center;
  }

  .hero { text-align: center; margin-bottom: var(--s-3); }
  .hero h1 { font-size: var(--fs-2xl); font-weight: 800; letter-spacing: -0.02em; }
  .sub { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .sec-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    margin: var(--s-4) 0 var(--s-2);
  }

  .grp-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .grp-row { display: flex; gap: var(--s-3); align-items: center; }
  .grp-ic {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: var(--bg-3);
    display: grid; place-items: center;
    font-size: 24px;
    flex-shrink: 0;
  }
  .grp-body { flex: 1; min-width: 0; }
  .grp-name { font-weight: 700; }
  .grp-meta { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .grp-desc { font-size: var(--fs-xs); color: var(--text); margin-top: 6px; line-height: 1.4; }
  .chev { color: var(--text-dim); font-size: 22px; }

  .empty { display: flex; gap: var(--s-3); align-items: center; padding: var(--s-2); color: var(--text-mute); }
  .empty .mi { font-size: 32px; color: var(--text-dim); }
  .empty-t { font-weight: 700; color: var(--text); }
  .empty-s { font-size: var(--fs-xs); margin-top: 2px; }

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
    max-height: 90dvh;
    overflow-y: auto;
  }
  .handle { width: 40px; height: 4px; background: var(--bg-4); border-radius: var(--r-full); margin: 0 auto var(--s-3); }
  .sheet h3 { font-size: var(--fs-lg); font-weight: 800; margin-bottom: var(--s-3); }
  .sheet label { display: block; margin-bottom: var(--s-3); }
  .lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-mute); display: block; margin-bottom: 6px; }
  .sheet input[type=text], .sheet textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
  }
  .sheet textarea { resize: vertical; min-height: 60px; }

  .emoji-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .emoji-btn {
    width: 40px; height: 40px;
    background: var(--bg-3);
    border: 2px solid transparent;
    border-radius: 50%;
    font-size: 22px;
  }
  .emoji-btn.on { border-color: var(--accent); }

  .toggle {
    display: flex; gap: var(--s-2); align-items: flex-start;
    cursor: pointer;
  }
  .toggle input { width: 20px; height: 20px; accent-color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  .t-t { font-weight: 700; font-size: var(--fs-sm); }
  .t-s { font-size: var(--fs-xs); color: var(--text-mute); line-height: 1.4; }

  .actions { display: flex; gap: var(--s-2); margin-top: var(--s-4); }
</style>
