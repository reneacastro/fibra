<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile } from '$lib/db/profile';
  import { listBodyComp } from '$lib/db/bodyComp';
  import { saveDietPlan, newPlanId } from '$lib/db/diet';
  import { suggestMacros, ACTIVITY_FACTOR, macroDistribution, macroCaloriesFromGrams } from '$lib/utils/macros';
  import { calcTMB, calcAge } from '$lib/utils/body';
  import { GOAL_LABEL } from '$lib/utils/format';
  import type { DietPlan, MacroTargets, UserProfile } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import AIPromptSheet from '$lib/components/AIPromptSheet.svelte';
  import { buildDietFromPrompt, type DietPlanBlueprint } from '$lib/db/gemini';
  import { listUserFoods, saveDietPlan as saveDiet, newPlanId as newId } from '$lib/db/diet';
  import { TACO_BASICS } from '$lib/db/openFoodFacts';

  interface Props {
    plan: DietPlan | null;
    onSaved: () => void;
  }

  let { plan, onSaved }: Props = $props();

  let profile = $state<UserProfile | null>(null);
  let latestWeight = $state<number | null>(null);
  let tmb = $state<number | null>(null);

  let name = $state(plan?.name ?? 'Meu plano principal');
  let targets = $state<MacroTargets>(plan?.dailyTargets ?? {
    kcal: 2200, proteinG: 150, carbG: 250, fatG: 70, fiberG: 25, waterMl: 2800
  });
  let saving = $state(false);

  onMount(async () => {
    if (!authStore.uid) return;
    profile = await getProfile(authStore.uid);
    const body = await listBodyComp(authStore.uid, 1);
    latestWeight = body[0]?.peso ?? profile?.weight ?? null;
    if (body[0]?.tmb) tmb = body[0].tmb;
    else if (profile?.birthDate && profile?.sex) {
      const age = calcAge(profile.birthDate);
      tmb = calcTMB(latestWeight ?? profile.weight, profile.height, age, profile.sex === 'F' ? 'F' : 'M');
    }
  });

  const currentKcal = $derived(macroCaloriesFromGrams(targets.proteinG, targets.carbG, targets.fatG));
  const dist = $derived(macroDistribution(targets));

  function applySuggestion() {
    if (!profile || !tmb || !latestWeight) return;
    const suggested = suggestMacros({
      tmb,
      activityLevel: profile.activityLevel ?? 3,
      weightKg: latestWeight,
      goals: profile.goals
    });
    targets = suggested;
  }

  function setKcalAndRebalance(newKcal: number) {
    // Mantém gramas de proteína, ajusta gordura (25%) e recalcula carbo pelo resto
    const proteinG = targets.proteinG;
    const fatG = Math.max(30, Math.round((newKcal * 0.25) / 9));
    const carbG = Math.max(50, Math.round((newKcal - proteinG * 4 - fatG * 9) / 4));
    targets = { ...targets, kcal: newKcal, fatG, carbG };
  }

  async function save() {
    if (!authStore.uid) return;
    saving = true;
    try {
      const p: DietPlan = {
        id: plan?.id ?? newPlanId(),
        name,
        dailyTargets: { ...targets, kcal: currentKcal },
        meals: plan?.meals ?? [],
        active: true,
        createdAt: plan?.createdAt ?? Date.now()
      };
      await saveDietPlan(authStore.uid, p);
      onSaved();
    } finally {
      saving = false;
    }
  }

  const canSuggest = $derived(!!(profile && tmb && latestWeight));

  // ─── AI Diet Builder ─────────────────────────────
  let aiOpen = $state(false);
  let aiBusy = $state(false);
  let aiError = $state<string | null>(null);
  let aiPreview = $state<DietPlanBlueprint | null>(null);

  async function generateDiet(prompt: string) {
    if (!authStore.uid || !profile) return;
    aiBusy = true;
    aiError = null;
    try {
      const ownFoods = await listUserFoods(authStore.uid);
      const allFoods = [...TACO_BASICS, ...ownFoods];

      const bp = await buildDietFromPrompt({
        userPrompt: prompt,
        userProfile: {
          name: profile.name,
          goals: profile.goals,
          weightKg: latestWeight ?? profile.weight,
          heightCm: profile.height,
          sex: (profile.sex ?? 'M') as 'M' | 'F' | 'outro',
          activityLevel: profile.activityLevel ?? 3
        },
        tmb: tmb ?? undefined,
        foods: allFoods.map((f) => ({
          id: f.id, name: f.name,
          kcalPer100g: f.kcalPer100g,
          proteinPer100g: f.proteinPer100g,
          carbPer100g: f.carbPer100g,
          fatPer100g: f.fatPer100g
        }))
      });

      // Valida foodIds
      const validIds = new Set(allFoods.map((f) => f.id));
      bp.meals = bp.meals.map((m) => ({
        ...m,
        items: m.items.filter((i) => validIds.has(i.foodId))
      })).filter((m) => m.items.length > 0);

      if (bp.meals.length === 0) {
        throw new Error('IA não retornou refeições válidas. Tenta reformular.');
      }
      aiPreview = bp;
    } catch (e) {
      aiError = (e as Error).message;
    } finally {
      aiBusy = false;
    }
  }

  async function acceptAIDiet() {
    if (!authStore.uid || !aiPreview) return;
    aiBusy = true;
    try {
      // Atualiza targets do form local
      targets = aiPreview.dailyTargets;
      name = aiPreview.name;

      // Salva plano com targets + refeições da agenda
      const p: DietPlan = {
        id: plan?.id ?? newId(),
        name: aiPreview.name,
        dailyTargets: aiPreview.dailyTargets,
        meals: aiPreview.meals.map((m, i) => ({
          id: 'm_' + Math.random().toString(36).slice(2, 8),
          name: m.name,
          time: m.time,
          items: m.items.map((it) => ({
            foodId: it.foodId,
            foodName: (TACO_BASICS.find((f) => f.id === it.foodId)?.name) ?? it.foodId,
            grams: it.grams
          }))
        })),
        active: true,
        createdAt: plan?.createdAt ?? Date.now()
      };
      await saveDiet(authStore.uid, p);
      aiOpen = false;
      aiPreview = null;
      onSaved();
    } finally {
      aiBusy = false;
    }
  }

  function closeAI() {
    if (aiBusy) return;
    aiOpen = false;
    aiPreview = null;
    aiError = null;
  }
