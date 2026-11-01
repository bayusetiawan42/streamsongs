import { WeatherCategory, PeriodName, Station } from '../../types';
import { getFifthsDistance } from './modulation';

export type TransitionMode = 'drop' | 'bridge' | 'morph';

export type TransitionStyle =
  | 'phonk-choke'
  | 'phonk-stutter'
  | 'arcade-blip'
  | 'arcade-warp'
  | 'arcade-fanfare'
  | 'impact-drop'
  | 'impact-silence'
  | 'cinematic-drive'
  | 'cinematic-upbeat'
  | 'generic-bridge'
  | 'lofi-smear'
  | 'sad-rubato'
  | 'cosmos-drift'
  | 'dream-dissolve'
  | 'focus-drift'
  | 'generic-morph';

export type ArrangementPhase = 'intro' | 'body' | 'peak' | 'outro';

export interface TransitionContext {
  stationId: string;
  energy: number;
  deltaFifths: number;
  deltaBpm: number;
  barPosition: number;
  barsRemaining: number;
  keysOnBeat: boolean;
  fatigue: boolean;
  weather: WeatherCategory;
  period: PeriodName;
  /** Where we are inside the currently playing arrangement */
  phase: ArrangementPhase;
  swing: boolean;
  pulse: boolean;
  /** Same root, different scale (pure mode change) */
  modeSwitch: boolean;
}

export interface TransitionPlan {
  mode: TransitionMode;
  bars: number;
  style: TransitionStyle;
  rampBpm: boolean;
}

export interface TransitionHistoryEntry {
  stationId: string;
  mode: TransitionMode;
  style?: TransitionStyle;
}

export interface StrategyOptions {
  /** Seeded RNG so a transition is reproducible per track/bar while still varied */
  rng?: () => number;
  /** Variety memory: recent transition modes per station */
  history?: TransitionHistoryEntry[];
}

const DROP_STATIONS = new Set(['phonk', 'arcade']);

const WEATHER_ENERGY: Record<WeatherCategory, number> = {
  clear: 0.04,
  cloudy: 0,
  rain: -0.04,
  fog: -0.07,
  storm: 0.09,
  snow: -0.05,
};

const NIGHT_PERIODS = new Set<PeriodName>(['night', 'dusk', 'evening']);

/** Half-width of the probabilistic blend zone around each band threshold. */
const SOFT_EDGE = 0.1;

export function computeTransitionEnergy(
  station: Station,
  bpm: number,
  weather: WeatherCategory,
  period: PeriodName
): number {
  const bpmNorm = Math.max(0, Math.min(1, (bpm - 48) / 102));
  const den = station.den ?? 0.45;
  const dr = (station.dr ?? 1) / 3;
  let e = 0.45 * bpmNorm + 0.45 * den + 0.1 * dr - 0.18;
  e += WEATHER_ENERGY[weather] ?? 0;
  if (NIGHT_PERIODS.has(period)) e -= 0.04;
  return Math.max(0, Math.min(1, e));
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Smooth 0→1 ramp centered on a band threshold. */
const smoothRamp = (e: number, center: number) => clamp01(0.5 + (e - center) / (2 * SOFT_EDGE));

/** How many consecutive recent transitions of this station used the given mode. */
function modeStreak(history: TransitionHistoryEntry[], stationId: string, mode: TransitionMode): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.stationId !== stationId) continue;
    if (h.mode === mode) n++;
    else break;
  }
  return n;
}

/** How many times back-to-back this station played the exact same style. */
function styleStreak(history: TransitionHistoryEntry[], stationId: string, style: TransitionStyle): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.stationId !== stationId) continue;
    if (h.style === style) n++;
    else break;
  }
  return n;
}

/**
 * Drop variants per station — a drop is never the same card twice in a row:
 *   phonk : classic choke / gated stutter build / silence-gap void
 *   arcade: chip blip run / pipe warp slide / triple-fanfare landing
 *   others: rising stinger / silence-gap
 */
