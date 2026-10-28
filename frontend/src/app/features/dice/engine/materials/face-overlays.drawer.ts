import { DiceBlendMode } from '../dice-physics.types';
import { DiceCustomRuntimeConfig, DiceSkinConfig } from '../skins/dice-skin.types';
import {
  drawSurfaceBackground,
  drawSurfaceBumpHeight,
  hexWithAlpha,
  shiftColorBrightness
} from './face-patterns.drawer';

export interface FaceCanvasPair {
  diffuseCanvas: HTMLCanvasElement;
  heightCanvas: HTMLCanvasElement;
  emissiveCanvas: HTMLCanvasElement;
}

function mapBlendMode(mode?: DiceBlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'additive':
      return 'lighter';
    default:
      return 'source-over';
  }
}

export function renderSelectedDiceTexturePreview(
  targetCanvas: HTMLCanvasElement,
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig
): void {
  const size = targetCanvas.width || 128;
  const pair = createFaceCanvas('', skin, custom, size);
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(pair.diffuseCanvas, 0, 0, size, size);
}

export function createBevelCanvas(
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  size = 256
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const coreHex = custom.coreColorHex || skin.baseColor;
  const borderHex = custom.borderColorHex || skin.borderColor || custom.glowColorHex || skin.accentColor;
  const surfaceStyle = custom.surfaceStyleOverride ?? skin.surfaceStyle;

  drawSurfaceBackground(ctx, size, surfaceStyle, shiftColorBrightness(coreHex, -12), borderHex);
  ctx.fillStyle = hexWithAlpha(borderHex, 0.22);
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createFaceCanvas(
  label: string,
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  size = 512
): FaceCanvasPair {
  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = size;
  diffuseCanvas.height = size;
  const ctx = diffuseCanvas.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const eCtx = emissiveCanvas.getContext('2d')!;

  const coreColor = custom.coreColorHex || skin.baseColor;
  const secondaryColor = custom.coreSecondaryColorHex || skin.accentColor;
  const numberColor = custom.numberColorHex || skin.textColor;
  const glowColor = custom.glowColorHex || skin.emissiveColor;
  const borderColor = custom.borderColorHex || skin.borderColor || glowColor;
  const surfaceStyle = custom.surfaceStyleOverride ?? skin.surfaceStyle;

  drawSurfaceBackground(ctx, size, surfaceStyle, coreColor, secondaryColor);

  // Photoshop/After Effects Core Gradient & Blend Mode Layer
  if (custom.coreGradientEnabled) {
    ctx.save();
    ctx.globalCompositeOperation = mapBlendMode(custom.coreBlendMode);
    if (custom.coreGradientType === 'linear') {
      const rad = ((custom.coreGradientAngle ?? 135) * Math.PI) / 180;
      const cx = size * 0.5;
      const dx = Math.cos(rad) * cx;
      const dy = Math.sin(rad) * cx;
      const g = ctx.createLinearGradient(cx - dx, cx - dy, cx + dx, cx + dy);
      g.addColorStop(0, hexWithAlpha(coreColor, 0.85));
      g.addColorStop(1, hexWithAlpha(secondaryColor, 0.75));
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.65);
      g.addColorStop(0, hexWithAlpha(secondaryColor, 0.58));
      g.addColorStop(1, hexWithAlpha(coreColor, 0.85));
      ctx.fillStyle = g;
    }
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  // Core Inner Glow Layer
  if (custom.coreInnerGlowEnabled && custom.coreInnerGlowOpacity > 0.02) {
    const igColor = custom.coreInnerGlowColor || glowColor;
    const igSize = Math.max(4, (custom.coreInnerGlowSize ?? 16) * (size / 256));
    const choke = Math.max(0.05, Math.min(0.95, 1 - (custom.coreInnerGlowChoke ?? 0.25) * 0.5));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ig = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.48 * choke - igSize, size * 0.5, size * 0.5, size * 0.5);
    ig.addColorStop(0, 'rgba(0,0,0,0)');
    ig.addColorStop(1, hexWithAlpha(igColor, custom.coreInnerGlowOpacity));
    ctx.fillStyle = ig;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    eCtx.save();
    eCtx.fillStyle = ig;
    eCtx.fillRect(0, 0, size, size);
    eCtx.restore();
  }

  // Core Outer / Ambient Glow Layer
  if (custom.coreOuterGlowEnabled && custom.coreOuterGlowOpacity > 0.02) {
    const ogColor = custom.coreOuterGlowColor || glowColor;
    const ogSpread = Math.max(0.15, Math.min(0.9, custom.coreOuterGlowSpread ?? 0.35));
    const og = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * (0.35 + ogSpread * 0.35));
    og.addColorStop(0, hexWithAlpha(ogColor, custom.coreOuterGlowOpacity * 0.45));
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    eCtx.save();
    eCtx.fillStyle = og;
    eCtx.fillRect(0, 0, size, size);
    eCtx.restore();
  }

  // Initialize Height Canvas + Surface Bump Relief
  hCtx.fillStyle = 'rgb(128,128,128)';
  hCtx.fillRect(0, 0, size, size);
  drawSurfaceBumpHeight(hCtx, size, surfaceStyle, custom.bumpMapIntensity ?? 1.0);

  if (!custom.coreInnerGlowEnabled && !custom.coreOuterGlowEnabled) {
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, size, size);
  }

  const overlayStyle = custom.faceOverlayStyle ?? (skin.hasCelticBorder ? 'celtic-cage' : skin.hasArcaneRunes ? 'arcane-runes' : 'recessed-plate');
  if (overlayStyle === 'celtic-cage') {
    drawCelticCageOverlay(ctx, hCtx, size, borderColor);
  } else if (overlayStyle === 'arcane-runes') {
    drawArcaneRuneCircle(ctx, eCtx, size, glowColor, custom.glowIntensity);
  } else if (overlayStyle === 'recessed-plate') {
    drawRecessedPlateBorder(ctx, hCtx, size, borderColor);
  }

  if (label && label.trim().length > 0) {
    const baseScale = label.length >= 2 ? 0.34 : 0.4;
    const userFontScale = Math.max(0.55, Math.min(1.45, custom.fontScale ?? 1.0));
    drawEngravedLabel(
      ctx, hCtx, eCtx, label, size * 0.5, size * 0.52,
      size * baseScale * userFontScale, 0, skin, custom, numberColor, glowColor
    );
  }

  return { diffuseCanvas, heightCanvas, emissiveCanvas };
}

