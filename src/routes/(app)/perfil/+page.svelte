<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile, saveProfile } from '$lib/db/profile';
  import { getMyRoleRequest, submitRoleRequest, cancelRoleRequest } from '$lib/db/roleRequests';
  import type { UserProfile, Goal, RoleRequest } from '$lib/types';
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
  let dirty = $state(false);
  let roleRequest = $state<RoleRequest | null>(null);
  let roleNote = $state('');

  onMount(async () => {
    if (!authStore.uid) return;
    profile = await getProfile(authStore.uid);
    roleRequest = await getMyRoleRequest(authStore.uid);
  });

  const approvedRole = $derived(profile?.settings?.role ?? 'athlete');

  let wantTrainer = $state(false);
  let wantNutri = $state(false);

  async function submitRoles() {
    if (!authStore.uid || !profile) return;
    if (!wantTrainer && !wantNutri) {
      alert('Escolha pelo menos um: Personal trainer ou Nutricionista.');
      return;
    }
    const role: 'trainer' | 'nutritionist' | 'both' =
      wantTrainer && wantNutri ? 'both' : wantTrainer ? 'trainer' : 'nutritionist';
    await requestRole(role);
    wantTrainer = false;
    wantNutri = false;
  }

  async function requestRole(role: 'trainer' | 'nutritionist' | 'both') {
    if (!authStore.uid || !profile) return;
    await submitRoleRequest({
      uid: authStore.uid,
      name: profile.name || authStore.user?.displayName || 'Usuário',
      avatar: authStore.user?.photoURL || profile.avatar,
      requestedRole: role,
      note: roleNote.trim() || undefined,
      createdAt: Date.now()
    });
    roleRequest = await getMyRoleRequest(authStore.uid);
    roleNote = '';
    alert('Pedido enviado. Um admin vai avaliar.');
  }

  async function cancelRequest() {
    if (!authStore.uid) return;
    if (!confirm('Cancelar seu pedido?')) return;
    await cancelRoleRequest(authStore.uid);
    roleRequest = null;
  }

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
      {#if authStore.user?.photoURL}
        <div class="avatar-big photo">
          <img src={authStore.user.photoURL} alt="Perfil" referrerpolicy="no-referrer" />
        </div>
      {:else}
        <div class="avatar-big">{profile.avatar}</div>
      {/if}
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

  <!-- Papel no app -->
  <Card title="Papel no app" icon="workspace_premium">
    <div class="role-sub">
      Treinadores e nutricionistas podem assistir clientes, criando treinos
      e planos direto no app deles. <strong>Precisa de aprovação do admin</strong>
      antes de virar trainer ou nutri (pra garantir que a pessoa é real).
    </div>

    {#if approvedRole !== 'athlete'}
      <div class="role-status approved">
        <span class="mi">verified</span>
        <div>
          <div class="rs-t">
            Você é {approvedRole === 'both' ? 'personal trainer + nutricionista' : approvedRole === 'trainer' ? 'personal trainer' : 'nutricionista'} aprovado
          </div>
          <div class="rs-s">Dashboard disponível em "Meus clientes"</div>
        </div>
      </div>
    {:else if roleRequest}
      <div class="role-status pending">
        <span class="mi spin">hourglass_top</span>
        <div>
          <div class="rs-t">Aguardando aprovação</div>
          <div class="rs-s">
            Pediu: {roleRequest.requestedRole === 'both' ? 'Personal trainer + Nutricionista' : roleRequest.requestedRole === 'trainer' ? 'Personal trainer' : 'Nutricionista'}
          </div>
        </div>
        <Button size="sm" variant="ghost" onclick={cancelRequest}>Cancelar</Button>
      </div>
    {:else}
      <div class="role-options">
        <div class="r-title">Pedir promoção — escolha um ou os dois</div>
        <label class="role-check">
          <input type="checkbox" bind:checked={wantTrainer} />
          <span class="r-ic">💪</span>
          <div class="r-body">
            <div class="r-t">Personal trainer</div>
            <div class="r-s">Monto treinos pra clientes</div>
          </div>
        </label>
        <label class="role-check">
          <input type="checkbox" bind:checked={wantNutri} />
          <span class="r-ic">🥗</span>
          <div class="r-body">
            <div class="r-t">Nutricionista</div>
            <div class="r-s">Monto dietas pra clientes</div>
          </div>
        </label>
        <textarea
          bind:value={roleNote}
          placeholder="Opcional: conta pro admin quem você é (ex: 'sou CREF 123, atendo há 5 anos')"
          rows="2"
          maxlength="300"
        ></textarea>
        <div class="spacer-xs"></div>
        <Button icon="send" full disabled={!wantTrainer && !wantNutri} onclick={submitRoles}>
          Enviar pedido
        </Button>
      </div>
    {/if}
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
    overflow: hidden;
  }
  .avatar-big.photo {
    background: var(--bg-3);
    border: 2px solid var(--accent);
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.4);
  }
  .avatar-big.photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  .role-sub {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    margin-bottom: var(--s-3);
    line-height: 1.5;
  }
  .role-status {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    padding: var(--s-3);
    border-radius: var(--r-md);
  }
  .role-status.approved {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
    color: var(--success);
  }
  .role-status.pending {
    background: color-mix(in srgb, var(--warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
    color: var(--warning);
    justify-content: space-between;
  }
  .role-status .mi { font-size: 28px; flex-shrink: 0; }
  .role-status.pending .mi { animation: spin 2s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rs-t { font-weight: 700; font-size: var(--fs-sm); color: var(--text); }
  .rs-s { font-size: var(--fs-xs); opacity: 0.8; margin-top: 2px; }

  .role-options textarea {
    width: 100%;
    padding: var(--s-2) var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    resize: vertical;
  }
  .spacer-xs { height: var(--s-2); }
  .r-title { font-size: var(--fs-xs); font-weight: 700; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: var(--s-2); }
  .role-check {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    margin-bottom: var(--s-2);
    cursor: pointer;
  }
  .role-check input[type=checkbox] {
    width: 20px; height: 20px;
    flex-shrink: 0;
    accent-color: var(--accent);
  }
  .role-check:has(input:checked) {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--bg-3));
  }
  .r-ic { font-size: 28px; flex-shrink: 0; }
  .r-t { font-weight: 700; font-size: var(--fs-sm); }
  .r-s { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }

  .footer {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-4);
    padding-bottom: var(--s-4);
  }
</style>
