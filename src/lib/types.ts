/* ═══════════════════════════════════════════════════════════
   FIBRA — Schema de domínio (Firestore)
   ═══════════════════════════════════════════════════════════
   Todos os docs usam camelCase. IDs são sempre strings.
   Datas no formato ISO YYYY-MM-DD. Timestamps em ms (Date.now()).
   ═══════════════════════════════════════════════════════════ */

// ─── Enums ───────────────────────────────────────────────
export type WorkoutCategory =
  | 'superior'
  | 'inferior'
  | 'fullbody'
  | 'livre'
  | 'alongamento'
  | 'funcional'
  | 'crossfit'
  | 'hiit'
  | 'cardio'
  | 'core'
  | 'mobilidade'
  | 'calistenia'
  | 'forca'       // powerlifting / força máxima
  | 'pump';       // foco em glúteo/estético

export type Goal = 'emagrecer' | 'massa' | 'qualidade' | 'lesao' | 'performance';

export type MuscleGroup =
  | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'antebraco'
  | 'quadriceps' | 'posterior' | 'gluteos' | 'panturrilha' | 'adutores' | 'abdutores'
  | 'core' | 'lombar' | 'cardio' | 'fullbody';

export type Equipment =
  | 'peso-corporal' | 'halteres' | 'barra' | 'polia' | 'maquina'
  | 'kettlebell' | 'elastico' | 'esteira' | 'bike' | 'eliptico'
  | 'caixa' | 'corda' | 'bola' | 'nenhum';

export type SetType = 'normal' | 'falha' | 'pirâmide' | 'dropset' | 'cluster' | 'isométrica';

export type CrossfitFormat = 'amrap' | 'emom' | 'fortime' | 'chipper' | 'tabata' | 'rft';

// ─── Perfil ──────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  name: string;
  surname?: string;
  email: string;
  avatar: string; // emoji ou URL
  height: number; // cm
  weight: number; // kg (último peso)
  birthDate?: string;
  sex?: 'M' | 'F' | 'outro';
  goals: Goal[];
  activityLevel?: 1 | 2 | 3 | 4 | 5; // 1=sedentário, 5=atleta
  settings: UserSettings;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'auto';
  units: 'metric' | 'imperial';
  restTimerDefault: number; // segundos
  hapticFeedback: boolean;
  notifications: {
    rest: boolean;
    dailyReminder: boolean;
    weeklyRecap: boolean;
  };
  publicProfile: boolean;
  dietPlanId?: string;
  // Papel real do usuário. Default = 'athlete'. Só admin pode promover.
  // 'both' = trainer + nutritionist (profissional dual).
  role?: 'athlete' | 'trainer' | 'nutritionist' | 'both';
  // Intenção do usuário (auto-declarada). Fica aqui até admin aprovar.
  rolePending?: 'trainer' | 'nutritionist' | 'both';
  roleApprovedAt?: number;
  roleApprovedBy?: string;
}

// ─── Catálogo de exercícios ──────────────────────────────
export interface Exercise {
  id: string;
  name: string;
  category: WorkoutCategory | WorkoutCategory[];
  muscleGroup: MuscleGroup | MuscleGroup[];
  equipment: Equipment;
  /** Imagem inicial / posição de partida (ou GIF animado completo) */
  gifUrl?: string;
  /** Imagem final / posição de chegada (alterna com gifUrl pra simular movimento) */
  gifEndUrl?: string;
  thumbUrl?: string;
  instructions?: string;
  tips?: string[];
  mets?: number; // intensidade metabólica para estimar calorias
  isCustom?: boolean; // true se criado pelo usuário
  tags?: string[];
}

// ─── Treinos ─────────────────────────────────────────────
export interface Workout {
  id: string;
  name: string;
  category: WorkoutCategory;
  description?: string;
  exercises: WorkoutExercise[];
  order: number;
  crossfit?: CrossfitConfig; // se category === 'crossfit'
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
  color?: string; // hex opcional
}

export interface WorkoutExercise {
  /** ID estavel por linha — evita colisao de chaves no keyed each do
   *  Svelte quando o mesmo exercicio aparece 2x e estabiliza drag&drop.
   *  Opcional pra retro-compat: treinos antigos ganham ID na primeira
   *  load via migrate em /treinos/[id]. */
  id?: string;
  exerciseId: string;
  order: number;
  sets: ExerciseSet[];
  restSeconds?: number;
  notes?: string;
  supersetWith?: string; // exerciseId do bi-set
}

export interface ExerciseSet {
  type: SetType;
  reps?: number;
  repsRange?: [number, number]; // ex: [8,12]
  weight?: number; // kg sugerido
  durationSec?: number; // para alongamento/isométrica
  distanceM?: number; // para corrida
  paceSecPerKm?: number; // ritmo alvo (corrida/cardio)
  rpeTarget?: number; // 1-10
  tempo?: string; // ex: "3-1-1-0"
}

