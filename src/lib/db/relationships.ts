import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Relationship } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const col = () => collection(db(), 'relationships');

export function relationshipId(trainerUid: string, clientUid: string): string {
  return `${trainerUid}_${clientUid}`;
}

export async function getRelationship(trainerUid: string, clientUid: string): Promise<Relationship | null> {
  const snap = await getDoc(doc(col(), relationshipId(trainerUid, clientUid)));
  return snap.exists() ? (snap.data() as Relationship) : null;
}

export async function inviteClient(rel: Omit<Relationship, 'id' | 'createdAt' | 'status' | 'acceptedAt' | 'endedAt'>): Promise<void> {
  const id = relationshipId(rel.trainerUid, rel.clientUid);
  // Não recriar se já existe ativo
  const existing = await getDoc(doc(col(), id));
  if (existing.exists()) {
    const data = existing.data() as Relationship;
    if (data.status === 'active') throw new Error('Cliente já vinculado.');
    if (data.status === 'pending') throw new Error('Convite já enviado, aguardando resposta.');
  }
  await setDoc(doc(col(), id), cleanUndefined({
    ...rel,
    id,
    status: 'pending' as const,
    createdAt: Date.now()
  }));
}

export async function acceptInvite(trainerUid: string, clientUid: string): Promise<void> {
  const id = relationshipId(trainerUid, clientUid);
  const snap = await getDoc(doc(col(), id));
  if (!snap.exists()) throw new Error('Convite não encontrado.');
  const data = snap.data() as Relationship;
  await setDoc(doc(col(), id), cleanUndefined({
    ...data,
    status: 'active',
    acceptedAt: Date.now()
  }));
}

export async function endRelationship(trainerUid: string, clientUid: string): Promise<void> {
  const id = relationshipId(trainerUid, clientUid);
  const snap = await getDoc(doc(col(), id));
  if (!snap.exists()) return;
  const data = snap.data() as Relationship;
  await setDoc(doc(col(), id), cleanUndefined({
    ...data,
    status: 'ended',
    endedAt: Date.now()
  }));
}

export async function deleteInvite(trainerUid: string, clientUid: string): Promise<void> {
  await deleteDoc(doc(col(), relationshipId(trainerUid, clientUid)));
}

/** Lista relacionamentos onde eu sou trainer. */
export async function listMyClients(trainerUid: string): Promise<Relationship[]> {
  const q = query(
    col(),
    where('trainerUid', '==', trainerUid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Relationship);
}

/** Convites pendentes pro cliente (onde cliente sou eu). */
export async function listPendingForMe(clientUid: string): Promise<Relationship[]> {
  const q = query(
    col(),
    where('clientUid', '==', clientUid),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Relationship);
}

/** Lista trainers/nutris ativos do cliente. */
export async function listMyTrainers(clientUid: string): Promise<Relationship[]> {
  const q = query(
    col(),
    where('clientUid', '==', clientUid),
    where('status', '==', 'active')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Relationship);
}
