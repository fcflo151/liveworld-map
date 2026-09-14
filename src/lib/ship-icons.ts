/**
 * OSIRIS — High-Fidelity Maritime Vector Icon Generator
 * Renders crisp, vector-proportional vessel silhouettes for WebGL symbol layers.
 * Differentiates Cargo/Container Ships, Tankers, Military Warships, Passenger/Cruise Liners, and General Vessels.
 */

export type ShipIconType = 'ship-cargo' | 'ship-tanker' | 'ship-military' | 'ship-passenger' | 'ship-default';

export interface RenderedShipIcon {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Draws a Container / Cargo Ship
 * Broad beam, container bay cell grid, aft wheelhouse/bridge with wings, and exhaust funnel.
 */
function drawCargoShip(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  // 1. Hull Silhouette
  ctx.beginPath();
  // Bow (pointing North / Top)
  ctx.moveTo(cx, cy - size * 0.44);
  // Starboard (Right) bow curve & parallel body
  ctx.bezierCurveTo(cx + size * 0.08, cy - size * 0.40, cx + size * 0.16, cy - size * 0.26, cx + size * 0.16, cy - size * 0.16);
  ctx.lineTo(cx + size * 0.16, cy + size * 0.34);
  // Starboard stern quarter
  ctx.quadraticCurveTo(cx + size * 0.16, cy + size * 0.42, cx + size * 0.11, cy + size * 0.42);
  // Transom stern
  ctx.lineTo(cx - size * 0.11, cy + size * 0.42);
  // Port (Left) stern quarter
  ctx.quadraticCurveTo(cx - size * 0.16, cy + size * 0.42, cx - size * 0.16, cy + size * 0.34);
  // Port parallel body & bow curve
  ctx.lineTo(cx - size * 0.16, cy - size * 0.16);
  ctx.bezierCurveTo(cx - size * 0.16, cy - size * 0.26, cx - size * 0.08, cy - size * 0.40, cx, cy - size * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Forecastle breakwater line
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.11, cy - size * 0.24);
  ctx.lineTo(cx, cy - size * 0.28);
  ctx.lineTo(cx + size * 0.11, cy - size * 0.24);
  ctx.stroke();

  // 3. Container Bays (grid of container stacks)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  const bayX = cx - size * 0.12;
  const bayW = size * 0.24;
  const bayY = cy - size * 0.21;
  const bayH = size * 0.42;
  ctx.fillRect(bayX, bayY, bayW, bayH);

  // Container stack dividers
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = Math.max(0.75, size * 0.025);
  ctx.beginPath();
  // Center longitudinal divider
  ctx.moveTo(cx, bayY);
  ctx.lineTo(cx, bayY + bayH);
  // Transverse bay dividers
  const rows = 4;
  for (let i = 1; i < rows; i++) {
    const y = bayY + (bayH / rows) * i;
    ctx.moveTo(bayX + size * 0.01, y);
    ctx.lineTo(bayX + bayW - size * 0.01, y);
  }
  ctx.stroke();

  // 4. Aft Superstructure (Bridge & Wings)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  const bridgeW = size * 0.28;
  const bridgeH = size * 0.07;
  const bridgeY = cy + size * 0.23;
  ctx.fillRect(cx - bridgeW / 2, bridgeY, bridgeW, bridgeH);

  // Bridge windows stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(cx - bridgeW / 2 + size * 0.02, bridgeY + size * 0.015, bridgeW - size * 0.04, size * 0.02);

  // 5. Funnel (exhaust stack) behind bridge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.34, size * 0.04, size * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an Oil / Chemical / LNG Tanker
 * Long, wide-beam hull, prominent catwalk line, tank expansion domes, and aft accommodation.
 */
function drawTankerShip(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  // 1. Broad Tanker Hull
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.43);
  // Blunt, rounded bow
  ctx.bezierCurveTo(cx + size * 0.12, cy - size * 0.43, cx + size * 0.18, cy - size * 0.32, cx + size * 0.18, cy - size * 0.20);
  ctx.lineTo(cx + size * 0.18, cy + size * 0.32);
  ctx.quadraticCurveTo(cx + size * 0.18, cy + size * 0.42, cx + size * 0.10, cy + size * 0.42);
  ctx.lineTo(cx - size * 0.10, cy + size * 0.42);
  ctx.quadraticCurveTo(cx - size * 0.18, cy + size * 0.42, cx - size * 0.18, cy + size * 0.32);
  ctx.lineTo(cx - size * 0.18, cy - size * 0.20);
  ctx.bezierCurveTo(cx - size * 0.18, cy - size * 0.32, cx - size * 0.12, cy - size * 0.43, cx, cy - size * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Centerline Catwalk / Pipe Rack
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.26);
  ctx.lineTo(cx, cy + size * 0.24);
  ctx.stroke();

  // 3. Midship Cargo Manifold
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.16, cy - size * 0.01);
  ctx.lineTo(cx + size * 0.16, cy - size * 0.01);
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.stroke();

