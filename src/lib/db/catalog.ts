import { doc, getDocs, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { SEED_EXERCISES } from '$lib/data/exerciseCatalog';
import type { Exercise } from '$lib/types';

const CATALOG = 'exerciseCatalog';

let cached: Exercise[] | null = null;

export async function loadCatalog(): Promise<Exercise[]> {
  if (cached) return cached;

  const snap = await getDocs(collection(db(), CATALOG));
  if (snap.empty) {
    // Fallback pro seed local enquanto o admin não populou o Firestore
    cached = SEED_EXERCISES;
    return cached;
  }
  cached = snap.docs.map((d) => d.data() as Exercise);
  return cached;
}

export async function seedCatalog() {
  const batch = writeBatch(db());
  for (const ex of SEED_EXERCISES) {
    batch.set(doc(db(), CATALOG, ex.id), ex);
  }
  await batch.commit();
  cached = null;
}

export function invalidate() {
  cached = null;
}
