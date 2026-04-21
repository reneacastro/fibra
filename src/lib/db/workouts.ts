import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Workout } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = (uid: string) => collection(db(), 'users', uid, 'workouts');

export async function listWorkouts(uid: string): Promise<Workout[]> {
  const q = query(col(uid), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Workout);
}

export async function getWorkout(uid: string, id: string): Promise<Workout | null> {
  const snap = await getDoc(doc(col(uid), id));
  return snap.exists() ? (snap.data() as Workout) : null;
}

export async function saveWorkout(uid: string, w: Workout) {
  const now = Date.now();
  await setDoc(doc(col(uid), w.id), cleanUndefined({
    ...w,
    updatedAt: now,
    createdAt: w.createdAt ?? now
  }));
}

export async function deleteWorkout(uid: string, id: string) {
  await deleteDoc(doc(col(uid), id));
}

export function newWorkoutId() {
  return 'w_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
