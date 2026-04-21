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
