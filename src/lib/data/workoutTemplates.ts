/**
 * Templates de treino prontos pra novo user clonar.
 *
 * Padrao: cada template e' um Workout sem id/createdAt/updatedAt
 * (gerados na hora do clone). Os exerciseIds REFERENCIAM o catalogo
 * curado em src/lib/data/exerciseCatalog.ts — qualquer ID aqui
 * precisa existir la.
 */

import type { Workout, WorkoutCategory, WorkoutExercise } from '$lib/types';

export interface WorkoutTemplate {
  /** Slug curto pra URL/key do template */
  slug: string;
  /** Nome do template (mostrado no card) */
  name: string;
  /** Descricao curta exibida no card */
  description: string;
  /** Emoji do template */
  emoji: string;
  /** Pra qual perfil eh recomendado */
  audience: string;
  /** Frequencia sugerida (ex: "3x por semana") */
  frequency: string;
  /** Lista de "treinos" do split (ex: PPL tem 3, Upper/Lower tem 2) */
  workouts: Array<{
    name: string;
    category: WorkoutCategory;
    description?: string;
    exercises: Array<{
      exerciseId: string;
      sets: number;
      reps: number | [number, number];
      restSec: number;
      // Pra cardio: distancia em metros, pace em sec/km
      distanceM?: number;
      paceSecPerKm?: number;
      // Pra duration-based: segundos
      durationSec?: number;
    }>;
  }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildExercise(
  exerciseId: string,
  sets: number,
  reps: number | [number, number],
  restSec: number,
  extra?: { distanceM?: number; paceSecPerKm?: number; durationSec?: number }
): Omit<WorkoutExercise, 'order'> {
  const setObj = extra?.distanceM !== undefined
    ? { type: 'normal' as const, distanceM: extra.distanceM, paceSecPerKm: extra.paceSecPerKm }
    : extra?.durationSec !== undefined
    ? { type: 'isométrica' as const, durationSec: extra.durationSec }
    : Array.isArray(reps)
    ? { type: 'normal' as const, repsRange: reps as [number, number], weight: 0 }
    : { type: 'normal' as const, reps, weight: 0 };

  return {
    exerciseId,
    sets: Array.from({ length: sets }, () => ({ ...setObj })),
    restSeconds: restSec
  };
}

/* ------------------------------------------------------------------ */
/* Templates                                                          */
/* ------------------------------------------------------------------ */

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  // ───────────────────────────────────────────────────────
  // PPL (Push / Pull / Legs) — padrão hipertrofia 3-6x/semana
  // ───────────────────────────────────────────────────────
  {
    slug: 'ppl',
    name: 'PPL — Push, Pull, Legs',
    description: 'Push (peito/ombro/tríceps), Pull (costas/bíceps), Legs (pernas). Volume balanceado pra hipertrofia.',
    emoji: '🔁',
    audience: 'Intermediário',
    frequency: '3 a 6x por semana',
    workouts: [
      {
        name: 'PPL · Push',
        category: 'superior',
        description: 'Peito, ombros, tríceps',
        exercises: [
          { exerciseId: 'supino-reto-barra', sets: 4, reps: [6, 10], restSec: 120 },
          { exerciseId: 'supino-halteres', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'desenvolvimento-halteres', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'elevacao-lateral', sets: 4, reps: [12, 15], restSec: 60 },
          { exerciseId: 'triceps-pulley', sets: 3, reps: [10, 15], restSec: 60 },
          { exerciseId: 'triceps-testa-haltere', sets: 3, reps: [10, 12], restSec: 60 }
        ]
      },
      {
        name: 'PPL · Pull',
        category: 'superior',
        description: 'Costas, bíceps',
        exercises: [
          { exerciseId: 'levantamento-terra', sets: 4, reps: [5, 8], restSec: 150 },
          { exerciseId: 'puxada-frontal-polia', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'remada-curvada', sets: 3, reps: [8, 10], restSec: 90 },
          { exerciseId: 'remada-sentada-polia', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'face-pull-polia', sets: 3, reps: [12, 15], restSec: 60 },
          { exerciseId: 'rosca-direta-halteres', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'rosca-martelo', sets: 3, reps: [10, 12], restSec: 60 }
        ]
      },
      {
        name: 'PPL · Legs',
        category: 'inferior',
        description: 'Pernas inteiras + core',
        exercises: [
          { exerciseId: 'agachamento-livre', sets: 4, reps: [6, 10], restSec: 150 },
          { exerciseId: 'leg-press-45', sets: 3, reps: [10, 12], restSec: 90 },
          { exerciseId: 'stiff-halteres', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'extensao-joelhos', sets: 3, reps: [12, 15], restSec: 60 },
          { exerciseId: 'mesa-flexora', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'panturrilha-em-pe', sets: 4, reps: [12, 15], restSec: 45 },
          { exerciseId: 'prancha-isometrica', sets: 3, reps: 1, restSec: 45, durationSec: 45 }
        ]
      }
    ]
  },

