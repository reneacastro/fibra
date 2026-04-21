import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { RoleRequest, UserProfile } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = () => collection(db(), 'roleRequests');

export async function getMyRoleRequest(uid: string): Promise<RoleRequest | null> {
  const snap = await getDoc(doc(col(), uid));
  return snap.exists() ? (snap.data() as RoleRequest) : null;
}

export async function submitRoleRequest(req: RoleRequest): Promise<void> {
  await setDoc(doc(col(), req.uid), cleanUndefined(req));
}

export async function cancelRoleRequest(uid: string): Promise<void> {
  await deleteDoc(doc(col(), uid));
}

/** Admin only — lista todas as solicitações pendentes. */
export async function listAllRoleRequests(): Promise<RoleRequest[]> {
  const q = query(col(), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RoleRequest);
}

/**
 * Aprova: admin escreve no perfil do usuário + deleta o request.
 * Requer que o admin tenha permissão de write em /users/{uid}.
 */
export async function approveRoleRequest(req: RoleRequest, adminUid: string, profile: UserProfile): Promise<void> {
  const { doc: userDoc, setDoc: setUser } = await import('firebase/firestore');
  const userRef = userDoc(db(), 'users', req.uid);
  await setUser(userRef, cleanUndefined({
    ...profile,
    settings: {
      ...profile.settings,
      role: req.requestedRole,
      rolePending: undefined,
      roleApprovedAt: Date.now(),
      roleApprovedBy: adminUid
    },
    updatedAt: Date.now()
  }));
  await deleteDoc(doc(col(), req.uid));
}

export async function rejectRoleRequest(uid: string): Promise<void> {
  await deleteDoc(doc(col(), uid));
}
