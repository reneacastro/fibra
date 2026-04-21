/**
 * Gerador de share cards 1080×1920 (stories).
 * Suporta foto de fundo, caption, tema e stickers posicionáveis.
 */

import type { Session } from '$lib/types';
import { CATEGORY_ICON, CATEGORY_LABEL, fmtDateShort, fmtDuration } from './format';

const W = 1080;
const H = 1920;

const TEXT = '#e6edf3';
const TEXT_MUTE = '#8b949e';
const TEXT_DIM = '#6e7681';

// ─── Temas de cor ────────────────────────────────────────
export const SHARE_THEMES = {
  fibra:  { primary: '#00e5ff', secondary: '#7c3aed', name: 'FIBRA' },
  fogo:   { primary: '#ff6a00', secondary: '#ee0979', name: 'Fogo' },
  floresta: { primary: '#11998e', secondary: '#38ef7d', name: 'Floresta' },
  sunset: { primary: '#f72585', secondary: '#7209b7', name: 'Sunset' },
  mono:   { primary: '#ffffff', secondary: '#8b949e', name: 'Mono' }
} as const;

export type ShareTheme = keyof typeof SHARE_THEMES;

// ─── Variantes de layout ────────────────────────────────
export type ShareLayout = 'stats' | 'photo' | 'minimal';

// ─── Templates ──────────────────────────────────────────
export type ShareTemplate = 'session' | 'pr' | 'streak' | 'week';

export interface Sticker {
  id: string;
  emoji: string;
  x: number; // 0-1 relative
  y: number; // 0-1 relative
  scale: number; // 0.3 - 2.0
  rotation: number; // radianos
  zoneIndex?: number; // 0-3, identifica zona segura ocupada
}

export interface SessionCardData {
  template: 'session';
  session: Session;
  userName: string;
  avatar?: string;
}
export interface PRCardData {
  template: 'pr';
  exerciseName: string;
  weight: number;
  reps: number;
  prevBest: { weight: number; reps: number } | null;
  userName: string;
  avatar?: string;
  date: string;
}
export interface StreakCardData {
  template: 'streak';
  streak: number;
  userName: string;
  avatar?: string;
}
export interface WeekCardData {
  template: 'week';
  totalSessions: number;
  totalVolume: number;
  totalCalories: number;
  totalPRs: number;
  byCategory: Record<string, number>;
  userName: string;
  avatar?: string;
}

export type ShareCardData = SessionCardData | PRCardData | StreakCardData | WeekCardData;

export interface CaptionStyle {
  x: number; // 0-1 relative center
  y: number; // 0-1 relative center
  scale: number; // 0.5-2
}

export interface ShareCustomization {
  theme: ShareTheme;
  layout: ShareLayout;
  caption?: string;
  captionStyle?: CaptionStyle;
  photoDataUrl?: string; // base64 data URL
  stickers: Sticker[];
}

export const DEFAULT_CUSTOMIZATION: ShareCustomization = {
  theme: 'fibra',
  layout: 'stats',
  stickers: [],
  captionStyle: { x: 0.5, y: 0.82, scale: 1 }
};

export const AVAILABLE_STICKERS = ['🔥', '💪', '🏆', '⚡', '✨', '🎯', '💯', '🚀', '💀', '👑'];

// ─── Render principal ───────────────────────────────────
type Ctx = CanvasRenderingContext2D;

export async function renderShareCard(
  data: ShareCardData,
  custom: ShareCustomization = DEFAULT_CUSTOMIZATION
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background: foto se tiver, gradient se não
  if (custom.photoDataUrl) {
    await drawPhotoBackground(ctx, custom.photoDataUrl, custom.layout);
  }
  drawThemeOverlay(ctx, custom.theme, !!custom.photoDataUrl);
  drawBrand(ctx, custom.theme);

  // Conteúdo baseado no template + layout
  switch (data.template) {
    case 'session':
      drawSessionCard(ctx, data, custom);
      break;
    case 'pr':
      drawPRCard(ctx, data, custom);
      break;
    case 'streak':
      drawStreakCard(ctx, data, custom);
      break;
    case 'week':
      drawWeekCard(ctx, data, custom);
      break;
  }

  // Caption (se tiver)
  if (custom.caption) drawCaption(ctx, custom.caption, custom.captionStyle);

  // Stickers (por cima de tudo)
  for (const s of custom.stickers) drawSticker(ctx, s);

  // Footer sempre por cima
  drawFooter(ctx, data);

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png', 0.95);
  });
}

