import { Track, Station, PeriodName, WeatherCategory, InstrumentId } from '../../types';
import { SCALES, NOTE_NAMES, ScaleName } from './scales';
import { GENRE_PROGRESSIONS, CHORD_TYPES, voiceLead } from './chords';

export const STATIONS: Station[] = [
  {
    id: 'auto',
    name: 'Sync Radio',
    icon: 'fa-clock',
    desc: 'Harmonizes with local time & real-time sky',
    auto: true,
    h: 180,
    preferredInstrument: 'auto'
  },
  {
    id: 'lofi',
    name: 'Lo-fi Chill',
    icon: 'fa-mug-hot',
    desc: 'Dusty Rhodes, vinyl warmth & cozy beats',
    h: 30,
    sc: ['dorian', 'minor', 'mixolydian'],
    bpm: [68, 84],
    w: ['sine', 'triangle'],
    dr: 1,
    den: 0.45,
    cut: 1100,
    wet: 1.1,
    swing: 0.24,
    preferredInstrument: 'rhodes',
    a: ['Dusty', 'Cozy', 'Velvet', 'Warm', 'Tape', 'Sleepy', 'Midnight', 'Quiet', 'Golden'],
    b: ['Notes', 'Cassette', 'Desk', 'Window', 'Coffee', 'Pages', 'Loft', 'Memories', 'Breeze']
  },
  {
    id: 'focus',
    name: 'Deep Focus',
    icon: 'fa-brain',
    desc: 'Lush ambient pads & pure meditative flow',
    h: 200,
    sc: ['dorian', 'lydian', 'major'],
    bpm: [56, 70],
    w: ['sine'],
    dr: 0,
    den: 0.2,
    cut: 750,
    wet: 1.6,
    preferredInstrument: 'pad',
    a: ['Steady', 'Clear', 'Inner', 'Quiet', 'Still', 'Flowing', 'Lucid', 'Deep', 'Pure'],
    b: ['Mind', 'State', 'Loop', 'Field', 'Depth', 'Thread', 'Horizon', 'Presence', 'Sphere']
  },
  {
    id: 'drive',
    name: 'Night Drive',
    icon: 'fa-car-side',
    desc: 'Neon synths, pumping bass & city lights',
    h: 290,
    sc: ['minor', 'phrygian', 'dorian'],
    bpm: [98, 116],
    w: ['sawtooth', 'square'],
    dr: 2,
    den: 0.65,
    cut: 1900,
    wet: 0.85,
    pulse: 1,
    preferredInstrument: 'synthwave',
    a: ['Neon', 'Midnight', 'Chrome', 'Electric', 'Velvet', 'Cyber', 'Dark', 'Endless'],
    b: ['Highway', 'Tunnel', 'Skyline', 'Overpass', 'Taillights', 'Boulevard', 'Circuit', 'Run']
  },
  {
    id: 'upbeat',
    name: 'Sunny Upbeat',
    icon: 'fa-face-smile-beam',
    desc: 'Sparkling kalimba, acoustic warmth & good vibes',
    h: 50,
    sc: ['major', 'mixolydian', 'lydian'],
    bpm: [110, 126],
    w: ['triangle', 'square'],
    dr: 2,
    den: 0.65,
    cut: 2100,
    wet: 0.75,
    preferredInstrument: 'pluck',
    a: ['Happy', 'Golden', 'Bouncy', 'Sparkling', 'Fresh', 'Sunny', 'Radiant', 'Joyful'],
    b: ['Vibes', 'Morning', 'Parade', 'Sunshine', 'Groove', 'Daybreak', 'Meadow', 'Horizon']
  },
  {
    id: 'dream',
    name: 'Dreamscape',
    icon: 'fa-wand-magic-sparkles',
    desc: 'Ethereal flutes, crystal harp & floating reverb',
    h: 260,
    sc: ['lydian', 'major', 'hirajoshi'],
    bpm: [60, 78],
    w: ['sine', 'triangle'],
    dr: 0,
    den: 0.32,
    cut: 1200,
    wet: 1.9,
    preferredInstrument: 'flute',
    a: ['Floating', 'Silver', 'Distant', 'Opal', 'Weightless', 'Glass', 'Celestial', 'Astral'],
    b: ['Clouds', 'Garden', 'Aurora', 'Tides', 'Horizon', 'Mirage', 'Echoes', 'Whisper']
  },
  {
    id: 'arcade',
    name: '8-Bit Arcade',
    icon: 'fa-gamepad',
    desc: 'Chiptune arpeggios & retro gaming nostalgia',
    h: 140,
    sc: ['major', 'mixolydian', 'minor'],
    bpm: [120, 140],
    w: ['square'],
    dr: 2,
    den: 0.75,
    cut: 3600,
    wet: 0.35,
    pulse: 1,
    chip: 1,
    preferredInstrument: 'chiptune',
    a: ['Pixel', 'Boss', 'Turbo', 'Level', 'Retro', 'Bonus', 'Arcade', 'Hyper', 'Bit'],
    b: ['Quest', 'Rush', 'Stage', 'Combo', 'Arena', 'Warp', 'Castle', 'Galaxy', 'Hero']
  },
  {
    id: 'interstellar',
    name: 'Interstellar',
    icon: 'fa-shuttle-space',
    desc: 'Cathedral organ, Zimmer ostinatos & epic cosmic crescendo',
    h: 215,
    sc: ['dorian', 'minor', 'lydian'],
    bpm: [78, 92],
    w: ['sawtooth', 'sine'],
    dr: 1,
    den: 0.65,
    cut: 2400,
    wet: 1.85,
    pulse: 1,
    preferredInstrument: 'organ',
    a: ['Gargantua', 'Cornfield', 'Day One', 'Event', 'Endless', 'Cosmic', 'Solar', 'Infinity', 'Stellar', 'Gravitational'],
    b: ['Horizon', 'Chase', 'Wormhole', 'Tears', 'Singularity', 'Orbit', 'Ascent', 'Echoes', 'Drift', 'Tides']
  },
  {
    id: 'phonk',
    name: 'Drift Phonk',
    icon: 'fa-gauge-high',
    desc: '808 cowbell riffs, saturated sub glides & Tokyo night drift',
    h: 330,
    sc: ['phrygian', 'pentatonic_minor', 'minor'],
    bpm: [136, 150],
    w: ['square', 'sawtooth'],
    dr: 3,
    den: 0.85,
    cut: 3400,
    wet: 0.65,
    pulse: 1,
    preferredInstrument: 'cowbell',
    a: ['Tokyo', 'Drift', 'Midnight', 'Phantom', 'Ghost', 'Shadow', 'Underground', 'Velocity', 'Neon', 'Demon'],
    b: ['Run', 'Echo', 'Takedown', 'Streets', 'Highway', 'Slide', 'Overdrive', 'Shift', 'Smoke', 'Outrun']
  },
  {
    id: 'sad',
    name: 'Melancholic Piano',
    icon: 'fa-cloud-rain',
    desc: 'Emotional grand piano, Einaudi chords & gentle string ensemble',
    h: 215,
    sc: ['harmonic_minor', 'minor', 'dorian'],
    bpm: [62, 78],
    w: ['triangle', 'sine'],
    dr: 0,
    den: 0.55,
    cut: 2400,
    wet: 1.6,
    preferredInstrument: 'piano',
    a: ['Tears', 'Silent', 'Forgotten', 'Lost', 'Melancholy', 'Distant', 'Fading', 'Lonely', 'Echoing', 'Fragile'],
    b: ['Memories', 'Raindrops', 'Letters', 'Goodbye', 'Sorrow', 'Autumn', 'Whisper', 'Silence', 'Passage', 'Solitude']
  }
];

