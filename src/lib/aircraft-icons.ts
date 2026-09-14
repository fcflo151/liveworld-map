/**
 * OSIRIS — High-Fidelity Aircraft Vector Icon Generator
 * Renders crisp, vector-proportional aircraft silhouettes for WebGL symbol layers.
 * Differentiates Commercial Jetliners, Military Interceptors, and Executive Private Jets.
 */

export type AircraftIconType = 'plane-cyan' | 'plane-red' | 'plane-pink' | 'plane-green' | 'plane-grey';

export interface RenderedIcon {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Draws a commercial jetliner (swept wings, twin underwing engines, horizontal stabilizer)
 */
function drawCommercialAirliner(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Nose / Radome
  ctx.moveTo(cx, cy - size * 0.44);
  // Right nose curve
  ctx.bezierCurveTo(cx + size * 0.05, cy - size * 0.40, cx + size * 0.07, cy - size * 0.20, cx + size * 0.07, cy - size * 0.06);
  // Right wing root & leading edge swept back
  ctx.lineTo(cx + size * 0.44, cy + size * 0.08);
  // Right winglet
  ctx.lineTo(cx + size * 0.44, cy + size * 0.03);
  ctx.lineTo(cx + size * 0.46, cy + size * 0.05);
  ctx.lineTo(cx + size * 0.44, cy + size * 0.15);
  // Right wing trailing edge with engine nacelle
  ctx.lineTo(cx + size * 0.22, cy + size * 0.12);
  // Right engine pod
  ctx.lineTo(cx + size * 0.22, cy + size * 0.18);
  ctx.lineTo(cx + size * 0.18, cy + size * 0.18);
  ctx.lineTo(cx + size * 0.18, cy + size * 0.11);
  // Fuselage side
  ctx.lineTo(cx + size * 0.06, cy + size * 0.14);
  ctx.lineTo(cx + size * 0.05, cy + size * 0.32);
  // Right horizontal stabilizer
  ctx.lineTo(cx + size * 0.22, cy + size * 0.38);
  ctx.lineTo(cx + size * 0.22, cy + size * 0.42);
  ctx.lineTo(cx + size * 0.04, cy + size * 0.39);
  // Tail cone tip
  ctx.lineTo(cx, cy + size * 0.44);
  // Left horizontal stabilizer
  ctx.lineTo(cx - size * 0.04, cy + size * 0.39);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.42);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.38);
  // Left fuselage side
  ctx.lineTo(cx - size * 0.05, cy + size * 0.32);
  ctx.lineTo(cx - size * 0.06, cy + size * 0.14);
  // Left engine pod
  ctx.lineTo(cx - size * 0.18, cy + size * 0.11);
  ctx.lineTo(cx - size * 0.18, cy + size * 0.18);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.18);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.12);
  // Left wing leading edge
  ctx.lineTo(cx - size * 0.44, cy + size * 0.15);
  // Left winglet
  ctx.lineTo(cx - size * 0.46, cy + size * 0.05);
  ctx.lineTo(cx - size * 0.44, cy + size * 0.03);
  ctx.lineTo(cx - size * 0.44, cy + size * 0.08);
  ctx.lineTo(cx - size * 0.07, cy - size * 0.06);
  // Left nose curve
  ctx.bezierCurveTo(cx - size * 0.07, cy - size * 0.20, cx - size * 0.05, cy - size * 0.40, cx, cy - size * 0.44);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle cockpit windshield glint
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - size * 0.32, size * 0.035, size * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a military fighter/interceptor jet (sharp delta wings, twin vertical tails, pointed nose cone)
 */
