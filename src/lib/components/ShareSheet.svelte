<script lang="ts">
  import { onMount } from 'svelte';
  import {
    renderShareCard, SHARE_THEMES, AVAILABLE_STICKERS,
    DEFAULT_CUSTOMIZATION,
    type ShareCardData, type ShareCustomization, type ShareTheme,
    type ShareLayout, type Sticker
  } from '$lib/utils/shareCard';
  import Button from './Button.svelte';

  interface Props {
    data: ShareCardData;
    onClose: () => void;
  }

  let { data, onClose }: Props = $props();

  let custom = $state<ShareCustomization>(structuredClone(DEFAULT_CUSTOMIZATION));
  let blob = $state<Blob | null>(null);
  let url = $state<string | null>(null);
  let rendering = $state(false);
  let photoInput: HTMLInputElement | undefined = $state();

  // Drag state
  let previewEl: HTMLDivElement | undefined = $state();
  let activeId = $state<string | null>(null);
  let dragging = $state(false);
  let dragStart = { x: 0, y: 0, origX: 0, origY: 0 };

  const activeScale = $derived.by(() => {
    if (!activeId) return 1;
    if (activeId === 'caption') return custom.captionStyle?.scale ?? 1;
    return custom.stickers.find((s) => s.id === activeId)?.scale ?? 1;
  });

  function startDrag(e: PointerEvent, kind: 'sticker' | 'caption', id?: string) {
    if (!previewEl) return;
    e.preventDefault();
    e.stopPropagation();
    const targetId = kind === 'caption' ? 'caption' : id!;
    activeId = targetId;
    dragging = true;

    const rect = previewEl.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    let origX: number, origY: number;
    if (kind === 'caption') {
      origX = custom.captionStyle?.x ?? 0.5;
      origY = custom.captionStyle?.y ?? 0.82;
    } else {
      const s = custom.stickers.find((x) => x.id === id);
      origX = s?.x ?? 0.5;
      origY = s?.y ?? 0.5;
    }
    dragStart = { x: relX, y: relY, origX, origY };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
    window.addEventListener('pointercancel', endDrag, { once: true });
  }

  function onDrag(e: PointerEvent) {
    if (!dragging || !activeId || !previewEl) return;
    const rect = previewEl.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const dx = relX - dragStart.x;
    const dy = relY - dragStart.y;
    const newX = Math.max(0.05, Math.min(0.95, dragStart.origX + dx));
    const newY = Math.max(0.05, Math.min(0.95, dragStart.origY + dy));

    if (activeId === 'caption') {
      custom = {
        ...custom,
        captionStyle: { ...(custom.captionStyle ?? { x: 0.5, y: 0.82, scale: 1 }), x: newX, y: newY }
      };
    } else {
      custom = {
        ...custom,
        stickers: custom.stickers.map((s) => s.id === activeId ? { ...s, x: newX, y: newY } : s)
      };
    }
  }

  function endDrag() {
    dragging = false;
    window.removeEventListener('pointermove', onDrag);
  }

  function scaleActive(delta: number) {
    if (!activeId) return;
    if (activeId === 'caption') {
      const cur = custom.captionStyle?.scale ?? 1;
      const next = Math.max(0.5, Math.min(2.5, cur + delta));
      custom = {
        ...custom,
        captionStyle: { ...(custom.captionStyle ?? { x: 0.5, y: 0.82, scale: 1 }), scale: next }
      };
    } else {
      custom = {
        ...custom,
        stickers: custom.stickers.map((s) => {
          if (s.id !== activeId) return s;
          return { ...s, scale: Math.max(0.3, Math.min(3, s.scale + delta)) };
        })
      };
    }
  }

  function rotateActive() {
    if (!activeId || activeId === 'caption') return;
    custom = {
      ...custom,
      stickers: custom.stickers.map((s) =>
        s.id === activeId ? { ...s, rotation: s.rotation + Math.PI / 12 } : s
      )
    };
  }

  // ─── Re-render on changes ───────────────────────
  let renderTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    // Dispara quando custom muda
    custom;
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(doRender, 200);
  });

  async function doRender() {
    rendering = true;
    try {
      const old = url;
      blob = await renderShareCard(data, $state.snapshot(custom) as ShareCustomization);
      url = URL.createObjectURL(blob);
      if (old) URL.revokeObjectURL(old);
    } finally {
      rendering = false;
    }
  }

  onMount(() => {
    doRender();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  });

  // ─── Photo upload ───────────────────────────────
  async function onPhoto(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      custom = { ...custom, photoDataUrl: reader.result as string };
    };
    reader.readAsDataURL(file);
  }
  function removePhoto() {
    custom = { ...custom, photoDataUrl: undefined };
    if (photoInput) photoInput.value = '';
  }

  // ─── Stickers ───────────────────────────────────
  // Zonas "seguras" pra stickers — cantos e bordas, evitando centro (rosto)
  const SAFE_ZONES = [
    { xMin: 0.06, xMax: 0.3, yMin: 0.12, yMax: 0.24 },  // canto sup esq
    { xMin: 0.7,  xMax: 0.94, yMin: 0.12, yMax: 0.24 }, // canto sup dir
    { xMin: 0.06, xMax: 0.3, yMin: 0.72, yMax: 0.84 },  // canto inf esq (acima footer)
    { xMin: 0.7,  xMax: 0.94, yMin: 0.72, yMax: 0.84 }  // canto inf dir
  ];

  function addSticker(emoji: string) {
    const existing = custom.stickers.find((s) => s.emoji === emoji);
    if (existing) {
      custom = { ...custom, stickers: custom.stickers.filter((s) => s.id !== existing.id) };
      return;
    }
    // Distribui em zona ainda não ocupada, se possível
    const used = new Set(custom.stickers.map((s) => s.zoneIndex));
    const zoneIdx = [0, 1, 2, 3].find((i) => !used.has(i)) ?? (custom.stickers.length % 4);
    const zone = SAFE_ZONES[zoneIdx];
    const newSticker: Sticker = {
      id: 's_' + Math.random().toString(36).slice(2, 8),
      emoji,
      x: zone.xMin + Math.random() * (zone.xMax - zone.xMin),
      y: zone.yMin + Math.random() * (zone.yMax - zone.yMin),
      scale: 0.85 + Math.random() * 0.3,
      rotation: (Math.random() - 0.5) * 0.35,
      zoneIndex: zoneIdx
    };
    custom = { ...custom, stickers: [...custom.stickers, newSticker] };
  }
  function clearStickers() {
    custom = { ...custom, stickers: [] };
  }

  // ─── Share/download ─────────────────────────────
  async function share() {
    if (!blob) return;
    const file = new File([blob], 'fibra.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'FIBRA' }).catch(() => {});
    } else {
      download();
    }
  }
  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `fibra-${data.template}-${Date.now()}.png`;
    a.click();
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  const canShare = $derived(typeof navigator !== 'undefined' && 'share' in navigator);

  const LAYOUTS: { id: ShareLayout; label: string; icon: string }[] = [
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'minimal', label: 'Minimal', icon: '✨' },
    { id: 'photo', label: 'Foto', icon: '📸' }
  ];

  const MAP_STYLES: { id: 'outdoors' | 'satellite' | 'dark'; label: string }[] = [
    { id: 'outdoors',  label: 'Ruas'       },
    { id: 'satellite', label: 'Satélite'   },
    { id: 'dark',      label: 'Escuro'     }
  ];
  // Map style é específico do template 'run' — armazena no próprio data
  const isRunCard = $derived(data.template === 'run');
  let mapStyle = $state<'outdoors' | 'satellite' | 'dark'>('outdoors');
  $effect(() => {
    if (isRunCard) {
      // Muta o data passado (mesma referência que o Sheet recebe)
      (data as { mapStyle?: string }).mapStyle = mapStyle;
      // Força re-render
      custom = { ...custom };
    }
  });