const DROP_VARIANTS: Record<string, TransitionStyle[]> = {
  phonk: ['phonk-choke', 'phonk-stutter', 'impact-silence'],
  arcade: ['arcade-blip', 'arcade-warp', 'arcade-fanfare'],
  other: ['impact-drop', 'impact-silence'],
};

function pickDropStyle(stationId: string, rng: () => number, history: TransitionHistoryEntry[]): TransitionStyle {
  const list = DROP_VARIANTS[stationId] ?? DROP_VARIANTS.other;
  let lastStyle: TransitionStyle | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].stationId === stationId) { lastStyle = history[i].style; break; }
  }
  const pool = lastStyle && styleStreak(history, stationId, lastStyle) >= 2
    ? list.filter(s => s !== lastStyle)
    : list;
  return pool[Math.floor(rng() * pool.length)];
}

function weightedMode(
  w: { drop: number; bridge: number; morph: number },
  fallback: TransitionMode,
  rng: () => number
): TransitionMode {
  const d = Math.max(0, w.drop);
  const b = Math.max(0, w.bridge);
  const m = Math.max(0, w.morph);
  const total = d + b + m;
  if (total <= 0) return fallback;
  let x = rng() * total;
  if (x < m) return 'morph';
  x -= m;
  if (x < b) return 'bridge';
  return 'drop';
}

function pickBridgeStyle(stationId: string, rng: () => number): TransitionStyle {
  const r = rng();
  if (stationId === 'drive') return r < 0.7 ? 'cinematic-drive' : 'generic-bridge';
  if (stationId === 'upbeat') return r < 0.7 ? 'cinematic-upbeat' : 'generic-bridge';
  return 'generic-bridge';
}

/** Station-flavored dissolve, with rotating alternates so a station never feels scripted. */
function pickMorphStyle(stationId: string, rng: () => number): TransitionStyle {
  const r = rng();
  switch (stationId) {
    case 'lofi': return r < 0.65 ? 'lofi-smear' : 'generic-morph';
    case 'sad': return r < 0.7 ? 'sad-rubato' : 'generic-morph';
    case 'cosmos': return r < 0.7 ? 'cosmos-drift' : 'dream-dissolve';
    case 'dream': return r < 0.6 ? 'dream-dissolve' : 'cosmos-drift';
    case 'focus': return r < 0.6 ? 'focus-drift' : 'cosmos-drift';
    case 'drive':
    case 'upbeat':
    case 'interstellar': return r < 0.5 ? 'dream-dissolve' : 'generic-morph';
    default: return 'generic-morph';
  }
}

function morphBars(stationId: string, rng: () => number): number {
  switch (stationId) {
    case 'focus': return 8;
    case 'dream': return 8;
    case 'sad':
    case 'lofi': return 6 + Math.floor(rng() * 3); // 6-8
    case 'cosmos': return 5 + Math.floor(rng() * 3); // 5-7
    default: return 4 + Math.floor(rng() * 3); // 4-6
  }
}

function clampBars(bars: number, barsRemaining: number): number {
  return Math.max(2, Math.min(bars, Math.max(2, barsRemaining)));
}

const rampDecision = (ctx: TransitionContext, rng: () => number): boolean =>
  Math.abs(ctx.deltaBpm) >= 6 || (Math.abs(ctx.deltaBpm) >= 3 && rng() < 0.4);

function dropPlan(
  ctx: TransitionContext,
  rng: () => number,
  history: TransitionHistoryEntry[],
  rampBpm: boolean
): TransitionPlan {
  let bars = ctx.keysOnBeat && ctx.deltaFifths < 5 ? 1 : 2;
  // Rotating choke: after a run of identical 1-bar drops, occasionally stretch to 2
  if (bars === 1 && modeStreak(history, ctx.stationId, 'drop') >= 3 && rng() < 0.45 && ctx.barsRemaining >= 2) {
    bars = 2;
  } else if (bars === 2 && rng() < 0.12 && ctx.barsRemaining >= 3) {
    bars = 3; // long-fuse choke
  }
  return { mode: 'drop', bars, style: pickDropStyle(ctx.stationId, rng, history), rampBpm };
}

