/**
 * Push Notifications — gerencia subscribe/unsubscribe e estado da
 * permissao do user. Salva subscription no Firestore pra um trigger
 * (Cloud Function ou similar) poder mandar push depois.
 *
 * Comportamento por plataforma:
 * - Android Chrome/Firefox/Edge: funciona em qualquer caso
 * - iOS Safari 16.4+: SO funciona se PWA instalada na tela inicial
 *   (display-mode: standalone). Senao retorna 'unsupported'.
 * - Desktop: funciona em todos os browsers principais
 *
 * Stack:
 * - Web Push Protocol (RFC 8030) via Service Worker
 * - VAPID keys (PUBLIC_VAPID_PUBLIC_KEY definida em env)
 * - Subscription persistida em /users/{uid}/pushSubscriptions/{deviceId}
 *
 * NOTA: o trigger (quem ENVIA o push) eh server-side. Fica pra outra
 * camada — Cloud Function listening em chats/sessions, ou cron job.
 */

import { db } from '$lib/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { authStore } from './auth.svelte';
import { browser } from '$app/environment';

export type PushState = 'idle' | 'unsupported' | 'denied' | 'granted' | 'subscribing';

const VAPID_PUBLIC_KEY = (import.meta as unknown as { env: Record<string, string> }).env
  .PUBLIC_VAPID_PUBLIC_KEY ?? '';

class PushStore {
  state = $state<PushState>('idle');
  permission = $state<NotificationPermission | 'unsupported'>('default');

  /** Verifica suporte e estado atual da permissao. */
  async ensure(): Promise<void> {
    if (!browser) return;
    // iOS pre-16.4 ou contexto nao-PWA em iOS: nao suporta web push fora da home
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      this.state = 'unsupported';
      this.permission = 'unsupported';
      return;
    }
    this.permission = Notification.permission;
    if (this.permission === 'denied') {
      this.state = 'denied';
      return;
    }
    if (this.permission === 'granted') {
      this.state = 'granted';
      return;
    }
    this.state = 'idle';
  }

  /** Pede permissao ao user e cria subscription. */
  async subscribe(): Promise<boolean> {
    if (!browser) return false;
    if (!('Notification' in window) || !VAPID_PUBLIC_KEY) {
      this.state = 'unsupported';
      return false;
    }
    if (!authStore.uid) return false;
    this.state = 'subscribing';

    try {
      // Pede permissao (mostra dialog do browser)
      const result = await Notification.requestPermission();
      this.permission = result;
      if (result !== 'granted') {
        this.state = result === 'denied' ? 'denied' : 'idle';
        return false;
      }

      // Registra service worker (SvelteKit ja registra via $service-worker)
      const reg = await navigator.serviceWorker.ready;

      // Cria subscription. Cast pra BufferSource pra contornar variancias
      // de tipo entre versoes do TS lib.dom (ArrayBufferLike vs ArrayBuffer)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });

      // Salva no Firestore
      const deviceId = await this.getOrCreateDeviceId();
      const data = sub.toJSON();
      await setDoc(
        doc(db(), `users/${authStore.uid}/pushSubscriptions/${deviceId}`),
        {
          endpoint: data.endpoint,
          keys: data.keys,
          userAgent: navigator.userAgent.slice(0, 200),
          createdAt: Date.now()
        }
      );

      this.state = 'granted';
      return true;
    } catch (e) {
      console.error('Push subscribe falhou:', e);
      this.state = 'idle';
      return false;
    }
  }

  /** Remove subscription do Firestore + revoga local. */
  async unsubscribe(): Promise<void> {
    if (!browser || !authStore.uid) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const deviceId = await this.getOrCreateDeviceId();
      await deleteDoc(doc(db(), `users/${authStore.uid}/pushSubscriptions/${deviceId}`));
      this.state = 'idle';
    } catch (e) {
      console.warn('Unsubscribe push falhou:', e);
    }
  }

  /** ID local do device. localStorage. */
  private async getOrCreateDeviceId(): Promise<string> {
    const KEY = 'fibra_push_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'd_' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(KEY, id);
    }
    return id;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const pushStore = new PushStore();