export function createD4FaceCanvas(
  numbers: [number, number, number],
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  size = 512
): FaceCanvasPair {
  const pair = createFaceCanvas('', skin, custom, size);
  const { diffuseCanvas, heightCanvas, emissiveCanvas } = pair;
  const ctx = diffuseCanvas.getContext('2d')!;
  const hCtx = heightCanvas.getContext('2d')!;
  const eCtx = emissiveCanvas.getContext('2d')!;

  const numberColor = custom.numberColorHex || skin.textColor;
  const glowColor = custom.glowColorHex || skin.emissiveColor;
  const cx = size * 0.5;
  const cy = size * 0.54;
  const radius = size * 0.25;
  const angles = [-Math.PI / 2, (Math.PI * 5) / 6, Math.PI / 6];
  const rotations = [0, (Math.PI * 2) / 3, -(Math.PI * 2) / 3];
  const userFontScale = Math.max(0.55, Math.min(1.45, custom.fontScale ?? 1.0));

  for (let i = 0; i < 3; i++) {
    drawEngravedLabel(
      ctx, hCtx, eCtx, String(numbers[i]),
      cx + Math.cos(angles[i]) * radius,
      cy + Math.sin(angles[i]) * radius,
      size * 0.2 * userFontScale, rotations[i], skin, custom, numberColor, glowColor
    );
  }
  return pair;
}

