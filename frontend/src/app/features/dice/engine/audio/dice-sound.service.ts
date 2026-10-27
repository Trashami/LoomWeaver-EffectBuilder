import { Injectable, signal } from '@angular/core';

export interface DiceSoundProfile {
  id: string;
  name: string;
  description: string;
  materialCategory: 'stone' | 'metal' | 'glass' | 'resin' | 'wood' | 'arcane';
  baseFrequencyHz: number;
  resonanceQ: number;
  decaySeconds: number;
  harmonicRatio: number;
  customAudioUrl?: string;
}

export const DICE_SOUND_PROFILES: DiceSoundProfile[] = [
  {
    id: 'sfx-stone-rattle',
    name: 'Basalt & Runestone Clatter',
    description: 'Deep lithic impacts with slate-table scraping resonance',
    materialCategory: 'stone',
    baseFrequencyHz: 260,
    resonanceQ: 5.5,
    decaySeconds: 0.085,
    harmonicRatio: 1.42
  },
  {
    id: 'sfx-metal-clink',
    name: 'Forged Steel & Brass Ring',
    description: 'Crisp metallic strikes with high-frequency harmonic overtones',
    materialCategory: 'metal',
    baseFrequencyHz: 920,
    resonanceQ: 14.0,
    decaySeconds: 0.14,
    harmonicRatio: 2.15
  },
  {
    id: 'sfx-crystal-chime',
    name: 'Astral Glass & Prism Chime',
    description: 'Crystalline bell-like impacts with shimmering harmonic tail',
    materialCategory: 'glass',
    baseFrequencyHz: 1340,
    resonanceQ: 18.0,
    decaySeconds: 0.19,
    harmonicRatio: 2.62
  },
  {
    id: 'sfx-resin-clatter',
    name: 'Tournament Resin Bounce',
    description: 'Snappy tabletop polyhedral clatter across felt and oak',
    materialCategory: 'resin',
    baseFrequencyHz: 520,
    resonanceQ: 7.2,
    decaySeconds: 0.065,
    harmonicRatio: 1.68
  },
  {
    id: 'sfx-wood-tumble',
    name: 'Edhellain Moonwood Tumble',
    description: 'Warm, hollow hardwood knocks with organic grain resonance',
    materialCategory: 'wood',
    baseFrequencyHz: 340,
    resonanceQ: 6.4,
    decaySeconds: 0.072,
    harmonicRatio: 1.5
  },
  {
    id: 'sfx-arcane-hum',
    name: 'Aether & Void Resonance',
    description: 'Phase-shifted crystalline pulses with sub-octave hum',
    materialCategory: 'arcane',
    baseFrequencyHz: 680,
    resonanceQ: 12.5,
    decaySeconds: 0.16,
    harmonicRatio: 1.88
  }
];

export function resolveDiceSoundProfile(profileId: string | null | undefined): DiceSoundProfile {
  if (!profileId) {
    return DICE_SOUND_PROFILES[0];
  }
  return DICE_SOUND_PROFILES.find(p => p.id === profileId) ?? DICE_SOUND_PROFILES[0];
}

export function registerDiceSoundProfile(profile: DiceSoundProfile): void {
  const idx = DICE_SOUND_PROFILES.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    DICE_SOUND_PROFILES[idx] = profile;
  } else {
    DICE_SOUND_PROFILES.push(profile);
  }
}

@Injectable({ providedIn: 'root' })
export class DiceSoundService {
  readonly volume = signal<number>(0.78);
  readonly muted = signal<boolean>(false);

  private audioCtx: AudioContext | null = null;

  setVolume(val: number): void {
    this.volume.set(Math.max(0, Math.min(1, val)));
  }

  setMuted(isMuted: boolean): void {
    this.muted.set(isMuted);
  }

  playRollStartClatter(profileId: string, diceCount = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const count = Math.min(6, Math.max(1, diceCount));
    for (let i = 0; i < count + 2; i++) {
      const delayMs = i * 38 + Math.random() * 22;
      const intensity = Math.max(0.28, 0.92 - i * 0.11);
      setTimeout(() => this.playBounceImpact(profileId, intensity), delayMs);
    }
  }

  playBounceImpact(profileId: string, intensity = 0.75): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const profile = resolveDiceSoundProfile(profileId);
    const gainScale = this.volume() * Math.max(0.1, Math.min(1, intensity));
    if (gainScale <= 0.01) return;

    const now = ctx.currentTime;
    const jitter = 0.88 + Math.random() * 0.26;
    const freq = profile.baseFrequencyHz * jitter;

    // Primary resonant body oscillator
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = profile.materialCategory === 'metal' || profile.materialCategory === 'glass' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(55, freq * 0.48), now + profile.decaySeconds);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * profile.harmonicRatio, now);
    osc2.frequency.exponentialRampToValueAtTime(
      Math.max(80, freq * profile.harmonicRatio * 0.65),
      now + profile.decaySeconds * 0.85
    );

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.25, now);
    filter.Q.setValueAtTime(profile.resonanceQ, now);

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.28 * gainScale, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0008, now + profile.decaySeconds);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + profile.decaySeconds + 0.02);
    osc2.stop(now + profile.decaySeconds + 0.02);
  }

  playSettleChime(profileId: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const profile = resolveDiceSoundProfile(profileId);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(profile.baseFrequencyHz * 1.15, now);
    osc.frequency.exponentialRampToValueAtTime(profile.baseFrequencyHz * 1.45, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16 * this.volume(), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playCriticalSuccessFanfare(profileId?: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const now = ctx.currentTime;

    notes.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.055;
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume(), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.62);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.66);
    });

    if (profileId) {
      this.playSettleChime(profileId);
    }
  }

  playCriticalFailureFracture(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [155.56, 146.83, 110.0, 73.42];

    freqs.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.06;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, start);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.68, start + 0.36);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18 * this.volume(), start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.42);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  private ensureContext(): AudioContext | null {
    if (this.muted() || this.volume() <= 0.01 || typeof window === 'undefined') {
      return null;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }
}
