import type { Goal, MacroTargets } from '$lib/types';

export const ACTIVITY_FACTOR: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1.2,    // sedentário
  2: 1.375,  // leve (1-2x/sem)
  3: 1.55,   // moderado (3-4x/sem)
  4: 1.725,  // alto (5-6x/sem)
  5: 1.9     // atleta / diário
};

export interface MacroSuggestionInput {
  tmb: number;
  activityLevel: 1 | 2 | 3 | 4 | 5;
  weightKg: number;
  goals: Goal[];
}

/**
 * Sugere targets diárias a partir do TMB + atividade + objetivos.
 * Regras simples e conservadoras (não substitui nutricionista).
 */
export function suggestMacros(input: MacroSuggestionInput): MacroTargets {
  const { tmb, activityLevel, weightKg, goals } = input;
  const tdee = Math.round(tmb * ACTIVITY_FACTOR[activityLevel]);

  // Ajuste calórico pelo objetivo primário
  let kcal = tdee;
  if (goals.includes('emagrecer')) kcal = Math.round(tdee * 0.82);   // déficit ~18%
  else if (goals.includes('massa')) kcal = Math.round(tdee * 1.12);  // superávit ~12%
  // performance e qualidade ficam em manutenção

  // Proteína: 1.8 g/kg base; 2.2 g/kg se ganho de massa; 2.4 g/kg se cutting
  let proteinPerKg = 1.8;
  if (goals.includes('massa')) proteinPerKg = 2.2;
  if (goals.includes('emagrecer')) proteinPerKg = 2.4;
  const proteinG = Math.round(weightKg * proteinPerKg);

  // Gordura: 25% do total (mínimo 0.8 g/kg)
  const fatKcalTarget = Math.round(kcal * 0.25);
  const fatG = Math.max(Math.round(weightKg * 0.8), Math.round(fatKcalTarget / 9));

  // Carboidrato: resto das calorias
  const usedKcal = proteinG * 4 + fatG * 9;
  const carbG = Math.max(50, Math.round((kcal - usedKcal) / 4));

  return {
    kcal,
    proteinG,
    carbG,
    fatG,
    fiberG: 25,
    waterMl: Math.round(weightKg * 35)
  };
}

export function macroCaloriesFromGrams(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}

/** Retorna {proteinPct, carbPct, fatPct} pras barras */
export function macroDistribution(t: MacroTargets) {
  const total = t.proteinG * 4 + t.carbG * 4 + t.fatG * 9;
  if (!total) return { proteinPct: 0, carbPct: 0, fatPct: 0 };
  return {
    proteinPct: Math.round((t.proteinG * 4 / total) * 100),
    carbPct: Math.round((t.carbG * 4 / total) * 100),
    fatPct: Math.round((t.fatG * 9 / total) * 100)
  };
}

export function adherence(current: number, target: number): number {
  if (!target) return 0;
  // Penaliza tanto embaixo quanto estourar (>110% vira negativo)
  const ratio = current / target;
  if (ratio <= 1) return Math.round(ratio * 100);
  return Math.round(Math.max(0, 100 - (ratio - 1) * 100));
}