// ─── Background ─────────────────────────────────────────
async function drawPhotoBackground(ctx: Ctx, dataUrl: string, layout: ShareLayout) {
  const img = await loadImage(dataUrl);
  // Cover fit
  const ir = img.width / img.height;
  const cr = W / H;
  let sw: number, sh: number, sx: number, sy: number;
  if (ir > cr) {
    sh = img.height;
    sw = sh * cr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / cr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

  // Escurecer pra legibilidade
  const darkness = layout === 'photo' ? 0.35 : layout === 'stats' ? 0.55 : 0.4;
  ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
  ctx.fillRect(0, 0, W, H);
}

function drawThemeOverlay(ctx: Ctx, themeKey: ShareTheme, hasPhoto: boolean) {
  const theme = SHARE_THEMES[themeKey];

  if (!hasPhoto) {
    // Fundo sólido escuro
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, W, H);
  }

  // Gradient no topo com cor primária
  const topGrad = ctx.createRadialGradient(W / 2, -100, 100, W / 2, -100, 1200);
  topGrad.addColorStop(0, hexA(theme.primary, hasPhoto ? 0.2 : 0.35));
  topGrad.addColorStop(1, hexA(theme.primary, 0));
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, H);

  // Gradient no rodapé com cor secundária
  const botGrad = ctx.createLinearGradient(0, H - 700, 0, H);
  botGrad.addColorStop(0, hexA(theme.secondary, 0));
  botGrad.addColorStop(1, hexA(theme.secondary, hasPhoto ? 0.4 : 0.25));
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawBrand(ctx: Ctx, themeKey: ShareTheme) {
  const theme = SHARE_THEMES[themeKey];
  ctx.save();
  ctx.translate(80, 90);
  const s = 64;
  // Gradient tricolor
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, theme.primary);
  g.addColorStop(0.6, theme.secondary);
  g.addColorStop(1, theme.primary);
  ctx.fillStyle = g;
  // Italic skew
  ctx.transform(1, 0, -0.14, 1, 8, 0);
  // Stem
  roundRect(ctx, 0, 0, s * 0.13, s * 0.75, 4); ctx.fill();
  // 3 fibras
  roundRect(ctx, 0, 0, s * 0.6, s * 0.13, 4); ctx.fill();
  ctx.globalAlpha = 0.9;
  roundRect(ctx, 0, s * 0.27, s * 0.45, s * 0.13, 4); ctx.fill();
  ctx.globalAlpha = 0.75;
  roundRect(ctx, 0, s * 0.54, s * 0.28, s * 0.13, 4); ctx.fill();
  ctx.restore();
  // Spark
  ctx.fillStyle = theme.primary;
  ctx.beginPath();
  ctx.arc(142, 100, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(142, 100, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  (ctx as any).letterSpacing = '8px';
  ctx.fillText('FIBRA', 170, 142);
}

// ─── Cards por template ─────────────────────────────────
function drawSessionCard(ctx: Ctx, d: SessionCardData, c: ShareCustomization) {
  const s = d.session;
  const totalSets = s.performedExercises.reduce(
    (a, pe) => a + pe.sets.filter((st) => st.completed).length, 0
  );
  const duration = s.finishedAt && s.startedAt ? s.finishedAt - s.startedAt : 0;

  const theme = SHARE_THEMES[c.theme];
  const isPhotoLayout = c.layout === 'photo';
  const yOffset = isPhotoLayout ? 240 : 0;

  // Categoria badge
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.primary;
  ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '4px';
  ctx.fillText(
    `${CATEGORY_ICON[s.workoutCategory]} ${CATEGORY_LABEL[s.workoutCategory].toUpperCase()}`,
    W / 2, 360 + yOffset
  );

  // Nome
  ctx.fillStyle = TEXT;
  ctx.font = `bold ${c.layout === 'minimal' ? 72 : 88}px "Plus Jakarta Sans", sans-serif`;
  (ctx as any).letterSpacing = '-2px';
  wrapText(ctx, s.workoutName, W / 2, 500 + yOffset, W - 160, 100);

  // Data + duração
  ctx.fillStyle = TEXT_MUTE;
  ctx.font = '32px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '0';
  ctx.fillText(`${fmtDateShort(s.date)} · ${fmtDuration(duration)}`, W / 2, 680 + yOffset);

  // Stats (só em 'stats' e 'minimal')
  if (c.layout !== 'photo') {
    const stats: [string, string][] = [
      [`${s.performedExercises.length}`, 'Exercícios'],
      [`${totalSets}`, 'Séries'],
      [`${Math.round(s.totalVolume ?? 0)}`, 'kg volume']
    ];
    if (s.calories) stats.push([`${s.calories}`, 'kcal']);
    drawStatGrid(ctx, stats, H / 2 - 100 + yOffset, theme);
  }

  // Badge de PR
  if (s.prsEarned && s.prsEarned.length > 0) {
    drawPRBadge(ctx, s.prsEarned.length, H - 560);
  }
}

function drawPRCard(ctx: Ctx, d: PRCardData, c: ShareCustomization) {
  const theme = SHARE_THEMES[c.theme];

  ctx.font = '220px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', W / 2, 440);

  ctx.fillStyle = theme.primary;
  ctx.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '8px';
  ctx.fillText('NOVO RECORDE PESSOAL', W / 2, 560);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 72px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '-1px';
  wrapText(ctx, d.exerciseName, W / 2, 720, W - 160, 90);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 220px "Geist Mono", monospace';
  (ctx as any).letterSpacing = '-6px';
  ctx.fillText(`${d.weight}kg`, W / 2, H / 2 + 180);

  ctx.fillStyle = theme.primary;
  ctx.font = 'bold 80px "Geist Mono", monospace';
  ctx.fillText(`× ${d.reps}`, W / 2, H / 2 + 300);

  if (d.prevBest) {
    const diff = Math.round((d.weight - d.prevBest.weight) * 10) / 10;
    ctx.fillStyle = TEXT_MUTE;
    ctx.font = '32px "Plus Jakarta Sans", sans-serif';
    (ctx as any).letterSpacing = '0';
    ctx.fillText(
      `Anterior: ${d.prevBest.weight}kg × ${d.prevBest.reps}  (+${diff}kg)`,
      W / 2, H / 2 + 400
    );
  }

  ctx.fillStyle = TEXT_DIM;
  ctx.font = '28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(fmtDateShort(d.date), W / 2, H - 380);
}

