import { doc, getDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

/** UID do fundador — sempre admin, hardcoded nas rules também. */
const FOUNDER_UID = '6Yqqavyj8odRlNvpiEoUehOspyI2';

/**
 * Admin é o fundador OU um usuário com doc em /admins/{uid}.
 * Admins podem promover outros criando docs em /admins via rule
 * (rule permite write se o criador já for admin — via isAdmin()).
 */
export async function checkIsAdmin(uid: string | null | undefined): Promise<boolean> {
  if (!uid) return false;
  if (uid === FOUNDER_UID) return true;
  try {
    const snap = await getDoc(doc(db(), 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}