  // 4. Circular Tank Hatches / Expansion Domes
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(0.75, size * 0.02);
  const tankOffsets = [-0.17, 0.11];
  tankOffsets.forEach(yOffset => {
    [-0.09, 0.09].forEach(xOffset => {
      ctx.beginPath();
      ctx.arc(cx + size * xOffset, cy + size * yOffset, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });

  // 5. Aft Accommodation & Bridge House
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  const houseW = size * 0.26;
  const houseH = size * 0.08;
  const houseY = cy + size * 0.25;
  ctx.fillRect(cx - houseW / 2, houseY, houseW, houseH);

  // Twin Funnels (common on large tankers)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.arc(cx - size * 0.06, cy + size * 0.36, size * 0.022, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.06, cy + size * 0.36, size * 0.022, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a Military Combatant (Destroyer / Frigate / Cruiser)
 * Sleek knife bow, forward main gun turret & barrel, faceted stealth superstructure, and aft helipad with 'H'.
 */
function drawMilitaryShip(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'miter';

  // 1. Sleek Warship Hull (High length-to-beam ratio)
  ctx.beginPath();
  // Sharp knife-edge bow tip
  ctx.moveTo(cx, cy - size * 0.46);
  ctx.lineTo(cx + size * 0.06, cy - size * 0.28);
  ctx.lineTo(cx + size * 0.12, cy - size * 0.06);
  ctx.lineTo(cx + size * 0.10, cy + size * 0.35);
  ctx.lineTo(cx + size * 0.08, cy + size * 0.43);
  // Squared transom stern
  ctx.lineTo(cx - size * 0.08, cy + size * 0.43);
  ctx.lineTo(cx - size * 0.10, cy + size * 0.35);
  ctx.lineTo(cx - size * 0.12, cy - size * 0.06);
  ctx.lineTo(cx - size * 0.06, cy - size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Forward Naval Gun Turret & Barrel
  const turretY = cy - size * 0.22;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.arc(cx, turretY, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // Gun barrel pointing forward
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = Math.max(1.2, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx, turretY);
  ctx.lineTo(cx, turretY - size * 0.11);
  ctx.stroke();

  // 3. Forward VLS (Vertical Launch System) Missile Deck
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(cx - size * 0.05, cy - size * 0.14, size * 0.10, size * 0.04);

  // 4. Faceted Stealth Superstructure & Integrated Mast
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.08);
  ctx.lineTo(cx + size * 0.09, cy - size * 0.03);
  ctx.lineTo(cx + size * 0.08, cy + size * 0.12);
  ctx.lineTo(cx, cy + size * 0.15);
  ctx.lineTo(cx - size * 0.08, cy + size * 0.12);
  ctx.lineTo(cx - size * 0.09, cy - size * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Main Phased Array / Radar Mast Core
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.02, size * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // 5. Aft Helipad Flight Deck (with distinctive 'H')
  const heliY = cy + size * 0.29;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = Math.max(0.8, size * 0.025);
  ctx.beginPath();
  ctx.arc(cx, heliY, size * 0.07, 0, Math.PI * 2);
  ctx.stroke();

  // Helipad 'H'
  ctx.font = `bold ${Math.round(size * 0.15)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillText('H', cx, heliY);

  ctx.restore();
}

/**
 * Draws a Passenger Cruise Ship / Ferry
 * Stepped multi-deck tiers, panoramic bridge wings, lido pool deck, and winged funnel.
 */
function drawPassengerShip(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  // 1. Sleek Cruise Liner Hull
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.44);
  // Elegant rake bow
  ctx.bezierCurveTo(cx + size * 0.10, cy - size * 0.40, cx + size * 0.17, cy - size * 0.22, cx + size * 0.17, cy - size * 0.10);
  ctx.lineTo(cx + size * 0.17, cy + size * 0.30);
  // Stepped rounded cruiser stern
  ctx.quadraticCurveTo(cx + size * 0.16, cy + size * 0.42, cx, cy + size * 0.43);
  ctx.quadraticCurveTo(cx - size * 0.16, cy + size * 0.42, cx - size * 0.17, cy + size * 0.30);
  ctx.lineTo(cx - size * 0.17, cy - size * 0.10);
  ctx.bezierCurveTo(cx - size * 0.17, cy - size * 0.22, cx - size * 0.10, cy - size * 0.40, cx, cy - size * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Swept Bridge Wings
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.18, cy - size * 0.16);
  ctx.lineTo(cx - size * 0.08, cy - size * 0.22);
  ctx.lineTo(cx + size * 0.08, cy - size * 0.22);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.16);
  ctx.lineTo(cx + size * 0.14, cy - size * 0.12);
  ctx.lineTo(cx - size * 0.14, cy - size * 0.12);
  ctx.closePath();
  ctx.fill();

  // 3. Lido / Pool Deck Area
  ctx.fillStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.fillRect(cx - size * 0.06, cy - size * 0.03, size * 0.12, size * 0.07);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = Math.max(0.75, size * 0.02);
  ctx.strokeRect(cx - size * 0.06, cy - size * 0.03, size * 0.12, size * 0.07);

  // 4. Iconic Winged Funnel
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  const funnelY = cy + size * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.10, funnelY - size * 0.02);
  ctx.lineTo(cx + size * 0.10, funnelY - size * 0.02);
  ctx.lineTo(cx + size * 0.06, funnelY + size * 0.04);
  ctx.lineTo(cx - size * 0.06, funnelY + size * 0.04);
  ctx.closePath();
  ctx.fill();

  // 5. Tiered Aft Balcony Deck Terraces
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(0.75, size * 0.025);
  ctx.beginPath();
  [0.26, 0.32, 0.37].forEach(y => {
    ctx.moveTo(cx - size * 0.12, cy + size * y);
    ctx.lineTo(cx + size * 0.12, cy + size * y);
  });
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a General / Utility Vessel (Fishing, Tug, Utility, Yacht)
 * Classic tapered boat hull, prominent wheelhouse cabin, and working deck.
 */
function drawDefaultShip(ctx: CanvasRenderingContext2D, size: number, color: string) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.lineJoin = 'round';

  // 1. Classic Boat Hull
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.44);
  ctx.bezierCurveTo(cx + size * 0.10, cy - size * 0.38, cx + size * 0.16, cy - size * 0.18, cx + size * 0.16, cy + size * 0.12);
  ctx.lineTo(cx + size * 0.14, cy + size * 0.36);
  ctx.quadraticCurveTo(cx + size * 0.12, cy + size * 0.42, cx, cy + size * 0.42);
  ctx.quadraticCurveTo(cx - size * 0.12, cy + size * 0.42, cx - size * 0.14, cy + size * 0.36);
  ctx.lineTo(cx - size * 0.16, cy + size * 0.12);
  ctx.bezierCurveTo(cx - size * 0.16, cy - size * 0.18, cx - size * 0.10, cy - size * 0.38, cx, cy - size * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Wheelhouse Cabin (Midships)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  const cabinW = size * 0.20;
  const cabinH = size * 0.22;
  const cabinY = cy - size * 0.12;
  ctx.beginPath();
  ctx.roundRect(cx - cabinW / 2, cabinY, cabinW, cabinH, size * 0.03);
  ctx.fill();

  // Windshield / Windows
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(cx - cabinW / 2 + size * 0.02, cabinY + size * 0.02, cabinW - size * 0.04, size * 0.035);

  // Mast on cabin roof
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.beginPath();
  ctx.arc(cx, cabinY + size * 0.11, size * 0.025, 0, Math.PI * 2);
  ctx.fill();

  // Aft Working Deck
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = Math.max(0.75, size * 0.025);
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.25, size * 0.06, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Creates high-fidelity ImageData for MapLibre map.addImage / map.updateImage.
 */
export function renderShipImageData(id: string, color: string, size: number = 28): RenderedShipIcon {
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

  if (id === 'ship-military' || id === 'military') {
    drawMilitaryShip(ctx, size, color);
  } else if (id === 'ship-tanker' || id === 'tanker') {
    drawTankerShip(ctx, size, color);
  } else if (id === 'ship-passenger' || id === 'passenger') {
    drawPassengerShip(ctx, size, color);
  } else if (id === 'ship-cargo' || id === 'cargo') {
    drawCargoShip(ctx, size, color);
  } else {
    drawDefaultShip(ctx, size, color);
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  return {
    width: size,
    height: size,
    data: new Uint8Array(imgData.data),
  };
}