export const PERIODS: Record<PeriodName, {
  sc: string[];
  bpm: [number, number];
  w: string[];
  dr: number;
  den: number;
  cut: number;
  instrument: InstrumentId;
  a: string[];
  b: string[];
}> = {
  night: {
    sc: ['minor', 'phrygian', 'dorian'],
    bpm: [56, 72],
    w: ['sine', 'triangle'],
    dr: 0,
    den: 0.3,
    cut: 650,
    instrument: 'rhodes',
    a: ['Hollow', 'Silent', 'Lunar', 'Midnight', 'Drifting', 'Velvet', 'Starless', 'Quiet', 'Deep'],
    b: ['Orbit', 'Hours', 'Tide', 'Signal', 'Dream', 'Haze', 'Echo', 'Room', 'Constellation']
  },
  dawn: {
    sc: ['lydian', 'major', 'dorian'],
    bpm: [66, 84],
    w: ['triangle', 'sine'],
    dr: 1,
    den: 0.38,
    cut: 950,
    instrument: 'flute',
    a: ['First', 'Pale', 'Rising', 'Soft', 'Golden', 'Waking', 'Misty', 'Early', 'Amber'],
    b: ['Light', 'Horizon', 'Dew', 'Bloom', 'Coffee', 'Sky', 'Steps', 'Birds', 'Awakening']
  },
  morning: {
    sc: ['major', 'mixolydian', 'lydian'],
    bpm: [96, 118],
    w: ['triangle', 'square'],
    dr: 2,
    den: 0.55,
    cut: 1450,
    instrument: 'pluck',
    a: ['Bright', 'Fresh', 'Sunny', 'Rolling', 'Open', 'Quick', 'Warm', 'Clear', 'Lively'],
    b: ['Streets', 'Commute', 'Window', 'Groove', 'Start', 'Breeze', 'Run', 'Coast', 'Stride']
  },
  afternoon: {
    sc: ['major', 'dorian', 'mixolydian'],
    bpm: [104, 124],
    w: ['square', 'triangle'],
    dr: 2,
    den: 0.58,
    cut: 1650,
    instrument: 'rhodes',
    a: ['High', 'Lazy', 'Electric', 'Dusty', 'Neon', 'Summer', 'Wide', 'Warm', 'Golden'],
    b: ['Noon', 'Highway', 'Pulse', 'Shade', 'Drive', 'Avenue', 'Heat', 'Motion', 'Drift']
  },
  dusk: {
    sc: ['dorian', 'minor', 'mixolydian'],
    bpm: [84, 102],
    w: ['triangle', 'sawtooth'],
    dr: 1,
    den: 0.45,
    cut: 1250,
    instrument: 'pad',
    a: ['Amber', 'Fading', 'Last', 'Crimson', 'Long', 'Distant', 'Burning', 'Gentle', 'Twilight'],
    b: ['Glow', 'Shadows', 'Rooftops', 'Sunset', 'Return', 'Embers', 'Skyline', 'Mile', 'Horizon']
  },
  evening: {
    sc: ['minor', 'dorian', 'phrygian'],
    bpm: [72, 92],
    w: ['sine', 'triangle'],
    dr: 1,
    den: 0.4,
    cut: 950,
    instrument: 'harp',
    a: ['Neon', 'Late', 'Blue', 'Smoky', 'Cold', 'Slow', 'City', 'Deep', 'Starlit'],
    b: ['Lights', 'Rain', 'Window', 'Café', 'Drift', 'Nights', 'Streets', 'Mood', 'Silhouette']
  }
};

