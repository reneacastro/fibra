<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { saveCustomExercise, newExerciseId } from '$lib/db/customExercises';
  import type { Exercise, WorkoutCategory, MuscleGroup, Equipment } from '$lib/types';
  import { CATEGORY_LABEL, CATEGORY_ICON } from '$lib/utils/format';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  // Query params: ?category=superior&returnTo=/treinos/xxx
  const returnTo = $derived(page.url.searchParams.get('returnTo') || '/treinos');
  const defaultCategory = $derived(
    (page.url.searchParams.get('category') as WorkoutCategory) || 'superior'
  );

  let name = $state('');
  let category = $state<WorkoutCategory>('superior');
  let muscleGroup = $state<MuscleGroup>('peito');
  let equipment = $state<Equipment>('halteres');
  let imageMode = $state<'url' | 'upload' | 'none'>('none');
  let imageUrl = $state('');
  let uploadedDataUrl = $state<string | null>(null);
  let instructions = $state('');
  let saving = $state(false);
  let uploadInput: HTMLInputElement | undefined = $state();

  // Sincroniza categoria default uma vez
  let categorySynced = false;
  $effect(() => {
    if (!categorySynced && defaultCategory) {
      category = defaultCategory;
      categorySynced = true;
    }
  });

  const CATS: WorkoutCategory[] = [
    'superior','inferior','fullbody','forca','pump','core',
    'funcional','calistenia','crossfit','hiit',
    'cardio','mobilidade','alongamento','livre'
  ];

  const MUSCLES: { id: MuscleGroup; label: string }[] = [
    { id: 'peito', label: 'Peito' },
    { id: 'costas', label: 'Costas' },
    { id: 'ombros', label: 'Ombros' },
    { id: 'biceps', label: 'Bíceps' },
    { id: 'triceps', label: 'Tríceps' },
    { id: 'antebraco', label: 'Antebraço' },
    { id: 'quadriceps', label: 'Quadríceps' },
    { id: 'posterior', label: 'Posterior' },
    { id: 'gluteos', label: 'Glúteos' },
    { id: 'panturrilha', label: 'Panturrilha' },
    { id: 'adutores', label: 'Adutores' },
    { id: 'abdutores', label: 'Abdutores' },
    { id: 'core', label: 'Core' },
    { id: 'lombar', label: 'Lombar' },
    { id: 'cardio', label: 'Cardio' },
    { id: 'fullbody', label: 'Full body' }
  ];

  const EQUIP: { id: Equipment; label: string }[] = [
    { id: 'peso-corporal', label: 'Peso corporal' },
    { id: 'halteres', label: 'Halteres' },
    { id: 'barra', label: 'Barra' },
    { id: 'polia', label: 'Polia' },
    { id: 'maquina', label: 'Máquina' },
    { id: 'kettlebell', label: 'Kettlebell' },
    { id: 'elastico', label: 'Elástico' },
    { id: 'esteira', label: 'Esteira' },
    { id: 'bike', label: 'Bike' },
    { id: 'eliptico', label: 'Elíptico' },
    { id: 'caixa', label: 'Caixa' },
    { id: 'corda', label: 'Corda' },
    { id: 'bola', label: 'Bola' },
    { id: 'nenhum', label: 'Nenhum' }
  ];

  async function onUpload(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadedDataUrl = reader.result as string;
      imageUrl = '';
    };
    reader.readAsDataURL(file);
  }

  const canSave = $derived(name.trim().length >= 3);

  const previewSrc = $derived.by(() => {
    if (imageMode === 'upload') return uploadedDataUrl;
    if (imageMode === 'url') return imageUrl.trim() || null;
    return null;
  });

  async function save() {
    if (!authStore.uid || !canSave) return;
    saving = true;
    try {
      const id = newExerciseId();
      const ex: Exercise = {
        id,
        name: name.trim(),
        category,
        muscleGroup,
        equipment,
        gifUrl: previewSrc ?? undefined,
        instructions: instructions.trim() || undefined,
        isCustom: true
      };
      await saveCustomExercise(authStore.uid, ex);
      await catalogStore.reloadCustoms();
      // Volta pra origem sinalizando que exercicio foi criado (pra auto-add)
      const sep = returnTo.includes('?') ? '&' : '?';
      goto(`${returnTo}${sep}createdEx=${id}`, { replaceState: true });
    } finally {
      saving = false;
    }
  }

  function cancel() {
    if (history.length > 1) history.back();
    else goto(returnTo);
  }
</script>

<svelte:head>
  <title>Novo exercício · FIBRA</title>
