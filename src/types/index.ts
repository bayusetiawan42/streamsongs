import { ScaleName } from '../audio/theory/scales';

export type WeatherCategory = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

export interface WeatherData {
  cat: WeatherCategory;
  label: string;
  icon: string;
  temp: number;
  wind: number;
  cloud: number;
  isDay: boolean;
  timezone: string;
  loaded: boolean;
}

export type SettlementType = 'metropolis' | 'city' | 'town' | 'village' | 'highlands';

export interface SettlementInfo {
  type: SettlementType;
  label: string;
  icon: string;
  description: string;
}

export interface LocationCoords {
  lat: number;
  lon: number;
  place?: string;
  country?: string;
  isUser?: boolean;
  timezone?: string;
  settlement?: SettlementType;
  population?: number;
  elevation?: number;
}

export interface RecentLocation {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  timezone?: string;
  settlement?: SettlementType;
  population?: number;
  elevation?: number;
}

export interface WindLevel {
  id: string;
  name: string;
  speed: number;
  icon: string;
}

export type InstrumentId = 
  | 'auto'
  | 'rhodes'
  | 'kalimba'
  | 'pluck'
  | 'pad'
  | 'flute'
  | 'harp'
  | 'synthwave'
  | 'chiptune'
  | 'organ'
  | 'cowbell'
  | 'piano';

export interface InstrumentInfo {
  id: InstrumentId;
  name: string;
  icon: string;
  desc: string;
}

export type PeriodName = 'night' | 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'evening';

export interface Station {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mood?: string;
  auto?: boolean;
  h: number;
  sc?: string[];
  bpm?: [number, number];
  w?: string[];
  dr?: number;
  den?: number;
  cut?: number;
  wet?: number;
  swing?: number;
  pulse?: number;
  chip?: number;
  a?: string[];
  b?: string[];
  preferredInstrument?: InstrumentId;
}

export interface ChordVoicing {
  root: number;
  notes: number[];
  name: string;
}

export interface Track {
  name: string;
  title: string;
  scn: ScaleName | string;
  scale: ScaleName | string;
  sc: number[];
  root: number;
  pc: number;
  rootName: string;
  bpm: number;
  prog: number[];
  voicings: number[][];
  bassProg: number[];
  w: string;
  instrument: InstrumentId;
  bars: number;
  cyc: (number | null)[][];
  mel: (number | null)[][];
  melOn: boolean[];
  drOn: boolean[];
  bassOn: boolean[];
  kick: number[];
  dr: number;
  cut: number;
  wet: number;
  hOff: number;
  ph: number;
  swing: number;
  pulse: boolean;
  chip: boolean;
  stId: string;
  period: PeriodName;
  cat: WeatherCategory;
  key: string;
}

export interface Deck {
  tr: Track;
  step: number;
  nt: number;
  t0: number;
  fin: number;
  stopAt: number;
  queued: boolean;
  f1: GainNode;
  f2: GainNode;
  dry: GainNode;
  wet: GainNode;
  next?: Track;
}
