/**
 * FIBRA — Webhook do Apple Watch
 *
 * Endpoint chamado pelo Atalho do iOS ao finalizar um treino no Watch.
 * Recebe métricas (FC, calorias, duração, distância) e escreve em
 *   users/{uid}/watchData/{date}
 * + tenta anexar à sessão mais recente do dia (users/{uid}/sessions/{id}).
 *
 * Autenticação: token pessoal do usuário (gerado na tela /config-watch),
 * salvo em users/{uid}/settings.watchToken. O Atalho envia no header.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export const watchWebhook = onRequest(
  { cors: true, maxInstances: 5 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }

    const token = (req.headers['x-fibra-token'] ?? req.query.token ?? '') + '';
    if (!token) {
      res.status(401).json({ error: 'missing token' });
      return;
    }

    // Busca usuário pelo token
    const usersSnap = await db
      .collection('users')
      .where('settings.watchToken', '==', token)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      res.status(403).json({ error: 'invalid token' });
      return;
    }

    const uid = usersSnap.docs[0].id;
    const body = req.body || {};
    const date = (body.date || new Date().toISOString().slice(0, 10)) + '';

    // Payload esperado do Atalho:
    // { date, heartRateAvg, heartRateMax, activeCalories, totalCalories,
    //   exerciseMinutes, distance }
    const metrics = {
      heartRateAvg: num(body.heartRateAvg),
      heartRateMax: num(body.heartRateMax),
      activeCalories: num(body.activeCalories),
      totalCalories: num(body.totalCalories),
      exerciseMinutes: num(body.exerciseMinutes),
      distance: num(body.distance),
      source: 'shortcut',
      importedAt: Date.now()
    };
    Object.keys(metrics).forEach((k) => {
      if (metrics[k] === undefined) delete metrics[k];
    });

    // 1) Salva em watchData/{date}
    await db.doc(`users/${uid}/watchData/${date}`).set(metrics, { merge: true });

    // 2) Tenta anexar à sessão mais recente do mesmo dia
    const sessionsSnap = await db
      .collection(`users/${uid}/sessions`)
      .where('date', '==', date)
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (!sessionsSnap.empty) {
      await sessionsSnap.docs[0].ref.update({
        watchData: metrics,
        // se sessão não tem calorias, usa a do watch (mais precisa)
        ...(metrics.activeCalories && !sessionsSnap.docs[0].data().calories
          ? { calories: Math.round(metrics.activeCalories) }
          : {})
      });
    }

    res.json({ ok: true, uid, date, attached: !sessionsSnap.empty });
  }
);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
