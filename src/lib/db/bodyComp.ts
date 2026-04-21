import {
  collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit as fsLimit
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { BodyComp } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = (uid: string) => collection(db(), 'users', uid, 'bodyComp');

export async function listBodyComp(uid: string, max = 200): Promise<BodyComp[]> {
  const q = query(col(uid), orderBy('date', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as BodyComp);
}

export async function saveBodyComp(uid: string, data: Omit<BodyComp, 'createdAt'>) {
  await setDoc(doc(col(uid), data.date), cleanUndefined({
    ...data,
    createdAt: Date.now()
  }));
}

export async function deleteBodyComp(uid: string, date: string) {
  await deleteDoc(doc(col(uid), date));
}
