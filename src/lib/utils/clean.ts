/**
 * Remove recursivamente chaves com valor undefined de objetos/arrays.
 * Firestore rejeita undefined — use antes de setDoc/addDoc.
 */
export function cleanUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map((v) => cleanUndefined(v)) as T;
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      result[k] = v && typeof v === 'object' ? cleanUndefined(v) : v;
    }
    return result as T;
  }
  return obj;
}
