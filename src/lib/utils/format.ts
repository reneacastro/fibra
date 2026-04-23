export const CATEGORY_LABEL: Record<string, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  fullbody: 'Full Body',
  livre: 'Livre',
  alongamento: 'Alongamento',
  funcional: 'Funcional',
  crossfit: 'CrossFit',
  hiit: 'HIIT',
  cardio: 'Cardio',
  core: 'Core/Abs',
  mobilidade: 'Mobilidade',
  calistenia: 'Calistenia',
  forca: 'Força',
  pump: 'Pump'
};

export const GOAL_LABEL: Record<string, string> = {
  emagrecer: 'Emagrecimento',
  massa: 'Ganho de Massa',
  qualidade: 'Qualidade de Vida',
  performance: 'Performance',
  lesao: 'Recuperação'
};

export const CATEGORY_ICON: Record<string, string> = {
  superior: '💪',
  inferior: '🦵',
  fullbody: '🔥',
  livre: '🏃',
  alongamento: '🧘',
  funcional: '🤸',
  crossfit: '⚡',
  hiit: '💥',
  cardio: '🏃‍♂️',
  core: '🫁',
  mobilidade: '🌊',
  calistenia: '🧗',
  forca: '🏋️',
  pump: '🍑'
};

export const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAYS_PT_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Timezone padrão — Brasília. Usamos explicitamente pra garantir que
 *  o "hoje" e horários do app batem com o relógio do usuário no Brasil,
 *  mesmo se o dispositivo estiver em outro fuso (ex: viagem). */
export const APP_TZ = 'America/Sao_Paulo';

/** ISO "YYYY-MM-DD" no timezone de Brasília (não em UTC como toISOString). */
export function todayISO() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return fmt.format(new Date()); // en-CA produz YYYY-MM-DD
}

export function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtDateRelative(iso: string) {
  const todayStr = todayISO();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const diff = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff < 7) return `há ${diff} dias`;
  if (diff < 30) return `há ${Math.floor(diff / 7)} sem`;
  if (diff < 365) return `há ${Math.floor(diff / 30)} meses`;
  return `há ${Math.floor(diff / 365)} anos`;
}

export function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${String(m % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtKg(n: number | null | undefined) {
  if (n == null) return '—';
  return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace('.', ',');
}

export function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function estimate1RM(weight: number, reps: number) {
  // Fórmula de Epley
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function estimateCalories(mets: number, weightKg: number, minutes: number) {
  // MET × kg × horas
  return Math.round((mets * weightKg * minutes) / 60);
}