/**
 * Transition Strategy Director — decides the execution style of every
 * transition (key, BPM, station or track-end) from a live energy score,
 * the current arrangement context and a variety memory.
 *
 * Base matrix (now soft-edged, ±SOFT_EDGE around each threshold):
 *   energy >= 0.60          -> DROP   (phonk/arcade always, whatever happens)
 *   energy 0.35-0.59        -> BRIDGE
 *   energy < 0.35           -> MORPH 4-8 bars
 *   fatigue / outro         -> forced MORPH (except phonk/arcade)
 *
 * Creativity layers:
 *   1. Soft edges: near a threshold the mode is picked probabilistically (seeded).
 *   2. Live context: arrangement phase, swing/pulse, pure mode switches and
 *      tritone jumps all shift the odds.
 *   3. Variety memory: each repeat of the same mode back-to-back halves that
 *      mode's weight, so a station never plays the same card twice in a row.
 */
export function planTransitionStrategy(ctx: TransitionContext, opts: StrategyOptions = {}): TransitionPlan {
  const rng = opts.rng ?? Math.random;
  const history = opts.history ?? [];

  // Genre identity rule: phonk & arcade NEVER morph, NEVER bridge — always drop.
  if (DROP_STATIONS.has(ctx.stationId)) {
    return dropPlan(ctx, rng, history, rampDecision(ctx, rng));
  }

  const rampBpm = rampDecision(ctx, rng);

  // Fatigue / outro — dissolve gently into the next section.
  if (ctx.fatigue) {
    const bars = clampBars(morphBars(ctx.stationId, rng), ctx.barsRemaining);
    return { mode: 'morph', bars, style: pickMorphStyle(ctx.stationId, rng), rampBpm };
  }

  // Soft-edged band weights: far from a threshold behaves deterministic,
  // near one blends between neighbors.
  const s35 = smoothRamp(ctx.energy, 0.35);
  const s60 = smoothRamp(ctx.energy, 0.6);
  let wMorph = 1 - s35;
  let wBridge = Math.max(0, s35 - s60);
  let wDrop = s60;

  // Live musical context nudges the odds
  if (ctx.phase === 'intro') { wMorph += 0.25; wDrop *= 0.6; }
  if (ctx.phase === 'peak') { wDrop += 0.22; wMorph *= 0.6; }
  if (ctx.phase === 'outro') { wMorph += 0.18; wDrop *= 0.7; }
  if (ctx.swing || ctx.pulse) { wDrop += 0.1; wMorph -= 0.08; }
  if (ctx.modeSwitch) wMorph += 0.35;
  if (ctx.deltaFifths === 6 && rng() < 0.25) wDrop += 0.25; // tritone: occasional surprise drop

  // Variety memory decay: repeated recent mode loses weight
  const decay = 0.55;
  wMorph *= Math.pow(decay, modeStreak(history, ctx.stationId, 'morph'));
  wBridge *= Math.pow(decay, modeStreak(history, ctx.stationId, 'bridge'));
  wDrop *= Math.pow(decay, modeStreak(history, ctx.stationId, 'drop'));

  const deterministic: TransitionMode = ctx.energy >= 0.6 ? 'drop' : ctx.energy >= 0.35 ? 'bridge' : 'morph';
  const mode = weightedMode({ drop: wDrop, bridge: wBridge, morph: wMorph }, deterministic, rng);

  if (mode === 'drop') return dropPlan(ctx, rng, history, rampBpm);

  if (mode === 'bridge') {
    const bars = rng() < 0.2 ? 3 : 2;
    return { mode: 'bridge', bars, style: pickBridgeStyle(ctx.stationId, rng), rampBpm };
  }

  const bars = clampBars(morphBars(ctx.stationId, rng), ctx.barsRemaining);
  return { mode: 'morph', bars, style: pickMorphStyle(ctx.stationId, rng), rampBpm };
}

export { getFifthsDistance };