export interface CrossfitConfig {
  format: CrossfitFormat;
  durationMin?: number; // AMRAP/EMOM
  rounds?: number; // RFT
  timeCap?: number; // For Time
  notes?: string;
}

// ─── Sessões realizadas ──────────────────────────────────
export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  startedAt: number;
  finishedAt?: number;
  workoutId?: string;
  workoutName: string;
  workoutCategory: WorkoutCategory;
  performedExercises: PerformedExercise[];
  totalVolume?: number; // soma reps*peso
  calories?: number;
  bodyWeight?: number; // peso do usuário no dia
  mood?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  // Cardio opcional
  km?: number;
  pace?: string;
  // PRs conquistados nessa sessão
  prsEarned?: string[]; // exerciseIds
  /** Como a sessao foi gravada:
   *  - 'realtime' (default): cronometrada na hora; finishedAt-startedAt e duracao real.
   *  - 'manual': registro pos-fato (treino antigo); cronometro nao roda, duracao
   *    nao entra em agregados publicos (ranking) pra nao "sujar" metrica de tempo. */
  recording?: 'realtime' | 'manual';
  createdAt: number;
}

export interface PerformedExercise {
  exerciseId: string;
  exerciseName: string;
  order: number;
  sets: PerformedSet[];
  skipped?: boolean;
}

export interface PerformedSet {
  reps?: number;
  weight?: number;
  durationSec?: number;
  distanceM?: number;
  paceSecPerKm?: number;
  rpe?: number;
  completed: boolean;
  // Rota GPS capturada (só cardio com GPS ativo)
  gpsTrack?: { lat: number; lng: number; t: number }[];
}

// ─── Log por exercício ───────────────────────────────────
// Fica em users/{uid}/exerciseLogs/{exerciseId}/entries/{entryId}
export interface ExerciseLogEntry {
  id: string;
  exerciseId: string;
  sessionId: string;
  date: string;
  topSet: { reps: number; weight: number };
  totalVolume: number;
  estimated1RM?: number;
  isPR?: boolean;
  createdAt: number;
}

// ─── Composição corporal ─────────────────────────────────
// Fica em users/{uid}/bodyComp/{YYYY-MM-DD}
export interface BodyComp {
  date: string;
  peso?: number;
  imc?: number;
  // Bioimpedância
  fat?: number;               // % gordura corporal
  subcutaneousFat?: number;   // % gordura subcutânea
  muscle?: number;            // kg massa muscular total
  skeletalMuscle?: number;    // kg massa muscular esquelética
  smi?: number;               // kg/m² índice de massa muscular esquelética
  protein?: number;           // kg proteína
  visceral?: number;          // índice
  hydration?: number;         // % água corporal
  bone?: number;              // kg massa óssea
  tmb?: number;               // kcal/dia
  metabolicAge?: number;      // anos
  bodyScore?: number;         // 0-100 pontuação corporal
  targetWeight?: number;      // kg peso alvo
  // Medidas (cm)
  waist?: number;
  hip?: number;
  chest?: number;
  abdomen?: number;
  thigh?: number;
  calf?: number;
  arm?: number;
  forearm?: number;
  shoulder?: number;
  neck?: number;
  source: 'manual' | 'pdf-relaxfit' | 'health';
  notes?: string;
  createdAt: number;
}

// ─── Agenda semanal ──────────────────────────────────────
export interface Schedule {
  // 0=dom, 1=seg, ... 6=sáb
  days: Record<number, ScheduleDay>;
  updatedAt: number;
}

export interface ScheduleDay {
  workoutIds: string[]; // múltiplos treinos num dia são permitidos
  rest: boolean;
  label?: string;
}

// ─── Dieta ───────────────────────────────────────────────
export interface DietPlan {
  id: string;
  name: string;
  dailyTargets: MacroTargets;
  meals: PlannedMeal[]; // template da rotina diária
  createdAt: number;
  active: boolean;
}

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  waterMl?: number;
}

export interface PlannedMeal {
  id: string;
  name: string; // "Café da manhã"
  time: string; // "07:00"
  items: PlannedFoodItem[];
  /** Dias da semana em que essa refeição aplica (0=dom, 6=sáb).
   * Se vazio/undefined, vale pra todos os dias. */
  daysOfWeek?: number[];
}

export interface PlannedFoodItem {
  foodId: string;
  foodName: string;
  grams: number;
  /** Qtd em unidades (se o alimento for medido em unidades). */
  units?: number;
  /** Macros por 100g — usado quando foodId não existe no catálogo (ex: dieta importada de nutri) */
  kcalPer100g?: number;
  proteinPer100g?: number;
  carbPer100g?: number;
  fatPer100g?: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingSize: number; // g (peso de 1 porção/unidade)
  /** Se preenchido, alimento pode ser medido em unidades além de gramas (ex: "unidade", "fatia", "colher") */
  unit?: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  source: 'taco' | 'off' | 'custom' | 'usda';
  custom?: boolean;
}