function drawEngravedLabel(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  eCtx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  fontSizePx: number,
  rotationRad: number,
  skin: DiceSkinConfig,
  custom: DiceCustomRuntimeConfig,
  numberColor: string,
  glowColor: string
): void {
  const fontFamily = custom.fontFamily || skin.fontFamily || 'Cinzel, Georgia, serif';
  const fontWeight = custom.fontWeight || '700';
  const fontSpec = `${fontWeight} ${Math.round(fontSizePx)}px ${fontFamily}`;
  const depth = custom.numberDepth ?? (custom.recessedNumbers ? -0.75 : 0.65);
  const isRecessed = depth < -0.05;
  const numOpacity = Math.max(0.1, Math.min(1, custom.numberOpacity ?? 1.0));

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = numOpacity;
  ctx.globalCompositeOperation = mapBlendMode(custom.numberBlendMode);
  if ('letterSpacing' in ctx && custom.fontTracking) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${custom.fontTracking}px`;
  }

  // Drop Shadow / Depth Bevel Shadow
  if (custom.numberDropShadowEnabled ?? true) {
    ctx.shadowColor = custom.numberShadowColorHex || (isRecessed ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.45)');
    ctx.shadowOffsetX = custom.numberShadowOffsetX ?? (isRecessed ? -2 : 2);
    ctx.shadowOffsetY = custom.numberShadowOffsetY ?? (isRecessed ? -3 : 3);
    ctx.shadowBlur = custom.numberShadowBlur ?? 5;
  }

  // Number Outer Glow
  if (custom.numberOuterGlowEnabled && (custom.numberOuterGlowOpacity ?? 0) > 0.05) {
    ctx.save();
    ctx.shadowColor = custom.numberOuterGlowColor || glowColor;
    ctx.shadowBlur = Math.max(2, (custom.numberOuterGlowSize ?? 14) * (1 + (custom.numberOuterGlowSpread ?? 0.3)));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = hexWithAlpha(custom.numberOuterGlowColor || glowColor, custom.numberOuterGlowOpacity);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // Outline Stroke
  const strokeWidth = custom.numberStrokeWidth ?? skin.textStrokeWidth ?? 0;
  if (strokeWidth > 0) {
    ctx.strokeStyle = custom.numberStrokeColorHex || skin.textStrokeColor || '#050806';
    ctx.lineWidth = strokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, 0, 0);
  }

  ctx.fillStyle = numberColor;
  ctx.fillText(label, 0, 0);

  // Number Inner Glow
  if (custom.numberInnerGlowEnabled && (custom.numberInnerGlowOpacity ?? 0) > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = hexWithAlpha(custom.numberInnerGlowColor || glowColor, custom.numberInnerGlowOpacity * 0.75);
    ctx.shadowColor = custom.numberInnerGlowColor || glowColor;
    ctx.shadowBlur = Math.max(1, custom.numberInnerGlowSize ?? 8);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // 6/9 Indicator
  const indicator = custom.sixNineIndicator ?? 'dot';
  if ((label === '6' || label === '9') && indicator !== 'none') {
    if (indicator === 'underline') {
      ctx.fillRect(-fontSizePx * 0.18, fontSizePx * 0.42, fontSizePx * 0.36, Math.max(3, fontSizePx * 0.055));
    } else {
      ctx.beginPath();
      ctx.arc(0, fontSizePx * 0.44, Math.max(3, fontSizePx * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Height Map for Number Depth (-1.0 deep carve .. 0.0 flush .. +1.0 raised relief)
  if (Math.abs(depth) > 0.03) {
    hCtx.save();
    hCtx.translate(x, y);
    hCtx.rotate(rotationRad);
    hCtx.font = fontSpec;
    hCtx.textAlign = 'center';
    hCtx.textBaseline = 'middle';
    const heightVal = Math.max(8, Math.min(248, Math.round(128 + depth * 112)));
    hCtx.shadowColor = `rgb(${heightVal},${heightVal},${heightVal})`;
    hCtx.shadowBlur = Math.max(2, Math.round(Math.abs(depth) * 6));
    hCtx.fillStyle = `rgb(${heightVal},${heightVal},${heightVal})`;
    hCtx.fillText(label, 0, 0);
    hCtx.restore();
  }

  // Emissive Map for Number Outer/Inner Glow
  const emisStrength = Math.max(
    custom.glowIntensity ?? 0,
    custom.numberOuterGlowEnabled ? (custom.numberOuterGlowOpacity ?? 0) : 0,
    custom.numberInnerGlowEnabled ? (custom.numberInnerGlowOpacity ?? 0) : 0
  );
  if (emisStrength > 0.05) {
    const eColor = custom.numberOuterGlowEnabled
      ? (custom.numberOuterGlowColor || glowColor)
      : custom.numberInnerGlowEnabled
        ? (custom.numberInnerGlowColor || glowColor)
        : glowColor;
    eCtx.save();
    eCtx.translate(x, y);
    eCtx.rotate(rotationRad);
    eCtx.font = fontSpec;
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.shadowColor = eColor;
    eCtx.shadowBlur = Math.round(18 * emisStrength);
    eCtx.fillStyle = hexWithAlpha(eColor, Math.min(1, emisStrength));
    eCtx.fillText(label, 0, 0);
    eCtx.restore();
  }
}

function drawCelticCageOverlay(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, size: number, borderColor: string): void {
  const c = size * 0.5;
  const rOuter = size * 0.43;
  const rInner = size * 0.37;
  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(c, c, rOuter, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, rInner, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  hCtx.save();
  hCtx.strokeStyle = 'rgb(230,230,230)';
  hCtx.lineWidth = 10;
  hCtx.beginPath();
  hCtx.arc(c, c, rOuter, 0, Math.PI * 2);
  hCtx.stroke();
  hCtx.restore();
}

function drawArcaneRuneCircle(ctx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, size: number, glowColor: string, glowIntensity: number): void {
  const c = size * 0.5;
  const r = size * 0.41;
  const drawRing = (target: CanvasRenderingContext2D, alpha: number) => {
    target.save();
    target.strokeStyle = hexWithAlpha(glowColor, alpha);
    target.lineWidth = 3.5;
    target.beginPath();
    target.arc(c, c, r, 0, Math.PI * 2);
    target.stroke();
    target.lineWidth = 2;
    target.beginPath();
    target.arc(c, c, r * 0.88, 0, Math.PI * 2);
    target.stroke();
    target.restore();
  };
  drawRing(ctx, 0.65);
  if (glowIntensity > 0.1) drawRing(eCtx, Math.min(1, glowIntensity * 0.78));
}

function drawRecessedPlateBorder(ctx: CanvasRenderingContext2D, hCtx: CanvasRenderingContext2D, size: number, borderColor: string): void {
  const c = size * 0.5;
  const r = size * 0.43;
  ctx.save();
  ctx.strokeStyle = hexWithAlpha(borderColor, 0.34);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  hCtx.save();
  hCtx.strokeStyle = 'rgb(95,95,95)';
  hCtx.lineWidth = 5;
  hCtx.beginPath();
  hCtx.arc(c, c, r, 0, Math.PI * 2);
  hCtx.stroke();
  hCtx.restore();
}
