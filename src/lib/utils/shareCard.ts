/**
 * Gerador de share cards 1080×1920 (stories).
 * Suporta foto de fundo, caption, tema e stickers posicionáveis.
 */

import type { Session } from '$lib/types';
import { CATEGORY_ICON, CATEGORY_LABEL, fmtDateShort, fmtDuration } from './format';
import { buildStaticMapUrl } from './mapbox';
import { fmtPace } from './exercise';

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
export type ShareTemplate = 'session' | 'pr' | 'streak' | 'week' | 'run';

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

export interface RunCardData {
  template: 'run';
  distanceM: number;
  paceSecPerKm: number;
  durationSec: number;
  calories?: number;
  date: string;
  userName: string;
  avatar?: string;
  track: { lat: number; lng: number }[];
  mapStyle?: 'outdoors' | 'satellite' | 'dark';
}

export interface RankCardData {
  template: 'rank';
  position: number;
  metricLabel: string;
  metricValue: string;
  userName: string;
  avatar?: string;
}

export type ShareCardData = SessionCardData | PRCardData | StreakCardData | WeekCardData | RunCardData | RankCardData;

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

  // Background: foto > mapa (se corrida) > gradient
  const hasPhoto = !!custom.photoDataUrl;
  const isRun = data.template === 'run';
  if (hasPhoto) {
    await drawPhotoBackground(ctx, custom.photoDataUrl!, custom.layout);
  } else if (isRun && (data as RunCardData).track.length > 1) {
    await drawMapBackground(ctx, data as RunCardData);
  }
  drawThemeOverlay(ctx, custom.theme, hasPhoto || isRun);

  // Corrida: só o mark (F). Outros templates: F + palavra FIBRA.
  if (isRun) drawLogoMark(ctx, custom.theme);
  else drawBrand(ctx, custom.theme);

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
    case 'run':
      await drawRunCard(ctx, data, custom);
      break;
    case 'rank':
      await drawRankCard(ctx, data, custom);
      break;
  }

  // Caption (se tiver)
  if (custom.caption) drawCaption(ctx, custom.caption, custom.captionStyle);

  // Stickers (por cima de tudo)
  for (const s of custom.stickers) drawSticker(ctx, s);

  // (Footer removido — info de perfil ficava poluindo)

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
  ctx.translate(80, 80);
  const s = 72;
  ctx.fillStyle = theme.primary;
  // Italic skew leve
  ctx.transform(1, 0, -0.1, 1, 6, 0);
  // Stem grosso
  ctx.fillRect(0, 0, s * 0.21, s * 0.75);
  // Braço superior
  ctx.fillRect(0, 0, s * 0.58, s * 0.21);
  // Braço do meio
  ctx.fillRect(0, s * 0.31, s * 0.42, s * 0.19);
  ctx.restore();

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  (ctx as any).letterSpacing = '8px';
  ctx.fillText('FIBRA', 170, 136);
}

/** Só o mark F (sem o wordmark), pra uso em cards tipo corrida.
 *  Posicionado abaixo da zona de avatar/username do Instagram. */
function drawLogoMark(ctx: Ctx, themeKey: ShareTheme) {
  const theme = SHARE_THEMES[themeKey];
  const cx = W - 100; // top-right, fora do zone do avatar Insta (top-left)
  const cy = 260;      // abaixo da barra de username (~90px)
  const r = 40;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx - 18, cy - 21);
  const s = 44;
  ctx.fillStyle = theme.primary;
  ctx.transform(1, 0, -0.1, 1, 6, 0);
  ctx.fillRect(0, 0, s * 0.21, s * 0.75);
  ctx.fillRect(0, 0, s * 0.58, s * 0.21);
  ctx.fillRect(0, s * 0.31, s * 0.42, s * 0.19);
  ctx.restore();
}

// Safe zones do Instagram Stories (1080x1920):
// - Topo 250px: avatar do usuário + botões
// - Baixo 260px: barra de comentários + botão de share
// Conteúdo importante deve caber em y=250 até y=1660.
const SAFE_TOP = 250;
const SAFE_BOTTOM = 1660;