  // ───────────────────────────────────────────────────────
  // UPPER / LOWER — bom pra 4 dias, intermediario
  // ───────────────────────────────────────────────────────
  {
    slug: 'upper-lower',
    name: 'Upper / Lower',
    description: 'Divisão simples em dois treinos: superior e inferior. Boa pra 4 dias na semana com 2 dias por grupo.',
    emoji: '⚖️',
    audience: 'Intermediário',
    frequency: '4x por semana (2 superior, 2 inferior)',
    workouts: [
      {
        name: 'Upper · Superior',
        category: 'superior',
        description: 'Treino completo do corpo superior',
        exercises: [
          { exerciseId: 'supino-reto-barra', sets: 4, reps: [6, 10], restSec: 120 },
          { exerciseId: 'remada-curvada', sets: 4, reps: [6, 10], restSec: 120 },
          { exerciseId: 'desenvolvimento-militar', sets: 3, reps: [8, 10], restSec: 90 },
          { exerciseId: 'puxada-frontal-polia', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'crucifixo-halteres', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'rosca-direta-halteres', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'triceps-pulley', sets: 3, reps: [10, 12], restSec: 60 }
        ]
      },
      {
        name: 'Lower · Inferior',
        category: 'inferior',
        description: 'Treino completo de pernas e glúteos',
        exercises: [
          { exerciseId: 'agachamento-livre', sets: 4, reps: [6, 10], restSec: 150 },
          { exerciseId: 'levantamento-terra', sets: 3, reps: [5, 8], restSec: 150 },
          { exerciseId: 'leg-press-45', sets: 3, reps: [10, 12], restSec: 90 },
          { exerciseId: 'afundo-halteres', sets: 3, reps: [10, 12], restSec: 90 },
          { exerciseId: 'mesa-flexora', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'hip-thrust-haltere', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'panturrilha-em-pe', sets: 4, reps: [12, 15], restSec: 45 }
        ]
      }
    ]
  },

  // ───────────────────────────────────────────────────────
  // FULL BODY — iniciante 3x/semana ou cabe em pouco tempo
  // ───────────────────────────────────────────────────────
  {
    slug: 'full-body',
    name: 'Full Body',
    description: 'Corpo inteiro em um treino só. Ótimo pra iniciantes e quem treina 3x por semana.',
    emoji: '💪',
    audience: 'Iniciante',
    frequency: '3x por semana (segunda/quarta/sexta)',
    workouts: [
      {
        name: 'Full Body · Treino A',
        category: 'fullbody',
        description: 'Treino completo focado em força',
        exercises: [
          { exerciseId: 'agachamento-livre', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'supino-reto-barra', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'remada-curvada', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'desenvolvimento-halteres', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'rosca-direta-halteres', sets: 2, reps: [10, 12], restSec: 60 },
          { exerciseId: 'triceps-pulley', sets: 2, reps: [10, 12], restSec: 60 },
          { exerciseId: 'prancha-isometrica', sets: 3, reps: 1, restSec: 45, durationSec: 45 }
        ]
      },
      {
        name: 'Full Body · Treino B',
        category: 'fullbody',
        description: 'Foco em posterior + glúteo + hipertrofia',
        exercises: [
          { exerciseId: 'levantamento-terra', sets: 3, reps: [6, 8], restSec: 120 },
          { exerciseId: 'leg-press-45', sets: 3, reps: [10, 12], restSec: 90 },
          { exerciseId: 'supino-halteres', sets: 3, reps: [8, 12], restSec: 90 },
          { exerciseId: 'puxada-frontal-polia', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'elevacao-lateral', sets: 3, reps: [12, 15], restSec: 45 },
          { exerciseId: 'hip-thrust-haltere', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'abdominal-bicicleta', sets: 3, reps: [15, 20], restSec: 45 }
        ]
      }
    ]
  },

  // ───────────────────────────────────────────────────────
  // GLUTEO/POSTERIOR (pump feminino, popular no Brasil)
  // ───────────────────────────────────────────────────────
  {
    slug: 'gluteo-pump',
    name: 'Glúteo & Posterior',
    description: 'Treino focado em glúteos e posterior de coxa. Popular pra hipertrofia estética.',
    emoji: '🍑',
    audience: 'Intermediário',
    frequency: '2 a 3x por semana',
    workouts: [
      {
        name: 'Glúteo · Volume',
        category: 'pump',
        description: 'Glúteo médio, máximo, posterior',
        exercises: [
          { exerciseId: 'hip-thrust-haltere', sets: 4, reps: [10, 12], restSec: 90 },
          { exerciseId: 'agachamento-sumo', sets: 4, reps: [10, 12], restSec: 90 },
          { exerciseId: 'stiff-halteres', sets: 3, reps: [10, 12], restSec: 75 },
          { exerciseId: 'afundo-halteres', sets: 3, reps: [10, 12], restSec: 60 },
          { exerciseId: 'cadeira-abdutora', sets: 3, reps: [15, 20], restSec: 45 },
          { exerciseId: 'coice-quadrupede', sets: 3, reps: [12, 15], restSec: 45 },
          { exerciseId: 'panturrilha-em-pe', sets: 3, reps: [15, 20], restSec: 45 }
        ]
      }
    ]
  },

  // ───────────────────────────────────────────────────────
  // CORRIDA — pro user que so quer registrar cardio
  // ───────────────────────────────────────────────────────
  {
    slug: 'corrida-iniciante',
    name: 'Corrida Iniciante',
    description: '3x por semana, alternando 5km com tempo livre. Ideal pra quem está começando a correr.',
    emoji: '🏃',
    audience: 'Iniciante',
    frequency: '3x por semana',
    workouts: [
      {
        name: 'Corrida 5km',
        category: 'cardio',
        description: '5km no seu ritmo',
        exercises: [
          { exerciseId: 'corrida', sets: 1, reps: 1, restSec: 0, distanceM: 5000, paceSecPerKm: 360 }
        ]
      }
    ]
  }
];
