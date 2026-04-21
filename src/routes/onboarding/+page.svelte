<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { saveProfile, defaultSettings } from '$lib/db/profile';
  import type { Goal } from '$lib/types';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';

  const AVATARS = ['🏋️‍♂️','🏋️‍♀️','💪','🤸‍♂️','🤸‍♀️','🧘‍♂️','🧘‍♀️','🏃‍♂️','🏃‍♀️','🚴‍♂️','🚴‍♀️','🥊','🤾‍♂️','🦵','🔥','🌟'];

  const GOALS: { id: Goal; icon: string; label: string }[] = [
    { id: 'emagrecer',   icon: '🔥',  label: 'Emagrecimento'   },
    { id: 'massa',       icon: '💪',  label: 'Ganho de Massa'  },
    { id: 'qualidade',   icon: '🌟',  label: 'Qualidade de Vida' },
    { id: 'performance', icon: '⚡', label: 'Performance'      },
    { id: 'lesao',       icon: '🩹',  label: 'Recuperação'     }
  ];

  let step = $state(1);
  let name = $state('');
  let surname = $state('');
  let avatar = $state('🏋️‍♂️');
  let height = $state('');
  let weight = $state('');
  let sex = $state<'M' | 'F' | 'outro'>('M');
  let birthDate = $state('');
  let goals = $state<Set<Goal>>(new Set());
  let activityLevel = $state<1 | 2 | 3 | 4 | 5>(3);
  let busy = $state(false);

  // Pré-popula com dados do Google
  $effect(() => {
    const u = authStore.user;
    if (!u) return;
    if (!name && u.displayName) {
      const parts = u.displayName.trim().split(' ');
      name = parts[0] ?? '';
      surname = parts.slice(1).join(' ');
    }
  });

  function toggleGoal(g: Goal) {
    const next = new Set(goals);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    goals = next;
  }

  const canProceed = $derived.by(() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return Number(height) > 100 && Number(weight) > 30;
    if (step === 3) return goals.size > 0;
    return true;
  });

  async function finish() {
    if (!authStore.user) return;
    busy = true;
    try {
      await saveProfile(authStore.user.uid, {
        name: name.trim(),
        surname: surname.trim(),
        email: authStore.user.email ?? '',
        avatar,
        height: Number(height),
        weight: Number(weight),
        sex,
        birthDate: birthDate || undefined,
        goals: Array.from(goals),
        activityLevel,
        settings: defaultSettings()
      });
      goto('/home');
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap">
  <div class="progress">
    <div class="bar" style="width: {(step / 4) * 100}%"></div>
  </div>

  <div class="card">
    {#if step === 1}
      <div class="step-head">
        <span class="step-num">1/4</span>
        <h2>Como podemos te chamar?</h2>
        <p>Escolha seu nome e avatar pra personalizar o app</p>
      </div>

      <div class="avatar-preview">
        <div class="av-circle">{avatar}</div>
      </div>
      <div class="av-grid">
        {#each AVATARS as a (a)}
          <button
            class="av-opt"
            class:sel={avatar === a}
            onclick={() => (avatar = a)}
            aria-label="Avatar {a}"
          >{a}</button>
        {/each}
      </div>

      <Input label="Nome" icon="person" bind:value={name} placeholder="Renê" />
      <Input label="Sobrenome (opcional)" bind:value={surname} placeholder="Castro" />

    {:else if step === 2}
      <div class="step-head">
        <span class="step-num">2/4</span>
        <h2>Seus dados físicos</h2>
        <p>Usaremos pra calcular IMC, calorias e metas de dieta</p>
      </div>

      <div class="two">
        <Input type="number" label="Altura" bind:value={height} placeholder="175" suffix="cm" min="100" max="250" />
        <Input type="number" label="Peso atual" bind:value={weight} placeholder="80" suffix="kg" step="0.1" min="30" max="300" />
      </div>

      <div class="sex-row">
        <button class="sex-btn" class:sel={sex === 'M'} onclick={() => (sex = 'M')}>♂ Masculino</button>
        <button class="sex-btn" class:sel={sex === 'F'} onclick={() => (sex = 'F')}>♀ Feminino</button>
        <button class="sex-btn" class:sel={sex === 'outro'} onclick={() => (sex = 'outro')}>Outro</button>
      </div>

      <Input type="date" label="Data de nascimento (opcional)" bind:value={birthDate} />

    {:else if step === 3}
      <div class="step-head">
        <span class="step-num">3/4</span>
        <h2>Seus objetivos</h2>
        <p>Pode escolher mais de um — ajustaremos treinos e dieta</p>
      </div>

      <div class="goals-grid">
        {#each GOALS as g (g.id)}
          <button
            class="goal-opt"
            class:sel={goals.has(g.id)}
            onclick={() => toggleGoal(g.id)}
          >
            <span class="g-ic">{g.icon}</span>
            <span class="g-lbl">{g.label}</span>
          </button>
        {/each}
      </div>

    {:else if step === 4}
      <div class="step-head">
        <span class="step-num">4/4</span>
        <h2>Nível de atividade</h2>
        <p>Quanto você se exercita fora da academia?</p>
      </div>

      {#each [
        { v: 1, t: 'Sedentário',   s: 'Sem atividade física regular' },
        { v: 2, t: 'Leve',         s: '1-2x por semana' },
        { v: 3, t: 'Moderado',     s: '3-4x por semana' },
        { v: 4, t: 'Alto',         s: '5-6x por semana' },
        { v: 5, t: 'Atleta',       s: 'Diário + competições' }
      ] as opt (opt.v)}
        <button
          class="act-opt"
          class:sel={activityLevel === opt.v}
          onclick={() => (activityLevel = opt.v as 1|2|3|4|5)}
        >
          <div class="act-left">
            <div class="act-t">{opt.t}</div>
            <div class="act-s">{opt.s}</div>
          </div>
          <div class="act-dots">
            {#each [1,2,3,4,5] as i (i)}
              <span class="dot" class:on={i <= opt.v}></span>
            {/each}
          </div>
        </button>
      {/each}
    {/if}

    <div class="nav-row">
      {#if step > 1}
        <Button variant="ghost" onclick={() => step--}>Voltar</Button>
      {/if}
      {#if step < 4}
        <Button disabled={!canProceed} onclick={() => step++} iconRight="arrow_forward" full>
          Continuar
        </Button>
      {:else}
        <Button variant="success" onclick={finish} loading={busy} icon="check_circle" full>
          Concluir e entrar
        </Button>
      {/if}
    </div>
  </div>
</div>

<style>
  .wrap {
    min-height: 100dvh;
    padding: var(--s-6) var(--s-4);
    background: var(--grad-hero), var(--bg-1);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .progress {
    width: 100%;
    max-width: 480px;
    height: 6px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    margin-bottom: var(--s-6);
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--r-full);
    transition: width var(--dur-slow) var(--ease-spring);
  }

  .card {
    width: 100%;
    max-width: 480px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-2xl);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }

  .step-head { text-align: center; }
  .step-num {
    display: inline-block;
    padding: 4px 12px;
    border-radius: var(--r-full);
    background: var(--accent-glow);
    color: var(--accent);
    font-size: var(--fs-xs);
    font-weight: 700;
    font-family: var(--font-mono);
    margin-bottom: var(--s-3);
  }
  .step-head h2 {
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .step-head p {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-top: 4px;
  }

  .avatar-preview {
    display: flex;
    justify-content: center;
  }
  .av-circle {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: grid;
    place-items: center;
    font-size: 44px;
    box-shadow: var(--shadow-glow);
  }
  .av-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: var(--s-2);
  }
  .av-opt {
    aspect-ratio: 1;
    background: var(--bg-3);
    border-radius: var(--r-md);
    font-size: 20px;
    transition: background var(--dur-fast), transform var(--dur-fast);
  }
  .av-opt:hover { background: var(--bg-4); }
  .av-opt.sel {
    background: var(--accent-glow);
    box-shadow: inset 0 0 0 2px var(--accent);
    transform: scale(1.05);
  }

  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }

  .sex-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-2); }
  .sex-btn {
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-weight: 600;
    font-size: var(--fs-sm);
    transition: all var(--dur-fast);
  }
  .sex-btn.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .goals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  .goal-opt {
    padding: var(--s-4);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .goal-opt .g-ic { font-size: 28px; }
  .goal-opt.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
    transform: scale(1.02);
  }

  .act-opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-4);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    color: var(--text);
    transition: all var(--dur-fast);
  }
  .act-opt.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
  }
  .act-left { text-align: left; }
  .act-t { font-weight: 700; }
  .act-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .act-dots { display: flex; gap: 4px; }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bg-4);
  }
  .dot.on { background: var(--accent); }

  .nav-row {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-3);
  }
</style>
