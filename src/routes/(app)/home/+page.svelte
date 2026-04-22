<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { catalogStore } from '$lib/stores/catalog.svelte';
  import { listWorkouts } from '$lib/db/workouts';
  import { listSessions } from '$lib/db/sessions';
  import { getSchedule } from '$lib/db/schedule';
  import { getProfile } from '$lib/db/profile';
  import type { Workout, Session, UserProfile, Schedule } from '$lib/types';
  import { CATEGORY_ICON, CATEGORY_LABEL, todayISO } from '$lib/utils/format';
  import Card from '$lib/components/Card.svelte';
  import Stat from '$lib/components/Stat.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import WeeklySchedule from '$lib/components/WeeklySchedule.svelte';
  import { randomPhrase } from '$lib/data/motivation';
  import { withTimeout } from '$lib/utils/withTimeout';
  import { checkIsAdmin } from '$lib/admin';
  import { listMyTrainers } from '$lib/db/relationships';
  import type { Relationship } from '$lib/types';

  let profile = $state<UserProfile | null>(null);
  let workouts = $state<Workout[]>([]);
  let sessions = $state<Session[]>([]);
  let schedule = $state<Schedule | null>(null);
  let loading = $state(true);
  let isAdminUser = $state(false);
  let myTrainers = $state<Relationship[]>([]);
  // Sorteada uma vez por carregamento da home
  const phrase = randomPhrase();

  let loadError = $state<string | null>(null);

  async function load() {
    if (!authStore.uid) { loading = false; return; }
    loading = true;
    loadError = null;
    try {
      await catalogStore.ensure();
      [profile, workouts, sessions, schedule, isAdminUser, myTrainers] = await withTimeout(
        Promise.all([
          getProfile(authStore.uid),
          listWorkouts(authStore.uid),
          listSessions(authStore.uid, 50),
          getSchedule(authStore.uid),
          checkIsAdmin(authStore.uid),
          listMyTrainers(authStore.uid).catch(() => [] as Relationship[])
        ]),
        10_000,
        'carregar home'
      );
    } catch (e) {
      console.error('Falha ao carregar home:', e);
      loadError = 'Falha ao carregar. Toque pra tentar de novo.';
    } finally {
      loading = false;
    }
  }

  onMount(() => { load(); });

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  });

  const firstName = $derived(profile?.name ?? authStore.user?.displayName?.split(' ')[0] ?? 'atleta');

  // Streak: dias consecutivos com sessão até hoje
  const streak = $derived.by(() => {
    if (sessions.length === 0) return 0;
    const dates = new Set(sessions.map((s) => s.date));
    let s = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const iso = d.toISOString().slice(0, 10);
      if (dates.has(iso)) { s++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); } // ainda pode treinar hoje
      else break;
    }
    return s;
  });

  const weekCount = $derived.by(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const iso = weekStart.toISOString().slice(0, 10);
    return sessions.filter((s) => s.date >= iso).length;
  });

  const totalCount = $derived(sessions.length);

  // Treino de hoje: baseado na grade semanal
  const todayWorkout = $derived.by(() => {
    if (!schedule) return null;
    const day = new Date().getDay();
    const plan = schedule.days[day];
    if (!plan || plan.rest || plan.workoutIds.length === 0) return null;
    const w = workouts.find((x) => plan.workoutIds.includes(x.id));
    return w ?? null;
  });

  const didTrainToday = $derived(sessions.some((s) => s.date === todayISO()));

  // Convite pro app
  const APP_URL = 'https://fibra-f1d34.web.app';
  const inviteText =
    `Testa o FIBRA comigo — app de treino + corrida + dieta + comunidade. ` +
    `Dá pra trocar treino com amigos, subir no ranking, e tem chat com personal trainer. ${APP_URL}`;

  async function shareApp() {
    const shareData = {
      title: 'FIBRA',
      text: 'App de treino + corrida + dieta + comunidade.',
      url: APP_URL
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelou */ }
    } else {
      await navigator.clipboard.writeText(inviteText);
      alert('Link copiado! Cola onde quiser.');
    }
  }
</script>

