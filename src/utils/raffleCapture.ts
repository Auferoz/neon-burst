/**
 * Shareable image of a raffle result, drawn on a <canvas> (browser only).
 *
 * It's a purpose-built card (1080×1350, the 4:5 ratio social networks use),
 * not a screenshot of the DOM: no extra dependency, crisp at any screen size,
 * and independent of the modal's scroll or viewport. Steam's CDN answers with
 * `Access-Control-Allow-Origin: *`, so images loaded with
 * `crossOrigin = 'anonymous'` don't taint the canvas; if one still fails, the
 * card is drawn without it instead of failing.
 */
import {
  controllerLabel,
  formatHours,
  formatPlaytime,
  normalizeGenres,
  raffleCaptureFileName,
  wrapText,
  type RaffleGame,
} from './steamRaffle';

const W = 1080;
const H = 1350;
const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

const C = {
  bg: '#06060a',
  surface: '#12121c',
  border: '#2a2a42',
  text: '#e8e8f0',
  muted: '#9898b0',
  cyan: '#00e5ff',
  pink: '#ff2d95',
  purple: '#b026ff',
  gold: '#ffd700',
};

const MONO = "'Fira Code', ui-monospace, monospace";
const DISPLAY = "'Orbitron', 'Fira Code', ui-monospace, monospace";

export interface RaffleCaptureInput {
  game: RaffleGame;
  /** How many games were in the pool when it was drawn. */
  poolSize: number;
  date?: Date;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function firstImage(sources: string[]): Promise<HTMLImageElement | null> {
  for (const src of sources) {
    const img = await loadImage(src);
    if (img) return img;
  }
  return null;
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${DISPLAY}`),
      document.fonts.load(`700 40px ${MONO}`),
      document.fonts.load(`400 40px ${MONO}`),
    ]);
  } catch {
    // Fallback fonts are fine.
  }
}

/** Draws `img` covering the box (like `object-fit: cover`). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, blur: number) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = blur / 2;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, hero: HTMLImageElement | null) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  if (hero) {
    ctx.save();
    ctx.filter = 'blur(28px) saturate(1.3)';
    ctx.globalAlpha = 0.55;
    drawCover(ctx, hero, -60, -60, W + 120, H + 120);
    ctx.restore();
  }

  // Vignette + darken the bottom, where the text goes.
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(6,6,10,0.55)');
  shade.addColorStop(0.45, 'rgba(6,6,10,0.35)');
  shade.addColorStop(1, 'rgba(6,6,10,0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  // Radial spotlight behind the poster.
  const spot = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 620);
  spot.addColorStop(0, 'rgba(0,229,255,0.28)');
  spot.addColorStop(0.5, 'rgba(176,38,255,0.12)');
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // Light rays.
  ctx.save();
  ctx.translate(W / 2, 520);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    const ray = ctx.createLinearGradient(0, 0, 0, -900);
    ray.addColorStop(0, i % 2 ? 'rgba(0,229,255,0.10)' : 'rgba(255,45,149,0.08)');
    ray.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-38, -900);
    ctx.lineTo(38, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // CRT scanlines.
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  // Neon frame.
  ctx.save();
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, C.cyan);
  frame.addColorStop(0.5, C.purple);
  frame.addColorStop(1, C.pink);
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 24;
  roundRectPath(ctx, 28, 28, W - 56, H - 56, 36);
  ctx.stroke();
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D) {
  // Deterministic pseudo-random so the same result always looks the same.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const colors = [C.cyan, C.pink, C.purple, C.gold, '#39ff14'];
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const x = 60 + rand() * (W - 120);
    const y = 60 + rand() * 820;
    // Keep the poster area clean.
    if (x > 290 && x < 790 && y > 150 && y < 900) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.55 + rand() * 0.45;
    ctx.shadowColor = ctx.fillStyle as string;
    ctx.shadowBlur = 10;
    ctx.fillRect(-7, -3, 14 + rand() * 10, 6);
    ctx.restore();
  }
  ctx.restore();
}

function drawPoster(ctx: CanvasRenderingContext2D, poster: HTMLImageElement | null, name: string) {
  const pw = 440;
  const ph = 660;
  const px = (W - pw) / 2;
  const py = 190;

  // Glow halo.
  ctx.save();
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 80;
  ctx.fillStyle = C.surface;
  roundRectPath(ctx, px, py, pw, ph, 26);
  ctx.fill();
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 140;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, px, py, pw, ph, 26);
  ctx.clip();
  if (poster) {
    drawCover(ctx, poster, px, py, pw, ph);
    // Glossy sheen.
    const sheen = ctx.createLinearGradient(px, py, px + pw, py + ph);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(px, py, pw, ph);
  } else {
    ctx.fillStyle = C.surface;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = C.text;
    ctx.font = `700 40px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(name, pw - 60, s => ctx.measureText(s).width, 5);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, py + ph / 2 + (i - (lines.length - 1) / 2) * 52));
  }
  ctx.restore();

  const border = ctx.createLinearGradient(px, py, px + pw, py + ph);
  border.addColorStop(0, C.cyan);
  border.addColorStop(1, C.pink);
  ctx.save();
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 30;
  roundRectPath(ctx, px, py, pw, ph, 26);
  ctx.stroke();
  ctx.restore();

  // "ELEGIDO" ribbon over the bottom edge of the poster.
  const label = '★ ELEGIDO ★';
  ctx.save();
  ctx.font = `800 34px ${DISPLAY}`;
  const lw = ctx.measureText(label).width + 70;
  const lx = (W - lw) / 2;
  const ly = py + ph - 30;
  const pill = ctx.createLinearGradient(lx, 0, lx + lw, 0);
  pill.addColorStop(0, '#ffb300');
  pill.addColorStop(0.5, C.gold);
  pill.addColorStop(1, '#ffb300');
  ctx.shadowColor = C.gold;
  ctx.shadowBlur = 40;
  ctx.fillStyle = pill;
  roundRectPath(ctx, lx, ly, lw, 64, 32);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a1200';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, ly + 34);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, input: RaffleCaptureInput) {
  const { game, poolSize } = input;
  const date = input.date ?? new Date();

  // Header.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillStyle = C.cyan;
  glowText(ctx, 'NEON BURST', W / 2, 108, C.cyan, 26);
  ctx.font = `500 22px ${MONO}`;
  ctx.fillStyle = C.muted;
  ctx.fillText('$ steam --sortear', W / 2, 146);
  ctx.restore();

  // Title.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 60px ${MONO}`;
  const lines = wrapText(game.name, W - 160, s => ctx.measureText(s).width, 2);
  let y = 960;
  ctx.fillStyle = '#ffffff';
  for (const line of lines) {
    glowText(ctx, line, W / 2, y, C.cyan, 30);
    y += 70;
  }
  ctx.restore();

  // Genres.
  const genres = normalizeGenres(game.genres).slice(0, 4).join('  ·  ');
  if (genres) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `400 24px ${MONO}`;
    ctx.fillStyle = C.pink;
    ctx.fillText(genres, W / 2, y - 18);
    ctx.restore();
    y += 22;
  }

  // Stats.
  const stats: [string, string][] = [
    ['HISTORIA', formatHours(game.hltb_main)],
    ['JUGADO', formatPlaytime(game.playtime)],
    ['CONTROL', controllerLabel(game.controller_support).replace('Sin dato de control', 'Sin dato')],
  ];
  const boxW = 290;
  const gap = 25;
  const startX = (W - (boxW * 3 + gap * 2)) / 2;
  const boxY = Math.max(y, 1110);
  stats.forEach(([label, value], i) => {
    const bx = startX + i * (boxW + gap);
    ctx.save();
    ctx.fillStyle = 'rgba(18,18,28,0.85)';
    ctx.strokeStyle = 'rgba(0,229,255,0.35)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, bx, boxY, boxW, 104, 18);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.muted;
    ctx.font = `500 20px ${MONO}`;
    ctx.fillText(label, bx + boxW / 2, boxY + 38);
    ctx.fillStyle = C.cyan;
    ctx.font = `700 28px ${MONO}`;
    const fitted = wrapText(value, boxW - 24, s => ctx.measureText(s).width, 1)[0] ?? value;
    ctx.fillText(fitted, bx + boxW / 2, boxY + 80);
    ctx.restore();
  });

  // Footer.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `400 22px ${MONO}`;
  ctx.fillStyle = C.muted;
  const when = date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  ctx.fillText(`Elegido entre ${poolSize} ${poolSize === 1 ? 'juego' : 'juegos'} · ${when} · neonburst.cl`, W / 2, H - 60);
  ctx.restore();
}

