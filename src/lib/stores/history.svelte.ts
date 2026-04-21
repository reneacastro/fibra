import { historyForExercise } from '$lib/db/sessions';
import { authStore } from './auth.svelte';
import type { ExerciseLogEntry } from '$lib/types';

interface CacheEntry {
  entries: ExerciseLogEntry[];
  loadedAt: number;
}

const TTL = 60_000; // 1 minuto

class HistoryStore {
  cache = $state<Record<string, CacheEntry>>({});
  pending = new Set<string>();

  async ensure(exerciseId: string): Promise<ExerciseLogEntry[]> {
    if (!authStore.uid) return [];
    const existing = this.cache[exerciseId];
    if (existing && Date.now() - existing.loadedAt < TTL) return existing.entries;
    if (this.pending.has(exerciseId)) {
      // await resultado em andamento por polling simples
      await new Promise<void>((res) => {
        const int = setInterval(() => {
          if (!this.pending.has(exerciseId)) {
            clearInterval(int);
            res();
          }
        }, 50);
      });
      return this.cache[exerciseId]?.entries ?? [];
    }
    this.pending.add(exerciseId);
    try {
      const entries = await historyForExercise(authStore.uid, exerciseId, 30);
      this.cache = { ...this.cache, [exerciseId]: { entries, loadedAt: Date.now() } };
      return entries;
    } finally {
      this.pending.delete(exerciseId);
    }
  }

  /**
   * Leitura síncrona do cache (para $derived). Retorna [] se ainda não carregado;
   * caller chama ensure() para popular.
   */
  get(exerciseId: string): ExerciseLogEntry[] {
    return this.cache[exerciseId]?.entries ?? [];
  }

  invalidate(exerciseId?: string) {
    if (!exerciseId) this.cache = {};
    else {
      const { [exerciseId]: _, ...rest } = this.cache;
      this.cache = rest;
    }
  }
}

export const historyStore = new HistoryStore();
