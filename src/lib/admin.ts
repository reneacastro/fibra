import { doc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

/**
 * Admin é definido pela existência de um doc em /admins/{uid} no Firestore.
 * Pra promover alguém a admin, cria o doc manualmente via Firebase Console.
 * Primeiro admin: faça isso pra seu próprio UID.
 */
export async function checkIsAdmin(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db(), 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}