function drawMilitaryFighter(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'miter';

  ctx.beginPath();
  // Sharp nose needle
  ctx.moveTo(cx, cy - size * 0.46);
  // Right chine / strake
  ctx.lineTo(cx + size * 0.08, cy - size * 0.15);
  // Swept delta wing leading edge
  ctx.lineTo(cx + size * 0.45, cy + size * 0.12);
  // Wingtip rail
  ctx.lineTo(cx + size * 0.45, cy + size * 0.16);
  // Wing trailing edge with elevon indent
  ctx.lineTo(cx + size * 0.16, cy + size * 0.16);
  // Right twin tail / engine nozzle
  ctx.lineTo(cx + size * 0.14, cy + size * 0.42);
  ctx.lineTo(cx + size * 0.06, cy + size * 0.42);
  // Center nozzle divider
  ctx.lineTo(cx, cy + size * 0.35);
  // Left engine nozzle
  ctx.lineTo(cx - size * 0.06, cy + size * 0.42);
  ctx.lineTo(cx - size * 0.14, cy + size * 0.42);
  // Left wing trailing edge
  ctx.lineTo(cx - size * 0.16, cy + size * 0.16);
  // Left wingtip rail
  ctx.lineTo(cx - size * 0.45, cy + size * 0.16);
  ctx.lineTo(cx - size * 0.45, cy + size * 0.12);
  // Left delta leading edge
  ctx.lineTo(cx - size * 0.08, cy - size * 0.15);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  // Fighter canopy
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - size * 0.22, size * 0.03, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an executive private jet (slender fuselage, rear-mounted twin engines, T-tail)
 */
function drawPrivateJet(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Nose
  ctx.moveTo(cx, cy - size * 0.44);
  ctx.lineTo(cx + size * 0.05, cy - size * 0.12);
  // High swept wings
  ctx.lineTo(cx + size * 0.40, cy + size * 0.08);
  ctx.lineTo(cx + size * 0.40, cy + size * 0.13);
  ctx.lineTo(cx + size * 0.06, cy + size * 0.12);
  // Rear fuselage with twin pods
  ctx.lineTo(cx + size * 0.06, cy + size * 0.22);
  ctx.lineTo(cx + size * 0.13, cy + size * 0.22);
  ctx.lineTo(cx + size * 0.13, cy + size * 0.32);
  ctx.lineTo(cx + size * 0.05, cy + size * 0.32);
  // T-tail horizontal stabilizer
  ctx.lineTo(cx + size * 0.20, cy + size * 0.40);
  ctx.lineTo(cx + size * 0.20, cy + size * 0.44);
  ctx.lineTo(cx, cy + size * 0.42);
  ctx.lineTo(cx - size * 0.20, cy + size * 0.44);
  ctx.lineTo(cx - size * 0.20, cy + size * 0.40);
  // Left rear engine pod
  ctx.lineTo(cx - size * 0.05, cy + size * 0.32);
  ctx.lineTo(cx - size * 0.13, cy + size * 0.32);
  ctx.lineTo(cx - size * 0.13, cy + size * 0.22);
  ctx.lineTo(cx - size * 0.06, cy + size * 0.22);
  // Left wing
  ctx.lineTo(cx - size * 0.06, cy + size * 0.12);
  ctx.lineTo(cx - size * 0.40, cy + size * 0.13);
  ctx.lineTo(cx - size * 0.40, cy + size * 0.08);
  ctx.lineTo(cx - size * 0.05, cy - size * 0.12);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Creates high-fidelity ImageData for MapLibre map.addImage / map.updateImage.
 */
export function renderAircraftImageData(id: string, color: string, size: number = 28): RenderedIcon {
  if (typeof document === 'undefined') {
    return { width: size, height: size, data: new Uint8Array(size * size * 4) };
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { width: size, height: size, data: new Uint8Array(size * size * 4) };
  }

  ctx.clearRect(0, 0, size, size);

  if (id === 'plane-red') {
    drawMilitaryFighter(ctx, size, color);
  } else if (id === 'plane-pink' || id === 'plane-green') {
    drawPrivateJet(ctx, size, color);
  } else {
    drawCommercialAirliner(ctx, size, color);
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  return {
    width: size,
    height: size,
    data: new Uint8Array(imgData.data),
  };
}
