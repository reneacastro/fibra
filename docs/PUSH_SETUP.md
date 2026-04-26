# Push Notifications — Setup

App tem toda a infra cliente pronta (SW, store, UI, subscription
registry no Firestore). Falta só configurar VAPID + servidor que
envia.

## 1. Gerar VAPID keys

```bash
npx web-push generate-vapid-keys
```

Vai imprimir duas strings em base64:
- **Public Key** → vai pro `.env` como `PUBLIC_VAPID_PUBLIC_KEY`
- **Private Key** → guarda secreta no servidor que dispara push

## 2. Adicionar ao .env

```env
PUBLIC_VAPID_PUBLIC_KEY=BPx...
```

Depois rebuilda + deploy. O toggle em `/perfil` vai funcionar.

## 3. Como o cliente registra

Quando user toca "Receber lembretes":

1. Browser pede permissão (`Notification.requestPermission()`)
2. Service Worker recebe subscription do push provider do browser
3. App salva subscription em:
   ```
   /users/{uid}/pushSubscriptions/{deviceId}
     - endpoint: string  (URL do push provider)
     - keys: { p256dh, auth }  (criptografia)
     - userAgent: string
     - createdAt: number
   ```

## 4. Servidor disparando push

Você precisa de algum servidor que use a **private VAPID key** pra
assinar e enviar pra cada subscription salva no Firestore.

### Opção A: Cloud Function (recomendada — exige plano Blaze)

```js
// functions/sendPush.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
webpush.setVapidDetails(
  'mailto:contato@fibra.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Trigger: nova mensagem no chat → push pro destinatário
exports.onChatMessage = functions.firestore
  .document('chat/{relId}/messages/{mid}')
  .onCreate(async (snap) => {
    const msg = snap.data();
    const recipientUid = msg.toUid;

    const subs = await admin.firestore()
      .collection(`users/${recipientUid}/pushSubscriptions`)
      .get();

    const payload = JSON.stringify({
      title: msg.fromName || 'FIBRA',
      body: msg.text.slice(0, 100),
      tag: `chat-${msg.fromUid}`,
      url: `/chat/${msg.relId}`
    });

    for (const doc of subs.docs) {
      try {
        await webpush.sendNotification({
          endpoint: doc.data().endpoint,
          keys: doc.data().keys
        }, payload);
      } catch (e) {
        if (e.statusCode === 410) {
          // Subscription expirada, remove
          await doc.ref.delete();
        }
      }
    }
  });

// Cron diário: lembrete de treino agendado
exports.dailyReminder = functions.pubsub
  .schedule('0 18 * * *') // todo dia 18h
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    // 1. Pega todos os users com schedule + publicProfile
    // 2. Pra cada, verifica se hoje tem treino agendado e ainda não foi feito
    // 3. Manda push
  });
```

Deploy:
```bash
firebase deploy --only functions
```

### Opção B: Servidor próprio (Cloudflare Workers, Deno Deploy, etc)

Mesmo princípio. Lê subscriptions do Firestore (via Admin SDK),
envia via `web-push`. Roda em cron ou trigger.

### Opção C: Sem servidor, só client-side (limitação)

Sem servidor, push do sistema só é possível via **navegação local**
(notificação local do app). Já está implementado em `pushStore` —
nada chega de fora. Bom pra rest timer terminar com app em background.

## 5. Casos de uso pré-mapeados pra implementar

| Trigger | Tipo | Quem dispara |
|---|---|---|
| Mensagem nova no chat | Push sistema | Cloud Function `onChatMessage` |
| Convite de trainer | Push sistema | Cloud Function `onRelationshipCreate` |
| Streak em risco (18h sem treino) | Push sistema | Cron 18h diário |
| Lembrete agenda do dia | Push sistema | Cron 7h diário |
| Rest timer terminou | Local notification | Client (já feito) |
| PR ganho | Toast in-app | Client (já feito) |

## 6. Limitações conhecidas

- **iOS Safari < 16.4**: zero push, nem instalando como PWA
- **iOS Safari ≥ 16.4 sem instalar**: zero push
- **iOS Safari instalado como PWA**: funciona mas pode silenciar som
- **Android**: funciona em qualquer navegador moderno
- **Permissão negada**: user precisa habilitar manualmente nas
  configurações do navegador (não dá pra perguntar de novo)