/** Renders the result card. Resolves to a PNG blob. */
export async function renderRaffleCapture(input: RaffleCaptureInput): Promise<Blob> {
  const { game } = input;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite generar la imagen');

  const [, poster, hero] = await Promise.all([
    ensureFonts(),
    firstImage([game.poster, `${STEAM_CDN}/${game.appid}/library_600x900.jpg`]),
    firstImage([`${STEAM_CDN}/${game.appid}/library_hero.jpg`, `${STEAM_CDN}/${game.appid}/header.jpg`, game.poster]),
  ]);

  drawBackground(ctx, hero);
  drawConfetti(ctx);
  drawPoster(ctx, poster, game.name);
  drawText(ctx, input);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png');
    } catch {
      reject(new Error('No se pudo generar la imagen'));
    }
  });
}

export type CaptureOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands the image to the user: the native share sheet on devices that can
 * share files (phones), a download everywhere else.
 */
export async function deliverRaffleCapture(blob: Blob, gameName: string, date = new Date()): Promise<CaptureOutcome> {
  const fileName = raffleCaptureFileName(gameName, date);
  const file = new File([blob], fileName, { type: 'image/png' });
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Sorteo: ${gameName}` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Any other share failure falls back to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Copies the image to the clipboard, when the browser supports it. */
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

/**
 * Must be called synchronously inside the click handler: the browser only
 * allows clipboard writes during the user gesture, and rendering the image
 * takes longer than that. Passing the *promise* to `ClipboardItem` claims the
 * clipboard right away and lets the browser wait for the image.
 */
export async function copyRaffleCapture(blob: Promise<Blob>): Promise<void> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch (e) {
    const name = (e as Error).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('El navegador no permitió copiar la imagen; usa "Guardar captura"');
    }
    throw e;
  }
}
