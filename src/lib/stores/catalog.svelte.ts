import type { Exercise, WorkoutCategory } from '$lib/types';
import { loadCatalog } from '$lib/db/catalog';

class CatalogStore {
  all = $state<Exercise[]>([]);
  loading = $state(false);
  loaded = $state(false);

  async ensure() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    try {
      this.all = await loadCatalog();
      this.loaded = true;
    } finally {
      this.loading = false;
    }
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
