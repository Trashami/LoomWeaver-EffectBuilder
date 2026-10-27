import {
  EffectLayer,
  parseSkyBeam,
  parseSkyLightning,
  parseSkyProjectile,
  ProjectileCoreShape,
  ProjectileElement,
} from '../effect-definition';
import { MaterialFrame } from '../arcane-motion';
import { FxPoint, seeded } from '../fireball-motion';
import { NativeField, NativeLayerFrame, NativePoint } from './native-frame';

const TAU = Math.PI * 2;
const pt = (p: FxPoint, height = 12): NativePoint => ({ ...p, height });

export function evaluateExtendedLayer(
  l: EffectLayer,
  f: MaterialFrame,
  out: NativeLayerFrame,
  from: FxPoint,
  to: FxPoint,
  scale: number,
  targets: FxPoint[],
  offset: (q: FxPoint) => FxPoint
): boolean {
  const p = f.p;
  const size = l.size * scale;
  const extent = f.extent;
  const angle = f.angle;
  const v = f.variant;

  const ribbon = (points: NativePoint[], width = size, color = l.color, taper = false) =>
    out.ribbons.push({ points, width: Math.max(0.35 * scale, width), color, taper });

  const field = (
    q: FxPoint,
    width: number,
    depth = width,
    family: NativeField['family'] = 'arcane',
    mode = 2,
    height = 10 * scale,
    rotation = 0,
    progress = p,
    vertical = false
  ) =>
    out.fields.push({
      point: pt(q, height),
      width,
      depth,
      angle: rotation,
      family,
      mode,
      progress,
      variant: v,
      vertical,
    });

  const particle = (
    q: FxPoint,
    r: number,
    alpha: number,
    tile = 1,
    height = 16 * scale,
    rotation = 0,
    stretch = 1,
    color = l.color
  ) =>
    out.particles.push({
      ...pt(q, height),
      size: Math.max(0.1, r),
      alpha: Math.max(0, alpha),
      tile,
      rotation,
      stretch,
      color,
    });

  switch (l.kind) {
    case 'sky_projectile': {
      const sp = parseSkyProjectile(l.skyProjectile, l.variant, l.color);
      const baseTarget =
        l.anchor === 'caster'
          ? offset(from)
          : l.anchor === 'path'
            ? offset({ x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 })
            : offset(to);
      const hitX = baseTarget.x + sp.hitOffsetX * scale;
      const hitY = baseTarget.y + sp.hitOffsetZ * scale;
      const hitH = (sp.hitHeight + v * 1.2) * scale;
      const skyX = hitX + (sp.skySlantX + (v - 2) * 7) * 1.8 * scale;
      const skyY = hitY + (sp.skySlantZ + (v % 2 ? 5 : -5)) * 1.8 * scale;
      const skyH = (sp.skyHeight * 2.2 + v * 12) * scale;
      const dx = hitX - skyX;
      const dy = hitY - skyY;
      const skyAngle = Math.atan2(dy, dx);
      const elemForVariant: ProjectileElement =
        l.skyProjectile?.element && v === 0
          ? sp.element
          : v === 2
            ? 'ice'
            : v === 3
              ? 'radiant'
              : v === 4
                ? 'shadow'
                : sp.element;
      const shapeForVariant: ProjectileCoreShape =
        l.skyProjectile?.shape && v === 0
          ? sp.shape
          : v === 1
            ? 'comet'
            : v === 2
              ? 'sphere'
              : v === 3
                ? 'star'
                : v === 4
                  ? 'prism'
                  : sp.shape;

      const sampleSky = (u: number): NativePoint => {
        const uClamped = Math.max(0, Math.min(1, u));
        const env = Math.sin(uClamped * Math.PI);
        const curveLat = env * (sp.arc * 0.65 + (v - 2) * 4) * scale;
        const turb =
          Math.sin(uClamped * 9 + f.clock * 5 + v) * l.motion.turbulence * 0.28 * scale * env;
        const lat = curveLat + turb;
        const x = skyX + dx * uClamped - Math.sin(skyAngle) * lat;
        const y = skyY + dy * uClamped + Math.cos(skyAngle) * lat;
        const height =
          skyH + (hitH - skyH) * (uClamped * (0.82 + 0.18 * uClamped)) + env * Math.abs(sp.arc) * 0.25 * scale;
        return pt({ x, y }, Math.max(2 * scale, height));
      };

      const t = Math.max(0, Math.min(1, (p * Math.max(0.25, l.motion.speed) * 1.15) / (1 + l.motion.drag * p)));
      const head = sampleSky(t);
      const prev = sampleSky(Math.max(0, t - 0.045));

      // Sky origin portal / cloud glow
      field(
        { x: skyX, y: skyY },
        size * (2.6 + v * 0.2),
        size * (2.6 + v * 0.2),
        elemForVariant === 'fire' ? 'fire' : 'arcane',
        4,
        skyH,
        f.clock * 1.5,
        Math.min(1, p * 2)
      );

      // Projectile head volumetric glow
      field(
        { x: head.x, y: head.y },
        size * 4.6 * sp.coronaSize,
        size * 4.6 * sp.coronaSize,
        elemForVariant === 'fire' ? 'fire' : 'arcane',
        elemForVariant === 'fire' ? 1 : 2,
        head.height,
        skyAngle,
        t
      );

      out.projectiles.push({
        head,
        prev,
        radius: Math.max(9 * scale, size * (0.85 + v * 0.06)),
        element: elemForVariant,
        shape: shapeForVariant,
        coreScale: sp.coreScale,
        coronaSize: sp.coronaSize,
        spinSpeed: sp.spinSpeed + v * 0.2,
        orbitCount: sp.orbitCount,
        clock: f.clock + v * 0.3,
        progress: t,
        color: l.color,
        secondaryColor: l.secondaryColor,
      });

      const wakeLen = (0.14 + l.motion.trail * 0.26) * sp.wakeLength;
      const coils = Math.max(1, Math.min(5, sp.wakeRibbons));
      for (let c = 0; c < coils; c++) {
        const coilPhase = (c * TAU) / coils + v * 0.5;
        const pts = Array.from({ length: 26 }, (_, j) => {
          const frac = j / 25;
          const u = Math.max(0, t - (1 - frac) * wakeLen);
          const centerPt = sampleSky(u);
          if (c === 0) return centerPt;
          const helixR = (1 - frac) * Math.max(3 * scale, size * (0.34 + v * 0.04));
          const theta = frac * (10 + v) + f.clock * sp.spinSpeed * 4 + coilPhase;
          return {
            x: centerPt.x - Math.sin(skyAngle) * Math.cos(theta) * helixR,
            y: centerPt.y + Math.cos(skyAngle) * Math.cos(theta) * helixR,
            height: centerPt.height + Math.sin(theta) * helixR,
          };
        });
        ribbon(pts, size * (c === 0 ? 0.78 : 0.38), c % 2 === 0 ? l.color : l.secondaryColor, true);
      }

      const pCount = Math.max(10, Math.min(48, l.count));
      for (let k = 0; k < pCount; k++) {
        const seedA = seeded(k + v * 31, l.motion.seed);
        const seedB = seeded(k + 173 + v * 19, l.motion.seed);
        const age = ((f.clock * 2.1 + seedA) % 1) * Math.min(1, t * 2);
        const trailPt = sampleSky(Math.max(0, t - age * wakeLen * 1.15));
        const theta = seedA * TAU + f.clock * 3;
        const spreadR = (0.2 + age * (0.9 + seedB * 0.8)) * Math.max(3 * scale, size * 0.45);
        particle(
          {
            x: trailPt.x + Math.cos(theta) * spreadR,
            y: trailPt.y + Math.sin(theta) * spreadR,
          },
          (1.6 + seedB * 2.6 + v * 0.2) * scale * sp.coreScale,
          (1 - age) ** 1.5 * 0.85,
          elemForVariant === 'ice' ? 5 : 2,
          trailPt.height + Math.sin(theta * 2) * spreadR * 0.5,
          skyAngle,
          1.8,
          k % 2 === 0 ? l.secondaryColor : l.color
        );
      }

      if (t >= 0.72) {
        const impProg = (t - 0.72) / 0.28;
        field(
          { x: hitX, y: hitY },
          size * (3.5 + impProg * 4.5),
          size * (3.5 + impProg * 4.5),
          elemForVariant === 'fire' ? 'fire' : 'arcane',
          2,
          hitH,
          f.clock * 2,
          impProg
        );
      }
      return true;
    }

    case 'sky_beam': {
      const sb = parseSkyBeam(l.skyBeam);
      const baseTarget =
        l.anchor === 'caster'
          ? offset(from)
          : l.anchor === 'path'
            ? offset({ x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 })
            : offset(to);
      const hitX = baseTarget.x + sb.hitOffsetX * scale;
      const hitY = baseTarget.y + sb.hitOffsetZ * scale;
      const hitH = sb.hitHeight * scale;
      const skyX = hitX + (sb.skySlantX + (v - 2) * 3.5) * 1.8 * scale;
      const skyY = hitY + sb.skySlantZ * 1.8 * scale;
      const skyH = (sb.skyHeight * 2.2 + v * 10) * scale;
      const descent = Math.min(1, p * 3.4 * Math.max(0.25, l.motion.speed));
      const steps = 42;
      const beamPts: NativePoint[] = [];
      const waveAmp = (sb.waveAmp + l.motion.turbulence * 0.25 + (v === 1 ? 3 : 0)) * scale;
      const waveFreq = sb.waveFreq + v;

      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * descent;
        const env = Math.sin((i / steps) * Math.PI);
        const wX = waveAmp > 0 ? Math.sin(u * waveFreq * TAU - f.clock * 10) * waveAmp * env : 0;
        const wY = waveAmp > 0 ? Math.cos(u * waveFreq * TAU - f.clock * 10) * waveAmp * 0.6 * env : 0;
        beamPts.push(
          pt(
            {
              x: skyX + (hitX - skyX) * u + wX,
              y: skyY + (hitY - skyY) * u + wY,
            },
            skyH + (hitH - skyH) * u
          )
        );
      }

      const haloW = Math.max(2 * scale, sb.haloWidth * scale * (0.9 + v * 0.08));
      const coreW = Math.max(1.2 * scale, sb.coreWidth * scale * (0.9 + v * 0.05));
      ribbon(beamPts, haloW, l.color, sb.taper !== 0);
      ribbon(beamPts, coreW, l.secondaryColor, sb.taper > 0.2);

      // Sky aperture halo ring at the top of the beam
      if (sb.skyAperture > 0) {
        const apR = sb.skyAperture * scale * (0.85 + v * 0.08);
        const apPts = Array.from({ length: 37 }, (_, i) => {
          const a = (i / 36) * TAU + f.clock * 1.2;
          return pt({ x: skyX + Math.cos(a) * apR, y: skyY + Math.sin(a) * apR }, skyH);
        });
        ribbon(apPts, Math.max(1.4 * scale, coreW * 0.22), l.secondaryColor);
        field({ x: skyX, y: skyY }, apR * 2.4, apR * 2.4, 'arcane', 4, skyH, f.clock);
      }

      // Descending pulse rings along the heavenly shaft
      const ringCount = 2 + (v % 3);
      for (let r = 0; r < ringCount; r++) {
        const uRing = ((f.clock * 1.35 + r / ringCount) % 1) * descent;
        const cx = skyX + (hitX - skyX) * uRing;
        const cy = skyY + (hitY - skyY) * uRing;
        const ch = skyH + (hitH - skyH) * uRing;
        const rRad = haloW * (0.65 + 0.35 * uRing);
        const ringPts = Array.from({ length: 25 }, (_, i) => {
          const a = (i / 24) * TAU;
          return pt({ x: cx + Math.cos(a) * rRad, y: cy + Math.sin(a) * rRad }, ch);
        });
        ribbon(ringPts, Math.max(1 * scale, coreW * 0.18), r % 2 ? l.color : l.secondaryColor);
      }

      // Target ground impact flare & vertical column glow
      if (descent > 0.25 && sb.impactFlare > 0) {
        const flareR = sb.impactFlare * scale * (0.8 + 0.3 * Math.sin(p * Math.PI) + v * 0.08);
        field(
          { x: hitX, y: hitY },
          flareR * 2.6,
          flareR * 2.6,
          v === 1 ? 'fire' : 'arcane',
          v === 4 ? 4 : 3,
          hitH + 2 * scale,
          f.clock * 1.6,
          descent
        );
        const crownPts = Array.from({ length: 33 }, (_, i) => {
          const a = (i / 32) * TAU - f.clock * 1.5;
          return pt({ x: hitX + Math.cos(a) * flareR, y: hitY + Math.sin(a) * flareR }, hitH + 3 * scale);
        });
        ribbon(crownPts, Math.max(1.4 * scale, coreW * 0.24), l.secondaryColor);
      }

      const motes = Math.min(48, Math.max(12, l.count));
      for (let i = 0; i < motes; i++) {
        const sA = seeded(i + v * 23, l.motion.seed);
        const sB = seeded(i + 109 + v * 17, l.motion.seed);
        const uM = ((f.clock * 0.9 + sA) % 1) * descent;
        const a = sB * TAU + f.clock * 2;
        const rad = (0.3 + sA * 0.9) * haloW * 0.85;
        particle(
          {
            x: skyX + (hitX - skyX) * uM + Math.cos(a) * rad,
            y: skyY + (hitY - skyY) * uM + Math.sin(a) * rad,
          },
          (1.6 + sB * 2.4 + v * 0.25) * scale,
          Math.sin(uM * Math.PI) * 0.9,
          2,
          skyH + (hitH - skyH) * uM,
          a,
          2.1,
          i % 2 ? l.secondaryColor : l.color
        );
      }
      return true;
    }

    case 'sky_lightning': {
      const sl = parseSkyLightning(l.skyLightning);
      const baseTarget =
        l.anchor === 'caster'
          ? offset(from)
          : l.anchor === 'path'
            ? offset({ x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 })
            : offset(to);
      const hitX = baseTarget.x + sl.hitOffsetX * scale;
      const hitY = baseTarget.y + sl.hitOffsetZ * scale;
      const hitH = sl.hitHeight * scale;
      const skyX = hitX + (sl.skySlantX + (v - 2) * 5) * 1.8 * scale;
      const skyY = hitY + sl.skySlantZ * 1.8 * scale;
      const skyH = (sl.skyHeight * 2.2 + v * 9) * scale;

      const boltReach = Math.min(1, p * 4.5 * Math.max(0.25, l.motion.speed));
      const flickerTick = Math.floor(f.clock * Math.max(1, sl.flickerRate));
      const arcs = Math.max(1, Math.min(8, sl.arcCount + (v === 1 ? 1 : 0)));
      const segs = Math.max(12, Math.min(80, sl.complexity));
      const jagAmp = (sl.jaggedness * 0.58 + v * 3.5) * scale;
      const glowW = Math.max(1.8 * scale, sl.glowWidth * scale * (0.9 + v * 0.06));
      const coreW = Math.max(0.9 * scale, sl.coreWidth * scale);
      const glowCol = v === 3 ? '#ffd978' : v === 4 ? '#b784ff' : sl.glowColor || l.color;
      const coreCol = sl.coreColor || l.secondaryColor;
      const emitCol = sl.emitterColor || glowCol;

      let primaryBoltPts: NativePoint[] = [];

      for (let aIdx = 0; aIdx < arcs; aIdx++) {
        const pts: NativePoint[] = [];
        const arcSpread = aIdx === 0 ? 0 : (aIdx % 2 ? 1 : -1) * Math.ceil(aIdx / 2) * 9 * scale;
        for (let i = 0; i <= segs; i++) {
          const u = (i / segs) * boltReach;
          const env = Math.sin((i / segs) * Math.PI);
          const coarseBucket = Math.floor((i / segs) * 6);
          const coarseFrac = (i / segs) * 6 - coarseBucket;
          const c0 = seeded(coarseBucket * 37 + aIdx * 113 + flickerTick * 71, l.motion.seed) - 0.5;
          const c1 = seeded((coarseBucket + 1) * 37 + aIdx * 113 + flickerTick * 71, l.motion.seed) - 0.5;
          const coarseX = (c0 + (c1 - c0) * coarseFrac) * jagAmp * 1.35;
          const coarseY =
            (seeded(coarseBucket * 53 + aIdx * 149 + flickerTick * 89, l.motion.seed) - 0.5) * jagAmp * 0.95;
          const fineX = (seeded(i * 19 + aIdx * 211 + flickerTick * 131, l.motion.seed) - 0.5) * jagAmp * 0.55;
          const fineY = (seeded(i * 29 + aIdx * 263 + flickerTick * 167, l.motion.seed) - 0.5) * jagAmp * 0.45;
          const jx = (coarseX + fineX + arcSpread) * env;
          const jy = (coarseY + fineY) * env;
          pts.push(
            pt(
              {
                x: skyX + (hitX - skyX) * u + jx,
                y: skyY + (hitY - skyY) * u + jy,
              },
              skyH + (hitH - skyH) * u
            )
          );
        }
        if (aIdx === 0) primaryBoltPts = pts;
        ribbon(pts, glowW * (aIdx === 0 ? 1 : 0.72), glowCol);
        ribbon(pts, coreW * (aIdx === 0 ? 1 : 0.72), coreCol);
      }

      // Branching lightning forks splitting off along the bolt
      const forks = Math.max(0, Math.min(24, sl.forkCount + (v === 1 ? 3 : 0)));
      const spreadRad = (sl.forkSpread * Math.PI) / 180;
      for (let fk = 0; fk < forks; fk++) {
        if (primaryBoltPts.length < 4) break;
        const uIdx = Math.min(
          primaryBoltPts.length - 2,
          Math.max(1, Math.floor((0.12 + 0.76 * seeded(fk * 41 + 7, l.motion.seed)) * (primaryBoltPts.length - 1)))
        );
        const root = primaryBoltPts[uIdx];
        const sideSign = fk % 2 === 0 ? 1 : -1;
        const baseAzimuth =
          sideSign * (0.35 + seeded(fk * 59 + flickerTick * 23, l.motion.seed) * spreadRad) + fk * 0.9;
        const reachDist = (35 + sl.skyHeight * 0.55) * sl.forkLength * scale * (0.65 + 0.5 * seeded(fk * 83, l.motion.seed));
        const forkSteps = 7;
        const fPts: NativePoint[] = [root];
        for (let s = 1; s <= forkSteps; s++) {
          const fu = s / forkSteps;
          const fJag =
            (seeded(fk * 97 + s * 31 + flickerTick * 61, l.motion.seed) - 0.5) * jagAmp * 0.48 * fu;
          const fx = root.x + Math.cos(baseAzimuth) * reachDist * fu - Math.sin(baseAzimuth) * fJag;
          const fy = root.y + Math.sin(baseAzimuth) * reachDist * fu + Math.cos(baseAzimuth) * fJag;
          const fh = Math.max(hitH, root.height - reachDist * 0.65 * fu);
          fPts.push(pt({ x: fx, y: fy }, fh));
        }
        ribbon(fPts, glowW * 0.46, glowCol, true);
        ribbon(fPts, coreW * 0.48, coreCol, true);
      }

      // Sky cloud flash & target strike shock field
      field({ x: skyX, y: skyY }, glowW * 3.4, glowW * 3.4, 'arcane', 2, skyH, f.clock * 4);
      if (boltReach > 0.5) {
        field(
          { x: hitX, y: hitY },
          glowW * (3.8 + v * 0.35),
          glowW * (3.8 + v * 0.35),
          'arcane',
          2 + (v % 3),
          hitH + 4 * scale,
          f.clock * 6,
          boltReach
        );
      }

      // Outer electrical spark emitter along bolt & impact
      const eCount = Math.max(0, Math.min(60, sl.emitterCount));
      const eSpread = sl.emitterSpread * scale;
      for (let k = 0; k < eCount; k++) {
        const sA = seeded(k * 37 + flickerTick * 17, l.motion.seed);
        const sB = seeded(k * 73 + 19, l.motion.seed);
        const anchorPt =
          primaryBoltPts[Math.min(primaryBoltPts.length - 1, Math.floor(sA * primaryBoltPts.length))] ??
          pt({ x: hitX, y: hitY }, hitH);
        const ang = sB * TAU + f.clock * 8;
        const rad = (0.2 + seeded(k * 101 + flickerTick, l.motion.seed) * 0.95) * eSpread;
        particle(
          {
            x: anchorPt.x + Math.cos(ang) * rad,
            y: anchorPt.y + Math.sin(ang) * rad,
          },
          (1.5 + (k % 3) * 1.1 + v * 0.2) * scale,
          0.55 + 0.4 * sB,
          2,
          anchorPt.height + (sA - 0.5) * eSpread * 0.7,
          ang,
          2.6,
          k % 3 === 0 ? coreCol : emitCol
        );
      }
      return true;
    }

    case 'chain_lightning': {
      const chainNodes: FxPoint[] = [
        offset(from),
        offset(targets[0] ?? to),
        offset(targets[1] ?? { x: to.x - 45 * scale, y: to.y - 55 * scale }),
        offset(targets[2] ?? { x: to.x + 35 * scale, y: to.y + 55 * scale }),
      ];
      const legCount = 3;
      for (let leg = 0; leg < legCount; leg++) {
        const legStart = leg * 0.22;
        const legProg = Math.max(0, Math.min(1, (p - legStart) / (1 - legStart * 0.8)));
        if (legProg <= 0) continue;
        const a = chainNodes[leg];
        const b = chainNodes[leg + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const dir = Math.atan2(dy, dx);
        const strands = v === 2 ? 2 : v === 3 ? 3 : 1;
        for (let s = 0; s < strands; s++) {
          const pts: NativePoint[] = [];
          const steps = 28;
          for (let i = 0; i <= steps; i++) {
            const u = (i / steps) * legProg;
            const jitter =
              (seeded(i + leg * 41 + s * 97 + Math.floor(f.clock * 16) * 53, l.motion.seed) - 0.5) *
              (12 + v * 5) *
              scale *
              Math.sin((i / steps) * Math.PI);
            pts.push(
              pt(
                {
                  x: a.x + Math.cos(dir) * dist * u - Math.sin(dir) * jitter,
                  y: a.y + Math.sin(dir) * dist * u + Math.cos(dir) * jitter,
                },
                (20 + (v === 1 ? 8 : 0) + Math.sin(u * Math.PI) * (6 + v * 3)) * scale
              )
            );
          }
          ribbon(pts, Math.max(1.2 * scale, size * (0.32 + s * 0.12)), s === 0 ? l.color : l.secondaryColor);
        }
        field(b, (28 + v * 6) * scale, (28 + v * 6) * scale, 'arcane', 2 + (v % 3), 18 * scale, f.clock, legProg);
        for (let k = 0; k < 6 + v * 2; k++) {
          const ang = k * 2.399 + leg + v * 0.4;
          const rad = legProg * (10 + seeded(k + leg * 19, l.motion.seed) * (18 + v * 4)) * scale;
          particle(
            { x: b.x + Math.cos(ang) * rad, y: b.y + Math.sin(ang) * rad },
            (1.6 + v * 0.25) * scale,
            (1 - legProg * 0.6) * 0.85,
            2,
            (16 + k) * scale,
            ang,
            2.2,
            l.secondaryColor
          );
        }
      }
      return true;
    }

    case 'shield': {
      const rings = 3 + (v % 3);
      const isWall = v === 1;
      for (let r = 0; r < rings; r++) {
        const elev = (r / Math.max(1, rings - 1)) * extent * 0.85;
        const rad = isWall ? extent * (0.9 - r * 0.12) : Math.sqrt(Math.max(0.08, 1 - (r / rings) ** 2)) * extent;
        const segs = v === 0 ? 6 : v === 2 ? 8 : 40;
        const span = isWall ? Math.PI * 0.85 : TAU;
        const startA = isWall ? angle - span / 2 : f.clock * 0.35 * (r % 2 ? -1 : 1) + v * 0.3;
        const pts = Array.from({ length: segs + 1 }, (_, i) => {
          const a = startA + (i / segs) * span;
          return pt({ x: f.anchor.x + Math.cos(a) * rad, y: f.anchor.y + Math.sin(a) * rad }, 6 * scale + elev);
        });
        ribbon(pts, Math.max(1.2 * scale, size * (0.04 + v * 0.005)), r % 2 ? l.secondaryColor : l.color);
      }
      field(f.anchor, extent * (2.1 + v * 0.12), extent * (2.1 + v * 0.12), 'barrier', v, 22 * scale, angle, p, isWall);
      return true;
    }

    case 'ground': {
      const fam = v === 0 ? 'fire' : 'arcane';
      field(f.anchor, extent * (2.6 + v * 0.15), extent * (2.6 + v * 0.15), fam, v % 5, (2 + v * 0.5) * scale, f.clock * 0.15);
      const spokes = 4 + v * 2;
      for (let s = 0; s < spokes; s++) {
        const baseA = (s / spokes) * TAU + v * 0.25;
        const pts = Array.from({ length: 14 }, (_, i) => {
          const u = i / 13;
          const r = u * extent * (0.85 + 0.15 * Math.sin(s + v));
          const w = Math.sin(u * (6 + v * 2) + f.clock * 2) * (4 + v * 2) * scale;
          return pt(
            { x: f.anchor.x + Math.cos(baseA) * r - Math.sin(baseA) * w, y: f.anchor.y + Math.sin(baseA) * r + Math.cos(baseA) * w },
            (1.5 + v * 0.4) * scale
          );
        });
        ribbon(pts, Math.max(1.1 * scale, size * 0.03), s % 2 ? l.secondaryColor : l.color, true);
      }
      for (let i = 0; i < 24 + v * 3; i++) {
        const a = seeded(i, l.motion.seed) * TAU;
        const d = Math.sqrt(seeded(i + 71, l.motion.seed)) * extent * 0.9;
        const age = (f.clock * 0.45 + seeded(i + 19, l.motion.seed)) % 1;
        particle(
          { x: f.anchor.x + Math.cos(a) * d, y: f.anchor.y + Math.sin(a) * d },
          (3 + v + age * 8) * scale,
          Math.sin(age * Math.PI) * 0.55,
          v === 0 ? 4 : v === 1 ? 5 : 0,
          (3 + age * (14 + v * 4)) * scale,
          a,
          1,
          i % 3 === 0 ? l.secondaryColor : l.color
        );
      }
      return true;
    }

    case 'emitter': {
      const count = Math.min(90, Math.max(16, l.count + v * 4));
      for (let i = 0; i < count; i++) {
        const sx = seeded(i + 13, l.motion.seed);
        const sy = seeded(i + 97, l.motion.seed);
        const phase = (f.clock * (0.7 + v * 0.15) * Math.max(0.2, l.motion.speed) + seeded(i + 211, l.motion.seed)) % 1;
        const fall = v <= 2 ? 1 - phase : phase;
        const drift = Math.sin(phase * TAU + i) * (6 + v * 4) * scale;
        const q = {
          x: f.anchor.x + (sx - 0.5) * extent * 2.2 + drift,
          y: f.anchor.y + (sy - 0.5) * extent * 2.2,
        };
        const h = (4 + fall * (65 + v * 6)) * scale;
        const stretch = v === 0 ? 4.2 : v === 2 ? 1.8 : 1.1;
        particle(q, (1.8 + v * 0.45) * scale, Math.sin(phase * Math.PI) * 0.85, v === 1 ? 5 : 1, h, v === 0 ? -0.25 : phase * TAU, stretch, i % 2 ? l.color : l.secondaryColor);
      }
      field(f.anchor, extent * (1.8 + v * 0.1), extent * (1.8 + v * 0.1), 'arcane', 4, 4 * scale, f.clock * 0.2);
      return true;
    }

    case 'vortex': {
      const arms = 3 + (v % 3);
      for (let arm = 0; arm < arms; arm++) {
        const pts = Array.from({ length: 48 }, (_, i) => {
          const u = i / 47;
          const turns = 2.4 + v * 0.45;
          const a = u * TAU * turns + f.clock * (2.2 + v * 0.3) * (v === 3 ? -1 : 1) + (arm * TAU) / arms;
          const rad = extent * (v === 3 ? (1 - u * 0.82) : (0.18 + u * (0.85 + v * 0.06)));
          return pt({ x: f.anchor.x + Math.cos(a) * rad, y: f.anchor.y + Math.sin(a) * rad }, (4 + u * (54 + v * 8)) * scale);
        });
        ribbon(pts, Math.max(1.2 * scale, size * (0.035 + v * 0.004)), arm % 2 ? l.secondaryColor : l.color, true);
      }
      field(f.anchor, extent * (2.2 + v * 0.12), extent * (2.2 + v * 0.12), v === 1 ? 'fire' : 'arcane', 2 + (v % 3), 14 * scale, f.clock);
      return true;
    }

    case 'portal': {
      const openScale = Math.min(1, p * 4, (1 - p) * 4 + 0.15);
      const rx = extent * (0.65 + v * 0.06) * openScale;
      const ry = extent * (1.05 + v * 0.08) * openScale;
      const rimPts = Array.from({ length: 56 }, (_, i) => {
        const a = (i / 55) * TAU + v * 0.2;
        return pt(
          {
            x: f.anchor.x + Math.cos(angle) * Math.cos(a) * rx,
            y: f.anchor.y + Math.sin(angle) * Math.cos(a) * rx,
          },
          (34 + Math.sin(a) * ry * 0.85) * scale
        );
      });
      ribbon(rimPts, Math.max(1.8 * scale, size * (0.055 + v * 0.006)), l.color);
      field(f.anchor, rx * 2.2, ry * 2.1, v === 3 ? 'fire' : 'arcane', v % 5, 34 * scale, angle, p, true);
      for (let i = 0; i < 20 + v * 3; i++) {
        const a = (i / (20 + v * 3)) * TAU + f.clock * (1.5 + v * 0.2);
        particle(
          { x: f.anchor.x + Math.cos(angle) * Math.cos(a) * rx, y: f.anchor.y + Math.sin(angle) * Math.cos(a) * rx },
          (2.2 + v * 0.3) * scale,
          0.85,
          2,
          (34 + Math.sin(a) * ry * 0.85) * scale,
          a,
          2,
          l.secondaryColor
        );
      }
      return true;
    }

    case 'orbit': {
      const satCount = 3 + v;
      for (let s = 0; s < satCount; s++) {
        const baseA = f.clock * (2.4 + v * 0.25) * Math.max(0.25, l.motion.speed) + (s * TAU) / satCount;
        const rad = extent * (0.72 + (s % 2) * 0.14);
        const h = (22 + Math.sin(baseA * 2 + s) * (8 + v * 2)) * scale;
        const head = { x: f.anchor.x + Math.cos(baseA) * rad, y: f.anchor.y + Math.sin(baseA) * rad };
        const tailPts = Array.from({ length: 16 }, (_, i) => {
          const a = baseA - (i / 15) * (0.65 + v * 0.08);
          return pt({ x: f.anchor.x + Math.cos(a) * rad, y: f.anchor.y + Math.sin(a) * rad }, h);
        }).reverse();
        ribbon(tailPts, Math.max(1.4 * scale, size * (0.045 + v * 0.005)), s % 2 ? l.secondaryColor : l.color, true);
        particle(head, (4.5 + v * 0.6) * scale, 0.95, 2, h, baseA, v === 0 ? 3.2 : 1.4, l.secondaryColor);
      }
      field(f.anchor, extent * 1.6, extent * 1.6, 'arcane', v % 5, 10 * scale, f.clock);
      return true;
    }

    case 'slash': {
      const slashes = v === 1 ? 2 : 1;
      for (let s = 0; s < slashes; s++) {
        const sweepSpan = v === 3 ? TAU * 0.92 : v === 4 ? 0.35 : Math.PI * (0.78 + v * 0.08);
        const dirSign = s % 2 ? -1 : 1;
        const pts = Array.from({ length: 36 }, (_, i) => {
          const u = (i / 35) * Math.min(1, p * 1.6);
          const a = angle + (u - 0.5) * sweepSpan * dirSign;
          const reach = v === 4 ? extent * (0.3 + u * 1.4) : extent * (0.85 + Math.sin(u * Math.PI) * (0.25 + v * 0.05));
          const h = v === 2 ? (12 + Math.sin(u * Math.PI) * 42) * scale : (22 + (s - 0.5) * 8) * scale;
          return pt({ x: f.anchor.x + Math.cos(a) * reach, y: f.anchor.y + Math.sin(a) * reach }, h);
        });
        ribbon(pts, Math.max(2.2 * scale, size * (0.09 + v * 0.01)), s ? l.secondaryColor : l.color, true);
      }
      field(f.anchor, extent * (1.8 + v * 0.1), extent * (1.8 + v * 0.1), 'arcane', 3, 20 * scale, angle);
      return true;
    }

    case 'symbol': {
      const hoverH = (44 + v * 4 + Math.sin(f.clock * 3) * 4) * scale;
      const sides = 3 + v;
      const polyPts = Array.from({ length: sides + 1 }, (_, i) => {
        const a = ((i * (v === 1 ? 2 : 1)) / sides) * TAU + f.clock * 0.6;
        const r = extent * (0.55 + v * 0.04);
        return pt({ x: f.anchor.x + Math.cos(a) * r, y: f.anchor.y + Math.sin(a) * r }, hoverH);
      });
      ribbon(polyPts, Math.max(1.5 * scale, size * 0.035), l.color);
      const outerPts = Array.from({ length: 40 }, (_, i) => {
        const a = (i / 39) * TAU - f.clock * 0.4;
        const r = extent * (0.72 + v * 0.04);
        return pt({ x: f.anchor.x + Math.cos(a) * r, y: f.anchor.y + Math.sin(a) * r }, hoverH);
      });
      ribbon(outerPts, Math.max(1.2 * scale, size * 0.025), l.secondaryColor);
      field(f.anchor, extent * (1.5 + v * 0.1), extent * (1.5 + v * 0.1), 'arcane', v % 5, hoverH, f.clock);
      return true;
    }

    case 'eruption': {
      const spikes = 5 + v * 2;
      const rise = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      for (let s = 0; s < spikes; s++) {
        const a = (s / spikes) * TAU + v * 0.3;
        const dist = extent * (0.22 + seeded(s + v * 17, l.motion.seed) * 0.68);
        const base = { x: f.anchor.x + Math.cos(a) * dist, y: f.anchor.y + Math.sin(a) * dist };
        const tip = {
          x: base.x + Math.cos(a) * (8 + v * 3) * scale * rise,
          y: base.y + Math.sin(a) * (8 + v * 3) * scale * rise,
        };
        const spikeH = (26 + seeded(s + 31, l.motion.seed) * 28 + v * 5) * scale * rise;
        ribbon([pt(base, 1 * scale), pt(tip, spikeH)], Math.max(2.2 * scale, size * (0.065 + v * 0.006)), s % 2 ? l.secondaryColor : l.color, true);
        particle(tip, (3 + v * 0.5) * scale, rise * 0.9, v === 2 ? 4 : v === 3 ? 5 : 2, spikeH, a, 1.8, l.secondaryColor);
      }
      field(f.anchor, extent * (2.3 + v * 0.1), extent * (2.3 + v * 0.1), v === 2 ? 'fire' : 'arcane', v % 5, 4 * scale, f.clock * 0.1);
      return true;
    }

    case 'distortion': {
      const waves = 3 + (v % 3);
      for (let w = 0; w < waves; w++) {
        const phase = (p + w / waves) % 1;
        const rad = extent * (0.25 + phase * (0.95 + v * 0.08));
        const pts = Array.from({ length: 48 }, (_, i) => {
          const a = (i / 47) * TAU;
          const warp = Math.sin(a * (3 + v) + f.clock * 5) * (4 + v * 2) * scale;
          return pt({ x: f.anchor.x + Math.cos(a) * (rad + warp), y: f.anchor.y + Math.sin(a) * (rad + warp) }, (14 + w * 6) * scale);
        });
        ribbon(pts, Math.max(1.1 * scale, size * (0.028 + v * 0.004)), w % 2 ? l.secondaryColor : l.color);
      }
      field(f.anchor, extent * (2.5 + v * 0.15), extent * (2.5 + v * 0.15), 'arcane', v % 5, 18 * scale, f.clock * 0.6);
      return true;
    }

    case 'trail': {
      if (v <= 2) {
        const headU = Math.min(1, p * 1.25);
        const sample = (u: number): FxPoint => {
          const arc = Math.sin(u * Math.PI) * (l.spread * 0.65 + v * 8) * scale;
          return offset({
            x: from.x + (to.x - from.x) * u - Math.sin(angle) * arc,
            y: from.y + (to.y - from.y) * u + Math.cos(angle) * arc,
          });
        };
        const trailPts = Array.from({ length: 32 }, (_, i) => {
          const u = Math.max(0, headU - ((31 - i) / 31) * (0.28 + v * 0.05));
          return pt(sample(u), (22 + Math.sin(u * Math.PI) * 18) * scale);
        });
        ribbon(trailPts, Math.max(1.5 * scale, size * (0.55 + v * 0.1)), l.color, true);
        const head = sample(headU);
        if (v === 2) {
          const spin = f.clock * 18;
          const bladeLen = Math.max(8 * scale, size * 1.1);
          ribbon(
            [
              pt({ x: head.x - Math.cos(spin) * bladeLen, y: head.y - Math.sin(spin) * bladeLen }, 24 * scale),
              pt({ x: head.x + Math.cos(spin) * bladeLen, y: head.y + Math.sin(spin) * bladeLen }, 24 * scale),
            ],
            Math.max(2.2 * scale, size * 0.35),
            l.secondaryColor,
            true
          );
        }
        field(head, (24 + v * 6) * scale, (24 + v * 6) * scale, 'arcane', 2, 22 * scale, f.clock * 8);
      } else {
        const fragCount = 18 + v * 4;
        for (let i = 0; i < fragCount; i++) {
          const a = seeded(i, l.motion.seed) * TAU;
          const speed = 0.35 + seeded(i + 41, l.motion.seed) * 0.95;
          const dist = p * extent * (1.2 + v * 0.15) * speed;
          const h = Math.max(2, Math.sin(p * Math.PI) * (34 + (i % 5) * 6) * scale);
          const pos = { x: f.anchor.x + Math.cos(a) * dist, y: f.anchor.y + Math.sin(a) * dist };
          particle(pos, (2.6 + (i % 3) * 1.2 + v * 0.3) * scale, (1 - p * 0.75) * 0.95, v === 4 ? 5 : 2, h, a + f.clock * 9, 1.6, i % 2 ? l.color : l.secondaryColor);
        }
        field(f.anchor, extent * (1.6 + v * 0.1), extent * (1.6 + v * 0.1), 'arcane', v % 5, 8 * scale);
      }
      return true;
    }

    case 'sound': {
      const rings = 3 + (v % 3);
      for (let r = 0; r < rings; r++) {
        const phase = (p * (1.2 + v * 0.15) + r / rings) % 1;
        const rad = extent * (0.2 + phase * (1.05 + v * 0.08));
        const pts = Array.from({ length: 44 }, (_, i) => {
          const a = (i / 43) * TAU;
          const amp = Math.sin(a * (6 + v * 2) + f.clock * 12) * (2.5 + v * 1.2) * scale * (1 - phase);
          return pt({ x: f.anchor.x + Math.cos(a) * (rad + amp), y: f.anchor.y + Math.sin(a) * (rad + amp) }, (14 + r * 3) * scale);
        });
        ribbon(pts, Math.max(1.1 * scale, size * (0.025 + v * 0.004)), r % 2 ? l.secondaryColor : l.color);
      }
      field(f.anchor, extent * (1.8 + v * 0.12), extent * (1.8 + v * 0.12), 'arcane', v % 5, 14 * scale, f.clock);
      return true;
    }

    default:
      return false;
  }
}
