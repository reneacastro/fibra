<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile, saveProfile } from '$lib/db/profile';
  import { seedCatalog } from '$lib/db/catalog';
  import type { UserProfile, Goal } from '$lib/types';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import Badge from '$lib/components/Badge.svelte';

  const AVATARS = ['🏋️‍♂️','🏋️‍♀️','💪','🤸‍♂️','🤸‍♀️','🧘‍♂️','🧘‍♀️','🏃‍♂️','🏃‍♀️','🚴‍♂️','🚴‍♀️','🥊','🤾‍♂️','🦵','🔥','🌟'];
  const GOALS: { id: Goal; icon: string; label: string }[] = [
    { id: 'emagrecer',   icon: '🔥',  label: 'Emagrecimento'   },
    { id: 'massa',       icon: '💪',  label: 'Ganho de Massa'  },
    { id: 'qualidade',   icon: '🌟',  label: 'Qualidade de Vida' },
    { id: 'performance', icon: '⚡', label: 'Performance'      },
    { id: 'lesao',       icon: '🩹',  label: 'Recuperação'     }
  ];

  let profile = $state<UserProfile | null>(null);
  let saving = $state(false);
  let seeding = $state(false);
  let seedDone = $state(false);
  let dirty = $state(false);

  onMount(async () => {
    if (!authStore.uid) return;
    profile = await getProfile(authStore.uid);
  });

  function toggleGoal(g: Goal) {
    if (!profile) return;
    const next = new Set(profile.goals);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    profile = { ...profile, goals: Array.from(next) };
    dirty = true;
  }

  function field<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    if (!profile) return;
    profile = { ...profile, [key]: value };
    dirty = true;
  }

  async function save() {
    if (!authStore.uid || !profile) return;
    saving = true;
    try {
      await saveProfile(authStore.uid, profile);
      dirty = false;
    } finally {
      saving = false;
    }
  }

  async function runSeed() {
    if (!confirm('Isso vai popular o Firestore com os 41 exercícios padrão. Continuar?')) return;
    seeding = true;
    try {
      await seedCatalog();
      seedDone = true;
    } catch (e) {
      alert('Falha ao semear: ' + (e as Error).message);
    } finally {
      seeding = false;
    }
  }

  async function logout() {
    if (!confirm('Sair da conta?')) return;
    await authStore.signOut();
    goto('/login');
  }
</script>

