import type { Exercise, WorkoutCategory } from '$lib/types';
import { loadCatalog } from '$lib/db/catalog';
import { listCustomExercises } from '$lib/db/customExercises';
import { loadExtendedCatalog, mergeCatalogs } from '$lib/db/extendedCatalog';
import { authStore } from './auth.svelte';
import { withTimeout } from '$lib/utils/withTimeout';

class CatalogStore {
  all = $state<Exercise[]>([]);
  loading = $state(false);
  loaded = $state(false);

  async ensure() {
    if (this.loaded) return;
    // Se está carregando há muito tempo, tolera a chamada paralela com timeout
    if (this.loading) {
      await waitFor(() => this.loaded, 8000);
      return;
    }
    this.loading = true;
    try {
      const [curated, customs] = await withTimeout(
        Promise.all([
          loadCatalog(),
          authStore.uid ? listCustomExercises(authStore.uid) : Promise.resolve([])
        ]),
        8000,
        'catálogo'
      );
      this.all = [...curated, ...customs];
      this.loaded = true;

      // Em background, carrega o estendido (873 exercícios) e mescla
      loadExtendedCatalog()
        .then((extended) => {
          this.all = [...mergeCatalogs(curated, extended), ...customs];
        })
        .catch((e) => console.warn('Falha ao carregar catálogo estendido:', e));
    } catch (e) {
      console.warn('Catálogo falhou, seguindo vazio:', e);
      // Não trava o app — deixa seguir com catálogo vazio
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

function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (check()) return resolve();
    const start = Date.now();
    const t = setInterval(() => {
      if (check() || Date.now() - start > timeoutMs) {
        clearInterval(t);
        resolve();
      }
    }, 100);
  });
}

export const catalogStore = new CatalogStore();