function drawStreakCard(ctx: Ctx, d: StreakCardData, c: ShareCustomization) {
  const theme = SHARE_THEMES[c.theme];

  ctx.font = '280px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔥', W / 2, 480);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 320px "Geist Mono", monospace';
  (ctx as any).letterSpacing = '-8px';
  ctx.fillText(String(d.streak), W / 2, H / 2 + 180);

  ctx.fillStyle = theme.primary;
  ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '8px';
  ctx.fillText(d.streak === 1 ? 'DIA SEGUIDO' : 'DIAS SEGUIDOS', W / 2, H / 2 + 280);

  ctx.fillStyle = TEXT_MUTE;
  ctx.font = 'italic 36px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '0';
  ctx.fillText('Fibra forjada na consistência.', W / 2, H / 2 + 440);
}

function drawWeekCard(ctx: Ctx, d: WeekCardData, c: ShareCustomization) {
  const theme = SHARE_THEMES[c.theme];

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.secondary;
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '8px';
  ctx.fillText('RESUMO DA SEMANA', W / 2, 360);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 360px "Geist Mono", monospace';
  (ctx as any).letterSpacing = '-8px';
  ctx.fillText(String(d.totalSessions), W / 2, 720);

  ctx.fillStyle = TEXT_MUTE;
  ctx.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '2px';
  ctx.fillText(d.totalSessions === 1 ? 'TREINO' : 'TREINOS', W / 2, 810);

  const stats: [string, string][] = [
    [`${Math.round(d.totalVolume)}`, 'kg volume'],
    [`${d.totalCalories}`, 'kcal gastas'],
    [`${d.totalPRs}`, d.totalPRs === 1 ? 'recorde' : 'recordes']
  ];
  drawStatGrid(ctx, stats, H / 2 + 260, theme);

  const cats = Object.entries(d.byCategory).filter(([_, v]) => v > 0);
  if (cats.length > 0) {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '28px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    const line = cats.map(([c, n]) => `${CATEGORY_ICON[c] ?? ''} ${n}`).join('  ·  ');
    ctx.fillText(line, W / 2, H - 450);
  }
}