{#if loadError}
  <button class="retry-box" onclick={load}>
    <span class="mi">refresh</span>
    <span>{loadError}</span>
  </button>
{/if}

<!-- Hero -->
<div class="hero">
  <div class="hero-top">
    <div>
      <div class="greet">{greeting},</div>
      <div class="name">{firstName} 👋</div>
    </div>
    {#if streak > 0}
      <Badge variant="accent" icon="local_fire_department">{streak} {streak === 1 ? 'dia' : 'dias'}</Badge>
    {/if}
  </div>
  <div class="hero-tag">
    {#if didTrainToday}
      Você já treinou hoje. Fibra em dia. 🔥
    {:else if todayWorkout}
      Pronto pra mais uma fibra?
    {:else}
      Cada fibra conta hoje.
    {/if}
  </div>
  <div class="hero-phrase">
    <span class="mi">auto_awesome</span>
    <span>{phrase}</span>
  </div>
</div>

<!-- Stats -->
<div class="stats">
  <Stat label="Sequência" value={streak} icon="bolt" accent={streak > 0 ? 'accent' : 'default'} />
  <Stat label="Semana" value={weekCount} icon="calendar_today" />
  <Stat label="Total" value={totalCount} icon="fitness_center" />
</div>

<!-- Treino de hoje -->
{#if todayWorkout && !didTrainToday}
  <div class="today">
    <div class="today-head">
      <span class="today-label">Treino de hoje</span>
      <Badge category={todayWorkout.category}>
        {CATEGORY_ICON[todayWorkout.category]} {CATEGORY_LABEL[todayWorkout.category]}
      </Badge>
    </div>
    <div class="today-title">{todayWorkout.name}</div>
    <div class="today-meta">
      <span><span class="mi">fitness_center</span> {todayWorkout.exercises.length} exercícios</span>
      <span><span class="mi">repeat</span> {todayWorkout.exercises.reduce((a, e) => a + e.sets.length, 0)} séries</span>
    </div>
    <Button size="lg" icon="play_arrow" full onclick={() => goto(`/registrar/${todayWorkout.id}`)}>
      Começar agora
    </Button>
  </div>
{:else if didTrainToday}
  <Card accent="glow">
    <div class="done-today">
      <div class="done-ic">✅</div>
      <div>
        <div class="done-t">Missão de hoje cumprida</div>
        <div class="done-s">Você treinou. +1 fibra na conta.</div>
      </div>
    </div>
  </Card>
{:else if !loading && schedule}
  <Card>
    <div class="no-plan">
      <span class="mi">event_available</span>
      <div>
        <div class="np-t">Dia sem treino agendado</div>
        <div class="np-s">Se quiser, comece um treino livre ou ajuste a grade.</div>
      </div>
    </div>
    <div class="np-btns">
      <Button size="sm" variant="secondary" onclick={() => goto('/registrar')}>Treino livre</Button>
    </div>
  </Card>
{/if}

<!-- Módulos -->
<div class="sec-title">Módulos</div>
<div class="menu-grid">
  <Card onclick={() => goto('/treinos')} padding="md">
    <div class="mc">
      <div class="mc-ic" style="background:var(--grad-primary)"><span class="mi">library_add</span></div>
      <div class="mc-body">
        <div class="mc-name">Banco de Treinos</div>
        <div class="mc-sub">{workouts.length} salvos</div>
      </div>
    </div>
  </Card>
  <Card onclick={() => goto('/dieta')} padding="md">
    <div class="mc">
      <div class="mc-ic" style="background:var(--grad-green)"><span class="mi">restaurant</span></div>
      <div class="mc-body">
        <div class="mc-name">Dieta</div>
        <div class="mc-sub">Macros do dia</div>
      </div>
    </div>
  </Card>
  <Card onclick={() => goto('/progresso')} padding="md">
    <div class="mc">
      <div class="mc-ic" style="background:var(--grad-purple)"><span class="mi">insights</span></div>
      <div class="mc-body">
        <div class="mc-name">Progresso</div>
        <div class="mc-sub">Gráficos e recordes</div>
      </div>
    </div>
  </Card>
  <Card onclick={() => goto('/corpo')} padding="md">
    <div class="mc">
      <div class="mc-ic" style="background:var(--grad-fire)"><span class="mi">monitor_heart</span></div>
      <div class="mc-body">
        <div class="mc-name">Corpo</div>
        <div class="mc-sub">Bioimpedância</div>
      </div>
    </div>
  </Card>
</div>

<!-- Grade semanal -->
<div class="sec-title">Grade semanal</div>
<Card>
  <WeeklySchedule />
</Card>

<!-- Trainer/Nutri dashboard (se aprovado) -->
{#if profile?.settings?.role && profile.settings.role !== 'athlete'}
  <div class="sec-title">Assessoria</div>
  <Card onclick={() => goto('/trainer')} accent="glow" padding="md">
    <div class="rank-promo">
      <div class="rp-ic">
        {#if profile.settings.role === 'both'}🏆
        {:else if profile.settings.role === 'nutritionist'}🥗
        {:else}💪{/if}
      </div>
      <div class="rp-body">
        <div class="rp-t">Meus clientes</div>
        <div class="rp-s">Gerencie atletas que você assiste.</div>
      </div>
      <span class="mi chev">chevron_right</span>
    </div>
  </Card>
{/if}

<!-- Meus treinadores/nutris (como cliente) -->
{#if myTrainers.length > 0}
  <div class="sec-title">Meu time</div>
  {#each myTrainers as t (t.id)}
    <Card onclick={() => goto(`/chat/${t.id}`)} padding="md">
      <div class="integ">
        <div class="trainer-ava">
          {#if t.trainerAvatar?.startsWith('http')}
            <img src={t.trainerAvatar} alt={t.trainerName} />
          {:else}
            <span>{t.trainerAvatar || (t.trainerRole === 'nutritionist' ? '🥗' : '💪')}</span>
          {/if}
        </div>
        <div class="integ-body">
          <div class="integ-name">{t.trainerName}</div>
          <div class="integ-sub">
            {t.trainerRole === 'nutritionist' ? 'Seu nutricionista' : 'Seu personal trainer'}
            · 💬 Chat
          </div>
        </div>
        <span class="mi chev">chevron_right</span>
      </div>
    </Card>
  {/each}
{/if}

<!-- Ranking + Grupos + Admin em pilha consistente -->
<div class="sec-title">Comunidade</div>
<div class="stack">
  <Card onclick={() => goto('/comunidade')} accent="glow" padding="md">
    <div class="integ">
      <div class="integ-ic"><span class="mi">emoji_events</span></div>
      <div class="integ-body">
        <div class="integ-name">Ranking da comunidade</div>
        <div class="integ-sub">Quem tá treinando mais · trocar treinos</div>
      </div>
      <span class="mi chev">chevron_right</span>
    </div>
  </Card>

  <Card onclick={() => goto('/grupos')} padding="md">
    <div class="integ">
      <div class="integ-ic"><span class="mi">groups</span></div>
      <div class="integ-body">
        <div class="integ-name">Grupos</div>
        <div class="integ-sub">Crie sua tribo · mural de incentivo</div>
      </div>
      <span class="mi chev">chevron_right</span>
    </div>
  </Card>

  {#if isAdminUser}
    <Card onclick={() => goto('/admin')} padding="md">
      <div class="integ">
        <div class="integ-ic"><span class="mi">admin_panel_settings</span></div>
        <div class="integ-body">
          <div class="integ-name">Admin</div>
          <div class="integ-sub">Aprovar pedidos de trainer/nutricionista</div>
        </div>
        <span class="mi chev">chevron_right</span>
      </div>
    </Card>
  {/if}
</div>

<div class="sec-title">Extras</div>
<Card onclick={() => goto('/instalar')} padding="md">
  <div class="integ">
    <div class="integ-ic"><span class="mi">add_to_home_screen</span></div>
    <div class="integ-body">
      <div class="integ-name">Instalar na tela inicial</div>
      <div class="integ-sub">Como salvar o FIBRA como app no iPhone/Android</div>
    </div>
    <span class="mi chev">chevron_right</span>
  </div>
</Card>

<!-- Convidar alguém -->
<div class="invite-wrap">
  <div class="invite-tagline">
    Chama a galera pra treinar junto.
  </div>
  <div class="invite-btns">
    <button class="inv-btn share" onclick={shareApp}>
      <span class="mi">ios_share</span>
      Compartilhar
    </button>
    <a
      class="inv-btn wa"
      href="https://wa.me/?text={encodeURIComponent(inviteText)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="inv-emo">💬</span>
      WhatsApp
    </a>
    <a
      class="inv-btn mail"
      href="mailto:?subject={encodeURIComponent('Conhece o FIBRA?')}&body={encodeURIComponent(inviteText)}"
    >
      <span class="mi">mail</span>
      E-mail
    </a>
  </div>
</div>

<style>
  .hero {
    background: var(--grad-hero);
    border: 1px solid var(--border);
    border-radius: var(--r-2xl);
    padding: var(--s-5);
    margin-bottom: var(--s-4);
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--s-3);
  }
  .greet { color: var(--text-mute); font-size: var(--fs-sm); }
  .name { font-size: var(--fs-2xl); font-weight: 800; letter-spacing: -0.02em; }
  .hero-tag { margin-top: var(--s-2); color: var(--text-mute); font-size: var(--fs-sm); font-style: italic; }
  .retry-box {
    width: 100%;
    display: flex;
    gap: var(--s-2);
    align-items: center;
    justify-content: center;
    padding: var(--s-3) var(--s-4);
    margin-bottom: var(--s-3);
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border: 1px solid var(--warning);
    border-radius: var(--r-lg);
    color: var(--warning);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .retry-box .mi { font-size: 20px; }
  .hero-phrase {
    margin-top: var(--s-3);
    padding: var(--s-2) var(--s-3);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-left: 3px solid var(--accent);
    border-radius: 0 var(--r-md) var(--r-md) 0;
    display: flex;
    gap: var(--s-2);
    align-items: center;
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 500;
    line-height: 1.4;
  }
  .hero-phrase .mi { font-size: 16px; color: var(--accent); flex-shrink: 0; }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-2);
    margin-bottom: var(--s-4);
  }
  @media (max-width: 380px) {
    .stats { grid-template-columns: 1fr 1fr; }
  }

  .today {
    background: linear-gradient(var(--bg-2), var(--bg-2)) padding-box,
                var(--grad-primary) border-box;
    border: 1px solid transparent;
    border-radius: var(--r-xl);
    padding: var(--s-5);
    margin-bottom: var(--s-5);
  }
  .today-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
  }
  .today-label {
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-mute);
    font-weight: 700;
  }
  .today-title { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; margin-bottom: var(--s-2); }
  .today-meta {
    display: flex;
    gap: var(--s-4);
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-bottom: var(--s-4);
  }
  .today-meta span { display: inline-flex; align-items: center; gap: 4px; }
  .today-meta .mi { font-size: 16px; }

  .done-today {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    padding: var(--s-2);
  }
  .done-ic { font-size: 36px; }
  .done-t { font-weight: 700; }
  .done-s { color: var(--text-mute); font-size: var(--fs-sm); }

  .no-plan {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    color: var(--text);
  }
  .no-plan .mi { font-size: 28px; color: var(--text-mute); }
  .np-t { font-weight: 700; }
  .np-s { color: var(--text-mute); font-size: var(--fs-sm); }
  .np-btns { margin-top: var(--s-3); display: flex; gap: var(--s-2); }

  .sec-title {
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-mute);
    font-weight: 700;
    margin: var(--s-5) 0 var(--s-2);
  }

  /* Stack de cards com espacamento consistente (home / comunidade) */
  .stack { display: flex; flex-direction: column; gap: var(--s-2); }

  .menu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-2);
  }
  .mc { display: flex; gap: var(--s-3); align-items: center; }
  .mc-ic {
    width: 40px;
    height: 40px;
    border-radius: var(--r-md);
    display: grid;
    place-items: center;
    color: var(--bg-0);
    flex-shrink: 0;
  }
  .mc-ic .mi { font-size: 20px; }
  .mc-name { font-weight: 700; font-size: var(--fs-sm); }
  .mc-sub { color: var(--text-mute); font-size: var(--fs-xs); }

  .integ { display: flex; align-items: center; gap: var(--s-3); }

  .trainer-ava {
    width: 44px; height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bg-3);
    border: 1px solid var(--border);
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .trainer-ava img { width: 100%; height: 100%; object-fit: cover; }
  .trainer-ava span { font-size: 24px; }

  .rank-promo {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }
  .rp-ic {
    font-size: 40px;
    flex-shrink: 0;
  }
  .rp-body { flex: 1; }
  .rp-t {
    font-size: var(--fs-lg);
    font-weight: 800;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    letter-spacing: -0.01em;
  }
  .rp-s {
    font-size: var(--fs-sm);
    color: var(--text-mute);
    margin-top: 2px;
  }

  .invite-wrap {
    margin-top: var(--s-6);
    padding: var(--s-4) var(--s-3);
    text-align: center;
  }
  .invite-tagline {
    font-size: var(--fs-sm);
    color: var(--text-mute);
    font-style: italic;
    margin-bottom: var(--s-3);
  }
  .invite-btns {
    display: flex;
    gap: var(--s-2);
    justify-content: center;
    flex-wrap: wrap;
  }
  .inv-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: var(--r-full);
    background: var(--bg-3);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: var(--fs-sm);
    font-weight: 600;
    text-decoration: none;
    transition: border-color var(--dur-fast);
  }
  @media (hover: hover) {
    .inv-btn:hover { border-color: var(--accent); }
  }
  .inv-btn:active { transform: scale(0.96); }
  .inv-btn .mi { font-size: 18px; }
  .inv-btn.share { background: var(--grad-primary); color: var(--bg-0); border-color: transparent; }
  .inv-btn.wa { background: color-mix(in srgb, #25d366 15%, var(--bg-3)); border-color: color-mix(in srgb, #25d366 30%, var(--border)); }
  .inv-emo { font-size: 18px; }
  .integ-ic {
    width: 40px;
    height: 40px;
    border-radius: var(--r-md);
    background: var(--bg-3);
    display: grid;
    place-items: center;
  }
  .integ-body { flex: 1; }
  .integ-name { font-weight: 700; font-size: var(--fs-sm); }
  .integ-sub { color: var(--text-mute); font-size: var(--fs-xs); }
  .chev { color: var(--text-dim); }
</style>
