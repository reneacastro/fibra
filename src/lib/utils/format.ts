export const CATEGORY_LABEL: Record<string, string> = {
  superior: 'Superior',
  inferior: 'Inferior',
  fullbody: 'Full Body',
  livre: 'Livre',
  alongamento: 'Alongamento',
  funcional: 'Funcional',
  crossfit: 'CrossFit',
  hiit: 'HIIT'
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
  hiit: '💥'
};

export const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAYS_PT_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtDateRelative(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