async function drawMapBackground(ctx: Ctx, data: RunCardData) {
  const MAP_H = 1020;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, W, H);

  // Bail cedo: sem pontos, não faz fetch (evita hang em Mapbox)
  if (!data.track || data.track.length < 2) {
    console.info('[shareCard] Sem track GPS, usando placeholder');
    drawNoMapPlaceholder(ctx);
    return;
  }

  const style =
    data.mapStyle === 'satellite' ? 'mapbox/satellite-streets-v12' :
    data.mapStyle === 'dark'      ? 'mapbox/dark-v11' :
                                    'mapbox/outdoors-v12';
  const url = buildStaticMapUrl({
    track: data.track,
    width: Math.floor(W / 2),
    height: Math.floor(MAP_H / 2),
    style,
    strokeColor: '22d3ee',
    strokeWidth: 6
  });
  if (!url) {
    console.warn('[shareCard] Mapbox URL nulo (token faltando?)');
    drawNoMapPlaceholder(ctx);
    return;
  }
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, 0, 0, W, MAP_H);
    const fade = ctx.createLinearGradient(0, MAP_H - 200, 0, MAP_H + 40);
    fade.addColorStop(0, 'rgba(11, 18, 32, 0)');
    fade.addColorStop(1, 'rgba(11, 18, 32, 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, MAP_H - 200, W, 240);
    const bot = ctx.createLinearGradient(0, MAP_H, 0, H);
    bot.addColorStop(0, '#0b1220');
    bot.addColorStop(1, '#050810');
    ctx.fillStyle = bot;
    ctx.fillRect(0, MAP_H, W, H - MAP_H);
  } catch (e) {
    console.warn('[shareCard] Falha ao carregar mapa:', (e as Error).message);
    drawNoMapPlaceholder(ctx);
  }
}

function drawNoMapPlaceholder(ctx: Ctx) {
  // Gradiente cyan estilizado com mensagem quando o track está ausente
  const MAP_H = 1020;
  const grad = ctx.createLinearGradient(0, 0, 0, MAP_H);
  grad.addColorStop(0, '#0e1a2b');
  grad.addColorStop(1, '#0b1220');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, MAP_H);
  // Ícone de mapa riscado
  ctx.font = '220px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.fillText('🗺️', W / 2, MAP_H / 2 - 20);
  ctx.font = '700 44px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('Sem rota GPS', W / 2, MAP_H / 2 + 80);
  ctx.font = '300 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('Ative o GPS na próxima corrida', W / 2, MAP_H / 2 + 130);
  ctx.textAlign = 'left';
}

async function drawRunCard(ctx: Ctx, d: RunCardData, c: ShareCustomization) {
  const theme = SHARE_THEMES[c.theme];
  const isMinimal = c.layout === 'minimal';
  const isPhoto = c.layout === 'photo' || !!c.photoDataUrl;

  // ─── Bloco central (KM) ─────
  // Começa em 1100 quando tem mapa (termina em 1020), ou no centro se photo.
  const centerY = isPhoto ? H / 2 - 100 : 1220;

  const km = (d.distanceM / 1000).toFixed(2);
  ctx.textAlign = 'center';
  ctx.font = '900 240px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  const kmWidth = ctx.measureText(km).width;
  ctx.fillText(km, W / 2, centerY);

  // "km" inline em thin/light
  ctx.font = '300 72px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = theme.primary;
  ctx.textAlign = 'left';
  ctx.fillText('km', W / 2 + kmWidth / 2 + 20, centerY);

  // ─── Linha de stats (stats + minimal com poucas) ─────
  if (!isMinimal) {
    const rowY = centerY + 150;
    const cellW = W / 3;
    drawRunStat(ctx, cellW / 2, rowY, 'PACE', d.paceSecPerKm > 0 ? fmtPace(d.paceSecPerKm) : '—', '/km', theme.primary);
    drawRunStat(ctx, cellW * 1.5, rowY, 'TEMPO', fmtRunDuration(d.durationSec), '', theme.primary);
    if (d.calories !== undefined) {
      drawRunStat(ctx, cellW * 2.5, rowY, 'KCAL', String(d.calories), '', theme.primary);
    }
  } else {
    // Minimal: só pace centralizado
    const rowY = centerY + 140;
    ctx.textAlign = 'center';
    ctx.font = '300 44px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const paceStr = d.paceSecPerKm > 0 ? `${fmtPace(d.paceSecPerKm)} /km` : '';
    ctx.fillText(paceStr, W / 2, rowY);
  }

  // ─── Footer unificado: avatar + nome + data ─────
  // Posicionado em 1600 pra ficar dentro da safe zone do Instagram.
  await drawUserFooter(ctx, d.userName, d.avatar, formatRunDateFull(d.date));

  ctx.textAlign = 'left';
}

