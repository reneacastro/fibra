import {
  collection, doc, getDocs, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Exercise } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = (uid: string) => collection(db(), 'users', uid, 'exercises');

export async function listCustomExercises(uid: string): Promise<Exercise[]> {
  const snap = await getDocs(col(uid));
  return snap.docs.map((d) => ({ ...(d.data() as Exercise), isCustom: true }));
}

export async function saveCustomExercise(uid: string, ex: Exercise) {
  await setDoc(doc(col(uid), ex.id), cleanUndefined({ ...ex, isCustom: true }));
}

export async function deleteCustomExercise(uid: string, id: string) {
  await deleteDoc(doc(col(uid), id));
}

export function newExerciseId() {
  return 'cx_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
