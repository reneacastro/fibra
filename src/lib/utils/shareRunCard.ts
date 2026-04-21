/**
 * Share card dedicado pra corrida com GPS: mapa real do percurso + stats.
 * Imagem 1080×1920 stories. Usa Mapbox Static pro mapa.
 */

import { buildStaticMapUrl } from './mapbox';
import { fmtPace } from './exercise';

const W = 1080;
const H = 1920;
const MAP_H = 1080; // quadrado, topo
const TEXT = '#f8fafc';
const MUTE = '#94a3b8';
const ACCENT = '#22d3ee';

export interface RunCardData {
  distanceM: number;
  paceSecPerKm: number;
  durationSec: number;
  calories?: number;
  date: string; // YYYY-MM-DD
  userName: string;
  track: { lat: number; lng: number }[];
  style?: 'outdoors' | 'satellite' | 'dark';
}

export async function renderRunCard(data: RunCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fundo geral
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0b1220');
  bgGrad.addColorStop(1, '#050810');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Mapa do percurso
  const mapStyle =
    data.style === 'satellite' ? 'mapbox/satellite-streets-v12' :
    data.style === 'dark' ? 'mapbox/dark-v11' :
    'mapbox/outdoors-v12';

  const mapUrl = buildStaticMapUrl({
    track: data.track,
    width: Math.floor(W / 2),
    height: Math.floor(MAP_H / 2),
    style: mapStyle,
    strokeColor: '22d3ee',
    strokeWidth: 6
  });

  if (mapUrl) {
    try {
      const img = await loadImage(mapUrl);
      ctx.drawImage(img, 0, 0, W, MAP_H);
      // Fade suave pro preto na parte de baixo do mapa
      const fade = ctx.createLinearGradient(0, MAP_H - 200, 0, MAP_H + 40);
      fade.addColorStop(0, 'rgba(5, 8, 16, 0)');
      fade.addColorStop(1, 'rgba(5, 8, 16, 1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, MAP_H - 200, W, 240);
    } catch {
      drawMapFallback(ctx);
    }
  } else {
    drawMapFallback(ctx);
  }

  // Selo FIBRA top-left
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, 36, 36, 170, 56, 28);
  ctx.fill();
  ctx.font = '800 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.textBaseline = 'middle';
  ctx.fillText('✦ FIBRA', 64, 64);

  // Data top-right
  ctx.font = '600 26px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(formatDate(data.date), W - 48, 64);
  ctx.textAlign = 'left';

  // STATS area (abaixo do mapa)
  const statsY = MAP_H + 80;

  // Big distance
  const km = (data.distanceM / 1000).toFixed(2);
  ctx.textAlign = 'center';
  ctx.font = '800 220px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText(km, W / 2, statsY + 170);

  ctx.font = '700 48px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText('KM', W / 2, statsY + 240);

  // Linha de stats secundários
  const rowY = statsY + 430;
  const cellW = W / 3;
  drawStat(ctx, cellW / 2, rowY, 'PACE', data.paceSecPerKm > 0 ? fmtPace(data.paceSecPerKm) : '—', '/km');
  drawStat(ctx, cellW * 1.5, rowY, 'TEMPO', fmtDuration(data.durationSec), '');
  drawStat(
    ctx, cellW * 2.5, rowY, 'KCAL',
    data.calories !== undefined ? String(data.calories) : '—',
    ''
  );

  // Nome do atleta (rodapé)
  ctx.font = '600 36px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = MUTE;
  ctx.textAlign = 'center';
  ctx.fillText(data.userName, W / 2, H - 120);

  ctx.font = '700 44px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText('CORRIDA', W / 2, H - 70);

  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png', 0.95);
  });
}

function drawStat(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, unit: string) {
  ctx.textAlign = 'center';
  ctx.font = '700 32px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = MUTE;
  ctx.fillText(label, x, y);

  ctx.font = '800 80px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  if (unit) {
    const valueW = ctx.measureText(value).width;
    ctx.fillText(value, x, y + 82);
    ctx.font = '600 34px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = MUTE;
    ctx.fillText(unit, x + valueW / 2 + 40, y + 74);
  } else {
    ctx.fillText(value, x, y + 82);
  }
}

function drawMapFallback(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, W, MAP_H);
  ctx.font = '600 44px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = MUTE;
  ctx.textAlign = 'center';
  ctx.fillText('Mapa indisponível', W / 2, MAP_H / 2);
  ctx.textAlign = 'left';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
