import {
  collection, doc, addDoc, query, orderBy, limit as fsLimit, onSnapshot, type Unsubscribe
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { ChatMessage } from '$lib/types';
import { cleanUndefined } from '$lib/utils/clean';

const msgCol = (relId: string) => collection(db(), 'relationships', relId, 'messages');

export async function sendMessage(relId: string, msg: Omit<ChatMessage, 'id'>): Promise<void> {
  await addDoc(msgCol(relId), cleanUndefined(msg));
}

/** Ouve mensagens em tempo real. Retorna função pra dar unsubscribe. */
export function subscribeMessages(
  relId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(msgCol(relId), orderBy('createdAt', 'asc'), fsLimit(500));
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
      onMessages(msgs);
    },
    (err) => onError?.(err)
  );
}