</script>

<Card title="Plano de macros" icon="target">
  <Input label="Nome do plano" value={name} oninput={(e) => (name = (e.currentTarget as HTMLInputElement).value)} />
  <div class="spacer"></div>

  <Button icon="auto_awesome" variant="secondary" full onclick={() => (aiOpen = true)}>
    Gerar plano completo com IA
  </Button>
  <div class="spacer"></div>

  {#if canSuggest}
    <div class="suggest-card">
      <div class="suggest-head">
        <span class="mi">auto_awesome</span>
        <div class="suggest-body">
          <div class="suggest-t">Sugestão baseada no seu perfil</div>
          <div class="suggest-s">
            TMB {tmb} × atividade {ACTIVITY_FACTOR[profile!.activityLevel ?? 3]} · {(profile!.goals ?? []).map((g) => GOAL_LABEL[g] ?? g).join(', ') || 'manutenção'}
          </div>
        </div>
      </div>
      <Button size="sm" icon="tune" variant="secondary" onclick={applySuggestion}>Aplicar</Button>
    </div>
  {:else}
    <div class="warn">
      <span class="mi">info</span>
      <span>Cadastre peso, altura, data de nascimento e sexo no perfil pra receber sugestão automática.</span>
    </div>
  {/if}

  <div class="spacer"></div>

  <!-- Calorias totais -->
  <div class="kcal-block">
    <div class="kcal-lbl">Meta calórica diária</div>
    <div class="kcal-input">
      <button class="kcal-adj" onclick={() => setKcalAndRebalance(Math.max(800, targets.kcal - 100))} aria-label="-100">−100</button>
      <div class="kcal-val mono">{targets.kcal}<span>kcal</span></div>
      <button class="kcal-adj" onclick={() => setKcalAndRebalance(targets.kcal + 100)} aria-label="+100">+100</button>
    </div>
    {#if Math.abs(currentKcal - targets.kcal) > 50}
      <div class="kcal-warn">
        <span class="mi">warning</span>
        Macros batem {currentKcal} kcal (diferença: {currentKcal - targets.kcal > 0 ? '+' : ''}{currentKcal - targets.kcal})
      </div>
    {/if}
  </div>

  <div class="spacer"></div>

  <!-- Distribution bar -->
  <div class="dist-bar">
    <div style="width:{dist.proteinPct}%;background:#ff5ea0" title="Proteína"></div>
    <div style="width:{dist.carbPct}%;background:#ffb86b" title="Carboidrato"></div>
    <div style="width:{dist.fatPct}%;background:#58a6ff" title="Gordura"></div>
  </div>
  <div class="dist-legend">
    <div><span class="dot" style="background:#ff5ea0"></span>Prot. {dist.proteinPct}%</div>
    <div><span class="dot" style="background:#ffb86b"></span>Carb. {dist.carbPct}%</div>
    <div><span class="dot" style="background:#58a6ff"></span>Gord. {dist.fatPct}%</div>
  </div>

  <div class="spacer"></div>

  <!-- Macros individuais -->
  <div class="grid-2">
    <Input
      type="number" label="Proteína" suffix="g" step="1" min="0"
      value={String(targets.proteinG)}
      oninput={(e) => (targets = { ...targets, proteinG: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
    />
    <Input
      type="number" label="Carboidrato" suffix="g" step="1" min="0"
      value={String(targets.carbG)}
      oninput={(e) => (targets = { ...targets, carbG: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
    />
    <Input
      type="number" label="Gordura" suffix="g" step="1" min="0"
      value={String(targets.fatG)}
      oninput={(e) => (targets = { ...targets, fatG: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
    />
    <Input
      type="number" label="Fibra" suffix="g" step="1" min="0"
      value={String(targets.fiberG ?? 25)}
      oninput={(e) => (targets = { ...targets, fiberG: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
    />
  </div>

  <div class="spacer"></div>

  <!-- Água (campo especial) -->
  <Input
    type="number" label="Água" suffix="ml" step="50" min="0"
    value={String(targets.waterMl ?? 2500)}
    oninput={(e) => (targets = { ...targets, waterMl: Number((e.currentTarget as HTMLInputElement).value) || 0 })}
  />

  <div class="spacer"></div>
  <Button icon="save" variant="success" full loading={saving} onclick={save}>
    Salvar e ativar plano
  </Button>
</Card>

{#if aiOpen}
  <AIPromptSheet
    title="Plano com IA"
    subtitle="A IA calcula macros e monta agenda alimentar com os alimentos TACO."
    placeholder="Ex: Plano pra hipertrofia 2500 kcal, 5 refeições, sem lactose"
    suggestions={[
      'Bulking limpo 2800 kcal, 5 refeições',
      'Cutting 1800 kcal com muita proteína',
      'Manutenção 4 refeições práticas',
      'Plano low-carb pra emagrecer'
    ]}
    busy={aiBusy}
    error={aiError}
    onSubmit={generateDiet}
    onClose={closeAI}
    preview={aiPreview ? dietPreview : undefined}
    onAccept={acceptAIDiet}
  />
{/if}

{#snippet dietPreview()}
  {#if aiPreview}
    <div class="ai-preview">
      <div class="ap-title">{aiPreview.name}</div>
      <div class="ap-macros">
        <span class="m-kcal mono">{aiPreview.dailyTargets.kcal} kcal</span>
        <span class="m-mac mono">P {aiPreview.dailyTargets.proteinG}</span>
        <span class="m-mac mono">C {aiPreview.dailyTargets.carbG}</span>
        <span class="m-mac mono">G {aiPreview.dailyTargets.fatG}</span>
      </div>
      <div class="ap-why">{aiPreview.reasoning}</div>
      <div class="ap-meals">
        {#each aiPreview.meals as m (m.time + m.name)}
          <div class="ap-meal">
            <div class="ap-meal-time mono">{m.time}</div>
            <div class="ap-meal-body">
              <div class="ap-meal-name">{m.name}</div>
              <div class="ap-meal-items">
                {#each m.items as it (it.foodId)}
                  {@const food = TACO_BASICS.find((f) => f.id === it.foodId)}
                  <div class="ap-item">{food?.name ?? it.foodId} <span class="mono">{it.grams}g</span></div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

<style>
  .spacer { height: var(--s-3); }

  .suggest-card {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    padding: var(--s-3);
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    border-radius: var(--r-md);
  }
  .suggest-head { display: flex; gap: var(--s-2); align-items: center; flex: 1; min-width: 0; }
  .suggest-head .mi { color: var(--accent); font-size: 22px; }
  .suggest-body { flex: 1; min-width: 0; }
  .suggest-t { font-weight: 700; font-size: var(--fs-sm); color: var(--accent); }
  .suggest-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .warn {
    display: flex;
    gap: var(--s-2);
    padding: var(--s-3);
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
    border-radius: var(--r-md);
    color: var(--warn);
    font-size: var(--fs-sm);
    align-items: flex-start;
  }
  .warn .mi { flex-shrink: 0; margin-top: 2px; }

  .kcal-block { text-align: center; }
  .kcal-lbl {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin-bottom: var(--s-2);
  }
  .kcal-input {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--s-4);
  }
  .kcal-adj {
    padding: 8px 16px;
    border-radius: var(--r-full);
    background: var(--bg-3);
    color: var(--text);
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .kcal-adj:hover { background: var(--bg-4); }
  .kcal-val {
    font-size: var(--fs-4xl);
    font-weight: 800;
    color: var(--accent);
    line-height: 1;
  }
  .kcal-val span {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
    margin-left: 4px;
  }
  .kcal-warn {
    margin-top: var(--s-2);
    font-size: var(--fs-xs);
    color: var(--warn);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }
  .kcal-warn .mi { font-size: 14px; }

  .dist-bar {
    height: 14px;
    border-radius: var(--r-full);
    overflow: hidden;
    display: flex;
    background: var(--bg-3);
  }
  .dist-bar > div {
    height: 100%;
    transition: width var(--dur-base) var(--ease-spring);
  }
  .dist-legend {
    display: flex;
    justify-content: center;
    gap: var(--s-3);
    margin-top: var(--s-2);
    font-size: var(--fs-xs);
    color: var(--text-mute);
  }
  .dist-legend > div { display: inline-flex; align-items: center; gap: 4px; }
  .dist-legend .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
  @media (max-width: 480px) {
    .grid-3 { grid-template-columns: 1fr 1fr; }
  }

  .ai-preview { display: flex; flex-direction: column; gap: var(--s-3); }
  .ap-title { font-size: var(--fs-lg); font-weight: 800; }
  .ap-macros {
    display: flex;
    gap: var(--s-2);
    flex-wrap: wrap;
  }
  .ap-macros .m-kcal {
    padding: 4px 10px;
    border-radius: var(--r-full);
    background: var(--accent-glow);
    color: var(--accent);
    font-weight: 800;
  }
  .ap-macros .m-mac {
    padding: 4px 10px;
    border-radius: var(--r-full);
    background: var(--bg-2);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  .ap-why {
    padding: var(--s-2) var(--s-3);
    background: var(--bg-2);
    border-left: 3px solid var(--accent);
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    color: var(--text-mute);
    font-style: italic;
    line-height: 1.5;
  }
  .ap-meals { display: flex; flex-direction: column; gap: var(--s-2); }
  .ap-meal {
    display: flex;
    gap: var(--s-3);
    padding: var(--s-2);
    background: var(--bg-2);
    border-radius: var(--r-md);
  }
  .ap-meal-time {
    width: 48px;
    text-align: center;
    padding: 6px 4px;
    background: var(--accent-glow);
    color: var(--accent);
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    font-weight: 800;
    height: fit-content;
    flex-shrink: 0;
  }
  .ap-meal-body { flex: 1; min-width: 0; }
  .ap-meal-name { font-weight: 700; font-size: var(--fs-sm); margin-bottom: 4px; }
  .ap-meal-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ap-item {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    display: flex;
    justify-content: space-between;
  }
  .ap-item .mono { color: var(--text); }
</style>
