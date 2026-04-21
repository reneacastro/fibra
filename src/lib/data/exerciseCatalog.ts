/* ═══════════════════════════════════════════════════════════
   FIBRA — Catálogo seed de exercícios
   ═══════════════════════════════════════════════════════════
   Esses são os 41 exercícios da v1 remapeados para o schema.
   Os gifs ficam em /exercises/{id}.gif (ou .webp).
   Na primeira execução, um script sobe isso para Firestore
   como documentos em `exerciseCatalog/{id}`.
   ═══════════════════════════════════════════════════════════ */

import type { Exercise } from '$lib/types';

export const SEED_EXERCISES: Exercise[] = [
  // ─── PEITO ──────────────────────────────────────────
  {
    id: 'supino-halteres',
    name: 'Supino com halteres',
    category: 'superior',
    muscleGroup: ['peito', 'triceps', 'ombros'],
    equipment: 'halteres',
    gifUrl: '/exercises/supino-halteres.gif',
    mets: 6,
    tags: ['push', 'composto']
  },
  {
    id: 'crucifixo-halteres',
    name: 'Crucifixo com halteres',
    category: 'superior',
    muscleGroup: 'peito',
    equipment: 'halteres',
    gifUrl: '/exercises/crucifixo-halteres.gif',
    mets: 5,
    tags: ['push', 'isolador']
  },
  {
    id: 'pull-over-halteres',
    name: 'Pull over com halteres',
    category: 'superior',
    muscleGroup: ['peito', 'costas'],
    equipment: 'halteres',
    gifUrl: '/exercises/pull-over-halteres.gif',
    mets: 5
  },
  {
    id: 'flexao-bracos',
    name: 'Flexão de braços',
    category: 'superior',
    muscleGroup: ['peito', 'triceps'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/flexao-bracos.gif',
    mets: 6,
    tags: ['push', 'funcional']
  },

  // ─── COSTAS ─────────────────────────────────────────
  {
    id: 'puxada-frontal-polia',
    name: 'Puxada frontal na polia',
    category: 'superior',
    muscleGroup: 'costas',
    equipment: 'polia',
    gifUrl: '/exercises/puxada-frontal-polia.gif',
    mets: 5,
    tags: ['pull']
  },
  {
    id: 'remada-sentada-polia',
    name: 'Remada sentada na polia',
    category: 'superior',
    muscleGroup: 'costas',
    equipment: 'polia',
    gifUrl: '/exercises/remada-sentada-polia.gif',
    mets: 5,
    tags: ['pull']
  },
  {
    id: 'remada-unilateral-haltere',
    name: 'Remada unilateral com haltere',
    category: 'superior',
    muscleGroup: 'costas',
    equipment: 'halteres',
    gifUrl: '/exercises/remada-unilateral-haltere.gif',
    mets: 5,
    tags: ['pull', 'unilateral']
  },
  {
    id: 'face-pull-polia',
    name: 'Face pull na polia',
    category: 'superior',
    muscleGroup: ['ombros', 'costas'],
    equipment: 'polia',
    gifUrl: '/exercises/face-pull-polia.gif',
    mets: 4,
    tags: ['saude-ombro']
  },

  // ─── OMBROS ─────────────────────────────────────────
  {
    id: 'desenvolvimento-halteres',
    name: 'Desenvolvimento com halteres',
    category: 'superior',
    muscleGroup: 'ombros',
    equipment: 'halteres',
    gifUrl: '/exercises/desenvolvimento-halteres.gif',
    mets: 6,
    tags: ['push', 'composto']
  },
  {
    id: 'elevacao-lateral',
    name: 'Elevação lateral',
    category: 'superior',
    muscleGroup: 'ombros',
    equipment: 'halteres',
    gifUrl: '/exercises/elevacao-lateral.gif',
    mets: 4,
    tags: ['isolador']
  },

  // ─── BÍCEPS / TRÍCEPS / ANTEBRAÇO ──────────────────
  {
    id: 'rosca-direta-halteres',
    name: 'Rosca direta com halteres',
    category: 'superior',
    muscleGroup: 'biceps',
    equipment: 'halteres',
    gifUrl: '/exercises/rosca-direta-halteres.gif',
    mets: 4
  },
  {
    id: 'rosca-martelo',
    name: 'Rosca martelo',
    category: 'superior',
    muscleGroup: ['biceps', 'antebraco'],
    equipment: 'halteres',
    gifUrl: '/exercises/rosca-martelo.gif',
    mets: 4
  },
  {
    id: 'triceps-testa-haltere',
    name: 'Tríceps testa com haltere',
    category: 'superior',
    muscleGroup: 'triceps',
    equipment: 'halteres',
    gifUrl: '/exercises/triceps-testa-haltere.gif',
    mets: 4
  },
  {
    id: 'triceps-pulley',
    name: 'Tríceps pulley',
    category: 'superior',
    muscleGroup: 'triceps',
    equipment: 'polia',
    gifUrl: '/exercises/triceps-pulley.gif',
    mets: 4
  },

  // ─── INFERIOR — QUADRÍCEPS ─────────────────────────
  {
    id: 'agachamento-sumo',
    name: 'Agachamento sumo',
    category: 'inferior',
    muscleGroup: ['quadriceps', 'adutores', 'gluteos'],
    equipment: 'halteres',
    gifUrl: '/exercises/agachamento-sumo.gif',
    mets: 7,
    tags: ['composto']
  },
  {
    id: 'goblet-squat-haltere',
    name: 'Goblet squat com haltere',
    category: 'inferior',
    muscleGroup: 'quadriceps',
    equipment: 'halteres',
    gifUrl: '/exercises/goblet-squat-haltere.gif',
    mets: 7,
    tags: ['composto']
  },
  {
    id: 'afundo-halteres',
    name: 'Afundo com halteres',
    category: 'inferior',
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'halteres',
    gifUrl: '/exercises/afundo-halteres.gif',
    mets: 6,
    tags: ['unilateral']
  },
  {
    id: 'avanco-halteres',
    name: 'Avanço com halteres',
    category: 'inferior',
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'halteres',
    gifUrl: '/exercises/avanco-halteres.gif',
    mets: 6,
    tags: ['unilateral']
  },
  {
    id: 'leg-press-45',
    name: 'Leg press 45°',
    category: 'inferior',
    muscleGroup: 'quadriceps',
    equipment: 'maquina',
    gifUrl: '/exercises/leg-press-45.gif',
    mets: 6,
    tags: ['composto']
  },
  {
    id: 'extensao-joelhos',
    name: 'Extensão de joelhos',
    category: 'inferior',
    muscleGroup: 'quadriceps',
    equipment: 'maquina',
    gifUrl: '/exercises/extensao-joelhos.gif',
    mets: 4,
    tags: ['isolador']
  },
  {
    id: 'step-up-halteres',
    name: 'Step up com halteres',
    category: 'inferior',
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'caixa',
    gifUrl: '/exercises/step-up-halteres.webp',
    mets: 6,
    tags: ['unilateral', 'funcional']
  },

  // ─── INFERIOR — POSTERIOR / GLÚTEO ─────────────────
  {
    id: 'stiff-halteres',
    name: 'Stiff com halteres',
    category: 'inferior',
    muscleGroup: ['posterior', 'gluteos', 'lombar'],
    equipment: 'halteres',
    gifUrl: '/exercises/stiff-halteres.gif',
    mets: 6
  },
  {
    id: 'mesa-flexora',
    name: 'Mesa flexora',
    category: 'inferior',
    muscleGroup: 'posterior',
    equipment: 'maquina',
    gifUrl: '/exercises/mesa-flexora.gif',
    mets: 4,
    tags: ['isolador']
  },
  {
    id: 'hip-thrust-haltere',
    name: 'Hip thrust com haltere',
    category: 'inferior',
    muscleGroup: 'gluteos',
    equipment: 'halteres',
    gifUrl: '/exercises/hip-thrust-haltere.gif',
    mets: 5
  },
  {
    id: 'elevacao-pelvica-banco',
    name: 'Elevação pélvica no banco',
    category: 'inferior',
    muscleGroup: 'gluteos',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/elevacao-pelvica-banco.gif',
    mets: 4
  },

  // ─── INFERIOR — ABDUTORES / PANTURRILHA ────────────
  {
    id: 'cadeira-abdutora',
    name: 'Cadeira abdutora',
    category: 'inferior',
    muscleGroup: 'abdutores',
    equipment: 'maquina',
    gifUrl: '/exercises/cadeira-abdutora.gif',
    mets: 3
  },
  {
    id: 'abducao-cabo',
    name: 'Abdução no cabo',
    category: 'inferior',
    muscleGroup: ['abdutores', 'gluteos'],
    equipment: 'polia',
    gifUrl: '/exercises/abducao-cabo.gif',
    mets: 3
  },
  {
    id: 'panturrilha-em-pe',
    name: 'Panturrilha em pé',
    category: 'inferior',
    muscleGroup: 'panturrilha',
    equipment: 'maquina',
    gifUrl: '/exercises/panturrilha-em-pe.gif',
    mets: 3
  },

  // ─── CORE / ABDOMINAL ──────────────────────────────
  {
    id: 'prancha-isometrica',
    name: 'Prancha isométrica',
    category: ['funcional', 'fullbody'],
    muscleGroup: ['core', 'lombar'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/prancha-isometrica.gif',
    mets: 4,
    tags: ['isometrica']
  },
  {
    id: 'prancha-lateral',
    name: 'Prancha lateral',
    category: 'funcional',
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/prancha-lateral.gif',
    mets: 4,
    tags: ['isometrica', 'unilateral']
  },
  {
    id: 'abdominal-bicicleta',
    name: 'Abdominal bicicleta',
    category: 'funcional',
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/abdominal-bicicleta.gif',
    mets: 5
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    category: ['funcional', 'alongamento'],
    muscleGroup: ['core', 'lombar'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/dead-bug.gif',
    mets: 3,
    tags: ['controle-motor', 'reabilitacao']
  },
  {
    id: 'bird-dog',
    name: 'Bird dog',
    category: ['funcional', 'alongamento'],
    muscleGroup: ['core', 'lombar', 'gluteos'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/bird-dog.gif',
    mets: 3,
    tags: ['controle-motor', 'mobilidade']
  },
  {
    id: 'superman-alternado',
    name: 'Superman alternado',
    category: 'funcional',
    muscleGroup: ['lombar', 'gluteos'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/superman-alternado.gif',
    mets: 3
  },
  {
    id: 'mountain-climber',
    name: 'Mountain climber',
    category: ['funcional', 'hiit', 'crossfit', 'fullbody'],
    muscleGroup: ['core', 'cardio'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/mountain-climber.gif',
    mets: 8,
    tags: ['metcon']
  },

  // ─── CROSSFIT / FUNCIONAL METCON ───────────────────
  {
    id: 'burpee',
    name: 'Burpee',
    category: ['crossfit', 'hiit', 'funcional', 'fullbody'],
    muscleGroup: 'fullbody',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/burpee.gif',
    mets: 10,
    tags: ['metcon']
  },
  {
    id: 'box-jump',
    name: 'Box jump',
    category: ['crossfit', 'funcional', 'fullbody'],
    muscleGroup: ['quadriceps', 'gluteos', 'panturrilha'],
    equipment: 'caixa',
    gifUrl: '/exercises/box-jump.gif',
    mets: 9,
    tags: ['pliometria']
  },
  {
    id: 'kettlebell-swing',
    name: 'Kettlebell swing',
    category: ['crossfit', 'funcional', 'fullbody'],
    muscleGroup: ['gluteos', 'posterior', 'core'],
    equipment: 'kettlebell',
    gifUrl: '/exercises/kettlebell-swing.gif',
    mets: 9,
    tags: ['balistico']
  },

  // ─── CARDIO ────────────────────────────────────────
  {
    id: 'corrida',
    name: 'Corrida',
    category: 'livre',
    muscleGroup: 'cardio',
    equipment: 'nenhum',
    gifUrl: '/exercises/corrida.gif',
    mets: 9,
    tags: ['cardio', 'outdoor']
  },
  {
    id: 'eliptico',
    name: 'Elíptico',
    category: 'livre',
    muscleGroup: 'cardio',
    equipment: 'eliptico',
    gifUrl: '/exercises/eliptico.gif',
    mets: 7,
    tags: ['cardio', 'baixo-impacto']
  },
  {
    id: 'remo-ergometrico',
    name: 'Remo ergométrico',
    category: 'livre',
    muscleGroup: ['cardio', 'costas'],
    equipment: 'maquina',
    gifUrl: '/exercises/remo-ergometrico.webp',
    mets: 8,
    tags: ['cardio', 'fullbody']
  }
];

export const EXERCISE_COUNT = SEED_EXERCISES.length;