// ─── Caption ────────────────────────────────────────────
function drawCaption(ctx: Ctx, text: string, style?: CaptionStyle) {
  const s = style ?? { x: 0.5, y: 0.82, scale: 1 };
  const fontSize = Math.round(44 * s.scale);
  const lineHeight = Math.round(58 * s.scale);
  const padX = Math.round(36 * s.scale);
  const padY = Math.round(20 * s.scale);

  ctx.font = `italic ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  (ctx as any).letterSpacing = '0';

  const maxWidth = W - 160;
  const quoted = `"${text}"`;
  const lines = wrapLines(ctx, quoted, maxWidth);
  const blockHeight = lines.length * lineHeight;

  let maxLineWidth = 0;
  for (const l of lines) {
    const w = ctx.measureText(l).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }
  const bgW = maxLineWidth + padX * 2;
  const bgH = blockHeight + padY * 2;

  // Centro do bloco na posição customizada
  const cx = s.x * W;
  const cy = s.y * H;
  const bgX = cx - bgW / 2;
  const bgY = cy - bgH / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, bgX, bgY, bgW, bgH, bgH / 2.4);
  ctx.fill();

  ctx.fillStyle = TEXT;
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    const ly = bgY + padY + (i + 0.5) * lineHeight;
    ctx.fillText(l, cx, ly);
  });
  ctx.textBaseline = 'alphabetic';
}

// ─── Stickers ───────────────────────────────────────────
function drawSticker(ctx: Ctx, s: Sticker) {
  ctx.save();
  ctx.translate(s.x * W, s.y * H);
  ctx.rotate(s.rotation);
  const baseSize = 120;
  ctx.font = `${baseSize * s.scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Sombra pra dar destaque
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  ctx.fillText(s.emoji, 0, 0);
  ctx.restore();
}

// ─── Helpers ────────────────────────────────────────────
function drawStatGrid(ctx: Ctx, stats: [string, string][], y: number, theme: typeof SHARE_THEMES[ShareTheme]) {
  const cols = stats.length;
  const colW = (W - 160) / cols;
  stats.forEach(([v, l], i) => {
    const x = 80 + colW * i + colW / 2;
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 96px "Geist Mono", monospace';
    (ctx as any).letterSpacing = '-2px';
    ctx.textAlign = 'center';
    ctx.fillText(v, x, y);
    ctx.fillStyle = TEXT_MUTE;
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    (ctx as any).letterSpacing = '2px';
    ctx.fillText(l.toUpperCase(), x, y + 50);
  });
}

function drawPRBadge(ctx: Ctx, count: number, y: number) {
  const label = `🏆 ${count} ${count === 1 ? 'NOVO RECORDE' : 'NOVOS RECORDES'}`;
  ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '4px';
  const w = ctx.measureText(label).width + 80;
  const x = (W - w) / 2;
  const h = 80;
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#ff6a00');
  g.addColorStop(1, '#ee0979');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, y + 55);
}

function drawFooter(ctx: Ctx, d: ShareCardData) {
  const y = H - 200;
  const avatarText = d.avatar ?? '💪';
  ctx.save();
  const cx = 90, cy = y - 30;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  const ag = ctx.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
  ag.addColorStop(0, '#00e5ff');
  ag.addColorStop(1, '#7c3aed');
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(avatarText, cx, cy + 2);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
  (ctx as any).letterSpacing = '0';
  ctx.fillText(d.userName, 170, y - 30);
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('fibra — o que te constrói.', 170, y + 5);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: Ctx, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const lines = wrapLines(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
