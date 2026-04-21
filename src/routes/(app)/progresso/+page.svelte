<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { listSessions } from '$lib/db/sessions';
  import { listBodyComp } from '$lib/db/bodyComp';
  import { getProfile } from '$lib/db/profile';
  import { getActiveDietPlan, getMealLog, listRecentMealLogs, computeMealLogTotals } from '$lib/db/diet';
  import { coachStore } from '$lib/stores/coach.svelte';
  import type { Session, BodyComp, UserProfile, DietPlan, MealLog } from '$lib/types';
  import {
    CATEGORY_LABEL, CATEGORY_ICON, fmtDateShort, fmtDateRelative, fmtKg, todayISO
  } from '$lib/utils/format';
  import { computeMilestones, recentPRs, type Milestone } from '$lib/utils/milestones';
  import Card from '$lib/components/Card.svelte';
  import TrendCard from '$lib/components/TrendCard.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';
  import ShareSheet from '$lib/components/ShareSheet.svelte';
  import type { ShareCardData } from '$lib/utils/shareCard';

  let sessions = $state<Session[]>([]);
  let bodyComp = $state<BodyComp[]>([]);
  let profile = $state<UserProfile | null>(null);
  let dietPlan = $state<DietPlan | null>(null);
  let todayLog = $state<MealLog | null>(null);
  let recentMealLogs = $state<MealLog[]>([]);
  let loading = $state(true);
  let shareData = $state<ShareCardData | null>(null);

  let period = $state<7 | 30 | 90 | 365>(30);

  onMount(async () => {
    if (!authStore.uid) { loading = false; return; }
    const uid = authStore.uid;
    try {
      [sessions, bodyComp, profile, dietPlan, todayLog, recentMealLogs] = await Promise.all([
        listSessions(uid, 365),
        listBodyComp(uid, 200),
        getProfile(uid),
        getActiveDietPlan(uid),
        getMealLog(uid, todayISO()),
        listRecentMealLogs(uid, 14)
      ]);
      coachStore.load(uid);
    } catch (e) {
      console.error('Falha ao carregar progresso:', e);
    } finally {
      loading = false;
    }
  });

  // ─── Filtro por período ────────────────────────────
  const cutoffISO = $derived.by(() => {
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d.toISOString().slice(0, 10);
  });
  const filtered = $derived(sessions.filter((s) => s.date >= cutoffISO));

  // ─── Sequência atual ───────────────────────────────
  const currentStreak = $derived.by(() => {
    if (sessions.length === 0) return 0;
    const dates = new Set(sessions.map((s) => s.date));
    let s = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const iso = d.toISOString().slice(0, 10);
      if (dates.has(iso)) { s++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  });

  const allMilestones = $derived(computeMilestones(sessions, bodyComp));
  const bestStreak = $derived.by(() => {
    const m = allMilestones.find((x) => x.id.startsWith('streak-') && x.achieved);
    // pega o maior alcançado
    const achieved = allMilestones.filter((x) => x.id.startsWith('streak-') && x.achieved);
    if (achieved.length === 0) return 0;
    return Math.max(...achieved.map((x) => Number(x.id.replace('streak-', ''))));
  });

  // ─── Último treino / última avaliação ──────────────
  const lastSession = $derived(sessions[0]);
  const lastBody = $derived(bodyComp[0]);
  const prevBody = $derived(bodyComp[1]);

  // ─── Total stats ──────────────────────────────────
  const totals = $derived.by(() => {
    const total = filtered.length;
    const kcal = filtered.reduce((a, s) => a + (s.calories ?? 0), 0);
    const volume = filtered.reduce((a, s) => a + (s.totalVolume ?? 0), 0);
    const prs = filtered.reduce((a, s) => a + (s.prsEarned?.length ?? 0), 0);
    const duration = filtered.reduce(
      (a, s) => a + (s.finishedAt && s.startedAt ? (s.finishedAt - s.startedAt) : 0), 0
    );
    return {
      total,
      kcal: Math.round(kcal),
      avgKcal: total > 0 ? Math.round(kcal / total) : 0,
      volume: Math.round(volume),
      prs,
      avgDurationMin: total > 0 ? Math.round(duration / total / 60000) : 0
    };
  });

  // ─── Sparklines pros TrendCards ───────────────────
  const sparkWorkouts = $derived.by(() => {
    // 1 ponto por dia no período
    const n = Math.min(period, 30);
    const values: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      values.push(sessions.filter((s) => s.date === iso).length);
    }
    return values;
  });

  const sparkVolume = $derived.by(() => {
    const n = Math.min(period, 30);
    const values: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const daySessions = sessions.filter((s) => s.date === iso);
      values.push(daySessions.reduce((a, s) => a + (s.totalVolume ?? 0), 0));
    }
    return values;
  });

  const sparkKcal = $derived.by(() => {
    const n = Math.min(period, 30);
    const values: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      values.push(sessions.filter((s) => s.date === iso).reduce((a, s) => a + (s.calories ?? 0), 0));
    }
    return values;
  });

  const sparkWeight = $derived.by(() => {
    return [...bodyComp]
      .filter((b) => b.peso && b.date >= cutoffISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => b.peso!);
  });

  // ─── Dieta — aderência ────────────────────────────
  const todayKcal = $derived(todayLog?.totals.kcal ?? 0);
  const todayProtein = $derived(todayLog?.totals.proteinG ?? 0);
  const avgAdherence = $derived.by(() => {
    if (!dietPlan || recentMealLogs.length === 0) return null;
    let sum = 0;
    let days = 0;
    for (const log of recentMealLogs) {
      const r = log.totals.kcal / dietPlan.dailyTargets.kcal;
      // aderência: 90-110% = 100%; fora disso cai
      const pct = Math.max(0, 100 - Math.abs(r - 1) * 100);
      sum += pct;
      days++;
    }
    return days > 0 ? Math.round(sum / days) : null;
  });

  // ─── Charts ───────────────────────────────────────
  const bodyCompAsc = $derived([...bodyComp].sort((a, b) => a.date.localeCompare(b.date)));

  const weightTrend = $derived.by(() => {
    const withVal = bodyCompAsc.filter((b) => b.peso);
    return {
      labels: withVal.map((b) => fmtDateShort(b.date).slice(0, 5)),
      values: withVal.map((b) => b.peso!)
    };
  });

  const compositionTrend = $derived.by(() => {
    return {
      labels: bodyCompAsc.map((b) => fmtDateShort(b.date).slice(0, 5)),
      fat: bodyCompAsc.map((b) => b.fat ?? null),
      muscle: bodyCompAsc.map((b) => b.muscle ?? null)
    };
  });

  const scoreTrend = $derived.by(() => {
    const withScore = bodyCompAsc.filter((b) => b.bodyScore);
    return {
      labels: withScore.map((b) => fmtDateShort(b.date).slice(0, 5)),
      values: withScore.map((b) => b.bodyScore!)
    };
  });

  const measuresTrend = $derived.by(() => {
    return {
      labels: bodyCompAsc.map((b) => fmtDateShort(b.date).slice(0, 5)),
      waist: bodyCompAsc.map((b) => b.waist ?? null),
      hip: bodyCompAsc.map((b) => b.hip ?? null)
    };
  });

  // ─── Consistência ─────────────────────────────────
  const heatmapData = $derived.by(() => {
    const map: Record<string, number> = {};
    sessions.forEach((s) => {
      map[s.date] = (map[s.date] ?? 0) + 1;
    });
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) normalized[k] = Math.min(4, v);
    return normalized;
  });

  const weekdayData = $derived.by(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filtered.forEach((s) => {
      const d = new Date(s.date + 'T12:00:00');
      counts[d.getDay()]++;
    });
    return { labels: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], values: counts };
  });

  const categoryData = $derived.by(() => {
    const count: Record<string, number> = {};
    filtered.forEach((s) => {
      count[s.workoutCategory] = (count[s.workoutCategory] ?? 0) + 1;
    });
    return count;
  });

  // ─── AI Coach ────────────────────────────────────
  let coachBusy = $state(false);
  async function refreshCoach(force = false) {
    if (!authStore.uid || !profile) return;
    coachBusy = true;
    try {
      const last7 = sessions.filter((s) => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return s.date >= d.toISOString().slice(0, 10);
      }).slice(0, 10);

      const last28 = sessions.filter((s) => {
        const d = new Date();
        d.setDate(d.getDate() - 28);
        return s.date >= d.toISOString().slice(0, 10);
      });

      const avgVolume = last28.length === 0 ? 0
        : last28.reduce((a, s) => a + (s.totalVolume ?? 0), 0) / last28.length;

      const latestWeight = bodyComp[0]?.peso;
      const older = bodyComp[Math.min(bodyComp.length - 1, 4)]?.peso;
      let weightTrendDir: 'up' | 'down' | 'stable' = 'stable';
      if (latestWeight && older) {
        const diff = latestWeight - older;
        if (diff > 0.8) weightTrendDir = 'up';
        else if (diff < -0.8) weightTrendDir = 'down';
      }

      await coachStore.refresh(authStore.uid, {
        userName: profile.name,
        goals: profile.goals,
        sessions7d: last7.map((s) => ({
          date: s.date,
          workoutName: s.workoutName,
          workoutCategory: s.workoutCategory,
          totalVolume: s.totalVolume,
          calories: s.calories,
          duration: s.finishedAt && s.startedAt ? s.finishedAt - s.startedAt : undefined,
          prsEarned: s.prsEarned?.length ?? 0,
          exerciseCount: s.performedExercises.length
        })),
        sessions28d: {
          totalSessions: last28.length,
          avgVolume,
          totalPRs: last28.reduce((a, s) => a + (s.prsEarned?.length ?? 0), 0)
        },
        latestWeight,
        weightTrend: weightTrendDir,
        dietAdherence: avgAdherence ?? undefined
      }, force);
    } finally {
      coachBusy = false;
    }
  }

  // ─── Recordes recentes ────────────────────────────
  const prsRecent = $derived(recentPRs(sessions, 60));

  const achievedMilestones = $derived(allMilestones.filter((m) => m.achieved));
  const pendingMilestones = $derived(
    allMilestones
      .filter((m) => !m.achieved && m.progress && m.progress.current > 0)
      .sort((a, b) => ((b.progress!.current / b.progress!.target) - (a.progress!.current / a.progress!.target)))
      .slice(0, 4)
  );

  // ─── Share ───────────────────────────────────────
  function shareStreak() {
    if (!profile) return;
    shareData = { template: 'streak', streak: currentStreak, userName: profile.name, avatar: profile.avatar };
  }
  function shareWeek() {
    if (!profile) return;
    const week = sessions.filter((s) => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return s.date >= d.toISOString().slice(0, 10);
    });
    shareData = {
      template: 'week',
      totalSessions: week.length,
      totalVolume: week.reduce((a, s) => a + (s.totalVolume ?? 0), 0),
      totalCalories: week.reduce((a, s) => a + (s.calories ?? 0), 0),
      totalPRs: week.reduce((a, s) => a + (s.prsEarned?.length ?? 0), 0),
      byCategory: week.reduce((acc, s) => {
        acc[s.workoutCategory] = (acc[s.workoutCategory] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      userName: profile.name,
      avatar: profile.avatar
    };
  }

  // ─── Body deltas ─────────────────────────────────
  const bodyDelta = $derived.by(() => {
    if (!lastBody || !prevBody) return null;
    return {
      peso: lastBody.peso && prevBody.peso ? lastBody.peso - prevBody.peso : null,
      fat: lastBody.fat && prevBody.fat ? lastBody.fat - prevBody.fat : null,
      muscle: lastBody.muscle && prevBody.muscle ? lastBody.muscle - prevBody.muscle : null,
      score: lastBody.bodyScore && prevBody.bodyScore ? lastBody.bodyScore - prevBody.bodyScore : null
    };
  });
</script>

{#if loading}
  <div class="loading"><span class="mi spin">progress_activity</span></div>
{:else}

  <!-- ═══ 1. HERO: ONDE ESTOU HOJE ═══════════════════════ -->
  <section class="hero">
    <div class="hero-title">Onde estou hoje</div>
    <div class="hero-grid">

      <!-- Sequência -->
      <Card padding="sm" accent={currentStreak > 0 ? 'glow' : 'default'}>
        <div class="hero-card">
          <div class="hc-label">🔥 Sequência</div>
          <div class="hc-value mono">{currentStreak}<span class="hc-unit">{currentStreak === 1 ? 'dia' : 'dias'}</span></div>
          {#if bestStreak > currentStreak}
            <div class="hc-sub">Recorde: {bestStreak} dias</div>
          {:else if currentStreak > 0}
            <div class="hc-sub">🌟 Novo recorde pessoal!</div>
          {:else}
            <div class="hc-sub">Comece hoje uma nova</div>
          {/if}
        </div>
      </Card>

      <!-- Último treino -->
      <Card padding="sm" onclick={() => goto('/registrar')}>
        <div class="hero-card">
          <div class="hc-label">{lastSession ? CATEGORY_ICON[lastSession.workoutCategory] : '💪'} Último treino</div>
          {#if lastSession}
            <div class="hc-value-sm">{lastSession.workoutName}</div>
            <div class="hc-sub">
              {fmtDateRelative(lastSession.date)}
              {#if (lastSession.prsEarned?.length ?? 0) > 0}
                · 🏆 {lastSession.prsEarned!.length} {lastSession.prsEarned!.length === 1 ? 'recorde' : 'recordes'}
              {/if}
            </div>
          {:else}
            <div class="hc-value-sm">Nenhum ainda</div>
            <div class="hc-sub">Registre o primeiro</div>
          {/if}
        </div>
      </Card>

      <!-- Última avaliação -->
      <Card padding="sm" onclick={() => goto('/corpo')}>
        <div class="hero-card">
          <div class="hc-label">⚖️ Última avaliação</div>
          {#if lastBody}
            <div class="hc-value mono">
              {fmtKg(lastBody.peso)}<span class="hc-unit">kg</span>
              {#if lastBody.bodyScore}
                <span class="hc-score">· {lastBody.bodyScore}/100</span>
              {/if}
            </div>
            <div class="hc-sub">
              {fmtDateRelative(lastBody.date)}
              {#if bodyDelta?.peso !== null && bodyDelta?.peso !== undefined}
                · <span class:up={bodyDelta.peso > 0.1} class:down={bodyDelta.peso < -0.1}>
                  {bodyDelta.peso > 0 ? '+' : ''}{bodyDelta.peso.toFixed(1)}kg
                </span>
              {/if}
            </div>
          {:else}
            <div class="hc-value-sm">Sem registro</div>
            <div class="hc-sub">Adicione sua 1ª avaliação</div>
          {/if}
        </div>
      </Card>

      <!-- Dieta hoje -->
      <Card padding="sm" onclick={() => goto('/dieta')}>
        <div class="hero-card">
          <div class="hc-label">🍽️ Dieta hoje</div>
          {#if dietPlan}
            <div class="hc-value mono">
              {todayKcal}<span class="hc-unit">/ {dietPlan.dailyTargets.kcal} kcal</span>
            </div>
            <div class="hc-sub">
              {Math.round(todayProtein)}g de {Math.round(dietPlan.dailyTargets.proteinG)}g proteína
            </div>
          {:else}
            <div class="hc-value-sm">Sem plano</div>
            <div class="hc-sub">Crie seu plano de macros</div>
          {/if}
        </div>
      </Card>

    </div>
  </section>

  <!-- ═══ 2. PERÍODO + STATS COM SPARKLINES ══════════════ -->
  <section>
    <div class="sec-head">
      <h2>Como estou indo</h2>
      <div class="period-tabs">
        {#each [7, 30, 90, 365] as p (p)}
          <button class="p-btn" class:on={period === p} onclick={() => (period = p as any)}>
            {p === 7 ? '7d' : p === 30 ? '30d' : p === 90 ? '90d' : '1a'}
          </button>
        {/each}
      </div>
    </div>

    <div class="trend-grid">
      <TrendCard
        label="Treinos"
        value={totals.total}
        icon="fitness_center"
        accent={totals.total > 0 ? 'accent' : 'default'}
        trend={sparkWorkouts}
      />
      <TrendCard
        label="Volume"
        value={totals.volume.toLocaleString('pt-BR')}
        unit="kg"
        icon="scale"
        trend={sparkVolume}
        color="#3fb950"
      />
      <TrendCard
        label="Calorias"
        value={totals.kcal.toLocaleString('pt-BR')}
        icon="local_fire_department"
        trend={sparkKcal}
        color="#ff7b3a"
      />
      <TrendCard
        label="Recordes"
        value={totals.prs}
        icon="military_tech"
        accent={totals.prs > 0 ? 'warn' : 'default'}
        color="#f0b72f"
      />
      <TrendCard
        label="Duração média"
        value={totals.avgDurationMin}
        unit="min"
        icon="timer"
      />
      {#if avgAdherence !== null}
        <TrendCard
          label="Aderência dieta"
          value={avgAdherence}
          unit="%"
          icon="restaurant"
          accent={avgAdherence >= 75 ? 'success' : avgAdherence >= 50 ? 'warn' : 'danger'}
          color="#a5f3b8"
        />
      {/if}
    </div>
  </section>

  <!-- ═══ 3. EVOLUÇÃO CORPORAL ═══════════════════════════ -->
  {#if bodyComp.length >= 2}
    <section>
      <h2>📊 Evolução corporal</h2>

      {#if weightTrend.values.length >= 2}
        <Card padding="md">
          <div class="chart-head">
            <span class="chart-title">Peso</span>
            <span class="chart-current mono">{fmtKg(weightTrend.values[weightTrend.values.length - 1])} kg</span>
          </div>
          <LineChart
            labels={weightTrend.labels}
            series={[{ label: 'kg', data: weightTrend.values, color: '#00e5ff', fill: true }]}
            height={160}
          />
        </Card>
      {/if}

      {#if compositionTrend.fat.some((v) => v !== null) || compositionTrend.muscle.some((v) => v !== null)}
        <Card padding="md">
          <div class="chart-head">
            <span class="chart-title">Gordura vs Músculo</span>
          </div>
          <LineChart
            labels={compositionTrend.labels}
            series={[
              ...(compositionTrend.fat.some((v) => v !== null) ? [{ label: '% Gordura', data: compositionTrend.fat as number[], color: '#ff7b3a' }] : []),
              ...(compositionTrend.muscle.some((v) => v !== null) ? [{ label: 'Músculo (kg)', data: compositionTrend.muscle as number[], color: '#3fb950' }] : [])
            ]}
            height={180}
          />
        </Card>
      {/if}

      {#if scoreTrend.values.length >= 2}
        <Card padding="md" accent="glow">
          <div class="chart-head">
            <span class="chart-title">🎯 Pontuação corporal</span>
            <span class="chart-current mono">{scoreTrend.values[scoreTrend.values.length - 1]}/100</span>
          </div>
          <LineChart
            labels={scoreTrend.labels}
            series={[{ label: 'Score', data: scoreTrend.values, color: '#bc8cff', fill: true }]}
            height={140}
            yMin={0}
            yMax={100}
          />
        </Card>
      {/if}

      {#if measuresTrend.waist.some((v) => v !== null) || measuresTrend.hip.some((v) => v !== null)}
        <Card padding="md">
          <div class="chart-head">
            <span class="chart-title">📏 Cintura / Quadril</span>
          </div>
          <LineChart
            labels={measuresTrend.labels}
            series={[
              ...(measuresTrend.waist.some((v) => v !== null) ? [{ label: 'Cintura', data: measuresTrend.waist as number[], color: '#58a6ff' }] : []),
              ...(measuresTrend.hip.some((v) => v !== null) ? [{ label: 'Quadril', data: measuresTrend.hip as number[], color: '#bc8cff' }] : [])
            ]}
            height={140}
          />
        </Card>
      {/if}
    </section>
  {/if}

  <!-- ═══ 4. CONSISTÊNCIA ════════════════════════════════ -->
  {#if sessions.length > 0}
    <section>
      <h2>📅 Consistência</h2>

      <Card padding="md">
        <div class="chart-head">
          <span class="chart-title">Últimas 17 semanas</span>
        </div>
        <Heatmap data={heatmapData} weeks={17} />
      </Card>

      {#if weekdayData.values.some((v) => v > 0)}
        <Card padding="md">
          <div class="chart-head">
            <span class="chart-title">Dia da semana mais treinado</span>
          </div>
          <LineChart
            labels={weekdayData.labels}
            series={[{ label: 'Treinos', data: weekdayData.values, color: '#00e5ff', fill: true }]}
            height={160}
          />
        </Card>
      {/if}

      {#if Object.keys(categoryData).length > 0}
        <Card padding="md">
          <div class="chart-head">
            <span class="chart-title">Tipos de treino</span>
          </div>
          <div class="cat-bars">
            {#each Object.entries(categoryData).sort((a, b) => b[1] - a[1]) as [cat, count] (cat)}
              {@const pct = totals.total > 0 ? (count / totals.total) * 100 : 0}
              <div class="cat-row">
                <div class="cat-info">
                  <span class="cat-ic">{CATEGORY_ICON[cat] ?? '🔹'}</span>
                  <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                </div>
                <div class="cat-bar-wrap">
                  <div class="cat-bar" style="width:{pct}%"></div>
                </div>
                <span class="cat-count mono">{count}</span>
              </div>
            {/each}
          </div>
        </Card>
      {/if}
    </section>
  {/if}

  <!-- ═══ 5. COACH IA ════════════════════════════════════ -->
  <section>
    <h2>🧠 Análise da semana</h2>
    <Card accent="glow">
      {#if coachStore.insight}
        <div class="coach-body">
          <p class="coach-summary">{coachStore.insight.summary}</p>

          {#if coachStore.insight.highlights.length > 0}
            <div class="coach-section">
              <div class="coach-lbl">✨ Destaques</div>
              <ul class="coach-list">
                {#each coachStore.insight.highlights as h (h)}<li>{h}</li>{/each}
              </ul>
            </div>
          {/if}

          {#if coachStore.insight.attentionPoints.length > 0}
            <div class="coach-section warn">
              <div class="coach-lbl">⚠️ Atenção</div>
              <ul class="coach-list">
                {#each coachStore.insight.attentionPoints as h (h)}<li>{h}</li>{/each}
              </ul>
            </div>
          {/if}

          <div class="coach-focus">
            <span class="mi">flag</span>
            <span><strong>Próxima semana:</strong> {coachStore.insight.nextWeekFocus}</span>
          </div>

          <div class="coach-meta">
            {#if coachStore.insight.plateauDetected}
              <Badge variant="warn" size="sm" icon="trending_flat">Platô detectado</Badge>
            {/if}
            {#if coachStore.insight.suggestedDeload}
              <Badge variant="info" size="sm" icon="hotel">Sugere deload</Badge>
            {/if}
          </div>

          <div class="coach-action">
            <Button size="sm" variant="ghost" icon="refresh" loading={coachBusy} onclick={() => refreshCoach(true)}>
              Atualizar análise
            </Button>
          </div>
        </div>
      {:else if coachStore.loading || coachBusy}
        <div class="coach-loading">
          <span class="mi spin">progress_activity</span>
          <span>Analisando sua semana…</span>
        </div>
      {:else if coachStore.error}
        <div class="coach-error">
          <span class="mi">error</span>
          <span>{coachStore.error}</span>
          <Button size="sm" onclick={() => refreshCoach(true)}>Tentar de novo</Button>
        </div>
      {:else}
        <div class="coach-empty">
          <div class="c-ic">🧠</div>
          <div class="c-t">Análise personalizada pela IA</div>
          <div class="c-s">
            A cada semana o coach lê seu histórico, dieta e composição corporal pra gerar insights acionáveis.
          </div>
          <div class="spacer"></div>
          <Button icon="auto_awesome" loading={coachBusy} onclick={() => refreshCoach(true)}>
            Gerar análise
          </Button>
        </div>
      {/if}
    </Card>
  </section>

  <!-- ═══ 6. CONQUISTAS ══════════════════════════════════ -->
  <section>
    <h2>🏆 Conquistas</h2>

    {#if prsRecent.length > 0}
      <div class="sub-title">Recordes recentes</div>
      <div class="prs-list">
        {#each prsRecent.slice(0, 6) as pr (pr.sessionId + pr.exerciseId)}
          <Card padding="sm">
            <div class="pr-row">
              <div class="pr-ic">🏆</div>
              <div class="pr-body">
                <div class="pr-name">{pr.exerciseName}</div>
                <div class="pr-value mono">{pr.topWeight}kg × {pr.topReps}</div>
              </div>
              <div class="pr-date">{fmtDateRelative(pr.date)}</div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}

    {#if pendingMilestones.length > 0}
      <div class="sub-title">Próximas metas</div>
      <div class="milestones">
        {#each pendingMilestones as m (m.id)}
          <div class="ms pending">
            <div class="ms-ic">{m.icon}</div>
            <div class="ms-body">
              <div class="ms-title">{m.title}</div>
              <div class="ms-desc">{m.description}</div>
              {#if m.progress}
                <div class="ms-bar">
                  <div class="ms-bar-fill" style="width:{Math.min(100, (m.progress.current / m.progress.target) * 100)}%"></div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if achievedMilestones.length > 0}
      <div class="sub-title">Desbloqueadas ({achievedMilestones.length})</div>
      <div class="milestones-grid">
        {#each achievedMilestones as m (m.id)}
          <div class="ms-chip achieved" title={m.description}>
            <span class="ms-chip-ic">{m.icon}</span>
            <span class="ms-chip-title">{m.title}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if prsRecent.length === 0 && achievedMilestones.length <= 1 && pendingMilestones.length === 0}
      <Card>
        <div class="empty">
          <div class="empty-ic">🎯</div>
          <div class="empty-title">Sem conquistas ainda</div>
          <div class="empty-sub">Registre treinos e avaliações pra começar a desbloquear</div>
        </div>
      </Card>
    {/if}
  </section>

  <!-- ═══ 7. COMPARTILHAR ════════════════════════════════ -->
  <section>
    <h2>📸 Compartilhar progresso</h2>
    <div class="share-row">
      {#if currentStreak > 0}
        <button class="share-btn" onclick={shareStreak}>
          <span class="mi">ios_share</span>
          <span>🔥 Sequência de {currentStreak} dias</span>
        </button>
      {/if}
      <button class="share-btn" onclick={shareWeek}>
        <span class="mi">ios_share</span>
        <span>📊 Resumo da semana</span>
      </button>
    </div>
  </section>
{/if}

{#if shareData}
  <ShareSheet data={shareData} onClose={() => (shareData = null)} />
{/if}

<style>
  .loading { min-height: 40vh; display: grid; place-content: center; }
  .loading .mi { font-size: 32px; color: var(--accent); animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  section {
    margin-bottom: var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  h2 {
    font-size: var(--fs-md);
    font-weight: 700;
    letter-spacing: -0.01em;
    margin-bottom: var(--s-2);
  }

  .sub-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: var(--s-3) 0 var(--s-2);
  }

  /* ─── Hero ──────────────────────────────── */
  .hero {
    background: var(--grad-hero);
    border-radius: var(--r-xl);
    padding: var(--s-4);
    margin-bottom: var(--s-5);
  }
  .hero-title {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    margin-bottom: var(--s-3);
  }
  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  .hero-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .hc-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .hc-value {
    font-size: var(--fs-xl);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  .hc-value-sm {
    font-size: var(--fs-md);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }
  .hc-unit {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
    margin-left: 2px;
  }
  .hc-score {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    font-weight: 600;
  }
  .hc-sub {
    font-size: 10px;
    color: var(--text-mute);
  }
  .hc-sub .up { color: var(--warn); font-weight: 700; }
  .hc-sub .down { color: var(--success); font-weight: 700; }


  /* ─── Seção de stats ────────────────────── */
  .sec-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-3);
    gap: var(--s-2);
  }
  .sec-head h2 { margin-bottom: 0; }

  .period-tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-full);
  }
  .p-btn {
    padding: 4px 10px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 700;
    font-family: var(--font-mono);
  }
  .p-btn.on { background: var(--grad-primary); color: var(--bg-0); }

  .trend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-2);
  }
  @media (min-width: 520px) {
    .trend-grid { grid-template-columns: repeat(3, 1fr); }
  }

  /* ─── Charts ────────────────────────────── */
  .chart-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--s-2);
  }
  .chart-title {
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .chart-current {
    font-size: var(--fs-md);
    font-weight: 800;
    color: var(--accent);
  }

  /* ─── Categorias ────────────────────────── */
  .cat-bars { display: flex; flex-direction: column; gap: var(--s-2); }
  .cat-row {
    display: grid;
    grid-template-columns: 1fr 2fr 32px;
    gap: var(--s-2);
    align-items: center;
  }
  .cat-info { display: flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 600; }
  .cat-ic { font-size: 14px; }
  .cat-bar-wrap { height: 6px; background: var(--bg-3); border-radius: var(--r-full); overflow: hidden; }
  .cat-bar {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--r-full);
    transition: width var(--dur-base) var(--ease-spring);
  }
  .cat-count { font-weight: 700; text-align: right; color: var(--accent); font-size: var(--fs-xs); }

  /* ─── Coach ─────────────────────────────── */
  .coach-body { display: flex; flex-direction: column; gap: var(--s-3); }
  .coach-summary { font-size: var(--fs-md); font-weight: 500; color: var(--text); line-height: 1.5; }
  .coach-section { padding: var(--s-3); background: var(--bg-3); border-radius: var(--r-md); }
  .coach-section.warn {
    background: color-mix(in srgb, var(--warn) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--warn) 25%, transparent);
  }
  .coach-lbl {
    font-size: var(--fs-xs); font-weight: 700; color: var(--text-mute);
    margin-bottom: var(--s-2); text-transform: uppercase; letter-spacing: 0.06em;
  }
  .coach-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .coach-list li { font-size: var(--fs-sm); color: var(--text); padding-left: 16px; position: relative; }
  .coach-list li::before { content: '•'; position: absolute; left: 4px; color: var(--accent); font-weight: 800; }
  .coach-focus {
    display: flex; gap: var(--s-2); align-items: flex-start;
    padding: var(--s-3); background: var(--accent-glow);
    border-radius: var(--r-md); color: var(--text); font-size: var(--fs-sm);
  }
  .coach-focus .mi { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
  .coach-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .coach-action { display: flex; justify-content: flex-end; margin-top: var(--s-2); }
  .coach-loading, .coach-error {
    display: flex; gap: var(--s-3); align-items: center;
    justify-content: center; padding: var(--s-5); color: var(--text-mute);
  }
  .coach-loading .mi { font-size: 24px; color: var(--accent); animation: spin 1s linear infinite; }
  .coach-error { color: var(--danger); flex-direction: column; }
  .coach-empty { text-align: center; padding: var(--s-4) var(--s-2); }
  .c-ic { font-size: 40px; margin-bottom: var(--s-2); }
  .c-t { font-weight: 700; font-size: var(--fs-md); }
  .c-s { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; line-height: 1.5; }

  /* ─── PRs / Recordes ────────────────────── */
  .prs-list { display: flex; flex-direction: column; gap: var(--s-2); }
  .pr-row { display: flex; align-items: center; gap: var(--s-2); }
  .pr-ic { font-size: 22px; flex-shrink: 0; }
  .pr-body { flex: 1; min-width: 0; }
  .pr-name {
    font-weight: 600;
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pr-value { font-size: var(--fs-sm); color: var(--accent); font-weight: 800; margin-top: 2px; }
  .pr-date { font-size: 10px; color: var(--text-mute); flex-shrink: 0; }

  /* ─── Milestones ────────────────────────── */
  .milestones { display: flex; flex-direction: column; gap: var(--s-2); }
  .ms {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .ms-ic { font-size: 28px; flex-shrink: 0; }
  .ms-body { flex: 1; min-width: 0; }
  .ms-title { font-weight: 700; font-size: var(--fs-sm); }
  .ms-desc { font-size: var(--fs-xs); color: var(--text-mute); margin-top: 2px; }
  .ms-bar { margin-top: 6px; height: 4px; background: var(--bg-3); border-radius: var(--r-full); overflow: hidden; }
  .ms-bar-fill {
    height: 100%;
    background: var(--grad-primary);
    border-radius: var(--r-full);
    transition: width var(--dur-base);
  }

  .milestones-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 6px;
  }
  .ms-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--success) 10%, var(--bg-2));
    border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
    border-radius: var(--r-full);
    font-size: var(--fs-xs);
    cursor: help;
  }
  .ms-chip-ic { font-size: 14px; }
  .ms-chip-title { font-weight: 700; color: var(--text); }

  /* ─── Share ─────────────────────────────── */
  .share-row {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .share-btn {
    padding: var(--s-3);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    display: flex;
    align-items: center;
    gap: var(--s-2);
    font-size: var(--fs-sm);
    font-weight: 600;
    transition: all var(--dur-fast);
  }
  .share-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .share-btn .mi { color: var(--accent); }

  .empty { text-align: center; padding: var(--s-5); }
  .empty-ic { font-size: 48px; margin-bottom: var(--s-3); }
  .empty-title { font-weight: 700; font-size: var(--fs-md); }
  .empty-sub { color: var(--text-mute); font-size: var(--fs-sm); margin-top: 4px; }

  .spacer { height: var(--s-3); }
</style>
