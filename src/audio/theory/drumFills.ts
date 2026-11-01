export interface DrumFillHit {
  kick: boolean;
  kickVol: number;
  snare: boolean;
  snareVol: number;
  hihat: boolean;
  hihatVol: number;
  isChoke: boolean; // Pre-drop micro silence
}

/**
 * Generates an authentic rhythmic drum fill / riser for the bridge transition bar.
 * Accelerates subdivisions (1/8 -> 1/16 -> rapid roll) with velocity crescendo,
 * chokes on steps 14-15, and readies the downbeat impact.
 */
export function getDrumFillStep(
  drLevel: number,
  stepInBridge: number,
  stationId: string
): DrumFillHit {
  const isAmbient = drLevel === 0 || ['sad', 'cosmos', 'focus', 'dream'].includes(stationId);

  // 1. Ambient stations: No loud drum rolls, preserves meditation & emotional intimacy
  if (isAmbient) {
    return {
      kick: false,
      kickVol: 0,
      snare: false,
      snareVol: 0,
      hihat: false,
      hihatVol: 0,
      isChoke: stepInBridge >= 14
    };
  }

  // 2. Beat stations (Phonk, Night Drive, Lo-Fi, Arcade, Upbeat):
  // Steps 14 & 15: The signature Pre-Drop Choke (sudden micro-vacuum silence)
  if (stepInBridge >= 14) {
    return {
      kick: false,
      kickVol: 0,
      snare: false,
      snareVol: 0,
      hihat: false,
      hihatVol: 0,
      isChoke: true
    };
  }

  // Steps 0 to 7: Initial syncopated pickup
  if (stepInBridge < 8) {
    const isSnare = stepInBridge === 4 || stepInBridge === 6;
    const isKick = stepInBridge === 0 || stepInBridge === 3;
    return {
      kick: isKick,
      kickVol: 0.75,
      snare: isSnare,
      snareVol: isSnare ? 0.45 : 0,
      hihat: stepInBridge % 2 === 0,
      hihatVol: 0.4,
      isChoke: false
    };
  }

  // Steps 8 to 13: The Riser Crescendo (Rapid 16th Snare Roll accelerating in volume)
  // Step 8: vol 0.5 -> Step 13: vol 0.95
  const progress = (stepInBridge - 8) / 5; // 0 to 1
  const crescendoVol = 0.5 + progress * 0.45;

  return {
    kick: stepInBridge === 8 || stepInBridge === 10,
    kickVol: 0.8,
    snare: true, // Snare hits every 16th note from 8 to 13!
    snareVol: crescendoVol,
    hihat: true,
    hihatVol: 0.5 + progress * 0.3,
    isChoke: false
  };
}
