import { MapSceneGraphState } from '../map-scene-contract';

export interface Real2dRenderOptions {
  readonly hideGmSecrets: boolean;
  readonly selectedNodeId?: string;
  readonly gridStepWorld?: number;
  readonly gridMode?: string;
  readonly ghostX?: number;
  readonly ghostZ?: number;
  readonly ghostLabel?: string;
  readonly wallStartAnchor?: { x: number; z: number } | null;
  readonly celestialMode?: 'sun' | 'moon';
  readonly celestialAzimuthDeg?: number;
  readonly celestialAltitudeDeg?: number;
}

export class Real2dMapRenderer {
  static renderSceneToCanvas(
    canvas: HTMLCanvasElement,
    state: MapSceneGraphState,
    options: Real2dRenderOptions,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = canvas.width || 960;
    const height = canvas.height || 600;
    const scale = Math.min(width, height) / 30;
    const cx = width / 2;
    const cy = height / 2;

    const toScreenX = (wx: number): number => cx + wx * scale;
    const toScreenY = (wz: number): number => cy - wz * scale;

    // 1. Background bump/height terrain base with Sun/Moon directional tint
    const isMoon = options.celestialMode === 'moon';
    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.65);
    grad.addColorStop(0, isMoon ? '#0e1d2a' : '#162d21');
    grad.addColorStop(0.65, isMoon ? '#08121b' : '#0b1912');
    grad.addColorStop(1, '#040a07');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Compute Sun/Moon shadow projection offset in 2D
    const azRad = ((options.celestialAzimuthDeg ?? 135) * Math.PI) / 180;
    const altRad = (Math.max(10, options.celestialAltitudeDeg ?? 42) * Math.PI) / 180;
    const shadowLenPx = Math.min(28, (1 / Math.tan(altRad)) * 11);
    const shadowDx = -Math.cos(azRad) * shadowLenPx;
    const shadowDy = Math.sin(azRad) * shadowLenPx;

    // 2. Tactical floor grid (5 ft, 10 ft, Hex, or Off)
    const mode = options.gridMode ?? '5 ft';
    if (mode !== 'Off') {
      ctx.strokeStyle = 'rgba(73, 232, 146, 0.14)';
      ctx.lineWidth = 1;
      if (mode === 'Hex') {
        const hexR = 0.92;
        const hexW = Math.sqrt(3) * hexR;
        const rowH = 1.5 * hexR;
        let rowIdx = 0;
        for (let gz = -12; gz <= 12; gz += rowH) {
          const offsetX = rowIdx % 2 === 1 ? hexW / 2 : 0;
          for (let gx = -16 + offsetX; gx <= 16; gx += hexW) {
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
              const a = ((60 * i - 30) * Math.PI) / 180;
              const sx = toScreenX(gx + Math.cos(a) * hexR);
              const sy = toScreenY(gz + Math.sin(a) * hexR);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
          rowIdx++;
        }
      } else {
        const gridStep = mode === '10 ft' ? 3.0 : (options.gridStepWorld ?? 1.5);
        for (let gx = -16; gx <= 16; gx += gridStep) {
          const sx = toScreenX(gx);
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, height);
          ctx.stroke();
        }
        for (let gz = -12; gz <= 12; gz += gridStep) {
          const sy = toScreenY(gz);
          ctx.beginPath();
          ctx.moveTo(0, sy);
          ctx.lineTo(width, sy);
          ctx.stroke();
        }
      }
    }

