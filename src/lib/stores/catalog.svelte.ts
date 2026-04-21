import type { Exercise, WorkoutCategory } from '$lib/types';
import { loadCatalog } from '$lib/db/catalog';
import { listCustomExercises } from '$lib/db/customExercises';
import { authStore } from './auth.svelte';

class CatalogStore {
  all = $state<Exercise[]>([]);
  loading = $state(false);
  loaded = $state(false);

  async ensure() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      const [base, customs] = await Promise.all([
        loadCatalog(),
        authStore.uid ? listCustomExercises(authStore.uid) : Promise.resolve([])
      ]);
      this.all = [...base, ...customs];
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async reloadCustoms() {
    if (!authStore.uid) return;
    const customs = await listCustomExercises(authStore.uid);
    const base = this.all.filter((e) => !e.isCustom);
    this.all = [...base, ...customs];
  }

  byId(id: string) {
    return this.all.find((e) => e.id === id);
  }

  byCategory(cat: WorkoutCategory) {
    return this.all.filter((e) => {
      const c = e.category;
      return Array.isArray(c) ? c.includes(cat) : c === cat;
    });
  }
}

export const catalogStore = new CatalogStore();
