/**
 * Catálogo estendido — 873 exercícios da free-exercise-db.
 * Carregado on-demand do JSON bundled em /exercises-db.json.
 * Mescla com SEED_EXERCISES (curados PT-BR) — esses tem prioridade por id/name.
 */

import type { Exercise, WorkoutCategory, MuscleGroup, Equipment } from '$lib/types';

interface RawExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

// ─── Mapeamentos en→pt ────────────────────────────────────

const MUSCLE_MAP: Record<string, MuscleGroup> = {
  'chest': 'peito',
  'lats': 'costas',
  'middle back': 'costas',
  'lower back': 'lombar',
  'traps': 'costas',
  'shoulders': 'ombros',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearms': 'antebraco',
  'quadriceps': 'quadriceps',
  'hamstrings': 'posterior',
  'glutes': 'gluteos',
  'calves': 'panturrilha',
  'abductors': 'abdutores',
  'adductors': 'adutores',
  'abdominals': 'core',
  'neck': 'core'
};

const EQUIPMENT_MAP: Record<string, Equipment> = {
  'barbell': 'barra',
  'dumbbell': 'halteres',
  'cable': 'polia',
  'machine': 'maquina',
  'kettlebells': 'kettlebell',
  'body only': 'peso-corporal',
  'bands': 'elastico',
  'medicine ball': 'bola',
  'exercise ball': 'bola',
  'foam roll': 'nenhum',
  'e-z curl bar': 'barra',
  'other': 'nenhum'
};

const CATEGORY_MAP: Record<string, WorkoutCategory> = {
  'strength': 'forca',
  'powerlifting': 'forca',
  'olympic weightlifting': 'forca',
  'strongman': 'forca',
  'cardio': 'cardio',
  'plyometrics': 'funcional',
  'stretching': 'alongamento'
};

// Detecta categoria adicional por músculo primário
function inferCategoryFromMuscle(muscle: MuscleGroup | undefined, primary: WorkoutCategory[]): WorkoutCategory[] {
  const cats = new Set<WorkoutCategory>(primary);
  if (!muscle) return [...cats];
  if (['peito','costas','ombros','biceps','triceps','antebraco'].includes(muscle)) cats.add('superior');
  if (['quadriceps','posterior','gluteos','panturrilha','adutores','abdutores'].includes(muscle)) cats.add('inferior');
  if (muscle === 'core' || muscle === 'lombar') cats.add('core');
  return [...cats];
}

function mapExercise(raw: RawExercise): Exercise {
  const primaryMuscles = (raw.primaryMuscles ?? []).map((m) => MUSCLE_MAP[m]).filter(Boolean) as MuscleGroup[];
  const equipment = (raw.equipment && EQUIPMENT_MAP[raw.equipment]) || 'nenhum';
  const baseCategories: WorkoutCategory[] = [];
  if (CATEGORY_MAP[raw.category]) baseCategories.push(CATEGORY_MAP[raw.category]);
  const category = inferCategoryFromMuscle(primaryMuscles[0], baseCategories);
  if (category.length === 0) category.push('livre');

  const folderName = raw.name.replace(/\//g, '_').replace(/ /g, '_').replace(/,/g, '');
  const baseUrl = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${folderName}`;
  const hasImages = raw.images && raw.images.length >= 1;

  return {
    id: raw.id,
    name: raw.name,
    category: category.length === 1 ? category[0] : category,
    muscleGroup: primaryMuscles.length === 0 ? 'fullbody' : (primaryMuscles.length === 1 ? primaryMuscles[0] : primaryMuscles),
    equipment,
    gifUrl: hasImages ? `${baseUrl}/0.jpg` : undefined,
    gifEndUrl: raw.images && raw.images.length >= 2 ? `${baseUrl}/1.jpg` : undefined,
    instructions: raw.instructions?.join('\n') || undefined,
    tags: [raw.level, raw.mechanic, raw.force].filter(Boolean) as string[]
  };
}

let cached: Exercise[] | null = null;

export async function loadExtendedCatalog(): Promise<Exercise[]> {
  if (cached) return cached;
  const res = await fetch('/exercises-db.json');
  if (!res.ok) throw new Error('Falha ao carregar catálogo estendido');
  const raw: RawExercise[] = await res.json();
  cached = raw.map(mapExercise);
  return cached;
}

/**
 * Mescla curados (PT-BR) + estendido (EN), com prioridade pra curados.
 * Curados são identificados por nome PT-BR (ex: "Supino com halteres") —
 * removemos o equivalente EN do estendido baseado em metadados.
 */
export function mergeCatalogs(curated: Exercise[], extended: Exercise[]): Exercise[] {
  // IDs dos curados que vieram do mapping pra free-exercise-db
  // Removemos do estendido pra não duplicar
  const curatedFolderNames = new Set(
    curated
      .map((e) => e.gifUrl)
      .filter((u): u is string => !!u && u.includes('free-exercise-db'))
      .map((u) => {
        const m = u.match(/exercises\/([^/]+)\/0\.jpg/);
        return m ? m[1] : null;
      })
      .filter((x): x is string => !!x)
  );

  const filteredExtended = extended.filter((ex) => {
    const m = ex.gifUrl?.match(/exercises\/([^/]+)\/0\.jpg/);
    return !m || !curatedFolderNames.has(m[1]);
  });

  return [...curated, ...filteredExtended];
}
