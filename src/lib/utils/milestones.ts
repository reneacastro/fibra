import type { Session, BodyComp } from '$lib/types';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  achieved: boolean;
  achievedAt?: string; // ISO date
  progress?: { current: number; target: number };
}

export function computeMilestones(sessions: Session[], bodyComp: BodyComp[]): Milestone[] {
  const ms: Milestone[] = [];
  const sessionsByDate = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const firstSession = sessionsByDate[0];

  // ─── Primeiro treino ─────────────────────
  ms.push({
    id: 'first-workout',
    title: 'Primeiro treino',
    description: firstSession ? `Começou em ${firstSession.date}` : 'Registre seu primeiro treino',
    icon: '🎉',
    achieved: !!firstSession,
    achievedAt: firstSession?.date
  });

  // ─── Totais de treinos ────────────────────
  for (const n of [10, 30, 50, 100, 250, 500]) {
    const achieved = sessions.length >= n;
    ms.push({
      id: `total-${n}`,
      title: `${n} treinos`,
      description: achieved
        ? `Alcançado (${sessions.length} total)`
        : `${sessions.length}/${n}`,
      icon: n >= 100 ? '💎' : n >= 30 ? '🏅' : '🏋️',
      achieved,
      achievedAt: achieved ? sessionsByDate[n - 1]?.date : undefined,
      progress: achieved ? undefined : { current: sessions.length, target: n }
    });
  }

  // ─── Sequência (dias consecutivos) ────────
  const maxStreak = longestStreak(sessions);
  for (const n of [7, 14, 30, 60, 100]) {
    const achieved = maxStreak >= n;
    ms.push({
      id: `streak-${n}`,
      title: `${n} dias seguidos`,
      description: achieved
        ? `Sequência recorde: ${maxStreak}`
        : `${maxStreak}/${n}`,
      icon: n >= 30 ? '🔥' : '⚡',
      achieved,
      progress: achieved ? undefined : { current: maxStreak, target: n }
    });
  }

  // ─── Primeiro recorde ─────────────────────
  const firstPR = sessions.find((s) => (s.prsEarned?.length ?? 0) > 0);
  ms.push({
    id: 'first-pr',
    title: 'Primeiro recorde',
    description: firstPR ? `Em ${firstPR.date}` : 'Bata seu primeiro recorde pessoal',
    icon: '🏆',
    achieved: !!firstPR,
    achievedAt: firstPR?.date
  });

  // ─── Total de recordes ────────────────────
  const totalPRs = sessions.reduce((a, s) => a + (s.prsEarned?.length ?? 0), 0);
  for (const n of [5, 20, 50]) {
    const achieved = totalPRs >= n;
    ms.push({
      id: `pr-${n}`,
      title: `${n} recordes`,
      description: achieved ? `${totalPRs} recordes batidos` : `${totalPRs}/${n}`,
      icon: '🏆',
      achieved,
      progress: achieved ? undefined : { current: totalPRs, target: n }
    });
  }

  // ─── Peso perdido (se emagrecimento é objetivo) ──
  if (bodyComp.length >= 2) {
    const first = bodyComp[bodyComp.length - 1];
    const latest = bodyComp[0];
    if (first.peso && latest.peso) {
      const lost = first.peso - latest.peso;
      for (const n of [1, 5, 10]) {
        const achieved = lost >= n;
        ms.push({
          id: `lost-${n}kg`,
          title: `-${n}kg`,
          description: achieved
            ? `${lost.toFixed(1)}kg perdidos desde ${first.date}`
            : `Perdeu ${Math.max(0, lost).toFixed(1)}kg de ${n}kg`,
          icon: n >= 5 ? '🌟' : '💪',
          achieved,
          achievedAt: achieved ? latest.date : undefined,
          progress: achieved ? undefined : { current: Math.max(0, lost), target: n }
        });
      }
    }

    // Ganho de massa muscular
    if (first.muscle && latest.muscle) {
      const gained = latest.muscle - first.muscle;
      for (const n of [1, 3, 5]) {
        const achieved = gained >= n;
        ms.push({
          id: `muscle-${n}kg`,
          title: `+${n}kg de músculo`,
          description: achieved
            ? `${gained.toFixed(1)}kg ganhos`
            : `Ganhou ${Math.max(0, gained).toFixed(1)}kg de ${n}kg`,
          icon: '💪',
          achieved,
          achievedAt: achieved ? latest.date : undefined,
          progress: achieved ? undefined : { current: Math.max(0, gained), target: n }
        });
      }
    }
  }

  return ms;
}

/** Retorna a maior sequência consecutiva de dias com treino. */
function longestStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0;
  const dates = [...new Set(sessions.map((s) => s.date))].sort();
  let max = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]).getTime();
    const curr = new Date(dates[i]).getTime();
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      current++;
      if (current > max) max = current;
    } else {
      current = 1;
    }
  }
  return max;
}

/** Extrai os recordes recentes direto das sessões. */
export interface RecentPR {
  sessionId: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  topWeight: number;
  topReps: number;
}

export function recentPRs(sessions: Session[], maxDays = 60): RecentPR[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const prs: RecentPR[] = [];
  for (const s of sessions) {
    if (s.date < cutoffISO) continue;
    for (const exerciseId of s.prsEarned ?? []) {
      const pe = s.performedExercises.find((e) => e.exerciseId === exerciseId);
      if (!pe) continue;
      const topSet = pe.sets
        .filter((st) => st.completed && st.weight && st.reps)
        .reduce((best, cur) => {
          const cs = (cur.weight ?? 0) * (cur.reps ?? 0);
          const bs = (best.weight ?? 0) * (best.reps ?? 0);
          return cs > bs ? cur : best;
        }, pe.sets[0]);

      prs.push({
        sessionId: s.id,
        date: s.date,
        exerciseId,
        exerciseName: pe.exerciseName,
        topWeight: topSet.weight ?? 0,
        topReps: topSet.reps ?? 0
      });
    }
  }
  return prs.sort((a, b) => b.date.localeCompare(a.date));
}
