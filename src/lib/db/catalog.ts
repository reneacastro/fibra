import { SEED_EXERCISES } from '$lib/data/exerciseCatalog';
import type { Exercise } from '$lib/types';

/**
 * Catálogo curado é 100% bundled (SEED_EXERCISES). Zero reads no Firestore.
 * Extended (873 exercícios) vem do JSON estático em /exercises-db.json.
 * Tínhamos uma collection "exerciseCatalog" + seed function — removidos.
 * Mantendo a API assíncrona pra retrocompat com quem chama `await`.
 */
export async function loadCatalog(): Promise<Exercise[]> {
  return SEED_EXERCISES;
}

export function invalidate() {
  // noop — catálogo curado é constante
}