{#if profile}
  <!-- Avatar + nome -->
  <Card>
    <div class="hero">
      <div class="avatar-big">{profile.avatar}</div>
      <div class="hero-info">
        <div class="hero-name">{profile.name} {profile.surname ?? ''}</div>
        <div class="hero-email">{profile.email}</div>
      </div>
    </div>

    <div class="sec-label">Avatar</div>
    <div class="av-grid">
      {#each AVATARS as a (a)}
        <button
          class="av-opt"
          class:sel={profile.avatar === a}
          onclick={() => field('avatar', a)}
        >{a}</button>
      {/each}
    </div>
  </Card>

  <!-- Dados pessoais -->
  <Card title="Dados pessoais" icon="person">
    <Input
      label="Nome"
      value={profile.name}
      oninput={(e) => field('name', (e.currentTarget as HTMLInputElement).value)}
    />
    <div class="spacer"></div>
    <Input
      label="Sobrenome"
      value={profile.surname ?? ''}
      oninput={(e) => field('surname', (e.currentTarget as HTMLInputElement).value)}
    />
    <div class="spacer"></div>
    <div class="two">
      <Input
        type="number"
        label="Altura"
        suffix="cm"
        value={String(profile.height)}
        oninput={(e) => field('height', Number((e.currentTarget as HTMLInputElement).value) || 0)}
      />
      <Input
        type="number"
        label="Peso"
        suffix="kg"
        step="0.1"
        value={String(profile.weight)}
        oninput={(e) => field('weight', Number((e.currentTarget as HTMLInputElement).value) || 0)}
      />
    </div>
  </Card>

  <!-- Objetivos -->
  <Card title="Objetivos" icon="flag">
    <div class="goals-grid">
      {#each GOALS as g (g.id)}
        <button
          class="goal-opt"
          class:sel={profile.goals.includes(g.id)}
          onclick={() => toggleGoal(g.id)}
        >
          <span class="g-ic">{g.icon}</span>
          <span class="g-lbl">{g.label}</span>
        </button>
      {/each}
    </div>
  </Card>

  <!-- Preferências -->
  <Card title="Preferências" icon="tune">
    <label class="toggle-row">
      <div>
        <div class="tr-t">Feedback háptico</div>
        <div class="tr-s">Vibrar ao completar séries e bater recordes</div>
      </div>
      <input
        type="checkbox"
        checked={profile.settings?.hapticFeedback ?? true}
        onchange={(e) => field('settings', { ...profile!.settings, hapticFeedback: e.currentTarget.checked })}
      />
    </label>
    <label class="toggle-row">
      <div>
        <div class="tr-t">Perfil público</div>
        <div class="tr-s">Permitir link compartilhável do seu progresso</div>
      </div>
      <input
        type="checkbox"
        checked={profile.settings?.publicProfile ?? false}
        onchange={(e) => field('settings', { ...profile!.settings, publicProfile: e.currentTarget.checked })}
      />
    </label>
  </Card>

  <!-- Admin -->
  <Card title="Administração" icon="admin_panel_settings">
    <div class="admin-row">
      <div>
        <div class="ar-t">Semear catálogo de exercícios</div>
        <div class="ar-s">
          {seedDone ? '✅ Catálogo populado no Firestore' : 'Sobe os 41 exercícios padrão pro Firestore (só na primeira vez).'}
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        icon={seedDone ? 'refresh' : 'cloud_upload'}
        loading={seeding}
        onclick={runSeed}
      >
        {seedDone ? 'Re-semear' : 'Semear'}
      </Button>
    </div>
  </Card>

  <!-- Ações -->
  <div class="footer">
    <Button variant="ghost" icon="logout" onclick={logout}>Sair</Button>
    <Button icon="save" full loading={saving} disabled={!dirty} onclick={save}>
      Salvar alterações
    </Button>
  </div>
{:else}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .hero {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    margin-bottom: var(--s-4);
  }
  .avatar-big {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: grid;
    place-items: center;
    font-size: 36px;
    box-shadow: var(--shadow-glow);
  }
  .hero-name { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; }
  .hero-email { color: var(--text-mute); font-size: var(--fs-sm); }

  .sec-label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: var(--s-2);
  }

  .av-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  }
  .av-opt {
    aspect-ratio: 1;
    background: var(--bg-3);
    border-radius: var(--r-md);
    font-size: 20px;
    transition: all var(--dur-fast);
  }
  .av-opt:hover { background: var(--bg-4); }
  .av-opt.sel {
    background: var(--accent-glow);
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .spacer { height: var(--s-3); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }

  .goals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  .goal-opt {
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text);
    font-size: var(--fs-xs);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .goal-opt .g-ic { font-size: 20px; }
  .goal-opt.sel {
    background: var(--accent-glow);
    border-color: var(--accent);
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--s-2) 0;
    gap: var(--s-3);
    cursor: pointer;
  }
  .toggle-row + .toggle-row { border-top: 1px solid var(--border); }
  .tr-t { font-weight: 600; font-size: var(--fs-sm); }
  .tr-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .toggle-row input[type=checkbox] {
    width: 44px;
    height: 24px;
    appearance: none;
    background: var(--bg-4);
    border-radius: var(--r-full);
    position: relative;
    cursor: pointer;
    transition: background var(--dur-fast);
  }
  .toggle-row input[type=checkbox]::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: left var(--dur-fast) var(--ease-spring);
  }
  .toggle-row input[type=checkbox]:checked {
    background: var(--accent);
  }
  .toggle-row input[type=checkbox]:checked::before {
    left: 22px;
  }

  .admin-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s-3);
  }
  .ar-t { font-weight: 600; font-size: var(--fs-sm); }
  .ar-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .footer {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-4);
    padding-bottom: var(--s-4);
  }
</style>
