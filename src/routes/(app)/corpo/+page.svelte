<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listBodyComp, saveBodyComp, deleteBodyComp } from '$lib/db/bodyComp';
  import { getProfile } from '$lib/db/profile';
  import type { BodyComp, UserProfile } from '$lib/types';
  import {
    calcIMC, classifyIMC, classifyBF, calcAge, calcWHR, calcTMB
  } from '$lib/utils/body';
  import { todayISO, fmtDateShort, fmtDateRelative, fmtKg } from '$lib/utils/format';
  import {
    extractPdfText, parseRelaxFitText, isParseOK, toBodyComp
  } from '$lib/utils/pdfRelaxFit';
  import { extractBodyCompFromText, extractBodyCompFromImage } from '$lib/db/gemini';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import BodyAnalyzerCard from '$lib/components/BodyAnalyzerCard.svelte';
  import { getActiveDietPlan } from '$lib/db/diet';
  import type { DietPlan } from '$lib/types';

  let profile = $state<UserProfile | null>(null);
  let history = $state<BodyComp[]>([]);
  let loading = $state(true);
  let saving = $state(false);

  // Form
  let form = $state<BodyComp>({
    date: todayISO(),
    source: 'manual',
    createdAt: Date.now()
  } as BodyComp);

  // Import
  let importing = $state(false);
  let importPreview = $state<BodyComp | null>(null);
  let importWarn = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  // UI
  let activeTab = $state<'novo' | 'historico' | 'evolucao'>('novo');

  let dietPlan = $state<DietPlan | null>(null);

  onMount(async () => {
    if (!authStore.uid) return;
    [profile, history, dietPlan] = await Promise.all([
      getProfile(authStore.uid),
      listBodyComp(authStore.uid),
      getActiveDietPlan(authStore.uid)
    ]);
    loading = false;
  });

  // IMC reativo
  const imc = $derived.by(() => {
    if (!profile || !form.peso) return 0;
    return calcIMC(form.peso, profile.height);
  });
  const imcCat = $derived(imc > 0 ? classifyIMC(imc) : null);

  // BF classificação
  const bfCat = $derived.by(() => {
    if (!form.fat || !profile) return null;
    return classifyBF(form.fat, profile.sex === 'F' ? 'F' : 'M');
  });

  // WHR
  const whr = $derived(calcWHR(form.waist, form.hip));
  const whrHealthy = $derived.by(() => {
    if (!whr || !profile) return null;
    const limit = profile.sex === 'F' ? 0.85 : 0.9;
    return whr < limit;
  });

  async function save() {
    if (!authStore.uid) return;
    saving = true;
    try {
      const toSave: BodyComp = { ...form, imc: imc || undefined, createdAt: Date.now() };
      await saveBodyComp(authStore.uid, toSave);
      history = await listBodyComp(authStore.uid);
      // Reset form
      form = { date: todayISO(), source: 'manual', createdAt: Date.now() } as BodyComp;
      activeTab = 'historico';
    } finally {
      saving = false;
    }
  }

  async function remove(date: string) {
    if (!authStore.uid) return;
    if (!confirm(`Apagar avaliação de ${fmtDateShort(date)}?`)) return;
    await deleteBodyComp(authStore.uid, date);
    history = await listBodyComp(authStore.uid);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        // Remove o prefixo "data:...;base64,"
        resolve(result.split(',')[1] ?? '');
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // ─── Import PDF ou Imagem ─────────────────────────
  async function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    importing = true;
    importWarn = null;
    try {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        throw new Error('Formato não suportado. Use PDF ou imagem (PNG/JPG).');
      }

      let parsed;

      if (isImage) {
        importWarn = 'Analisando imagem com Gemini…';
        const base64 = await fileToBase64(file);
        const data = await extractBodyCompFromImage(base64, file.type);
        parsed = { ...data, _missing: [] };
        importWarn = null;
      } else {
        // PDF: tenta parser local primeiro
        const raw = await extractPdfText(file);
        parsed = parseRelaxFitText(raw);

        // Fallback Gemini se falhar
        if (!isParseOK(parsed)) {
          try {
            importWarn = 'Layout não reconhecido — usando Gemini pra extrair.';
            const geminiData = await extractBodyCompFromText(raw);
            parsed = { ...parsed, ...geminiData, _missing: [] };
            importWarn = null;
          } catch (e) {
            importWarn = `Parser falhou e Gemini também: ${(e as Error).message}`;
            return;
          }
        }
      }

      importPreview = {
        ...toBodyComp(parsed, todayISO()),
        createdAt: Date.now()
      } as BodyComp;
    } catch (err) {
      importWarn = 'Erro: ' + (err as Error).message;
    } finally {
      importing = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function acceptImport() {
    if (!importPreview) return;
    form = { ...importPreview };
    importPreview = null;
    activeTab = 'novo';
  }

  // ─── Dados pros charts ────────────────────────────
  const chartData = $derived.by(() => {
    const asc = [...history].reverse();
    return {
      labels: asc.map((h) => fmtDateShort(h.date).slice(0, 5)),
      peso: asc.map((h) => h.peso ?? null).filter((v): v is number => v !== null),
      pesoLabels: asc.filter((h) => h.peso).map((h) => fmtDateShort(h.date).slice(0, 5)),
      fat: asc.map((h) => h.fat ?? null),
      fatLabels: asc.filter((h) => h.fat != null).map((h) => fmtDateShort(h.date).slice(0, 5)),
      fatValues: asc.filter((h) => h.fat != null).map((h) => h.fat!),
      muscle: asc.filter((h) => h.muscle != null).map((h) => h.muscle!),
      muscleLabels: asc.filter((h) => h.muscle != null).map((h) => fmtDateShort(h.date).slice(0, 5)),
      waist: asc.filter((h) => h.waist != null).map((h) => h.waist!),
      hip: asc.filter((h) => h.hip != null).map((h) => h.hip!),
      measureLabels: asc.filter((h) => h.waist != null || h.hip != null).map((h) => fmtDateShort(h.date).slice(0, 5))
    };
  });
</script>

<div class="tabs-row">
  <button class="tab" class:on={activeTab === 'novo'} onclick={() => (activeTab = 'novo')}>
    <span class="mi">add_circle</span> Novo
  </button>
  <button class="tab" class:on={activeTab === 'historico'} onclick={() => (activeTab = 'historico')}>
    <span class="mi">history</span> Histórico
    <span class="count">{history.length}</span>
  </button>
  <button class="tab" class:on={activeTab === 'evolucao'} onclick={() => (activeTab = 'evolucao')}>
    <span class="mi">insights</span> Evolução
  </button>
</div>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>

{:else if activeTab === 'novo'}
  <!-- Import Relax Fit -->
  <Card accent="gradient">
    <div class="import-head">
      <div class="import-ic">📄</div>
      <div class="import-body">
        <div class="import-title">Importar avaliação</div>
        <div class="import-sub">PDF ou foto do relatório da balança — a IA lê e preenche</div>
      </div>
    </div>
    <div class="spacer-sm"></div>
    <Button icon="upload_file" variant="secondary" full loading={importing} onclick={() => fileInput?.click()}>
      {importing ? 'Analisando…' : 'Selecionar PDF ou imagem'}
    </Button>
    <input
      type="file"
      accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
      bind:this={fileInput}
      onchange={onFile}
      style="display:none"
    />
    {#if importWarn}
      <div class="warn-box">
        <span class="mi">info</span>
        <span>{importWarn}</span>
      </div>
    {/if}
  </Card>

  <!-- Preview de import -->
  {#if importPreview}
    <Card title="Preview do PDF" icon="fact_check" accent="glow">
      <div class="preview-grid">
        {#if importPreview.peso}<div><span class="pv-l">Peso</span><span class="pv-v mono">{fmtKg(importPreview.peso)} kg</span></div>{/if}
        {#if importPreview.fat}<div><span class="pv-l">% Gordura</span><span class="pv-v mono">{importPreview.fat}%</span></div>{/if}
        {#if importPreview.subcutaneousFat}<div><span class="pv-l">Subcutânea</span><span class="pv-v mono">{importPreview.subcutaneousFat}%</span></div>{/if}
        {#if importPreview.muscle}<div><span class="pv-l">Massa muscular</span><span class="pv-v mono">{fmtKg(importPreview.muscle)} kg</span></div>{/if}
        {#if importPreview.skeletalMuscle}<div><span class="pv-l">Esquelético</span><span class="pv-v mono">{fmtKg(importPreview.skeletalMuscle)} kg</span></div>{/if}
        {#if importPreview.smi}<div><span class="pv-l">SMI</span><span class="pv-v mono">{importPreview.smi}</span></div>{/if}
        {#if importPreview.protein}<div><span class="pv-l">Proteína</span><span class="pv-v mono">{fmtKg(importPreview.protein)} kg</span></div>{/if}
        {#if importPreview.visceral}<div><span class="pv-l">Visceral</span><span class="pv-v mono">{importPreview.visceral}</span></div>{/if}
        {#if importPreview.hydration}<div><span class="pv-l">Hidratação</span><span class="pv-v mono">{importPreview.hydration}%</span></div>{/if}
        {#if importPreview.bone}<div><span class="pv-l">Óssea</span><span class="pv-v mono">{fmtKg(importPreview.bone)} kg</span></div>{/if}
        {#if importPreview.tmb}<div><span class="pv-l">TMB</span><span class="pv-v mono">{importPreview.tmb} kcal</span></div>{/if}
        {#if importPreview.metabolicAge}<div><span class="pv-l">Idade corpo</span><span class="pv-v mono">{importPreview.metabolicAge}</span></div>{/if}
        {#if importPreview.bodyScore}<div><span class="pv-l">Pontuação</span><span class="pv-v mono">{importPreview.bodyScore}/100</span></div>{/if}
      </div>
      <div class="spacer-sm"></div>
      <div class="preview-btns">
        <Button variant="ghost" onclick={() => (importPreview = null)}>Descartar</Button>
        <Button icon="check" full onclick={acceptImport}>Usar esses dados</Button>
      </div>
    </Card>
  {/if}

  <!-- Form manual -->
  <Card title="Nova avaliação" icon="edit">
    <Input type="date" label="Data" bind:value={form.date} />
    <div class="spacer"></div>

    <div class="section-title">Dados básicos</div>
    <div class="two">
      <Input
        type="number" label="Peso" suffix="kg" step="0.1"
        value={form.peso ?? ''}
        oninput={(e) => (form.peso = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <div class="imc-box">
        <div class="imc-lbl">IMC</div>
        <div class="imc-val mono">{imc > 0 ? imc.toFixed(1) : '—'}</div>
        {#if imcCat}
          <Badge variant={imcCat.tone} size="sm">{imcCat.label}</Badge>
        {/if}
      </div>
    </div>

    <div class="section-title">Bioimpedância</div>
    <div class="grid-2">
      <Input
        type="number" label="% Gordura" suffix="%" step="0.1"
        value={form.fat ?? ''}
        oninput={(e) => (form.fat = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Subcutânea" suffix="%" step="0.1"
        value={form.subcutaneousFat ?? ''}
        oninput={(e) => (form.subcutaneousFat = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Massa muscular" suffix="kg" step="0.1"
        value={form.muscle ?? ''}
        oninput={(e) => (form.muscle = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Músc. esquelético" suffix="kg" step="0.1"
        value={form.skeletalMuscle ?? ''}
        oninput={(e) => (form.skeletalMuscle = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="SMI" suffix="kg/m²" step="0.1"
        value={form.smi ?? ''}
        oninput={(e) => (form.smi = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Proteína" suffix="kg" step="0.1"
        value={form.protein ?? ''}
        oninput={(e) => (form.protein = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Visceral" step="1"
        value={form.visceral ?? ''}
        oninput={(e) => (form.visceral = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Hidratação" suffix="%" step="0.1"
        value={form.hydration ?? ''}
        oninput={(e) => (form.hydration = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Massa óssea" suffix="kg" step="0.1"
        value={form.bone ?? ''}
        oninput={(e) => (form.bone = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="TMB" suffix="kcal" step="1"
        value={form.tmb ?? ''}
        oninput={(e) => (form.tmb = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Idade corporal" suffix="anos" step="1"
        value={form.metabolicAge ?? ''}
        oninput={(e) => (form.metabolicAge = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Pontuação" suffix="/100" step="1"
        value={form.bodyScore ?? ''}
        oninput={(e) => (form.bodyScore = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
    </div>
    {#if bfCat}
      <div class="cat-indicator" style="color:{bfCat.color}">
        <span class="mi">info</span>
        <span><strong>% Gordura:</strong> {bfCat.label}</span>
      </div>
    {/if}

    <div class="section-title">Medidas (cm)</div>
    <div class="grid-2">
      <Input
        type="number" label="Cintura" suffix="cm" step="0.5"
        value={form.waist ?? ''}
        oninput={(e) => (form.waist = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Quadril" suffix="cm" step="0.5"
        value={form.hip ?? ''}
        oninput={(e) => (form.hip = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Peito" suffix="cm" step="0.5"
        value={form.chest ?? ''}
        oninput={(e) => (form.chest = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Abdômen" suffix="cm" step="0.5"
        value={form.abdomen ?? ''}
        oninput={(e) => (form.abdomen = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Coxa" suffix="cm" step="0.5"
        value={form.thigh ?? ''}
        oninput={(e) => (form.thigh = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Panturrilha" suffix="cm" step="0.5"
        value={form.calf ?? ''}
        oninput={(e) => (form.calf = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Braço" suffix="cm" step="0.5"
        value={form.arm ?? ''}
        oninput={(e) => (form.arm = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Antebraço" suffix="cm" step="0.5"
        value={form.forearm ?? ''}
        oninput={(e) => (form.forearm = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
      <Input
        type="number" label="Ombros" suffix="cm" step="0.5"
        value={form.shoulder ?? ''}
        oninput={(e) => (form.shoulder = Number((e.currentTarget as HTMLInputElement).value) || undefined)}
      />
    </div>

    {#if whr !== null}
      <div class="cat-indicator" style="color:{whrHealthy ? 'var(--success)' : 'var(--warn)'}">
        <span class="mi">{whrHealthy ? 'check_circle' : 'warning'}</span>
        <span><strong>Cintura/Quadril:</strong> {whr} ({whrHealthy ? 'saudável' : 'atenção'})</span>
      </div>
    {/if}

    <div class="spacer"></div>
    <Button icon="save" variant="success" full loading={saving} disabled={!form.peso} onclick={save}>
      Salvar avaliação
    </Button>
  </Card>

{:else if activeTab === 'historico'}
  {#if history.length === 0}
    <Card>
      <div class="empty-card">
        <div class="empty-ic">📊</div>
        <div class="empty-title">Sem avaliações ainda</div>
        <div class="empty-sub">Faça a primeira na aba "Novo"</div>
      </div>
    </Card>
  {:else}
    {#if profile}
      <BodyAnalyzerCard
        {profile}
        current={history[0]}
        previous={history[1]}
        currentDietKcal={dietPlan?.dailyTargets.kcal}
      />
      <div style="height: var(--s-4)"></div>
    {/if}

    <div class="hist-list">
      {#each history as h (h.date)}
        <Card padding="md">
          <div class="hist-head">
            <div>
              <div class="hist-date">{fmtDateShort(h.date)}</div>
              <div class="hist-rel">{fmtDateRelative(h.date)}</div>
            </div>
            <div class="hist-badges">
              {#if h.source === 'pdf-relaxfit'}
                <Badge variant="info" size="sm" icon="picture_as_pdf">Relax Fit</Badge>
              {:else if h.source === 'health'}
                <Badge variant="accent" size="sm" icon="favorite">Health</Badge>
              {/if}
              <button class="del-btn" onclick={() => remove(h.date)} aria-label="Apagar">
                <span class="mi">delete_outline</span>
              </button>
            </div>
          </div>
          <div class="hist-grid">
            {#if h.peso}<div><span class="hg-l">Peso</span><span class="hg-v mono">{fmtKg(h.peso)}<em>kg</em></span></div>{/if}
            {#if h.imc}<div><span class="hg-l">IMC</span><span class="hg-v mono">{h.imc.toFixed(1)}</span></div>{/if}
            {#if h.fat}<div><span class="hg-l">Gord.</span><span class="hg-v mono">{h.fat}<em>%</em></span></div>{/if}
            {#if h.muscle}<div><span class="hg-l">Músculo</span><span class="hg-v mono">{fmtKg(h.muscle)}<em>kg</em></span></div>{/if}
            {#if h.bodyScore}<div><span class="hg-l">Score</span><span class="hg-v mono">{h.bodyScore}<em>/100</em></span></div>{/if}
            {#if h.visceral}<div><span class="hg-l">Visceral</span><span class="hg-v mono">{h.visceral}</span></div>{/if}
            {#if h.waist}<div><span class="hg-l">Cintura</span><span class="hg-v mono">{h.waist}<em>cm</em></span></div>{/if}
            {#if h.hip}<div><span class="hg-l">Quadril</span><span class="hg-v mono">{h.hip}<em>cm</em></span></div>{/if}
          </div>
        </Card>
      {/each}
    </div>
  {/if}

{:else if activeTab === 'evolucao'}
  {#if history.length < 2}
    <Card>
      <div class="empty-card">
        <div class="empty-ic">📈</div>
        <div class="empty-title">Precisa de pelo menos 2 avaliações</div>
        <div class="empty-sub">Os gráficos aparecem quando houver histórico.</div>
      </div>
    </Card>
  {:else}
    {#if chartData.peso.length >= 2}
      <Card title="⚖️ Peso" icon="monitor_weight">
        <LineChart labels={chartData.pesoLabels} series={[{ label: 'kg', data: chartData.peso, color: '#00e5ff', fill: true }]} />
      </Card>
    {/if}

    {#if chartData.fatValues.length >= 2}
      <Card title="🔥 % Gordura corporal" icon="whatshot">
        <LineChart labels={chartData.fatLabels} series={[{ label: '%', data: chartData.fatValues, color: '#ff7b3a', fill: true }]} />
      </Card>
    {/if}

    {#if chartData.muscle.length >= 2}
      <Card title="💪 Massa muscular" icon="fitness_center">
        <LineChart labels={chartData.muscleLabels} series={[{ label: 'kg', data: chartData.muscle, color: '#3fb950', fill: true }]} />
      </Card>
    {/if}

    {#if chartData.waist.length >= 2 || chartData.hip.length >= 2}
      <Card title="📏 Cintura / Quadril" icon="straighten">
        <LineChart
          labels={chartData.measureLabels}
          series={[
            ...(chartData.waist.length ? [{ label: 'Cintura', data: chartData.waist, color: '#58a6ff' }] : []),
            ...(chartData.hip.length ? [{ label: 'Quadril', data: chartData.hip, color: '#bc8cff' }] : [])
          ]}
        />
      </Card>
    {/if}
  {/if}
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .tabs-row {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
    margin-bottom: var(--s-4);
  }
  .tab {
    flex: 1;
    padding: 10px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-sm);
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all var(--dur-fast);
  }
  .tab .mi { font-size: 18px; }
  .tab.on {
    background: var(--grad-primary);
    color: var(--bg-0);
  }
  .tab .count {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--r-full);
    background: rgba(0, 0, 0, 0.2);
    font-family: var(--font-mono);
  }

  .import-head {
    display: flex;
    gap: var(--s-3);
    align-items: center;
  }
  .import-ic {
    font-size: 32px;
    width: 48px;
    height: 48px;
    border-radius: var(--r-md);
    background: var(--grad-fire);
    display: grid;
    place-items: center;
  }
  .import-title { font-weight: 800; font-size: var(--fs-md); }
  .import-sub { color: var(--text-mute); font-size: var(--fs-xs); margin-top: 2px; }

  .warn-box {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    padding: var(--s-2) var(--s-3);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
    border-radius: var(--r-md);
    color: var(--warn);
    font-size: var(--fs-xs);
    margin-top: var(--s-2);
  }
  .warn-box .mi { font-size: 16px; flex-shrink: 0; }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-2);
  }
  .preview-grid > div {
    display: flex;
    justify-content: space-between;
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-sm);
  }
  .pv-l { font-size: var(--fs-xs); color: var(--text-mute); }
  .pv-v { font-weight: 700; }

  .preview-btns { display: flex; gap: var(--s-2); }

  .spacer { height: var(--s-3); }
  .spacer-sm { height: var(--s-2); }

  .section-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--s-4) 0 var(--s-2);
  }
  .section-title:first-of-type { margin-top: 0; }

  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); align-items: end; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }

  @media (max-width: 380px) {
    .grid-2 { grid-template-columns: 1fr; }
  }

  .imc-box {
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: 8px 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    justify-content: center;
    min-height: 52px;
    align-self: stretch;
  }
  .imc-lbl {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .imc-val {
    font-size: var(--fs-xl);
    font-weight: 800;
  }

  .cat-indicator {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
    font-size: var(--fs-sm);
    margin-top: var(--s-2);
  }
  .cat-indicator .mi { font-size: 18px; }

  .hist-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .hist-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--s-3);
  }
  .hist-date { font-weight: 700; font-size: var(--fs-md); }
  .hist-rel { color: var(--text-mute); font-size: var(--fs-xs); margin-top: 2px; }
  .hist-badges { display: flex; gap: 4px; align-items: center; }

  .del-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--r-md);
    color: var(--text-dim);
    display: grid;
    place-items: center;
  }
  .del-btn:hover { background: var(--bg-3); color: var(--danger); }
  .del-btn .mi { font-size: 18px; }

  .hist-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
  }
  .hist-grid > div {
    background: var(--bg-3);
    border-radius: var(--r-sm);
    padding: var(--s-2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hg-l { font-size: 10px; color: var(--text-mute); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .hg-v { font-size: var(--fs-md); font-weight: 800; }
  .hg-v em { font-style: normal; font-size: var(--fs-xs); color: var(--text-mute); margin-left: 2px; font-weight: 600; }

  .empty-card { text-align: center; padding: var(--s-5); }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-title { font-weight: 700; font-size: var(--fs-md); margin-bottom: 4px; }
  .empty-sub { color: var(--text-mute); font-size: var(--fs-sm); }
</style>