export interface MealLog {
  date: string;
  meals: LoggedMeal[];
  totals: MacroTargets;
  adherencePct?: number;
  waterMl?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoggedMeal {
  id: string;
  plannedMealId?: string;
  name: string;
  time: string;
  items: LoggedFoodItem[];
  /** Marca que a refeição foi de fato consumida — só refeições concluídas contam nos totais */
  completed?: boolean;
  completedAt?: number;
}

export interface LoggedFoodItem {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

// ─── Conquistas / PRs ────────────────────────────────────
export type AchievementType =
  | 'pr-weight' | 'pr-reps' | 'pr-volume' | 'pr-1rm'
  | 'streak-7' | 'streak-30' | 'streak-100'
  | 'weight-goal' | 'body-fat-goal' | 'first-workout'
  | 'milestone-workouts';

export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  earnedAt: number;
  icon: string;
  context?: Record<string, unknown>;
  seen?: boolean;
}

// ─── Perfil público (compartilhamento) ───────────────────
export interface PublicProfile {
  uid: string;
  handle: string; // @renecastro
  displayName: string;
  avatar: string;
  bio?: string;
  stats: {
    totalWorkouts: number;
    currentStreak: number;
    joinedAt: number;
  };
  showcase?: {
    prs: boolean;
    measurements: boolean;
    currentWeight: boolean;
  };
}

// ─── Pedidos de role (gate admin) ───────────────────────

export interface RoleRequest {
  uid: string;
  name: string;
  avatar?: string;
  requestedRole: 'trainer' | 'nutritionist' | 'both';
  note?: string;
  createdAt: number;
}

// ─── Relacionamentos trainer/nutri ⇄ cliente ────────────

/**
 * Doc ID determinístico: `${trainerUid}_${clientUid}`.
 * Evita duplicatas de convite e simplifica regras.
 */
export interface Relationship {
  id: string; // = `${trainerUid}_${clientUid}`
  trainerUid: string;
  trainerName: string;
  trainerAvatar?: string;
  trainerRole: 'trainer' | 'nutritionist';
  clientUid: string;
  clientName: string;
  clientAvatar?: string;
  status: 'pending' | 'active' | 'ended';
  scope: Array<'workouts' | 'diet'>; // o que o trainer pode editar no cliente
  note?: string; // mensagem opcional do trainer ao convidar
  createdAt: number;
  acceptedAt?: number;
  endedAt?: number;
}

// ─── Grupos (comunidade dentro da comunidade) ───────────

export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerUid: string;
  ownerName: string;
  memberUids: string[]; // inclui o owner
  isPublic: boolean;
  emoji?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GroupPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  // menções futuras: uids do time (não implementado ainda)
  mentions?: string[];
  createdAt: number;
}

// ─── Chat trainer ⇄ cliente ─────────────────────────────

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
}

// ─── Comunidade ─────────────────────────────────────────

/** Entry do ranking público. Um doc por usuário, agregado a cada sessão salva. */
export interface RankingEntry {
  uid: string;
  displayName: string;
  avatar?: string; // emoji ou URL
  // Métricas globais (desde o início)
  totalSessions: number;
  totalVolumeKg: number;
  totalPRs: number;
  totalDistanceM: number; // soma de corridas
  totalDurationSec: number;
  // Métricas da última semana (7 dias rolantes)
  weekSessions: number;
  weekVolumeKg: number;
  weekDistanceM: number;
  // Métricas do último mês (30 dias)
  monthSessions: number;
  // Por categoria (totalSessions por tipo de treino)
  byCategory: Partial<Record<WorkoutCategory, number>>;
  // Streak atual
  currentStreak: number;
  // Meta
  lastActivityAt: number;
  updatedAt: number;
}

/** Treino compartilhado — pode ser público pra qualquer um ou direcionado a um usuário. */
export interface SharedWorkout {
  id: string;
  sourceWorkoutId: string;
  ownerUid: string;
  ownerName: string;
  ownerAvatar?: string;
  name: string;
  category: WorkoutCategory;
  exercises: WorkoutExercise[];
  crossfit?: CrossfitConfig;
  description?: string;
  // Visibilidade:
  // - public: aparece pra todos na /comunidade
  // - targeted: só aparece pro usuário com uid = targetUid (envio direto)
  visibility: 'public' | 'targeted';
  targetUid?: string;   // obrigatório se visibility=targeted
  targetName?: string;  // pra exibir no remetente sem nova query
  clonedCount: number;
  likes: number;
  publishedAt: number;
  updatedAt: number;
}