export const WX_CONFIG: Record<WeatherCategory, {
  bpm: number;
  sc: string[];
  cut: number;
  den: number;
  wet: number;
  preferredInstrument?: InstrumentId;
  a: string[];
  n: string[];
}> = {
  clear: {
    bpm: 1.04,
    sc: ['major', 'lydian', 'mixolydian'],
    cut: 1.2,
    den: 1.1,
    wet: 0.8,
    a: ['Sunlit', 'Clear', 'Golden', 'Open', 'Luminous'],
    n: ['Sunbeam', 'Skies', 'Daylight', 'Horizon', 'Solar']
  },
  cloudy: {
    bpm: 0.96,
    sc: ['dorian', 'minor', 'mixolydian'],
    cut: 0.88,
    den: 0.9,
    wet: 1.05,
    a: ['Grey', 'Overcast', 'Soft', 'Drifting', 'Muted'],
    n: ['Clouds', 'Canopy', 'Veil', 'Haze', 'Overcast']
  },
  fog: {
    bpm: 0.82,
    sc: ['lydian', 'dorian', 'hirajoshi'],
    cut: 0.6,
    den: 0.7,
    wet: 1.65,
    preferredInstrument: 'flute',
    a: ['Foggy', 'Hidden', 'Muted', 'Pale', 'Ghostly'],
    n: ['Mist', 'Fog', 'Whisper', 'Blur', 'Shimmer']
  },
  rain: {
    bpm: 0.88,
    sc: ['minor', 'dorian', 'hirajoshi'],
    cut: 0.75,
    den: 0.82,
    wet: 1.45,
    preferredInstrument: 'rhodes',
    a: ['Rainy', 'Wet', 'Falling', 'Washed', 'Pensive'],
    n: ['Rain', 'Puddles', 'Drizzle', 'Umbrella', 'Drops']
  },
  storm: {
    bpm: 0.98,
    sc: ['phrygian', 'minor'],
    cut: 0.95,
    den: 0.85,
    wet: 1.35,
    a: ['Thunder', 'Stormy', 'Restless', 'Dark', 'Electrified'],
    n: ['Storm', 'Thunder', 'Lightning', 'Tempest', 'Gale']
  },
  snow: {
    bpm: 0.8,
    sc: ['lydian', 'major', 'hirajoshi'],
    cut: 0.68,
    den: 0.62,
    wet: 1.75,
    preferredInstrument: 'pluck',
    a: ['Frozen', 'Snowy', 'Silent', 'White', 'Glacial'],
    n: ['Snow', 'Frost', 'Flurry', 'Winter', 'Crystal']
  }
};

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seedStr: string): () => number {
  const seedGen = xmur3(seedStr);
  return sfc32(seedGen(), seedGen(), seedGen(), seedGen());
}