function drawRunStat(ctx: Ctx, x: number, y: number, label: string, value: string, unit: string, accent: string) {
  ctx.textAlign = 'center';
  ctx.font = '700 30px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT_MUTE;
  ctx.fillText(label, x, y);

  ctx.font = '800 82px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  if (unit) {
    const vw = ctx.measureText(value).width;
    ctx.fillText(value, x, y + 82);
    ctx.font = '600 30px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText(unit, x + vw / 2 + 10, y + 76);
  } else {
    ctx.fillText(value, x, y + 82);
  }
}

async function drawUserFooter(ctx: Ctx, name: string, avatar: string | undefined, dateStr: string) {
  // Posicionado em y=1600 pra ficar dentro da safe zone do Insta Stories
  const cy = 1600;
  const size = 88;

  // Calcula largura pra centralizar tudo
  ctx.font = '600 38px -apple-system, system-ui, sans-serif';
  const nameWidth = ctx.measureText(name).width;
  const totalWidth = size + 24 + nameWidth;
  const startX = (W - totalWidth) / 2;
  const avatarCx = startX + size / 2;
  const textX = startX + size + 24;

  // ─── Avatar ─────
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();

  if (avatar) {
    if (avatar.startsWith('http')) {
      try {
        const img = await loadImage(avatar);
        ctx.drawImage(img, avatarCx - size / 2, cy - size / 2, size, size);
      } catch {
        drawEmojiAvatar(ctx, avatar, avatarCx, cy, size);
      }
    } else {
      drawEmojiAvatar(ctx, avatar, avatarCx, cy, size);
    }
  } else {
    drawEmojiAvatar(ctx, '🔥', avatarCx, cy, size);
  }
  ctx.restore();

  // ─── Nome (light, não mais em caps) ─────
  ctx.font = '600 38px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, textX, cy - 14);

  // ─── Data (light, menor, mesma linha vertical) ─────
  ctx.font = '300 26px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT_MUTE;
  ctx.fillText(dateStr, textX, cy + 22);

  ctx.textBaseline = 'alphabetic';
}

function drawEmojiAvatar(ctx: Ctx, emoji: string, cx: number, cy: number, size: number) {
  ctx.font = `${Math.floor(size * 0.7)}px -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 4);
  ctx.textBaseline = 'alphabetic';
}

async function drawRankCard(ctx: Ctx, d: RankCardData, c: ShareCustomization) {
  const theme = SHARE_THEMES[c.theme];
  const medal = ['🥇', '🥈', '🥉'][d.position - 1] ?? '';

  // Fundo gradiente radial (só se não tem foto)
  if (!c.photoDataUrl) {
    const rad = ctx.createRadialGradient(W / 2, 720, 100, W / 2, 720, 1000);
    rad.addColorStop(0, `${theme.primary}40`);
    rad.addColorStop(1, '#0a0e14');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
  }

  // Medalha gigante em cima
  ctx.textAlign = 'center';
  ctx.font = '400 400px -apple-system, system-ui, sans-serif';
  ctx.fillText(medal || `#${d.position}`, W / 2, 720);

  // "TOP" + posição
  ctx.font = '800 56px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = theme.primary;
  ctx.fillText('TOP', W / 2 - 110, 920);

  ctx.font = '900 180px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText(`#${d.position}`, W / 2 + 90, 960);

  // Métrica
  ctx.font = '700 34px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT_MUTE;
  ctx.fillText(d.metricLabel.toUpperCase(), W / 2, 1090);

  ctx.font = '800 88px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText(d.metricValue, W / 2, 1190);

  // "na comunidade FIBRA"
  ctx.font = '300 32px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = TEXT_MUTE;
  ctx.fillText('na comunidade FIBRA', W / 2, 1260);

  // Footer unificado
  await drawUserFooter(ctx, d.userName, d.avatar, new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }));

  ctx.textAlign = 'left';
}

function formatRunDateFull(iso: string): string {
  const d = new Date(iso + 'T12:00:00-03:00');
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
}

function fmtRunDuration(sec: number): string {
  // Sempre HH:MM:SS estilo Apple Watch (ex: 0:20:58)
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

  // Stats mínimos: apenas tempo e kcal (quando houver)
  if (c.layout !== 'photo') {
    const stats: [string, string][] = [
      [fmtDuration(duration), 'Tempo']
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

function loadImage(src: string, timeoutMs = 5000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      img.src = ''; // interrompe load
      reject(new Error('Timeout carregando imagem'));
    }, timeoutMs);
    img.onload = () => { if (done) return; done = true; clearTimeout(timer); resolve(img); };
    img.onerror = () => { if (done) return; done = true; clearTimeout(timer); reject(new Error('Falha ao carregar imagem')); };
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
