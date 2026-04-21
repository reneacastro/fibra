import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, limit as fsLimit, where
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { DietPlan, Food, MealLog, LoggedMeal, LoggedFoodItem } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

// ─── Planos ──────────────────────────────────────────────
const plansCol = (uid: string) => collection(db(), 'users', uid, 'dietPlans');

export async function listDietPlans(uid: string): Promise<DietPlan[]> {
  const snap = await getDocs(plansCol(uid));
  return snap.docs.map((d) => d.data() as DietPlan);
}

export async function getActiveDietPlan(uid: string): Promise<DietPlan | null> {
  const snap = await getDocs(query(plansCol(uid), where('active', '==', true), fsLimit(1)));
  return snap.empty ? null : (snap.docs[0].data() as DietPlan);
}

export async function saveDietPlan(uid: string, plan: DietPlan) {
  // Se o plano está ativo, desativa os outros
  if (plan.active) {
    const current = await getDocs(query(plansCol(uid), where('active', '==', true)));
    for (const d of current.docs) {
      if (d.id !== plan.id) {
        await setDoc(d.ref, { ...(d.data() as DietPlan), active: false });
      }
    }
  }
  await setDoc(doc(plansCol(uid), plan.id), cleanUndefined(plan));
}

export async function deleteDietPlan(uid: string, id: string) {
  await deleteDoc(doc(plansCol(uid), id));
}

export function newPlanId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Foods custom do usuário ────────────────────────────
const foodsCol = (uid: string) => collection(db(), 'users', uid, 'foods');

export async function listUserFoods(uid: string, max = 200): Promise<Food[]> {
  const snap = await getDocs(query(foodsCol(uid), fsLimit(max)));
  return snap.docs.map((d) => d.data() as Food);
}

export async function saveFood(uid: string, food: Food) {
  await setDoc(doc(foodsCol(uid), food.id), cleanUndefined(food));
}

export async function deleteFood(uid: string, id: string) {
  await deleteDoc(doc(foodsCol(uid), id));
}

export function newFoodId() {
  return 'f_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Log diário ─────────────────────────────────────────
const mealsCol = (uid: string) => collection(db(), 'users', uid, 'meals');

export async function getMealLog(uid: string, date: string): Promise<MealLog | null> {
  const snap = await getDoc(doc(mealsCol(uid), date));
  return snap.exists() ? (snap.data() as MealLog) : null;
}

export async function saveMealLog(uid: string, log: MealLog) {
  await setDoc(doc(mealsCol(uid), log.date), cleanUndefined({ ...log, updatedAt: Date.now() }));
}

export async function listRecentMealLogs(uid: string, max = 14): Promise<MealLog[]> {
  const q = query(mealsCol(uid), orderBy('date', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as MealLog);
}

export function newLoggedMealId() {
  return 'lm_' + Math.random().toString(36).slice(2, 8);
}
export function newLoggedItemId() {
  return 'li_' + Math.random().toString(36).slice(2, 8);
}

export function computeMealLogTotals(meals: LoggedMeal[]) {
  const totals = { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 };
  for (const meal of meals) {
    for (const item of meal.items) {
      totals.kcal += item.kcal;
      totals.proteinG += item.proteinG;
      totals.carbG += item.carbG;
      totals.fatG += item.fatG;
    }
  }
  return {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.proteinG * 10) / 10,
    carbG: Math.round(totals.carbG * 10) / 10,
    fatG: Math.round(totals.fatG * 10) / 10
  };
}

export function computeItemMacros(food: Food, grams: number): Omit<LoggedFoodItem, 'id' | 'foodId' | 'foodName' | 'grams'> {
  const f = grams / 100;
  return {
    kcal: Math.round(food.kcalPer100g * f),
    proteinG: Math.round(food.proteinPer100g * f * 10) / 10,
    carbG: Math.round(food.carbPer100g * f * 10) / 10,
    fatG: Math.round(food.fatPer100g * f * 10) / 10
  };
}
