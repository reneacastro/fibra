import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, addDoc,
  query, where, orderBy, limit as fsLimit, onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Group, GroupPost } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const groupsCol = () => collection(db(), 'groups');
const postsCol = (groupId: string) => collection(db(), 'groups', groupId, 'posts');

export function newGroupId() {
  return 'g_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function createGroup(group: Group): Promise<void> {
  await setDoc(doc(groupsCol(), group.id), cleanUndefined(group));
}

export async function updateGroup(group: Group): Promise<void> {
  await setDoc(doc(groupsCol(), group.id), cleanUndefined({ ...group, updatedAt: Date.now() }));
}

export async function deleteGroup(id: string): Promise<void> {
  await deleteDoc(doc(groupsCol(), id));
}

export async function getGroup(id: string): Promise<Group | null> {
  const snap = await getDoc(doc(groupsCol(), id));
  return snap.exists() ? (snap.data() as Group) : null;
}

/** Lista grupos dos quais sou membro. */
export async function listMyGroups(myUid: string): Promise<Group[]> {
  const q = query(
    groupsCol(),
    where('memberUids', 'array-contains', myUid),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Group);
}

/** Lista grupos públicos pra descobrir. */
export async function listPublicGroups(max = 30): Promise<Group[]> {
  const q = query(groupsCol(), where('isPublic', '==', true), orderBy('updatedAt', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Group);
}

/** Adicionar um membro (só owner via rule). */
export async function addMember(group: Group, uid: string): Promise<void> {
  if (group.memberUids.includes(uid)) return;
  await updateGroup({ ...group, memberUids: [...group.memberUids, uid] });
}

/** Cliente remove a si mesmo. */
export async function leaveGroup(group: Group, myUid: string): Promise<void> {
  const next = group.memberUids.filter((u) => u !== myUid);
  await updateGroup({ ...group, memberUids: next });
}

/** Mural: posts ordenados desc, real-time. */
export function subscribePosts(
  groupId: string,
  onPosts: (posts: GroupPost[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(postsCol(groupId), orderBy('createdAt', 'desc'), fsLimit(200));
  return onSnapshot(
    q,
    (snap) => onPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupPost))),
    (e) => onError?.(e)
  );
}

export async function createPost(groupId: string, post: Omit<GroupPost, 'id'>): Promise<void> {
  await addDoc(postsCol(groupId), cleanUndefined(post));
}

export async function deletePost(groupId: string, postId: string): Promise<void> {
  await deleteDoc(doc(postsCol(groupId), postId));
}
