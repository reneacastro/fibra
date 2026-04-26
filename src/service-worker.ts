/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Service Worker do FIBRA — instalavel como PWA + handler de push.
 *
 * Responsabilidades:
 * 1. Cache estatico de assets (build artifacts) pra app funcionar offline
 * 2. Receber push do servidor e mostrar notificacao
 * 3. Click em notificacao -> abre/foca a aba do app na rota desejada
 *
 * IMPORTANTE: o trigger (quem ENVIA o push) eh server-side. Esse SW so
 * processa quando recebe. Pra enviar, configure Cloud Function ou
 * outro endpoint que use a subscription salva em pushSubscriptions.
 */

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE = `fibra-cache-${version}`;
const ASSETS = [...build, ...files];

// Install: precacheia assets do build
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: estrategia network-first com fallback ao cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip externals (Firestore, Mapbox, etc)
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(event.request);
        // Atualiza cache em background
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        // Offline ou falha de rede: tenta cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Fallback: index.html (SPA mode)
        if (event.request.mode === 'navigate') {
          const indexHtml = await caches.match('/');
          if (indexHtml) return indexHtml;
        }
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});

// PUSH: recebe payload do servidor e mostra notificacao
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
    actions?: Array<{ action: string; title: string }>;
  };

  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'FIBRA', body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192-v3.png',
    badge: payload.badge || '/icon-192-v3.png',
    tag: payload.tag, // tag igual sobrescreve notif anterior
    data: { url: payload.url || '/' }
    // actions e vibrate sao optional e nao tipados em Notification
  };
  // Adiciona actions se houver (cast via any pra evitar TS complain em browsers antigos)
  if (payload.actions) (options as { actions?: unknown }).actions = payload.actions;

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// CLICK em notificacao: abre/foca a aba do app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string })?.url || '/';

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      // Se ja tem aba aberta, foca e navega
      for (const client of list) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await (client as WindowClient).navigate(targetUrl);
            } catch {
              // navigate so funciona em same-origin com client controlado
            }
          }
          return;
        }
      }
      // Senao, abre nova
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
