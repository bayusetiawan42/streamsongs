export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type ScaleName =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'pentatonic_major'
  | 'pentatonic_minor'
  | 'hirajoshi'
  | 'harmonic_minor';

export const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8], // Serene traditional Japanese scale
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11] // Classical poignant / emotional minor
};

export const m2f = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export function getScaleNote(scale: number[], rootNote: number, degree: number, octaveOffset = 0): number {
  const len = scale.length;
  const oct = Math.floor(degree / len) + octaveOffset;
  const idx = ((degree % len) + len) % len;
  return rootNote + scale[idx] + oct * 12;
}