</svelte:head>

<div class="page">
  <div class="content">
    <Input label="Nome do exercício" bind:value={name} placeholder="Ex: Agachamento búlgaro" />
    <div class="spacer"></div>

    <div class="field-label">Categoria</div>
    <div class="chips">
      {#each CATS as c (c)}
        <button class="chip" class:on={category === c} onclick={() => (category = c)}>
          <span class="ic">{CATEGORY_ICON[c]}</span>
          <span>{CATEGORY_LABEL[c]}</span>
        </button>
      {/each}
    </div>
    <div class="spacer"></div>

    <div class="field-label">Grupo muscular principal</div>
    <div class="chips">
      {#each MUSCLES as m (m.id)}
        <button class="chip small" class:on={muscleGroup === m.id} onclick={() => (muscleGroup = m.id)}>
          {m.label}
        </button>
      {/each}
    </div>
    <div class="spacer"></div>

    <div class="field-label">Equipamento</div>
    <div class="chips">
      {#each EQUIP as e (e.id)}
        <button class="chip small" class:on={equipment === e.id} onclick={() => (equipment = e.id)}>
          {e.label}
        </button>
      {/each}
    </div>
    <div class="spacer"></div>

    <div class="field-label">Imagem ou GIF (opcional)</div>
    <div class="img-modes">
      <button class="mode-btn" class:on={imageMode === 'none'} onclick={() => (imageMode = 'none')}>
        <span class="mi">block</span> Sem imagem
      </button>
      <button class="mode-btn" class:on={imageMode === 'url'} onclick={() => (imageMode = 'url')}>
        <span class="mi">link</span> Colar URL
      </button>
      <button class="mode-btn" class:on={imageMode === 'upload'} onclick={() => (imageMode = 'upload')}>
        <span class="mi">upload</span> Upload
      </button>
    </div>

    {#if imageMode === 'url'}
      <div class="spacer-sm"></div>
      <Input
        icon="link"
        placeholder="https://... (gif ou png/jpg)"
        bind:value={imageUrl}
      />
      <div class="hint">Busca no Google Imagens: "[nome do exercício] gif" e cola a URL direta</div>
    {:else if imageMode === 'upload'}
      <div class="spacer-sm"></div>
      <Button variant="secondary" icon="upload_file" full onclick={() => uploadInput?.click()}>
        {uploadedDataUrl ? 'Trocar imagem' : 'Selecionar imagem'}
      </Button>
      <input
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp"
        bind:this={uploadInput}
        onchange={onUpload}
        style="display:none"
      />
    {/if}

    {#if previewSrc}
      <div class="preview">
        <img src={previewSrc} alt="Preview" onerror={() => { if (imageMode === 'url') imageUrl = ''; }} />
      </div>
    {/if}

    <div class="spacer"></div>

    <div class="field-label">Notas / Instruções (opcional)</div>
    <textarea
      bind:value={instructions}
      rows="3"
      placeholder="Dicas de execução, cadência, etc"
    ></textarea>
  </div>

  <div class="footer">
    <Button variant="ghost" onclick={cancel}>Cancelar</Button>
    <Button icon="save" variant="success" full loading={saving} disabled={!canSave} onclick={save}>
      Criar
    </Button>
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding-bottom: calc(var(--safe-bottom) + var(--s-3));
  }
  .content {
    flex: 1;
    padding: var(--s-4);
  }
  .footer {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: var(--s-2);
    padding: var(--s-3) var(--s-4) calc(var(--s-3) + var(--safe-bottom));
    background: linear-gradient(to top, var(--bg-1) 60%, transparent);
  }

  .spacer { height: var(--s-3); }
  .spacer-sm { height: var(--s-2); }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }

  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .chip.small { padding: 4px 10px; font-size: 11px; }
  .chip .ic { font-size: 14px; }
  .chip.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .img-modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }
  .mode-btn {
    padding: 10px 6px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    color: var(--text-mute);
    font-size: 11px;
    font-weight: 600;
  }
  .mode-btn .mi { font-size: 18px; }
  .mode-btn.on {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .hint { font-size: 10px; color: var(--text-dim); margin-top: 6px; }

  .preview {
    margin-top: var(--s-2);
    width: 100%;
    max-height: 260px;
    background: var(--bg-3);
    border-radius: var(--r-md);
    overflow: hidden;
    display: grid;
    place-items: center;
  }
  .preview img { max-width: 100%; max-height: 260px; object-fit: contain; }

  textarea {
    width: 100%;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    resize: vertical;
    min-height: 80px;
  }
  textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
</style>
