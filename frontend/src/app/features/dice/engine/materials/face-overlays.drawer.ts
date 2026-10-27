import { DiceCustomRuntimeConfig, DiceSkinConfig } from '../skins/dice-skin.types';
import {
  drawSurfaceBackground,
  hexWithAlpha,
  shiftColorBrightness
} from './face-patterns.drawer';

export interface FaceCanvasPair {
  diffuseCanvas: HTMLCanvasElement;
  heightCanvas: HTMLCanvasElement;
  emissiveCanvas: HTMLCanvasElement;
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
  const borderHex = skin.borderColor || custom.glowColorHex || skin.accentColor;

  drawSurfaceBackground(ctx, size, skin.surfaceStyle, shiftColorBrightness(coreHex, -12), borderHex);
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
  const numberColor = custom.numberColorHex || skin.textColor;
  const glowColor = custom.glowColorHex || skin.emissiveColor;
  const borderColor = skin.borderColor || glowColor;

  drawSurfaceBackground(ctx, size, skin.surfaceStyle, coreColor, glowColor);
  hCtx.fillStyle = 'rgb(128,128,128)';
  hCtx.fillRect(0, 0, size, size);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  if (skin.hasCelticBorder) {
    drawCelticCageOverlay(ctx, hCtx, size, borderColor);
  } else if (skin.hasArcaneRunes) {
    drawArcaneRuneCircle(ctx, eCtx, size, glowColor, custom.glowIntensity);
  } else {
    drawRecessedPlateBorder(ctx, hCtx, size, borderColor);
  }

  if (label && label.trim().length > 0) {
    const fontScale = label.length >= 2 ? 0.34 : 0.4;
    drawEngravedLabel(
      ctx, hCtx, eCtx, label, size * 0.5, size * 0.52,
      size * fontScale, 0, skin, custom, numberColor, glowColor
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

  for (let i = 0; i < 3; i++) {
    drawEngravedLabel(
      ctx, hCtx, eCtx, String(numbers[i]),
      cx + Math.cos(angles[i]) * radius,
      cy + Math.sin(angles[i]) * radius,
      size * 0.2, rotations[i], skin, custom, numberColor, glowColor
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
  const fontSpec = `700 ${Math.round(fontSizePx)}px ${skin.fontFamily}`;
  const isRecessed = custom.recessedNumbers ?? skin.textStyle === 'recessed';

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationRad);
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = isRecessed ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.45)';
  ctx.shadowOffsetX = isRecessed ? -2 : 2;
  ctx.shadowOffsetY = isRecessed ? -3 : 3;
  ctx.shadowBlur = 5;

  if (skin.textStrokeWidth > 0) {
    ctx.strokeStyle = skin.textStrokeColor;
    ctx.lineWidth = skin.textStrokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, 0, 0);
  }
  if (custom.glowIntensity > 0.15) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.round(14 * custom.glowIntensity);
  }
  ctx.fillStyle = numberColor;
  ctx.fillText(label, 0, 0);

  if (label === '6' || label === '9') {
    ctx.beginPath();
    ctx.arc(0, fontSizePx * 0.44, Math.max(3, fontSizePx * 0.045), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  hCtx.save();
  hCtx.translate(x, y);
  hCtx.rotate(rotationRad);
  hCtx.font = fontSpec;
  hCtx.textAlign = 'center';
  hCtx.textBaseline = 'middle';
  hCtx.fillStyle = isRecessed ? 'rgb(38,38,38)' : 'rgb(225,225,225)';
  hCtx.fillText(label, 0, 0);
  hCtx.restore();

  if (custom.glowIntensity > 0.05) {
    eCtx.save();
    eCtx.translate(x, y);
    eCtx.rotate(rotationRad);
    eCtx.font = fontSpec;
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.shadowColor = glowColor;
    eCtx.shadowBlur = Math.round(18 * custom.glowIntensity);
    eCtx.fillStyle = hexWithAlpha(glowColor, Math.min(1, custom.glowIntensity));
    eCtx.fillText(label, 0, 0);
    eCtx.restore();
  }
}

function drawCelticCageOverlay(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  size: number,
  borderColor: string
): void {
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
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rMid = (rOuter + rInner) * 0.5;
    ctx.fillStyle = shiftColorBrightness(borderColor, 28);
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * rMid, c + Math.sin(a) * rMid, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  hCtx.save();
  hCtx.strokeStyle = 'rgb(230,230,230)';
  hCtx.lineWidth = 12;
  hCtx.beginPath();
  ctx.arc(c, c, rOuter, 0, Math.PI * 2);
  hCtx.stroke();
  hCtx.restore();
}

function drawArcaneRuneCircle(
  ctx: CanvasRenderingContext2D,
  eCtx: CanvasRenderingContext2D,
  size: number,
  glowColor: string,
  glowIntensity: number
): void {
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
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      target.beginPath();
      target.moveTo(c + Math.cos(a) * (r * 0.88), c + Math.sin(a) * (r * 0.88));
      target.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      target.stroke();
    }
    target.restore();
  };
  drawRing(ctx, 0.65);
  if (glowIntensity > 0.1) drawRing(eCtx, Math.min(1, glowIntensity * 0.78));
}

function drawRecessedPlateBorder(
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  size: number,
  borderColor: string
): void {
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
