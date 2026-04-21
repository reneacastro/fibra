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
    category: ['superior', 'forca'],
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
    category: ['superior', 'calistenia', 'funcional'],
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
    category: ['superior', 'forca'],
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
    category: ['superior', 'forca'],
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
    category: ['superior', 'forca'],
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
    category: ['inferior', 'forca', 'pump'],
    muscleGroup: ['quadriceps', 'adutores', 'gluteos'],
    equipment: 'halteres',
    gifUrl: '/exercises/agachamento-sumo.gif',
    mets: 7,
    tags: ['composto']
  },
  {
    id: 'goblet-squat-haltere',
    name: 'Goblet squat com haltere',
    category: ['inferior', 'forca'],
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
    category: ['inferior', 'forca'],
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
    category: ['inferior', 'forca', 'pump'],
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
    category: ['inferior', 'pump'],
    muscleGroup: 'gluteos',
    equipment: 'halteres',
    gifUrl: '/exercises/hip-thrust-haltere.gif',
    mets: 5
  },
  {
    id: 'elevacao-pelvica-banco',
    name: 'Elevação pélvica no banco',
    category: ['inferior', 'pump'],
    muscleGroup: 'gluteos',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/elevacao-pelvica-banco.gif',
    mets: 4
  },

  // ─── INFERIOR — ABDUTORES / PANTURRILHA ────────────
  {
    id: 'cadeira-abdutora',
    name: 'Cadeira abdutora',
    category: ['inferior', 'pump'],
    muscleGroup: 'abdutores',
    equipment: 'maquina',
    gifUrl: '/exercises/cadeira-abdutora.gif',
    mets: 3
  },
  {
    id: 'abducao-cabo',
    name: 'Abdução no cabo',
    category: ['inferior', 'pump'],
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
    category: ['core', 'funcional', 'fullbody'],
    muscleGroup: ['core', 'lombar'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/prancha-isometrica.gif',
    mets: 4,
    tags: ['isometrica']
  },
  {
    id: 'prancha-lateral',
    name: 'Prancha lateral',
    category: ['core', 'funcional'],
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/prancha-lateral.gif',
    mets: 4,
    tags: ['isometrica', 'unilateral']
  },
  {
    id: 'abdominal-bicicleta',
    name: 'Abdominal bicicleta',
    category: ['core', 'funcional'],
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/abdominal-bicicleta.gif',
    mets: 5
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    category: ['core', 'funcional', 'mobilidade'],
    muscleGroup: ['core', 'lombar'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/dead-bug.gif',
    mets: 3,
    tags: ['controle-motor', 'reabilitacao']
  },
  {
    id: 'bird-dog',
    name: 'Bird dog',
    category: ['core', 'funcional', 'mobilidade'],
    muscleGroup: ['core', 'lombar', 'gluteos'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/bird-dog.gif',
    mets: 3,
    tags: ['controle-motor', 'mobilidade']
  },
  {
    id: 'superman-alternado',
    name: 'Superman alternado',
    category: ['core', 'funcional'],
    muscleGroup: ['lombar', 'gluteos'],
    equipment: 'peso-corporal',
    gifUrl: '/exercises/superman-alternado.gif',
    mets: 3
  },
  {
    id: 'mountain-climber',
    name: 'Mountain climber',
    category: ['core', 'funcional', 'hiit', 'crossfit', 'fullbody', 'cardio'],
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
    category: ['crossfit', 'hiit', 'funcional', 'fullbody', 'cardio', 'calistenia'],
    muscleGroup: 'fullbody',
    equipment: 'peso-corporal',
    gifUrl: '/exercises/burpee.gif',
    mets: 10,
    tags: ['metcon']
  },
  {
    id: 'box-jump',
    name: 'Box jump',
    category: ['crossfit', 'funcional', 'fullbody', 'calistenia'],
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
    category: ['cardio', 'livre'],
    muscleGroup: 'cardio',
    equipment: 'nenhum',
    gifUrl: '/exercises/corrida.gif',
    mets: 9,
    tags: ['cardio', 'outdoor']
  },
  {
    id: 'eliptico',
    name: 'Elíptico',
    category: ['cardio', 'livre'],
    muscleGroup: 'cardio',
    equipment: 'eliptico',
    gifUrl: '/exercises/eliptico.gif',
    mets: 7,
    tags: ['cardio', 'baixo-impacto']
  },
  {
    id: 'remo-ergometrico',
    name: 'Remo ergométrico',
    category: ['cardio', 'livre'],
    muscleGroup: ['cardio', 'costas'],
    equipment: 'maquina',
    gifUrl: '/exercises/remo-ergometrico.webp',
    mets: 8,
    tags: ['cardio', 'fullbody']
  },

  // ═══ FORÇA (powerlifting / low-rep compostos) ══════════
  {
    id: 'agachamento-livre',
    name: 'Agachamento livre com barra',
    category: ['inferior', 'forca'],
    muscleGroup: ['quadriceps', 'gluteos', 'lombar'],
    equipment: 'barra',
    mets: 8,
    tags: ['composto', 'big-three']
  },
  {
    id: 'levantamento-terra',
    name: 'Levantamento terra',
    category: ['fullbody', 'forca'],
    muscleGroup: ['posterior', 'gluteos', 'lombar', 'costas'],
    equipment: 'barra',
    mets: 8,
    tags: ['composto', 'big-three']
  },
  {
    id: 'supino-reto-barra',
    name: 'Supino reto com barra',
    category: ['superior', 'forca'],
    muscleGroup: ['peito', 'triceps', 'ombros'],
    equipment: 'barra',
    mets: 6,
    tags: ['composto', 'push', 'big-three']
  },
  {
    id: 'desenvolvimento-militar',
    name: 'Desenvolvimento militar (overhead press)',
    category: ['superior', 'forca'],
    muscleGroup: ['ombros', 'triceps', 'core'],
    equipment: 'barra',
    mets: 6,
    tags: ['composto', 'push']
  },
  {
    id: 'remada-curvada',
    name: 'Remada curvada com barra',
    category: ['superior', 'forca'],
    muscleGroup: ['costas', 'biceps'],
    equipment: 'barra',
    mets: 6,
    tags: ['composto', 'pull']
  },

  // ═══ PUMP (glúteo/estético) ═══════════════════════════
  {
    id: 'cadeira-adutora',
    name: 'Cadeira adutora',
    category: ['inferior', 'pump'],
    muscleGroup: 'adutores',
    equipment: 'maquina',
    mets: 3
  },
  {
    id: 'eleva-perna-polia',
    name: 'Elevação posterior de perna na polia',
    category: ['inferior', 'pump'],
    muscleGroup: ['gluteos', 'posterior'],
    equipment: 'polia',
    mets: 4
  },
  {
    id: 'coice-quadrupede',
    name: 'Coice quadrúpede (donkey kick)',
    category: ['inferior', 'pump'],
    muscleGroup: 'gluteos',
    equipment: 'peso-corporal',
    mets: 4
  },
  {
    id: 'agachamento-bulgaro',
    name: 'Agachamento búlgaro',
    category: ['inferior', 'pump', 'forca'],
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'halteres',
    mets: 7,
    tags: ['unilateral']
  },

  // ═══ CORE / ABS ════════════════════════════════════════
  {
    id: 'abdominal-crunch',
    name: 'Abdominal crunch',
    category: 'core',
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    mets: 4
  },
  {
    id: 'abdominal-canivete',
    name: 'Abdominal canivete',
    category: 'core',
    muscleGroup: 'core',
    equipment: 'peso-corporal',
    mets: 5
  },
  {
    id: 'ab-wheel',
    name: 'Ab wheel (rolinho abdominal)',
    category: ['core', 'calistenia'],
    muscleGroup: ['core', 'ombros'],
    equipment: 'nenhum',
    mets: 5
  },
  {
    id: 'russian-twist',
    name: 'Russian twist',
    category: ['core', 'funcional'],
    muscleGroup: 'core',
    equipment: 'halteres',
    mets: 5
  },
  {
    id: 'elevacao-pernas',
    name: 'Elevação de pernas (na barra ou deitado)',
    category: ['core', 'calistenia'],
    muscleGroup: 'core',
    equipment: 'barra',
    mets: 5
  },

  // ═══ CARDIO ═══════════════════════════════════════════
  {
    id: 'bike-ergometrica',
    name: 'Bike ergométrica',
    category: ['cardio', 'livre'],
    muscleGroup: 'cardio',
    equipment: 'bike',
    mets: 7,
    tags: ['baixo-impacto']
  },
  {
    id: 'pular-corda',
    name: 'Pular corda',
    category: ['cardio', 'hiit'],
    muscleGroup: ['cardio', 'panturrilha'],
    equipment: 'corda',
    mets: 11,
    tags: ['cardio', 'hiit']
  },
  {
    id: 'caminhada-esteira',
    name: 'Caminhada na esteira',
    category: ['cardio', 'livre'],
    muscleGroup: 'cardio',
    equipment: 'esteira',
    mets: 4,
    tags: ['baixo-impacto', 'recuperacao']
  },

  // ═══ CALISTENIA ═══════════════════════════════════════
  {
    id: 'pull-up',
    name: 'Barra fixa (pull-up)',
    category: ['superior', 'calistenia'],
    muscleGroup: ['costas', 'biceps'],
    equipment: 'barra',
    mets: 8,
    tags: ['pull', 'composto']
  },
  {
    id: 'chin-up',
    name: 'Chin-up (palmas invertidas)',
    category: ['superior', 'calistenia'],
    muscleGroup: ['costas', 'biceps'],
    equipment: 'barra',
    mets: 8,
    tags: ['pull']
  },
  {
    id: 'dip-paralela',
    name: 'Paralela (dip)',
    category: ['superior', 'calistenia'],
    muscleGroup: ['peito', 'triceps', 'ombros'],
    equipment: 'nenhum',
    mets: 7,
    tags: ['push']
  },
  {
    id: 'flexao-diamante',
    name: 'Flexão diamante',
    category: ['superior', 'calistenia'],
    muscleGroup: ['triceps', 'peito'],
    equipment: 'peso-corporal',
    mets: 6
  },
  {
    id: 'l-sit',
    name: 'L-sit',
    category: ['core', 'calistenia'],
    muscleGroup: ['core', 'quadriceps'],
    equipment: 'peso-corporal',
    mets: 5,
    tags: ['isometrica']
  },
  {
    id: 'pistol-squat',
    name: 'Pistol squat (agachamento unilateral)',
    category: ['inferior', 'calistenia', 'forca'],
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'peso-corporal',
    mets: 7,
    tags: ['unilateral']
  },

  // ═══ MOBILIDADE / ALONGAMENTO ══════════════════════════
  {
    id: 'pigeon-pose',
    name: 'Pigeon pose (alongamento glúteo)',
    category: ['mobilidade', 'alongamento'],
    muscleGroup: ['gluteos', 'quadriceps'],
    equipment: 'peso-corporal',
    mets: 2,
    tags: ['isometrica', 'yoga']
  },
  {
    id: 'cat-cow',
    name: 'Cat-cow (coluna)',
    category: ['mobilidade', 'alongamento'],
    muscleGroup: ['lombar', 'core'],
    equipment: 'peso-corporal',
    mets: 2,
    tags: ['yoga', 'coluna']
  },
  {
    id: 'down-dog',
    name: 'Downward dog (cachorro olhando pra baixo)',
    category: ['mobilidade', 'alongamento'],
    muscleGroup: ['posterior', 'ombros', 'panturrilha'],
    equipment: 'peso-corporal',
    mets: 3,
    tags: ['yoga', 'isometrica']
  },
  {
    id: 'flexor-quadril',
    name: 'Alongamento de flexor do quadril',
    category: ['mobilidade', 'alongamento'],
    muscleGroup: ['quadriceps', 'gluteos'],
    equipment: 'peso-corporal',
    mets: 2,
    tags: ['isometrica']
  },
  {
    id: 'circulos-ombro',
    name: 'Círculos de ombro',
    category: 'mobilidade',
    muscleGroup: 'ombros',
    equipment: 'peso-corporal',
    mets: 2
  },
  {
    id: 'world-greatest-stretch',
    name: "World's greatest stretch",
    category: ['mobilidade', 'alongamento'],
    muscleGroup: 'fullbody',
    equipment: 'peso-corporal',
    mets: 3,
    tags: ['dinamico']
  }
];

export const EXERCISE_COUNT = SEED_EXERCISES.length;
