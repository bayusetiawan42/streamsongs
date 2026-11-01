import { TransitionStyle } from './strategy';

/**
 * Morph sequencing shapes: the outgoing key dissolves into the incoming one
 * over 4-8 bars via ghost-note infiltration, a stepped bass chord journey
 * (provided by the modulation pivot chain) and eased microscopic BPM drift.
 */

/** Smoothstep easing for the metric BPM micro-drift (0.3-1.5 BPM/bar feel). */
export function morphEase(progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}

/**
 * Ghost note infiltration probability: how likely an outgoing-key melody
 * note gets re-tuned into the target key. Rises per morph bar (ease-in).
 */
export function ghostProbability(progress: number, style: TransitionStyle): number {
  const p = morphEase(progress);
  if (style === 'cosmos-drift' || style === 'focus-drift') return p * 0.95;
  if (style === 'sad-rubato') return p * 0.7;
  return p * 0.85;
}

/** Probability a melody note is dropped entirely (dissolve sparseness). */
export function morphDropout(progress: number, style: TransitionStyle): number {
  const p = morphEase(progress);
  if (style === 'sad-rubato') return p * 0.38;
  if (style === 'dream-dissolve' || style === 'cosmos-drift') return p * 0.3;
  if (style === 'lofi-smear') return p * 0.15;
  return p * 0.2;
}

/** Velocity envelope across the morph — every style lands softly. */
export function morphVelocity(progress: number, style: TransitionStyle): number {
  const p = morphEase(progress);
  if (style === 'sad-rubato') return 1 - 0.45 * p;
  if (style === 'lofi-smear') return 0.85 + 0.15 * Math.sin(p * Math.PI);
  return 1 - 0.25 * p;
}

/** Filter cutoff multiplier (cosmos/focus drift the pad darker as they morph). */
export function morphCutoffScale(progress: number, style: TransitionStyle): number {
  if (style === 'cosmos-drift') return 1 - 0.55 * morphEase(progress);
  if (style === 'focus-drift') return 1 - 0.35 * morphEase(progress);
  if (style === 'dream-dissolve') return 1 - 0.25 * morphEase(progress);
  return 1;
}

/** Tape-fling timing jitter in seconds, lofi only — the signature smear. */
export function morphTimingJitter(progress: number, style: TransitionStyle, stepDur: number): number {
  if (style !== 'lofi-smear') return 0;
  return (Math.random() - 0.5) * 0.12 * stepDur * morphEase(progress);
}

/** Extra reverb send multiplier toward the landing (dissolve wetness). */
export function morphWetScale(progress: number, style: TransitionStyle): number {
  const p = morphEase(progress);
  if (style === 'dream-dissolve') return 1 + 0.6 * p;
  if (style === 'sad-rubato') return 1 + 0.5 * p;
  if (style === 'cosmos-drift') return 1 + 0.4 * p;
  return 1;
}

/**
 * Re-tunes an outgoing-key MIDI note to the nearest pitch class that belongs
 * to the incoming key/scale, preserving octave register. This is the ghost
 * infiltration primitive: morphed notes are always legal in the new key,
 * so the landing reveals a harmony that has already arrived.
 */
export function morphNoteToKey(midi: number, targetRootMidi: number, targetScale: number[]): number {
  const base = Math.floor((midi - targetRootMidi) / 12) * 12 + targetRootMidi;
  let best = base;
  let minDist = Infinity;
  for (const oct of [-12, 0, 12]) {
    for (const deg of targetScale) {
      const cand = base + oct + deg;
      const d = Math.abs(cand - midi);
      if (d < minDist) {
        minDist = d;
        best = cand;
      }
    }
  }
  return best;
}
