<script lang="ts">
  import { analyzeBodyComposition, type BodyAnalyzerResult } from '$lib/db/gemini';
  import type { BodyComp, UserProfile } from '$lib/types';
  import Card from './Card.svelte';
  import Button from './Button.svelte';
  import Badge from './Badge.svelte';

  interface Props {
    profile: UserProfile;
    current: BodyComp;
    previous?: BodyComp;
    currentDietKcal?: number;
  }

  let { profile, current, previous, currentDietKcal }: Props = $props();

  let loading = $state(false);
  let result = $state<BodyAnalyzerResult | null>(null);
  let error = $state<string | null>(null);

  const weeksBetween = $derived.by(() => {
    if (!previous) return 0;
    const d1 = new Date(current.date).getTime();
    const d2 = new Date(previous.date).getTime();
    return Math.max(1, Math.round((d1 - d2) / (7 * 86400000)));
  });

  async function analyze() {
    loading = true;
    error = null;
    try {
      result = await analyzeBodyComposition({
        userProfile: {
          name: profile.name,
          goals: profile.goals,
          sex: (profile.sex ?? 'M') as 'M' | 'F' | 'outro',
          activityLevel: profile.activityLevel ?? 3
        },
        current,
        previous,
        weeksBetween,
        currentDietKcal
      });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }
</script>

<Card accent="glow">
  <div class="head">
    <div class="ai-badge">
      <span class="mi">auto_awesome</span>
      <span>Análise IA</span>
    </div>
    {#if previous}
      <div class="period">{weeksBetween} {weeksBetween === 1 ? 'semana' : 'semanas'} desde a última</div>
    {:else}
      <div class="period">Primeira avaliação</div>
    {/if}
  </div>

  {#if !result && !loading && !error}
    <p class="intro">
      Deixe a IA analisar essa avaliação e sugerir ajustes na dieta e treino pra alcançar seus objetivos mais rápido.
    </p>
    <Button icon="auto_awesome" full onclick={analyze}>
      Analisar composição
    </Button>
  {:else if loading}
    <div class="loading">
      <span class="mi spin">progress_activity</span>
      <span>Analisando seus dados…</span>
    </div>
  {:else if error}
    <div class="error">
      <span class="mi">error</span>
      <span>{error}</span>
    </div>
    <Button size="sm" onclick={analyze}>Tentar de novo</Button>
  {:else if result}
    <div class="narrative">{result.narrative}</div>

    {#if result.highlights.length > 0}
      <div class="section">
        <div class="sec-lbl">✨ Destaques</div>
        <ul class="list">
          {#each result.highlights as h (h)}<li>{h}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if result.concerns.length > 0}
      <div class="section warn">
        <div class="sec-lbl">⚠️ Atenção</div>
        <ul class="list">
          {#each result.concerns as c (c)}<li>{c}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if result.dietAdjustment}
      <div class="adj diet">
        <div class="adj-head">
          <span class="mi">restaurant</span>
          <div>
            <div class="adj-title">Ajuste na dieta</div>
            <div class="adj-delta mono">
              {result.dietAdjustment.kcalDelta > 0 ? '+' : ''}{result.dietAdjustment.kcalDelta} kcal
              {#if result.dietAdjustment.proteinGDelta}· {result.dietAdjustment.proteinGDelta > 0 ? '+' : ''}{result.dietAdjustment.proteinGDelta}g prot{/if}
            </div>
          </div>
        </div>
        <p>{result.dietAdjustment.rationale}</p>
      </div>
    {/if}

    {#if result.trainingAdjustment}
      <div class="adj training">
        <div class="adj-head">
          <span class="mi">fitness_center</span>
          <div>
            <div class="adj-title">Ajuste no treino</div>
            <div class="adj-focus">{result.trainingAdjustment.focus}</div>
          </div>
        </div>
        <div class="chips">
          {#if result.trainingAdjustment.addCardio}<Badge variant="info" size="sm" icon="directions_run">Adicionar cardio</Badge>{/if}
          {#if result.trainingAdjustment.deloadSuggested}<Badge variant="warn" size="sm" icon="hotel">Deload sugerido</Badge>{/if}
        </div>
        <p>{result.trainingAdjustment.rationale}</p>
      </div>
    {/if}

    <div class="goal">
      <span class="mi">flag</span>
      <div>
        <div class="goal-lbl">Meta próximas semanas</div>
        <div class="goal-text">{result.nextGoal}</div>
      </div>
    </div>

    <Button size="sm" variant="ghost" icon="refresh" onclick={analyze}>
      Reanalisar
    </Button>
  {/if}
</Card>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
  }
  .ai-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: var(--r-full);
    background: var(--grad-primary);
    color: var(--bg-0);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
  }
  .ai-badge .mi { font-size: 12px; }
  .period { font-size: var(--fs-xs); color: var(--text-mute); }

  .intro {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-bottom: var(--s-3);
    line-height: 1.5;
  }

  .loading, .error {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    justify-content: center;
    padding: var(--s-5);
    color: var(--text-mute);
  }
  .loading .mi { color: var(--accent); animation: spin 1s linear infinite; }
  .error { color: var(--danger); flex-direction: column; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .narrative {
    font-size: var(--fs-md);
    font-weight: 500;
    color: var(--text);
    line-height: 1.6;
    margin-bottom: var(--s-4);
  }

  .section {
    padding: var(--s-3);
    background: var(--bg-3);
    border-radius: var(--r-md);
    margin-bottom: var(--s-3);
  }
  .section.warn {
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 25%, transparent);
  }
  .sec-lbl {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    margin-bottom: var(--s-2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .list li {
    font-size: var(--fs-sm);
    padding-left: 16px;
    position: relative;
  }
  .list li::before {
    content: '•';
    position: absolute;
    left: 4px;
    color: var(--accent);
    font-weight: 800;
  }

  .adj {
    padding: var(--s-3);
    border-radius: var(--r-md);
    margin-bottom: var(--s-3);
    border: 1px solid;
  }
  .adj.diet {
    background: color-mix(in srgb, #3fb950 8%, transparent);
    border-color: color-mix(in srgb, #3fb950 30%, transparent);
  }
  .adj.training {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .adj-head {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    margin-bottom: var(--s-2);
  }
  .adj-head .mi {
    font-size: 22px;
    color: var(--accent);
  }
  .adj.diet .adj-head .mi { color: #3fb950; }
  .adj-title {
    font-weight: 700;
    font-size: var(--fs-sm);
  }
  .adj-delta {
    font-size: var(--fs-md);
    font-weight: 800;
    color: var(--accent);
    margin-top: 2px;
  }
  .adj.diet .adj-delta { color: #3fb950; }
  .adj-focus {
    font-size: var(--fs-sm);
    color: var(--text);
    margin-top: 2px;
  }
  .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: var(--s-2); }
  .adj p {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    line-height: 1.5;
  }

  .goal {
    display: flex;
    gap: var(--s-2);
    align-items: flex-start;
    padding: var(--s-3);
    background: var(--accent-glow);
    border-radius: var(--r-md);
    margin-bottom: var(--s-3);
  }
  .goal .mi {
    color: var(--accent);
    font-size: 22px;
    flex-shrink: 0;
  }
  .goal-lbl {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .goal-text {
    font-weight: 600;
    font-size: var(--fs-sm);
    color: var(--text);
    margin-top: 2px;
  }
</style>
