/**
 * Compact maritime marker generator.
 *
 * The map can display many vessels at once. Detailed 28px sprites made dense
 * sea areas unreadable, especially because the symbol layer intentionally
 * allows overlapping tracks. Keep the source sprites small and recognizable;
 * MapLibre still scales them with zoom, but they no longer cover large parts
 * of the map at regional zoom levels.
 */

export type ShipIconType = 'ship-cargo' | 'ship-tanker' | 'ship-military' | 'ship-passenger' | 'ship-default';

export interface RenderedShipIcon {
  width: number;
  height: number;
  data: Uint8Array;
}

const MIN_RENDERED_SIZE = 12;
const MAX_RENDERED_SIZE = 16;

function hullPath(
  ctx: CanvasRenderingContext2D,
  size: number,
  beam: number,
  bow: number,
  stern: number,
) {
  const cx = size / 2;
  const cy = size / 2;
  const halfBeam = size * beam;

  ctx.beginPath();
  ctx.moveTo(cx, cy - size * bow);
  ctx.quadraticCurveTo(cx + halfBeam, cy - size * 0.25, cx + halfBeam, cy + size * 0.18);
  ctx.lineTo(cx + size * stern, cy + size * 0.36);
  ctx.lineTo(cx - size * stern, cy + size * 0.36);
  ctx.lineTo(cx - halfBeam, cy + size * 0.18);
  ctx.quadraticCurveTo(cx - halfBeam, cy - size * 0.25, cx, cy - size * bow);
  ctx.closePath();
}

function drawBaseHull(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  beam = 0.18,
  bow = 0.43,
  stern = 0.13,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.lineWidth = Math.max(1, size * 0.055);
  ctx.lineJoin = 'round';
  hullPath(ctx, size, beam, bow, stern);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCargo(ctx: CanvasRenderingContext2D, size: number, color: string) {
  drawBaseHull(ctx, size, color, 0.18, 0.44, 0.14);
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(cx - size * 0.105, cy - size * 0.18, size * 0.21, size * 0.30);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.18);
  ctx.lineTo(cx, cy + size * 0.12);
  ctx.moveTo(cx - size * 0.105, cy - size * 0.03);
  ctx.lineTo(cx + size * 0.105, cy - size * 0.03);
  ctx.stroke();
  ctx.restore();
}

function drawTanker(ctx: CanvasRenderingContext2D, size: number, color: string) {
  drawBaseHull(ctx, size, color, 0.20, 0.42, 0.15);
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.58)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.22);
  ctx.lineTo(cx, cy + size * 0.17);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.beginPath();
  ctx.arc(cx - size * 0.07, cy - size * 0.02, Math.max(1, size * 0.035), 0, Math.PI * 2);
  ctx.arc(cx + size * 0.07, cy - size * 0.02, Math.max(1, size * 0.035), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPassenger(ctx: CanvasRenderingContext2D, size: number, color: string) {
  drawBaseHull(ctx, size, color, 0.19, 0.43, 0.12);
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.fillRect(cx - size * 0.11, cy - size * 0.09, size * 0.22, size * 0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(cx - size * 0.085, cy - size * 0.045, size * 0.17, Math.max(1, size * 0.025));
  ctx.restore();
}

function drawSlim(ctx: CanvasRenderingContext2D, size: number, color: string) {
  drawBaseHull(ctx, size, color, 0.13, 0.46, 0.10);
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.055, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDefault(ctx: CanvasRenderingContext2D, size: number, color: string) {
  drawBaseHull(ctx, size, color, 0.16, 0.44, 0.12);
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.46)';
  ctx.fillRect(cx - size * 0.07, cy - size * 0.03, size * 0.14, size * 0.12);
  ctx.restore();
}

/**
 * Creates ImageData for MapLibre map.addImage / map.updateImage.
 * The requested size is treated as an upper-level hint; the actual sprite is
 * deliberately capped so the current zoom expression cannot produce 28px
 * vessels that blanket dense shipping areas.
 */
export function renderShipImageData(id: string, color: string, size: number = 28): RenderedShipIcon {
  const renderedSize = Math.max(
    MIN_RENDERED_SIZE,
    Math.min(MAX_RENDERED_SIZE, Math.round(size * 0.57)),
  );

  if (typeof document === 'undefined') {
    return {
      width: renderedSize,
      height: renderedSize,
      data: new Uint8Array(renderedSize * renderedSize * 4),
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = renderedSize;
  canvas.height = renderedSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return {
      width: renderedSize,
      height: renderedSize,
      data: new Uint8Array(renderedSize * renderedSize * 4),
    };
  }

  ctx.clearRect(0, 0, renderedSize, renderedSize);

  if (id === 'ship-cargo' || id === 'cargo') drawCargo(ctx, renderedSize, color);
  else if (id === 'ship-tanker' || id === 'tanker') drawTanker(ctx, renderedSize, color);
  else if (id === 'ship-passenger' || id === 'passenger') drawPassenger(ctx, renderedSize, color);
  else if (id === 'ship-military' || id === 'military') drawSlim(ctx, renderedSize, color);
  else drawDefault(ctx, renderedSize, color);

  const image = ctx.getImageData(0, 0, renderedSize, renderedSize);
  return {
    width: renderedSize,
    height: renderedSize,
    data: new Uint8Array(image.data),
  };
}
