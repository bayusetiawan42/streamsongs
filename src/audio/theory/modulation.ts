import { ScaleName, SCALES } from './scales';
import { voiceLead } from './chords';

export interface ModulationPath {
  type: 'pivot' | 'dominant' | 'chromatic';
  bridgeVoicing: number[];
  bridgeBass: number[];
  targetRoot: number;
  targetPc: number;
  targetScn: ScaleName;
  fifthsDistance: number;
}

/**
 * Calculates the Circle of Fifths distance between two pitch classes (0 to 6)
 */
export function getFifthsDistance(pcA: number, pcB: number): number {
  const posA = (pcA * 7) % 12;
  const posB = (pcB * 7) % 12;
  const diff = Math.abs(posA - posB);
  return Math.min(diff, 12 - diff);
}

/**
 * Generates an authentic harmonic modulation pathway between two musical keys.
 * Uses pivot chords for close keys, secondary dominants for medium keys,
 * and chromatic approach chords for distant keys.
 */
export function planModulation(
  fromRoot: number,
  fromPc: number,
  fromScn: ScaleName | string,
  toRoot: number,
  toPc: number,
  toScn: ScaleName | string,
  lastVoicing: number[]
): ModulationPath {
  const fromScale = SCALES[fromScn as ScaleName] || SCALES.minor;
  const targetScn = (SCALES[toScn as ScaleName] ? toScn : 'minor') as ScaleName;
  const targetScale = SCALES[targetScn];
  const distance = getFifthsDistance(fromPc, toPc);

  let type: 'pivot' | 'dominant' | 'chromatic';
  let bridgeRawPitches: number[];
  let bridgeBass: number[];

  if (distance <= 2) {
    // 1. Close Keys (<= 2 fifths): Common Pivot Chord
    // e.g. C major -> A minor uses a shared common chord
    type = 'pivot';
    const sharedDegree = fromScale.find(deg => targetScale.includes((deg + fromRoot - toRoot + 120) % 12)) ?? 0;
    const pivotRoot = fromRoot + sharedDegree;
    bridgeRawPitches = [pivotRoot, pivotRoot + 3, pivotRoot + 7, pivotRoot + 10]; // minor 7th
    bridgeBass = [pivotRoot - 24, (toRoot + 7) - 24]; // Pivot -> Dominant in bass
  } else if (distance <= 4) {
    // 2. Medium Distance (3-4 fifths): Secondary Dominant Cadence
    // Plays the V7 of the target key (Target + 7 semitones)
    type = 'dominant';
    const domRoot = (toRoot + 7);
    // Dominant 7th chord: Root, Maj3, 5th, Min7, plus color 9th
    bridgeRawPitches = [domRoot, domRoot + 4, domRoot + 7, domRoot + 10, domRoot + 14];
    bridgeBass = [domRoot - 24, domRoot - 24];
  } else {
    // 3. Distant Keys (>= 5 fifths, e.g. Tritone or Chromatic Mediant)
    // Chromatic half-step approach chord (Tristan chord / Neapolitan approach)
    type = 'chromatic';
    const approachRoot = toRoot - 1; // 1 semitone below target root
    // Half-diminished or suspended tension chord that slides into target
    bridgeRawPitches = [approachRoot, approachRoot + 4, approachRoot + 7, approachRoot + 11];
    bridgeBass = [approachRoot - 24, toRoot - 1 - 24]; // Chromatic walk-up
  }

  // Voice lead bridge voicing smoothly from previous chord
  const bridgeVoicing = voiceLead(lastVoicing, [0, 2, 4, 6], targetScale, bridgeRawPitches[0]);

  return {
    type,
    bridgeVoicing,
    bridgeBass,
    targetRoot: toRoot,
    targetPc: toPc,
    targetScn,
    fifthsDistance: distance
  };
}

/**
 * Multi-bar pivot chord chain for slow morph transitions.
 * Walks the circle of fifths from the outgoing key toward the target one
 * intermediate chord per bar, voice-led through shared tones, and finishes
 * with the authentic single-bar approach chord (pivot / dominant / chromatic).
 */
export function planModulationChain(
  fromRoot: number,
  fromPc: number,
  fromScn: ScaleName | string,
  toRoot: number,
  toPc: number,
  toScn: ScaleName | string,
  startVoicing: number[],
  bars: number
): ModulationPath[] {
  const fromScale = SCALES[fromScn as ScaleName] || SCALES.minor;
  const targetScn = (SCALES[toScn as ScaleName] ? toScn : 'minor') as ScaleName;
  const toScale = SCALES[targetScn];

  const posA = (fromPc * 7) % 12;
  const posB = (toPc * 7) % 12;
  let diff = posB - posA;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  const chain: ModulationPath[] = [];
  let prevVoicing = startVoicing;
  let prevRoot = fromRoot;
  let prevPc = fromPc;
  let prevScn: ScaleName = fromScn as ScaleName;

  for (let i = 0; i < bars; i++) {
    if (i === bars - 1) {
      chain.push(planModulation(prevRoot, prevPc, prevScn, toRoot, toPc, targetScn, prevVoicing));
      break;
    }

    const t = (i + 1) / bars;
    const stepPos = ((posA + diff * t) % 12 + 12) % 12;
    // Invert the fifths mapping (7 is its own inverse mod 12) to get the pitch class
    const pc = Math.round(stepPos) * 7 % 12;
    const root = 48 + pc;
    const useTarget = t > 0.5;
    const scale = useTarget ? toScale : fromScale;
    const scn = useTarget ? targetScn : prevScn;

    const bridgeVoicing = voiceLead(prevVoicing, [0, 2, 4, 6], scale, root);
    chain.push({
      type: 'pivot',
      bridgeVoicing,
      bridgeBass: [root - 24, root - 24],
      targetRoot: root,
      targetPc: pc,
      targetScn: scn,
      fifthsDistance: getFifthsDistance(fromPc, pc)
    });

    prevVoicing = bridgeVoicing;
    prevRoot = root;
    prevPc = pc;
    prevScn = scn;
  }

  return chain;
}
