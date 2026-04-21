import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy, limit as fsLimit, where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { SharedWorkout, Workout, WorkoutCategory } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = () => collection(db(), 'sharedWorkouts');

export function newSharedId() {
  return 'sh_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function listShared(params: {
  category?: WorkoutCategory;
  max?: number;
  orderByField?: 'publishedAt' | 'clonedCount' | 'likes';
}): Promise<SharedWorkout[]> {
  const { category, max = 50, orderByField = 'publishedAt' } = params;
  const q = category
    ? query(col(), where('category', '==', category), orderBy(orderByField, 'desc'), fsLimit(max))
    : query(col(), orderBy(orderByField, 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedWorkout);
}

export async function getShared(id: string): Promise<SharedWorkout | null> {
  const snap = await getDoc(doc(col(), id));
  return snap.exists() ? (snap.data() as SharedWorkout) : null;
}

/** Cria ou atualiza o share. O ownerUid do doc = uid do usuário logado. */
export async function publishShared(entry: SharedWorkout) {
  await setDoc(doc(col(), entry.id), cleanUndefined(entry));
}

export async function deleteShared(id: string) {
  await deleteDoc(doc(col(), id));
}

/** Incrementa clonedCount. Só funciona porque rule permite update pelo owner
 *  — pra MVP, se quiser contar clones feitos por outros, precisa Cloud Function.
 *  Versão simples: guardamos local, sem aumentar contador público agora. */

export async function listMyShared(ownerUid: string): Promise<SharedWorkout[]> {
  const q = query(col(), where('ownerUid', '==', ownerUid), orderBy('publishedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedWorkout);
}

/** Monta um novo Workout local a partir de um SharedWorkout, pra clonar. */
export function cloneToWorkout(shared: SharedWorkout, newId: string, order: number): Workout {
  return {
    id: newId,
    name: `${shared.name} (de ${shared.ownerName})`,
    category: shared.category,
    exercises: shared.exercises.map((e) => ({ ...e })),
    crossfit: shared.crossfit,
    order,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false
  };
}