</script>

<svelte:window onkeydown={handleKey} />

<div class="backdrop" onclick={handleBackdrop} role="presentation">
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="handle"></div>
    <div class="head">
      <h3>Compartilhar</h3>
      <button class="close" onclick={onClose} aria-label="Fechar"><span class="mi">close</span></button>
    </div>

    <!-- Preview com overlay interativo -->
    <div class="preview" class:rendering bind:this={previewEl}>
      {#if url}
        <img src={url} alt="Preview" />
      {/if}

      <!-- Overlay de stickers (drag + pinch) -->
      {#each custom.stickers as s (s.id)}
        <button
          class="sticker-overlay"
          class:active={activeId === s.id}
          style="left: {s.x * 100}%; top: {s.y * 100}%; transform: translate(-50%, -50%) scale({s.scale}) rotate({s.rotation}rad); font-size: 60px;"
          onpointerdown={(e) => startDrag(e, 'sticker', s.id)}
          aria-label="Mover {s.emoji}"
        >{s.emoji}</button>
      {/each}

      <!-- Overlay de caption (drag + pinch) -->
      {#if custom.caption && custom.captionStyle}
        <button
          class="caption-overlay"
          class:active={activeId === 'caption'}
          style="left: {custom.captionStyle.x * 100}%; top: {custom.captionStyle.y * 100}%; transform: translate(-50%, -50%) scale({custom.captionStyle.scale}); "
          onpointerdown={(e) => startDrag(e, 'caption')}
          aria-label="Mover legenda"
        >"{custom.caption}"</button>
      {/if}

      {#if rendering}
        <div class="rendering-dot"><span class="mi spin">progress_activity</span></div>
      {/if}
    </div>

    <!-- Controle de tamanho do elemento ativo -->
    {#if activeId}
      <div class="scale-bar">
        <span class="sb-label">
          {activeId === 'caption' ? '💬 Legenda' : custom.stickers.find((s) => s.id === activeId)?.emoji}
        </span>
        <button onclick={() => scaleActive(-0.15)} aria-label="Diminuir">
          <span class="mi">remove</span>
        </button>
        <span class="sb-val mono">{Math.round(activeScale * 100)}%</span>
        <button onclick={() => scaleActive(0.15)} aria-label="Aumentar">
          <span class="mi">add</span>
        </button>
        <button onclick={() => rotateActive()} aria-label="Girar">
          <span class="mi">rotate_right</span>
        </button>
        <button class="clear-ative" onclick={() => (activeId = null)}>OK</button>
      </div>
    {/if}

    <!-- Controles -->
    <div class="controls">

      <!-- Foto -->
      <div class="ctrl-section">
        <div class="ctrl-label">📸 Foto de fundo</div>
        <div class="photo-row">
          {#if custom.photoDataUrl}
            <div class="photo-thumb">
              <img src={custom.photoDataUrl} alt="Selecionada" />
              <button class="photo-remove" onclick={removePhoto} aria-label="Remover">
                <span class="mi">close</span>
              </button>
            </div>
            <button class="photo-change" onclick={() => photoInput?.click()}>
              <span class="mi">swap_horiz</span> Trocar
            </button>
          {:else}
            <button class="photo-add" onclick={() => photoInput?.click()}>
              <span class="mi">add_a_photo</span>
              <span>Adicionar selfie / foto</span>
            </button>
          {/if}
          <input
            type="file"
            accept="image/*"
            capture="user"
            bind:this={photoInput}
            onchange={onPhoto}
            style="display:none"
          />
        </div>
      </div>

      <!-- Tema de cor -->
      <div class="ctrl-section">
        <div class="ctrl-label">🎨 Tema</div>
        <div class="theme-row">
          {#each Object.entries(SHARE_THEMES) as [key, t] (key)}
            <button
              class="theme-btn"
              class:on={custom.theme === key}
              style="--p:{t.primary}; --s:{t.secondary}"
              onclick={() => (custom = { ...custom, theme: key as ShareTheme })}
              aria-label={t.name}
              title={t.name}
            ></button>
          {/each}
        </div>
      </div>

      <!-- Layout -->
      <div class="ctrl-section">
        <div class="ctrl-label">📐 Layout</div>
        <div class="layout-row">
          {#each LAYOUTS as l (l.id)}
            <button
              class="layout-btn"
              class:on={custom.layout === l.id}
              onclick={() => (custom = { ...custom, layout: l.id })}
            >
              <span class="l-ic">{l.icon}</span>
              <span class="l-lbl">{l.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Map style (só em cards de corrida) -->
      {#if isRunCard}
        <div class="ctrl-section">
          <div class="ctrl-label">🗺️ Mapa</div>
          <div class="layout-row">
            {#each MAP_STYLES as m (m.id)}
              <button
                class="layout-btn"
                class:on={mapStyle === m.id}
                onclick={() => (mapStyle = m.id)}
              >
                <span class="l-lbl">{m.label}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Caption -->
      <div class="ctrl-section">
        <div class="ctrl-label">💬 Legenda</div>
        <input
          type="text"
          class="caption-input"
          placeholder="Conta algo sobre esse treino..."
          maxlength="120"
          value={custom.caption ?? ''}
          oninput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            custom = { ...custom, caption: v || undefined };
          }}
        />
      </div>

      <!-- Stickers -->
      <div class="ctrl-section">
        <div class="ctrl-label">
          ✨ Stickers
          {#if custom.stickers.length > 0}
            <button class="clear-btn" onclick={clearStickers}>limpar</button>
          {/if}
        </div>
        <div class="sticker-row">
          {#each AVAILABLE_STICKERS as e (e)}
            {@const active = custom.stickers.some((s) => s.emoji === e)}
            <button
              class="sticker-btn"
              class:on={active}
              onclick={() => addSticker(e)}
              aria-label={`Sticker ${e}`}
            >{e}</button>
          {/each}
        </div>
      </div>

    </div>

    <!-- Ações -->
    <div class="btns">
      {#if canShare}
        <Button icon="ios_share" full size="lg" disabled={rendering || !blob} onclick={share}>
          Compartilhar
        </Button>
      {/if}
      <Button icon="download" variant="secondary" full size="lg" disabled={rendering || !blob} onclick={download}>
        Baixar PNG
      </Button>
    </div>
    <div class="insta-hint">
      <span class="mi">photo_camera</span>
      <span>Pra postar no Stories do Instagram: toque em <strong>Compartilhar</strong> e escolha <strong>Instagram</strong>.</span>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    z-index: 400;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    animation: fade 200ms;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .sheet {
    width: 100%;
    max-width: 520px;
    height: 95dvh;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-top-left-radius: var(--r-2xl);
    border-top-right-radius: var(--r-2xl);
    padding: 10px var(--s-4) calc(var(--s-4) + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    animation: slide 320ms var(--ease-spring);
    overflow: hidden;
  }
  @keyframes slide { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .handle {
    width: 40px;
    height: 4px;
    background: var(--bg-4);
    border-radius: var(--r-full);
    margin: 0 auto 10px;
    flex-shrink: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
    flex-shrink: 0;
  }
  .head h3 { font-size: var(--fs-lg); font-weight: 800; }
  .close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--text-mute);
    display: grid;
    place-items: center;
  }
  .close:hover { background: var(--bg-3); color: var(--text); }

  .preview {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: #000;
    border-radius: var(--r-lg);
    overflow: hidden;
    margin: 0 auto var(--s-3);
    aspect-ratio: 9 / 16;
    max-height: 44dvh;
    width: auto;
    max-width: 100%;
    position: relative;
    transition: opacity var(--dur-fast);
    touch-action: none;
  }
  .preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .preview.rendering img { opacity: 0.6; }

  /* Overlays interativos: hit-area transparente, sem visual */
  .sticker-overlay {
    position: absolute;
    background: transparent;
    border: 1.5px solid transparent;
    padding: 4px 8px;
    border-radius: var(--r-md);
    cursor: grab;
    touch-action: none;
    user-select: none;
    line-height: 1;
    z-index: 10;
    opacity: 0;
  }
  .sticker-overlay.active {
    opacity: 1;
    color: transparent;
    border-color: rgba(0, 229, 255, 0.8);
    background: transparent;
  }

  .caption-overlay {
    position: absolute;
    background: transparent;
    border: 1.5px solid transparent;
    padding: 8px 16px;
    border-radius: var(--r-full);
    cursor: grab;
    touch-action: none;
    user-select: none;
    font-family: var(--font-sans);
    font-style: italic;
    color: transparent;
    z-index: 10;
    min-width: 60px;
    min-height: 30px;
  }
  .caption-overlay.active {
    border-color: rgba(0, 229, 255, 0.8);
    background: transparent;
  }

  /* Barra de controle do elemento ativo */
  .scale-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    border-radius: var(--r-full);
    margin-bottom: var(--s-3);
    justify-content: center;
  }
  .sb-label {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--accent);
    margin-right: 4px;
  }
  .scale-bar button {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: var(--bg-2);
    color: var(--text);
    display: grid;
    place-items: center;
  }
  .scale-bar button:hover { background: var(--bg-3); }
  .scale-bar .mi { font-size: 16px; }
  .sb-val {
    min-width: 40px;
    text-align: center;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--accent);
  }
  .clear-ative {
    width: auto !important;
    padding: 0 12px;
    border-radius: var(--r-full) !important;
    font-size: var(--fs-xs);
    font-weight: 700;
    background: var(--accent) !important;
    color: var(--bg-0) !important;
    margin-left: 4px;
  }
  .rendering-dot {
    position: absolute;
    inset: auto 12px 12px auto;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
  }
  .rendering-dot .mi {
    color: var(--accent);
    font-size: 18px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .controls {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    padding-bottom: var(--s-2);
  }

  .ctrl-section { display: flex; flex-direction: column; gap: 6px; }
  .ctrl-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .clear-btn {
    background: none;
    color: var(--text-dim);
    font-size: 10px;
    text-transform: none;
    letter-spacing: 0;
  }
  .clear-btn:hover { color: var(--danger); }

  /* ─── Photo ─────────────────────── */
  .photo-row {
    display: flex;
    gap: var(--s-2);
    align-items: stretch;
  }
  .photo-thumb {
    position: relative;
    width: 80px;
    height: 80px;
    border-radius: var(--r-md);
    overflow: hidden;
    background: var(--bg-3);
  }
  .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .photo-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    display: grid;
    place-items: center;
  }
  .photo-remove .mi { font-size: 16px; }

  .photo-add, .photo-change {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px dashed var(--border-strong);
    border-radius: var(--r-md);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .photo-add:hover, .photo-change:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .photo-change { flex: 0 1 auto; border-style: solid; padding: var(--s-2) var(--s-3); }

  /* ─── Tema ──────────────────────── */
  .theme-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .theme-btn {
    width: 44px;
    height: 44px;
    border-radius: var(--r-full);
    background: linear-gradient(135deg, var(--p), var(--s));
    border: 3px solid transparent;
    transition: all var(--dur-fast);
    cursor: pointer;
  }
  .theme-btn:hover { transform: scale(1.08); }
  .theme-btn.on {
    border-color: var(--text);
    box-shadow: 0 0 0 2px var(--bg-2), 0 0 0 4px var(--accent);
  }

  /* ─── Layout ────────────────────── */
  .layout-row { display: flex; gap: 6px; }
  .layout-btn {
    flex: 1;
    padding: 10px 6px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .layout-btn .l-ic { font-size: 18px; }
  .layout-btn.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ─── Caption ───────────────────── */
  .caption-input {
    padding: 12px var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    font-style: italic;
  }
  .caption-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }
  .caption-input::placeholder { color: var(--text-dim); font-style: italic; }

  /* ─── Stickers ──────────────────── */
  .sticker-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .sticker-btn {
    width: 44px;
    height: 44px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    border: 1px solid var(--border);
    font-size: 22px;
    transition: all var(--dur-fast);
  }
  .sticker-btn:hover { background: var(--bg-4); transform: scale(1.05); }
  .sticker-btn.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    transform: scale(1.08);
  }

  .insta-hint {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin-top: var(--s-2);
    padding: 10px 12px;
    background: var(--bg-3);
    border-radius: var(--r-md);
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-mute);
  }
  .insta-hint .mi { font-size: 16px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }
  .insta-hint strong { color: var(--text); }

  .btns {
    display: flex;
    gap: var(--s-2);
    flex-direction: column;
    margin-top: var(--s-3);
    flex-shrink: 0;
  }
</style>
