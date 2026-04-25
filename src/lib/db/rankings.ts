import {
  collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit as fsLimit
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { RankingEntry, Session, UserProfile, WorkoutCategory } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';
import { listSessions } from './sessions';

const rankingCol = () => collection(db(), 'rankings');

export async function getMyRanking(uid: string): Promise<RankingEntry | null> {
  const snap = await getDoc(doc(rankingCol(), uid));
  return snap.exists() ? (snap.data() as RankingEntry) : null;
}

/** Upsert simples no doc público do usuário. */
export async function saveRanking(entry: RankingEntry) {
  await setDoc(doc(rankingCol(), entry.uid), cleanUndefined(entry));
}

export async function deleteMyRanking(uid: string) {
  await setDoc(doc(rankingCol(), uid), { uid, deleted: true, updatedAt: Date.now() }, { merge: true });
}

export type RankingOrder = 'totalSessions' | 'weekSessions' | 'totalVolumeKg' | 'totalPRs' | 'totalDistanceM' | 'currentStreak';

/** Busca top N do ranking. category opcional filtra client-side. */
export async function listRanking(params: {
  orderBy: RankingOrder;
  max?: number;
  category?: WorkoutCategory;
}): Promise<RankingEntry[]> {
  const { orderBy: ord, max = 50, category } = params;
  const q = query(rankingCol(), orderBy(ord, 'desc'), fsLimit(max * 2));
  const snap = await getDocs(q);
  const rows = snap.docs
    .map((d) => d.data() as RankingEntry)
    .filter((r) => !(r as unknown as { deleted?: boolean }).deleted);

  if (category) {
    return rows
      .filter((r) => (r.byCategory?.[category] ?? 0) > 0)
      .sort((a, b) => (b.byCategory?.[category] ?? 0) - (a.byCategory?.[category] ?? 0))
      .slice(0, max);
  }
  return rows.slice(0, max);
}

/**
 * Pipeline: busca sessões, computa ranking, salva no doc público.
 * Chama isso depois de saveSession se publicProfile = true.
 *
 * Throttle: se o último sync foi há menos de 10 minutos, pula —
 * ninguém precisa de ranking atualizado a cada segundo, e cada sync
 * custa ~100 reads no Firestore.
 */
const RANKING_SYNC_THROTTLE_MS = 10 * 60 * 1000;

export async function syncRanking(uid: string, profile: UserProfile, opts: {
  displayName?: string;
  avatar?: string;
  force?: boolean;
}): Promise<void> {
  if (!opts.force) {
    // Lê o doc existente pra ver se sync recente (1 read, barato)
    const existing = await getMyRanking(uid);
    if (existing && Date.now() - (existing.updatedAt ?? 0) < RANKING_SYNC_THROTTLE_MS) {
      return; // Sync recente, pula
    }
  }
  // 100 sessões é suficiente pra ranking (week=7d, month=30d, total agregado).
  // Antes era 500 = 500 reads por save. Agora 100 = 5x economia.
  const sessions = await listSessions(uid, 100);
  const entry = computeRankingEntry({ uid, profile, sessions, ...opts });
  await saveRanking(entry);
}

/**
 * Recalcula o ranking do usuário a partir das sessions.
 * Chamado ao salvar uma sessão nova, se user.settings.publicProfile = true.
 */
export function computeRankingEntry(params: {
  uid: string;
  profile: UserProfile;
  sessions: Session[];
  displayName?: string;
  avatar?: string;
}): RankingEntry {
  const { uid, profile, sessions, displayName, avatar } = params;
  const now = Date.now();
  const DAY = 86_400_000;

  let totalSessions = 0;
  let totalVolumeKg = 0;
  let totalPRs = 0;
  let totalDistanceM = 0;
  let totalDurationSec = 0;
  let weekSessions = 0, weekVolumeKg = 0, weekDistanceM = 0;
  let monthSessions = 0;
  const byCategory: Partial<Record<WorkoutCategory, number>> = {};
  const dates = new Set<string>();
  let lastActivityAt = 0;

  for (const s of sessions) {
    totalSessions++;
    const duration = s.finishedAt ? Math.floor((s.finishedAt - s.startedAt) / 1000) : 0;
    totalDurationSec += duration;
    totalPRs += s.prsEarned?.length ?? 0;
    totalVolumeKg += s.totalVolume ?? 0;

    // Distância: soma sets de cardio concluídos
    for (const pe of s.performedExercises) {
      for (const set of pe.sets) {
        if (set.completed && set.distanceM) totalDistanceM += set.distanceM;
      }
    }

    byCategory[s.workoutCategory] = (byCategory[s.workoutCategory] ?? 0) + 1;
    dates.add(s.date);
    if (s.createdAt > lastActivityAt) lastActivityAt = s.createdAt;

    const age = now - s.createdAt;
    if (age < 7 * DAY) {
      weekSessions++;
      weekVolumeKg += s.totalVolume ?? 0;
      for (const pe of s.performedExercises) {
        for (const set of pe.sets) {
          if (set.completed && set.distanceM) weekDistanceM += set.distanceM;
        }
      }
    }
    if (age < 30 * DAY) monthSessions++;
  }

  // Streak: dias consecutivos até hoje (ou até ontem, se hoje ainda não treinou)
  let currentStreak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (dates.has(iso)) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      d.setDate(d.getDate() - 1);
    } else break;
  }

  return {
    uid,
    displayName: displayName ?? profile.name ?? 'Atleta',
    // Fallback: se quem chamou nao passou avatar mas o profile tem,
    // usa o do profile. Garante que ranking nunca fica sem avatar
    // quando o usuario tem foto/emoji configurada no perfil.
    avatar: avatar ?? profile.avatar,
    totalSessions,
    totalVolumeKg: Math.round(totalVolumeKg),
    totalPRs,
    totalDistanceM: Math.round(totalDistanceM),
    totalDurationSec,
    weekSessions,
    weekVolumeKg: Math.round(weekVolumeKg),
    weekDistanceM: Math.round(weekDistanceM),
    monthSessions,
    byCategory,
    currentStreak,
    lastActivityAt,
    updatedAt: now
  };
}
