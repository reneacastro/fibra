import type { Exercise } from '$lib/types';

export function isDurationBased(ex: Exercise): boolean {
  const cat = Array.isArray(ex.category) ? ex.category : [ex.category];
  if (cat.includes('alongamento')) return true;
  if (ex.tags?.includes('isometrica')) return true;
  return false;
}

export function isCardio(ex: Exercise): boolean {
  const mg = Array.isArray(ex.muscleGroup) ? ex.muscleGroup : [ex.muscleGroup];
  return mg.includes('cardio');
}

export function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Pace em segundos/km → "5:30" */
export function fmtPace(secPerKm: number | undefined): string {
  if (!secPerKm || secPerKm <= 0) return '';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "5:30" → 330 seg/km. Aceita "5" (assume minutos), "5:30", "330" (seg direto). */
export function parsePace(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;
  if (s.includes(':')) {
    const [m, sec] = s.split(':').map((x) => Number(x.trim()));
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return undefined;
    return m * 60 + sec;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  // Assume minutos se <= 20 (ninguém corre mais devagar que 20min/km)
  return n <= 20 ? Math.round(n * 60) : Math.round(n);
}
