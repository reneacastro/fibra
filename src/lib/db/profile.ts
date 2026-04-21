import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { UserProfile } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db(), 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function saveProfile(uid: string, data: Partial<UserProfile>) {
  const ref = doc(db(), 'users', uid);
  const existing = await getDoc(ref);
  const now = Date.now();
  await setDoc(
    ref,
    cleanUndefined({
      ...data,
      uid,
      updatedAt: now,
      ...(existing.exists() ? {} : { createdAt: now })
    }),
    { merge: true }
  );
}

export function defaultSettings() {
  return {
    theme: 'dark' as const,
    units: 'metric' as const,
    restTimerDefault: 90,
    hapticFeedback: true,
    notifications: {
      rest: true,
      dailyReminder: false,
      weeklyRecap: true
    },
    publicProfile: false
  };
}
