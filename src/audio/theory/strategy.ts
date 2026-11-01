import { WeatherCategory, PeriodName, Station } from '../../types';
import { getFifthsDistance } from './modulation';

export type TransitionMode = 'drop' | 'bridge' | 'morph';

export type TransitionStyle =
  | 'phonk-choke'
  | 'arcade-blip'
  | 'impact-drop'
  | 'cinematic-drive'
  | 'cinematic-upbeat'
  | 'generic-bridge'
  | 'lofi-smear'
  | 'sad-rubato'
  | 'cosmos-drift'
  | 'dream-dissolve'
  | 'focus-drift'
  | 'generic-morph';

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
}

export interface TransitionPlan {
  mode: TransitionMode;
  bars: number;
  style: TransitionStyle;
  rampBpm: boolean;
}

const DROP_STATIONS = new Set(['phonk', 'arcade']);

const MORPH_BARS: Record<string, number> = {
  focus: 8,
  dream: 8,
  sad: 7,
  lofi: 6,
  cosmos: 6,
};

const WEATHER_ENERGY: Record<WeatherCategory, number> = {
  clear: 0.04,
  cloudy: 0,
  rain: -0.04,
  fog: -0.07,
  storm: 0.09,
  snow: -0.05,
};

const NIGHT_PERIODS = new Set<PeriodName>(['night', 'dusk', 'evening']);

export function computeTransitionEnergy(
  station: Station,
  bpm: number,
  weather: WeatherCategory,
  period: PeriodName
): number {
  const bpmNorm = Math.max(0, Math.min(1, (bpm - 48) / 102));
  const den = station.den ?? 0.45;
  const dr = (station.dr ?? 1) / 3;
  // Calibrated so drive/upbeat/interstellar land in the bridge band (0.35-0.59)
  // while lofi/sad/dream/focus/cosmos dissolve below 0.35.
  let e = 0.45 * bpmNorm + 0.45 * den + 0.1 * dr - 0.18;
  e += WEATHER_ENERGY[weather] ?? 0;
  if (NIGHT_PERIODS.has(period)) e -= 0.04;
  return Math.max(0, Math.min(1, e));
}

function pickDropStyle(stationId: string): TransitionStyle {
  if (stationId === 'phonk') return 'phonk-choke';
  if (stationId === 'arcade') return 'arcade-blip';
  return 'impact-drop';
}

function pickBridgeStyle(stationId: string): TransitionStyle {
  if (stationId === 'drive') return 'cinematic-drive';
  if (stationId === 'upbeat') return 'cinematic-upbeat';
  return 'generic-bridge';
}

function pickMorphStyle(stationId: string): TransitionStyle {
  if (stationId === 'lofi') return 'lofi-smear';
  if (stationId === 'sad') return 'sad-rubato';
  if (stationId === 'cosmos') return 'cosmos-drift';
  if (stationId === 'dream') return 'dream-dissolve';
  if (stationId === 'focus') return 'focus-drift';
  return 'generic-morph';
}

function clampBars(bars: number, barsRemaining: number): number {
  return Math.max(2, Math.min(bars, Math.max(2, barsRemaining)));
}

/**
 * Transition Strategy Director — decides the execution style of every
 * transition (key, BPM, station or track-end) purely from the energy score.
 *
 * Matrix:
 *   energy >= 0.60 & keys on beat  -> DROP 1 bar   (phonk/arcade always drop)
 *   energy >= 0.60 & Δfifths >= 5  -> DROP 2 bars
 *   energy 0.35-0.59               -> BRIDGE 2 bars
 *   energy < 0.35                  -> MORPH 4-8 bars
 *   fatigue / outro                -> forced MORPH (except phonk/arcade)
 */
export function planTransitionStrategy(ctx: TransitionContext): TransitionPlan {
  const rampBpm = Math.abs(ctx.deltaBpm) >= 6;

  // Genre identity rule: phonk & arcade NEVER morph, NEVER bridge — always drop.
  if (DROP_STATIONS.has(ctx.stationId)) {
    const bars = ctx.keysOnBeat && ctx.deltaFifths < 5 ? 1 : 2;
    return { mode: 'drop', bars, style: pickDropStyle(ctx.stationId), rampBpm };
  }

  // Fatigue / outro — dissolve gently into the next section.
  if (ctx.fatigue) {
    const bars = clampBars(MORPH_BARS[ctx.stationId] ?? 6, ctx.barsRemaining);
    return { mode: 'morph', bars, style: pickMorphStyle(ctx.stationId), rampBpm };
  }

  if (ctx.energy >= 0.6) {
    const bars = ctx.keysOnBeat && ctx.deltaFifths < 5 ? 1 : 2;
    return { mode: 'drop', bars, style: pickDropStyle(ctx.stationId), rampBpm };
  }

  if (ctx.energy >= 0.35) {
    return { mode: 'bridge', bars: 2, style: pickBridgeStyle(ctx.stationId), rampBpm };
  }

  const bars = clampBars(MORPH_BARS[ctx.stationId] ?? 4, ctx.barsRemaining);
  return { mode: 'morph', bars, style: pickMorphStyle(ctx.stationId), rampBpm };
}

export { getFifthsDistance };
