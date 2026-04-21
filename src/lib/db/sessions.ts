import {
  collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit as fsLimit, where, writeBatch
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Session, ExerciseLogEntry } from '$lib/types';

/** Remove recursivamente chaves com valor undefined (Firestore rejeita). */
function cleanUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map((v) => cleanUndefined(v)) as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      result[k] = v && typeof v === 'object' ? cleanUndefined(v) : v;
    }
    return result as T;
  }
  return obj;
}

const sessionsCol = (uid: string) => collection(db(), 'users', uid, 'sessions');
const entriesCol = (uid: string, exerciseId: string) =>
  collection(db(), 'users', uid, 'exerciseLogs', exerciseId, 'entries');

export function newSessionId() {
  return 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function listSessions(uid: string, max = 100): Promise<Session[]> {
  const q = query(sessionsCol(uid), orderBy('date', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Session);
}

export async function sessionsForDate(uid: string, date: string): Promise<Session[]> {
  const q = query(sessionsCol(uid), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Session);
}

/**
 * Salva uma sessão + gera entries no histórico por exercício.
 * Detecta PRs comparando com o melhor registro anterior.
 */
export async function saveSession(uid: string, s: Session) {
  const batch = writeBatch(db());

  // 1) Salvar a sessão (sem undefined — Firestore rejeita)
  const cleanSession = cleanUndefined(s);
  batch.set(doc(sessionsCol(uid), s.id), cleanSession);

  // 2) Para cada exercício executado, criar entry + detectar PR
  const prsEarned: string[] = [];
  for (const pe of s.performedExercises) {
    if (pe.skipped) continue;
    const completedSets = pe.sets.filter((set) => set.completed && set.weight && set.reps);
    if (completedSets.length === 0) continue;

    const topSet = completedSets.reduce((best, cur) => {
      const curScore = (cur.weight ?? 0) * (cur.reps ?? 0);
      const bestScore = (best.weight ?? 0) * (best.reps ?? 0);
      return curScore > bestScore ? cur : best;
    }, completedSets[0]);

    const volume = completedSets.reduce(
      (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0
    );
    const e1rm = topSet.weight && topSet.reps
      ? Math.round(topSet.weight * (1 + topSet.reps / 30) * 10) / 10
      : undefined;

    const entry: ExerciseLogEntry = {
      id: `${s.date}_${s.id.slice(-6)}`,
      exerciseId: pe.exerciseId,
      sessionId: s.id,
      date: s.date,
      topSet: { reps: topSet.reps ?? 0, weight: topSet.weight ?? 0 },
      totalVolume: volume,
      estimated1RM: e1rm,
      isPR: false,
      createdAt: Date.now()
    };

    // Detecta PR: compara com entries anteriores
    const prev = await getDocs(
      query(entriesCol(uid, pe.exerciseId), orderBy('estimated1RM', 'desc'), fsLimit(1))
    );
    const prevTop = prev.docs[0]?.data() as ExerciseLogEntry | undefined;
    if (!prevTop || (e1rm && e1rm > (prevTop.estimated1RM ?? 0))) {
      entry.isPR = true;
      prsEarned.push(pe.exerciseId);
    }

    batch.set(doc(entriesCol(uid, pe.exerciseId), entry.id), cleanUndefined(entry));
  }

  // 3) Atualizar PRs na sessão (se houve)
  if (prsEarned.length > 0) {
    batch.set(doc(sessionsCol(uid), s.id), cleanUndefined({ ...s, prsEarned }), { merge: true });
  }

  await batch.commit();
  return { prsEarned };
}

/**
 * Apaga uma sessão e todos os exerciseLogs associados a ela.
 */
export async function deleteSession(uid: string, sessionId: string) {
  const batch = writeBatch(db());

  // 1) Apagar a sessão
  batch.delete(doc(sessionsCol(uid), sessionId));

  // 2) Apagar entries de exerciseLogs que referenciam essa sessão
  // collectionGroup query pra varrer todos os exerciseLogs
  const session = await getDocs(
    query(sessionsCol(uid), where('id', '==', sessionId), fsLimit(1))
  );
  if (!session.empty) {
    const s = session.docs[0].data() as Session;
    for (const pe of s.performedExercises) {
      const entries = await getDocs(
        query(entriesCol(uid, pe.exerciseId), where('sessionId', '==', sessionId))
      );
      for (const e of entries.docs) batch.delete(e.ref);
    }
  }

  await batch.commit();
}

export async function historyForExercise(uid: string, exerciseId: string, max = 30) {
  const q = query(entriesCol(uid, exerciseId), orderBy('date', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ExerciseLogEntry);
}
