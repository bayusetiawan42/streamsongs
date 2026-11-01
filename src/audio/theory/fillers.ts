import { InstrumentId } from '../../types';

/**
 * Generates an expressive 16-step melodic bridge filler
 * tailored to the musical style of the current station / instrument
 * and to the transition execution mode (drop / bridge / morph).
 * Connects the outgoing scale/voicing to the incoming target key.
 */
export function generateMelodicFiller(
  stationId: string,
  instrument: InstrumentId,
  fromRoot: number,
  toRoot: number,
  targetScale: number[],
  mode: 'drop' | 'bridge' | 'morph' = 'bridge',
  style?: string
): (number | null)[] {
  const filler: (number | null)[] = new Array(16).fill(null);

  if (mode === 'morph') {
    // Sparse drifting whole notes — the dissolve whisper line.
    // Floats from the old octave down toward the new key landing.
    filler[0] = fromRoot + 12;
    filler[4] = toRoot + targetScale[2 % targetScale.length] + 12;
    filler[8] = toRoot + targetScale[4 % targetScale.length];
    filler[12] = toRoot + 7;
    return filler;
  }

  if (mode === 'drop' && style === 'impact-silence') {
    // Silence-gap: one lone sub thud, then a void right before the drop
    filler[0] = toRoot - 12;
    return filler;
  }

  if (mode === 'drop' && style === 'phonk-stutter') {
    // Gated cowbell stutter pulse on root/fifth, exploding into a 16th climb
    [0, 2, 4, 6, 8, 10].forEach(s => { filler[s] = s % 4 === 0 ? toRoot : toRoot + 7; });
    [12, 13, 14, 15].forEach((s, i) => { filler[s] = toRoot + [0, 3, 5, 7][i]; });
    return filler;
  }

  if (mode === 'drop' && style === 'arcade-warp') {
    // Mario-pipe chromatic warp slide falling from the old key into the new one
    for (let s = 0; s < 16; s++) {
      filler[s] = fromRoot + 24 - s;
    }
    filler[15] = toRoot; // locked landing on the target root
    return filler;
  }

  if (mode === 'drop' && style === 'arcade-fanfare') {
    // Triple-fanfare "da-da-da-DAAA": motif punch then high octaves
    filler[0] = toRoot;
    filler[2] = toRoot;
    filler[4] = toRoot + 7;
    filler[6] = toRoot;
    filler[8] = toRoot + 12;
    filler[10] = toRoot + 12;
    filler[12] = toRoot + targetScale[4 % targetScale.length] + 12;
    filler[14] = toRoot + 19;
    return filler;
  }

  if (mode === 'drop' && stationId !== 'phonk' && stationId !== 'arcade') {
    // Impact stinger: accelerating 16th run into the target root, choke at the end
    for (let s = 0; s < 14; s++) {
      const oct = Math.floor(s / targetScale.length);
      filler[s] = toRoot + targetScale[s % targetScale.length] + oct * 12;
    }
    // 14-15 silence before the drop
    return filler;
  }

  if (stationId === 'sad' || instrument === 'piano') {
    // 1. Concert Piano: Poignant Pause -> Rapid Scalar Arpeggio Run -> High Landing
    // Steps 4 to 14: Ascending scalar flourish (Ludovico Einaudi / Chopin style)
    const runDegrees = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17];
    let degIdx = 0;
    for (let s = 4; s < 15; s++) {
      if (s % 1 === 0) { // Every 16th note
        const deg = runDegrees[degIdx % runDegrees.length];
        const oct = Math.floor(deg / targetScale.length);
        const noteInScale = targetScale[deg % targetScale.length];
        filler[s] = toRoot + noteInScale + oct * 12;
        degIdx++;
      }
    }
  } else if (stationId === 'phonk' || instrument === 'cowbell') {
    // 2. Drift Phonk: Aggressive Triplet Staccato Burst -> Choke Silence
    // Steps 0, 2, 4, 6, 8, 10, 11, 12: Accelerating cowbell hits
    const phonkRun = [0, 3, 5, 6, 7, 10, 12, 13];
    const hitSteps = [0, 2, 4, 6, 8, 10, 11, 12];
    hitSteps.forEach((st, idx) => {
      filler[st] = toRoot + phonkRun[idx % phonkRun.length];
    });
    // Steps 13, 14, 15 are left null for the signature pre-drop choke!
  } else if (stationId === 'interstellar' || instrument === 'organ') {
    // 3. Interstellar: Hans Zimmer Ascending Ostinato Crescendo
    // 16th-note climbing ostinato shifting from old key to new key
    const zimmerClimb = [0, 2, 4, 7, 2, 4, 7, 9, 4, 7, 9, 11, 7, 9, 11, 12];
    for (let s = 0; s < 16; s++) {
      const deg = zimmerClimb[s];
      filler[s] = toRoot + deg;
    }
  } else if (stationId === 'cosmos' || instrument === 'space' || instrument === 'pad') {
    // 4. Deep Cosmos: Floating Lydian Fifths with Spacious Decay
    // Sparse notes on steps 0, 4, 8, leaving vast silence before the drop
    filler[0] = fromRoot + 12;
    filler[4] = toRoot + 7;
    filler[8] = toRoot + 14;
    // 9-15 silence
  } else {
    // 5. Lo-Fi / Upbeat / Default: Pentatonic Blues Grace Lick
    // Steps 6 to 14: Smooth chromatic approach notes
    const lick = [0, 3, 5, 6, 7, 10, 12];
    const steps = [6, 8, 10, 11, 12, 13, 14];
    steps.forEach((st, idx) => {
      filler[st] = toRoot + lick[idx % lick.length];
    });
  }

  return filler;
}
