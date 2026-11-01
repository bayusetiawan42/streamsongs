import { getScaleNote } from './scales';

export interface ChordTemplate {
  name: string;
  degrees: number[]; // Scale degrees relative to root (e.g. 0=root, 2=3rd, 4=5th, 6=7th, 8=9th)
}

// Sophisticated chord voicings with 7ths, 9ths, and color tones
export const CHORD_TYPES: Record<string, number[]> = {
  triad: [0, 2, 4],
  seventh: [0, 2, 4, 6],
  ninth: [0, 2, 4, 6, 8],
  add9: [0, 2, 4, 8],
  sus2: [0, 1, 4],
  sus4: [0, 3, 4],
  sixth_nine: [0, 2, 4, 5, 8]
};

// Curated harmonic progressions by genre/mood
export const GENRE_PROGRESSIONS: Record<string, number[][]> = {
  lofi: [
    [1, 4, 0, 5], // ii9 - V - Imaj9 - vi
    [0, 2, 3, 4], // Imaj7 - iii7 - IVmaj7 - V
    [0, 5, 1, 4], // I - vi - ii - V
    [5, 3, 0, 4]  // vi - IV - I - V
  ],
  focus: [
    [0, 3, 4, 3], // I - IV - V - IV
    [0, 5, 3, 4], // I - vi - IV - V
    [0, 2, 5, 4], // I - iii - vi - V
    [3, 4, 0, 0]  // IV - V - I - I (modal float)
  ],
  drive: [
    [0, 5, 2, 6], // i - VI - III - VII (classic 80s synthwave)
    [0, 3, 4, 0], // i - iv - v - i
    [0, 5, 3, 4], // i - VI - iv - v
    [5, 6, 0, 2]  // VI - VII - i - III
  ],
  upbeat: [
    [0, 4, 5, 3], // I - V - vi - IV (pop gold)
    [0, 3, 4, 3], // I - IV - V - IV
    [0, 5, 3, 4], // I - vi - IV - V
    [1, 4, 0, 3]  // ii - V - I - IV
  ],
  dream: [
    [0, 3, 1, 4], // I - IV - ii - V
    [0, 1, 3, 4], // Lydian float
    [0, 5, 2, 4], // I - vi - iii - V
    [3, 0, 4, 0]  // IV - I - V - I
  ],
  arcade: [
    [0, 4, 5, 2], // I - V - vi - iii
    [3, 0, 3, 4], // IV - I - IV - V
    [0, 5, 3, 4], // i - VI - iv - V
    [0, 2, 5, 4]  // i - III - VI - V
  ],
  interstellar: [
    [0, 5, 2, 6], // i - VI - III - VII (Zimmer cinematic ascent)
    [0, 3, 5, 4], // i - iv - VI - v (soaring space crescendo)
    [5, 0, 3, 4], // VI - i - iv - v (gravitational pull)
    [0, 2, 3, 4]  // i - III - iv - v (epic modal climb)
  ],
  phonk: [
    [0, 5, 0, 1], // i - VI - i - bII (classic dark Phrygian phonk shift)
    [0, 6, 5, 6], // i - VII - VI - VII (driving Memphis drift)
    [0, 3, 5, 0], // i - iv - VI - i
    [0, 5, 6, 5]  // i - VI - VII - VI
  ],
  sad: [
    [0, 5, 2, 6], // i - VI - III - VII (Einaudi Experience & Nuvole Bianche)
    [5, 0, 2, 4], // VI - i - iii - v (tearful melancholic lift)
    [0, 3, 5, 4], // i - iv - VI - v (classic poignant lament)
    [3, 0, 4, 0]  // iv - i - V - i (heartbreaking classical resolution)
  ]
};

/**
 * Voice leading optimizer:
 * Takes the raw pitches of a new chord and inverts notes to minimize total pitch distance from previous chord.
 */
export function voiceLead(previousNotes: number[], targetDegrees: number[], scale: number[], rootNote: number): number[] {
  if (!previousNotes || previousNotes.length === 0) {
    return targetDegrees.map(d => getScaleNote(scale, rootNote, d, 0));
  }

  const rawPitches = targetDegrees.map(d => getScaleNote(scale, rootNote, d, 0));
  const avgPrev = previousNotes.reduce((a, b) => a + b, 0) / previousNotes.length;

  return rawPitches.map(p => {
    let best = p;
    let minDiff = Math.abs(best - avgPrev);
    // Test octaves -1, 0, +1
    for (const oct of [-12, 12]) {
      const candidate = p + oct;
      if (Math.abs(candidate - avgPrev) < minDiff) {
        best = candidate;
        minDiff = Math.abs(candidate - avgPrev);
      }
    }
    return best;
  }).sort((a, b) => a - b);
}
