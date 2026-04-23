<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { sendMessage, subscribeMessages } from '$lib/db/chat';
  import type { ChatMessage, Relationship } from '$lib/types';
  import Button from './Button.svelte';

  interface Props {
    relationship: Relationship;
  }
  let { relationship }: Props = $props();

  let messages = $state<ChatMessage[]>([]);
  let text = $state('');
  let sending = $state(false);
  let error = $state<string | null>(null);
  let unsub: (() => void) | null = null;
  let listEl: HTMLDivElement | undefined = $state();

  const myUid = $derived(authStore.uid || '');
  const isTrainer = $derived(relationship.trainerUid === myUid);
  const otherName = $derived(isTrainer ? relationship.clientName : relationship.trainerName);
  const otherAvatar = $derived(isTrainer ? relationship.clientAvatar : relationship.trainerAvatar);

  onMount(() => {
    unsub = subscribeMessages(
      relationship.id,
      async (msgs) => {
        messages = msgs;
        await tick();
        scrollToBottom();
      },
      (e) => (error = e.message)
    );
  });

  onDestroy(() => unsub?.());

  function scrollToBottom() {
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  async function send() {
    const t = text.trim();
    if (!t || sending || !myUid) return;
    sending = true;
    error = null;
    try {
      await sendMessage(relationship.id, {
        senderUid: myUid,
        senderName: isTrainer ? relationship.trainerName : relationship.clientName,
        senderAvatar: isTrainer ? relationship.trainerAvatar : relationship.clientAvatar,
        text: t,
        createdAt: Date.now()
      });
      text = '';
    } catch (e) {
      error = 'Falha ao enviar: ' + (e as Error).message;
    } finally {
      sending = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
  }

  function fmtTime(ts: number): string {
    const TZ = 'America/Sao_Paulo';
    const d = new Date(ts);
    // Dia em Brasília pra decidir se é hoje
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const msgDay = fmt.format(d);
    const todayDay = fmt.format(new Date());
    if (msgDay === todayDay) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: TZ })
      + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  }
</script>

<div class="chat">
  <!-- Header -->
  <div class="chat-head">
    <div class="ch-avatar">
      {#if otherAvatar?.startsWith('http')}
        <img src={otherAvatar} alt={otherName} />
      {:else}
        <span>{otherAvatar || '💬'}</span>
      {/if}
    </div>
    <div class="ch-body">
      <div class="ch-name">{otherName}</div>
      <div class="ch-sub">
        {isTrainer ? 'seu cliente' : (relationship.trainerRole === 'nutritionist' ? 'nutricionista' : 'personal trainer')}
      </div>
    </div>
  </div>

  <!-- Mensagens -->
  <div class="msg-list" bind:this={listEl}>
    {#if messages.length === 0}
      <div class="empty">
        <span class="mi">chat</span>
        <div>Nenhuma mensagem ainda. Manda um "oi".</div>
      </div>
    {/if}
    {#each messages as m (m.id)}
      {@const mine = m.senderUid === myUid}
      <div class="msg" class:mine>
        <div class="msg-bubble">
          {m.text}
          <div class="msg-time">{fmtTime(m.createdAt)}</div>
        </div>
      </div>
    {/each}
  </div>

  {#if error}
    <div class="chat-err">{error}</div>
  {/if}

  <!-- Input -->
  <div class="chat-input">
    <textarea
      bind:value={text}
      onkeydown={handleKeydown}
      placeholder="Digite sua mensagem…"
      rows="1"
    ></textarea>
    <Button
      icon="send"
      size="sm"
      loading={sending}
      disabled={!text.trim()}
      onclick={send}
    >
      Enviar
    </Button>
  </div>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: calc(100dvh - 140px);
    max-height: 100dvh;
  }

  .chat-head {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    padding: var(--s-2) 0 var(--s-3);
    border-bottom: 1px solid var(--border);
  }
  .ch-avatar {
    width: 48px; height: 48px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .ch-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .ch-avatar span { font-size: 28px; }
  .ch-name { font-weight: 700; }
  .ch-sub { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .msg-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--s-3) 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .empty {
    text-align: center;
    padding: var(--s-6);
    color: var(--text-mute);
  }
  .empty .mi { font-size: 32px; color: var(--text-dim); display: block; margin-bottom: var(--s-2); }

  .msg {
    display: flex;
    max-width: 80%;
  }
  .msg.mine { align-self: flex-end; }
  .msg:not(.mine) { align-self: flex-start; }

  .msg-bubble {
    padding: 10px 14px;
    border-radius: 18px;
    background: var(--bg-3);
    color: var(--text);
    font-size: var(--fs-sm);
    line-height: 1.4;
    word-wrap: break-word;
  }
  .msg.mine .msg-bubble {
    background: var(--grad-primary);
    color: var(--bg-0);
  }
  .msg-time {
    font-size: 10px;
    margin-top: 4px;
    opacity: 0.7;
  }

  .chat-err {
    padding: 8px 12px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    border: 1px solid var(--danger);
    border-radius: var(--r-sm);
    color: var(--danger);
    font-size: var(--fs-xs);
    margin: var(--s-2) 0;
    text-align: center;
  }

  .chat-input {
    display: flex;
    gap: 8px;
    padding: var(--s-2) 0;
    border-top: 1px solid var(--border);
    background: var(--bg-1);
  }
  .chat-input textarea {
    flex: 1;
    padding: 10px 12px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    line-height: 1.4;
    resize: none;
    max-height: 100px;
  }
</style>