export function generateTrack(
  seed: string,
  period: PeriodName,
  station: Station,
  weatherCat: WeatherCategory,
  tempC: number,
  prevTrack: Track | null,
  overrides?: {
    key?: { pc: number; scn: string } | null;
    bpm?: number | 'default';
    instrument?: InstrumentId;
  }
): Track {
  const r = createRng(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const isAuto = !!station.auto;

  const P = PERIODS[period];
  const X = WX_CONFIG[weatherCat] || WX_CONFIG.clear;

  // Title generation
  const q = r();
  const name = isAuto
    ? q < 0.4
      ? `${pick(P.a)} ${pick(X.n)}`
      : q < 0.7
      ? `${pick(X.a)} ${pick(P.b)}`
      : `${pick(P.a)} ${pick(P.b)}`
    : q < 0.35
    ? `${pick(station.a || P.a)} ${pick(X.n)}`
    : `${pick(station.a || P.a)} ${pick(station.b || P.b)}`;

  // Scale and Root
  let scn: string;
  let pc: number;
  if (overrides?.key) {
    scn = overrides.key.scn;
    pc = overrides.key.pc;
  } else {
    const scalePool = isAuto ? [...P.sc, ...X.sc] : (station.sc || P.sc);
    scn = pick(scalePool);
    pc = prevTrack ? (prevTrack.pc + pick([0, 0, 5, 7, 9])) % 12 : Math.floor(r() * 12);
  }
  const sc = SCALES[scn as ScaleName] || SCALES.major;
  const root = 48 + pc;

  // Tempo
  let bpm: number;
  if (overrides?.bpm && overrides.bpm !== 'default') {
    bpm = Number(overrides.bpm);
  } else {
    const range = isAuto ? P.bpm : (station.bpm || P.bpm);
    const weatherBpmFactor = isAuto ? X.bpm : 1 + (X.bpm - 1) * 0.5;
    const tempOffset = (tempC - 24) * 0.3;
    const base = range[0] + r() * (range[1] - range[0]);
    bpm = Math.max(54, Math.min(144, Math.round(base * weatherBpmFactor + tempOffset)));
  }

  // Instrument Selection
  let instrument: InstrumentId = 'rhodes';
  if (overrides?.instrument && overrides.instrument !== 'auto') {
    instrument = overrides.instrument;
  } else if (station.preferredInstrument && station.preferredInstrument !== 'auto') {
    instrument = station.preferredInstrument;
  } else if (X.preferredInstrument) {
    instrument = X.preferredInstrument;
  } else {
    instrument = P.instrument || 'rhodes';
  }

  // Harmonic Progression with Rich Voicings
  const genreKey = station.id === 'auto' ? 'focus' : station.id;
  const progPool = GENRE_PROGRESSIONS[genreKey] || GENRE_PROGRESSIONS.lofi;
  const prog = pick(progPool).slice();

  // Create voice-led chords
  const voicings: number[][] = [];
  let prevVoicing: number[] = [];
  const chordType = pick([CHORD_TYPES.seventh, CHORD_TYPES.ninth, CHORD_TYPES.add9]);

  for (const rootDeg of prog) {
    const rawDegrees = chordType.map(d => rootDeg + d);
    const voiced = voiceLead(prevVoicing, rawDegrees, sc, root);
    voicings.push(voiced);
    prevVoicing = voiced;
  }

  const bassProg = prog.map(d => sc[((d % sc.length) + sc.length) % sc.length] + root - 24);

  // Sound character parameters
  const cutBase = isAuto ? P.cut * X.cut : (station.cut || 1100) * (1 + (X.cut - 1) * 0.4);
  const cut = Math.max(450, Math.min(3200, Math.round(cutBase)));
  const wet = Math.max(0.3, Math.min(2.0, (station.wet || 1) * (1 + (X.wet - 1) * 0.5)));
  const dr = isAuto ? P.dr : (station.dr ?? 1);
  const den = Math.min(0.85, (isAuto ? P.den * X.den : (station.den || 0.45)));

  // Form & Structure (Bars)
  const targetDurationSec = 50 + r() * 100;
  const barSec = (240 / bpm);
  const bars = Math.max(16, Math.min(48, Math.round(targetDurationSec / barSec / 4) * 4));

  // Generative Motivic Melody (Phrasing with Questions & Answers)
  const cyc: (number | null)[][] = [];
  const motifLen = 4;
  const motif = Array.from({ length: motifLen }, () => (r() < 0.65 ? Math.floor(r() * 8) : null));

  for (let b = 0; b < 4; b++) {
    const row: (number | null)[] = [];
    const rootChordNote = prog[b];
    for (let s = 0; s < 16; s++) {
      let n: number | null = null;
      const isDownbeat = s % 4 === 0;
      const isSyncopated = s % 2 === 1;

      if (station.id === 'interstellar') {
        // Hans Zimmer climbing 16th-note arpeggiated ostinato (Cornfield Chase / Day One)
        const ostinato = [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, 2];
        const stepDeg = ostinato[s % ostinato.length];
        n = rootChordNote + stepDeg;
      } else if (station.id === 'phonk') {
        // Syncopated 808 cowbell riff (DVRST / Kordhell style)
        const phonkHit = [0, 3, 6, 8, 10, 12, 14].includes(s);
        if (phonkHit) {
          const riff = [0, 3, 5, 7, 10, 12, 7, 5];
          n = rootChordNote + riff[(s + b * 2) % riff.length];
        } else {
          n = null;
        }
      } else if (station.id === 'sad') {
        // Ludovico Einaudi / Yiruma poignant rolling piano arpeggios & emotional answering motif
        const isArpStep = s % 2 === 0;
        if (isArpStep) {
          const einaudiPattern = [0, 4, 2, 5, 4, 2, 1, 0];
          n = rootChordNote + einaudiPattern[(s / 2 + b * 2) % einaudiPattern.length];
        } else if (s === 7 || s === 15) {
          n = rootChordNote + 7; // Poignant high emotional fifth lift
        } else {
          n = null;
        }
      } else if (isDownbeat) {
        // Strong resolution to chord tone
        n = r() < 0.85 ? rootChordNote + pick([0, 2, 4]) : null;
      } else if (isSyncopated && r() < den * 0.7) {
        // Expressive passing note
        const motifRef = motif[s % motifLen];
        n = motifRef !== null ? (motifRef + pick([-1, 0, 1])) : Math.floor(r() * 9);
      }
      row.push(n);
    }
    cyc.push(row);
  }

  // Generate full melody with macro dynamics across bars
  const mel: (number | null)[][] = Array.from({ length: bars }, (_, b) => {
    const pattern = cyc[b % 4];
    return pattern.map(n => (b >= 4 && r() < 0.12 ? (n === null ? Math.floor(r() * 7) : null) : n));
  });

  // Arrangement Evolution: Intro -> Build -> Peak -> Outro
  const blocks = bars / 4;
  const melOn: boolean[] = [];
  const drOn: boolean[] = [];
  const bassOn: boolean[] = [];

  for (let b = 0; b < blocks; b++) {
    const isIntro = b === 0;
    const isOutro = b === blocks - 1;
    const m = !isIntro;
    const d = dr > 0 && b >= 1 && !isOutro;
    const bs = b >= 1;

    for (let k = 0; k < 4; k++) {
      melOn.push(m);
      drOn.push(d);
      bassOn.push(bs);
    }
  }

  const kick = dr === 2 ? [0, 8, ...(r() < 0.5 ? [10] : [6, 14])] : [0, 8];
  const hOff = station.h + Math.floor(r() * 50) - 25;
  const ph = r() * 6.28;

  return {
    name,
    title: name,
    scn,
    scale: scn,
    sc,
    root,
    pc,
    rootName: NOTE_NAMES[pc],
    bpm,
    prog,
    voicings,
    bassProg,
    w: pick(isAuto ? (P.w || ['sine']) : (station.w || ['triangle'])),
    instrument,
    bars,
    cyc,
    mel,
    melOn,
    drOn,
    bassOn,
    kick,
    dr,
    cut,
    wet,
    hOff,
    ph,
    swing: station.swing || 0,
    pulse: !!station.pulse,
    chip: !!station.chip,
    stId: station.id,
    period,
    cat: weatherCat,
    key: `${NOTE_NAMES[pc]} ${scn}`
  };
}