    // 3. Water splines
    for (const water of state.waterSplines) {
      if (water.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = water.colorHex || '#1b6d82';
      ctx.lineWidth = Math.max(6, water.width * scale * 0.65);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      water.points.forEach((pt, idx) => {
        const sx = toScreenX(pt[0]);
        const sy = toScreenY(pt[2]);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 4. Cutaway rooms, dungeon walls, and directional Sun/Moon shadows
    for (const wall of state.walls ?? []) {
      if (wall.points.length < 2) continue;
      const isSelected = options.selectedNodeId === wall.id;

      // Cast directional shadow
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = Math.max(5, wall.thicknessMeters * scale * 1.15);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      wall.points.forEach((pt, idx) => {
        const sx = toScreenX(pt[0]) + shadowDx;
        const sy = toScreenY(pt[1]) + shadowDy;
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      if (wall.drawMode !== 'line') ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(26, 36, 32, 0.58)';
      ctx.strokeStyle = isSelected ? '#49e892' : '#96a69d';
      ctx.lineWidth = Math.max(4, wall.thicknessMeters * scale * 0.95);
      ctx.lineJoin = 'round';

      ctx.beginPath();
      wall.points.forEach((pt, idx) => {
        const sx = toScreenX(pt[0]);
        const sy = toScreenY(pt[1]);
        if (idx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      if (wall.drawMode !== 'line') {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();

      for (const pt of wall.points) {
        const sx = toScreenX(pt[0]);
        const sy = toScreenY(pt[1]);
        ctx.fillStyle = isSelected ? '#49e892' : '#d9b77a';
        ctx.fillRect(sx - 3.5, sy - 3.5, 7, 7);
      }
      ctx.restore();
    }

    // 5. Dynamic Torch & Light Halos
    for (const light of state.lights) {
      const sx = toScreenX(light.x);
      const sy = toScreenY(light.z);
      const radiusPx = Math.max(24, light.range * scale * 0.35);
      const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, radiusPx);
      halo.addColorStop(0, 'rgba(255, 198, 109, 0.38)');
      halo.addColorStop(0.5, 'rgba(255, 152, 68, 0.14)');
      halo.addColorStop(1, 'rgba(255, 152, 68, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Props, Bump Stamps & Tokens + directional shadows
    for (const st of state.stamps) {
      if (options.hideGmSecrets && st.label.toLowerCase().includes('secret')) {
        continue;
      }
      const sx = toScreenX(st.x);
      const sy = toScreenY(st.z);
      const r = Math.max(7, 8 * st.scale);
      const isSelected = options.selectedNodeId === st.id;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.arc(sx + shadowDx * 0.65, sy + shadowDy * 0.65, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = st.colorHex || '#49e892';
      ctx.strokeStyle = isSelected ? '#49e892' : '#06140e';
      ctx.lineWidth = isSelected ? 3 : 1.5;

      ctx.beginPath();
      if (st.category === 'Token') {
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
      } else {
        ctx.roundRect(sx - r, sy - r, r * 2, r * 2, 4);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e9f8ef';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.label.slice(0, 18), sx, sy - r - 5);
      ctx.restore();
    }

    // 7. Ghost Asset / Wall Line Preview at Mouse Cursor
    if (options.ghostX !== undefined && options.ghostZ !== undefined) {
      const gx = toScreenX(options.ghostX);
      const gy = toScreenY(options.ghostZ);

      ctx.save();
      if (options.wallStartAnchor) {
        const ax = toScreenX(options.wallStartAnchor.x);
        const ay = toScreenY(options.wallStartAnchor.z);
        ctx.strokeStyle = 'rgba(73, 232, 146, 0.85)';
        ctx.lineWidth = 6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(gx, gy);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(46, 230, 107, 0.32)';
      ctx.strokeStyle = '#49e892';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gx - 12, gy - 12, 24, 24, 5);
      ctx.fill();
      ctx.stroke();

      if (options.ghostLabel) {
        ctx.fillStyle = '#49e892';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Ghost: ${options.ghostLabel.slice(0, 20)}`, gx, gy - 16);
      }
      ctx.restore();
    }
  }

  static screenToWorld(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
  ): { x: number; z: number } {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const py = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const scale = Math.min(canvas.width, canvas.height) / 30;
    const wx = (px - canvas.width / 2) / scale;
    const wz = (canvas.height / 2 - py) / scale;
    return {
      x: Math.round(wx * 10) / 10,
      z: Math.round(wz * 10) / 10,
    };
  }
}
