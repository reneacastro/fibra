import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Schedule } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const ref = (uid: string) => doc(db(), 'users', uid, 'schedule', 'weekly');

export async function getSchedule(uid: string): Promise<Schedule | null> {
  const snap = await getDoc(ref(uid));
  return snap.exists() ? (snap.data() as Schedule) : null;
}

export async function saveSchedule(uid: string, schedule: Omit<Schedule, 'updatedAt'>) {
  await setDoc(ref(uid), cleanUndefined({ ...schedule, updatedAt: Date.now() }));
}

export function emptySchedule(): Schedule {
  const days: Schedule['days'] = {};
  for (let i = 0; i < 7; i++) days[i] = { workoutIds: [], rest: true };
  return { days, updatedAt: Date.now() };
}
