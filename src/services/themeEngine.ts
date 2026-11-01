import { WeatherData, Station, SettlementType } from '../types';

export interface ThemePalette {
  top: string;
  bot: string;
  acc: string;
  acc2: string;
  glow: string;
  skyglowColor: string;
  skyglowAlpha: number;
  h1: number;
  h2: number;
  ah: number;
  h: number;
  isDay: boolean;
  starVisibility: number;
  fireflyDensity: number;
}

// Math interpolation helpers
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hl = (a: number, b: number, t: number) =>
  (a + (((b - a + 540) % 360) - 180) * t + 360) % 360;

const mixHsl = (a: number[], b: number[], t: number): number[] => [
  hl(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const hslStr = (c: number[]) =>
  `hsl(${c[0].toFixed(1)} ${Math.max(0, Math.min(100, c[1])).toFixed(1)}% ${Math.max(0, Math.min(100, c[2])).toFixed(1)}%)`;

// Base 24-hour diurnal sky color keyframe table [hour, top, bot, accent]
const SKY_KEYFRAMES: [number, number[], number[], number[]][] = [
  [0,  [248, 52, 6],   [268, 48, 12],  [280, 80, 68]], // Deep Midnight
  [4,  [245, 45, 9],   [290, 42, 16],  [310, 75, 65]], // Late Night
  [5,  [240, 45, 14],  [335, 58, 28],  [345, 88, 70]], // Astronomical Dawn
  [6.5,[215, 65, 30],  [25, 85, 52],   [32, 96, 62]],  // Golden Sunrise
  [8,  [205, 72, 45],  [42, 80, 64],   [45, 94, 60]],  // Warm Morning
  [12, [205, 75, 52],  [192, 70, 72],  [48, 95, 58]],  // Brilliant Noon
  [16, [212, 68, 48],  [195, 65, 66],  [38, 95, 62]],  // Late Afternoon
  [18, [230, 58, 26],  [20, 88, 48],   [14, 96, 64]],  // Crimson Sunset
  [19.5,[245, 52, 14], [285, 55, 22],  [295, 82, 68]], // Twilight Dusk
  [21, [248, 50, 10],  [275, 48, 16],  [285, 78, 65]], // Nightfall
  [24, [248, 52, 6],   [268, 48, 12],  [280, 80, 68]], // Deep Midnight (loop)
];

// Station mood color influence parameters
const STATION_PALETTES: Record<string, { hueShift: number; satMul: number; litMul: number; accOverride?: number[] }> = {
  lofi: {
    hueShift: 24,       // Warm vintage amber tint
    satMul: 0.9,
    litMul: 0.95,
    accOverride: [32, 88, 64],
  },
  focus: {
    hueShift: -15,      // Deep calm indigo/slate
    satMul: 0.75,
    litMul: 0.9,
    accOverride: [205, 75, 66],
  },
  drive: {
    hueShift: 65,       // Cyberpunk magenta/cyan twilight
    satMul: 1.25,
    litMul: 1.05,
    accOverride: [305, 95, 68],
  },
  upbeat: {
    hueShift: 10,       // Bright golden sunlight
    satMul: 1.15,
    litMul: 1.08,
    accOverride: [45, 95, 60],
  },
  dream: {
    hueShift: -40,      // Ethereal aurora / lavender
    satMul: 1.05,
    litMul: 1.02,
    accOverride: [265, 82, 72],
  },
  arcade: {
    hueShift: 80,       // Retro neon electric glow
    satMul: 1.3,
    litMul: 1.1,
    accOverride: [155, 90, 62],
  },
  interstellar: {
    hueShift: -25,      // Deep cosmic space & golden accretion glow
    satMul: 1.15,
    litMul: 0.88,
    accOverride: [42, 95, 62],
  },
  phonk: {
    hueShift: 110,      // Intense neon crimson & Tokyo drift ultraviolet
    satMul: 1.35,
    litMul: 0.95,
    accOverride: [340, 95, 62],
  },
  sad: {
    hueShift: -20,      // Slate blue / weeping silver-blue twilight
    satMul: 0.72,
    litMul: 0.88,
    accOverride: [215, 65, 70],
  },
  cosmos: {
    hueShift: -55,      // Deep obsidian space & emerald nebula glow
    satMul: 0.85,
    litMul: 0.72,
    accOverride: [165, 85, 65],
  },
  auto: {
    hueShift: 0,
    satMul: 1.0,
    litMul: 1.0,
  },
};

export function computeTheme(params: {
  zonedDate: Date;
  station: Station;
  weather: WeatherData;
  settlement: SettlementType;
  weatherMuted?: boolean;
  trackHueOffset?: number;
}): ThemePalette {
  const {
    zonedDate,
    station,
    weather,
    settlement,
    weatherMuted = false,
    trackHueOffset = 0,
  } = params;

  // 1. Precise solar hour from local zoned time
  const hr =
    zonedDate.getHours() +
    zonedDate.getMinutes() / 60 +
    zonedDate.getSeconds() / 3600;

  const isDay = hr >= 6 && hr < 18;

  // 2. Interpolate base diurnal sky from table
  let idx = 0;
  while (idx < SKY_KEYFRAMES.length - 2 && hr >= SKY_KEYFRAMES[idx + 1][0]) {
    idx++;
  }
  const t =
    (hr - SKY_KEYFRAMES[idx][0]) /
    (SKY_KEYFRAMES[idx + 1][0] - SKY_KEYFRAMES[idx][0]);

  let topHsl = mixHsl(SKY_KEYFRAMES[idx][1], SKY_KEYFRAMES[idx + 1][1], t);
  let botHsl = mixHsl(SKY_KEYFRAMES[idx][2], SKY_KEYFRAMES[idx + 1][2], t);
  let accHsl = mixHsl(SKY_KEYFRAMES[idx][3], SKY_KEYFRAMES[idx + 1][3], t);

  // 3. Station Vibe Influence (Blend station personality subtly into sky)
  const stConfig = STATION_PALETTES[station.id] || STATION_PALETTES.auto;
  const moodBlend = station.id === 'auto' ? 0 : 0.35; // 35% station mood coloring

  if (moodBlend > 0) {
    topHsl[0] = hl(topHsl[0], (topHsl[0] + stConfig.hueShift + 360) % 360, moodBlend);
    botHsl[0] = hl(botHsl[0], (botHsl[0] + stConfig.hueShift + 360) % 360, moodBlend);
    topHsl[1] = Math.min(100, topHsl[1] * stConfig.satMul);
    botHsl[1] = Math.min(100, botHsl[1] * stConfig.satMul);

    if (stConfig.accOverride) {
      accHsl = mixHsl(accHsl, stConfig.accOverride, 0.7);
    }
  }

  // 4. Weather Attenuation
  if (!weatherMuted) {
    const cloudFactor = Math.min(1, weather.cloud / 100);
    const rainDim = weather.cat === 'storm' ? 0.45 : weather.cat === 'rain' ? 0.3 : weather.cat === 'fog' ? 0.2 : 0;
    
    // Desaturate and darken under heavy cloud/rain
    topHsl[1] *= 1 - cloudFactor * 0.4;
    botHsl[1] *= 1 - cloudFactor * 0.35;
    topHsl[2] *= 1 - rainDim;
    botHsl[2] *= 1 - rainDim * 0.9;
  }

  // 5. Settlement Atmosphere Adjustments
  let skyglowAlpha = 0;
  let skyglowColor = 'rgba(255, 170, 90, 0.2)'; // Warm city sodium/neon glow
  let starVisibility = isDay ? 0 : 1.0;
  let fireflyDensity = 0;

  switch (settlement) {
    case 'metropolis':
      // Urban skyglow at night, fewer stars due to light pollution
      if (!isDay) {
        skyglowAlpha = 0.32;
        skyglowColor = station.id === 'drive' ? 'rgba(240, 70, 180, 0.28)' : 'rgba(255, 160, 90, 0.25)';
        botHsl[2] = Math.min(32, botHsl[2] + 4); // Night bottom sky never pitch black
        starVisibility = 0.35; // Light pollution obscures faint stars
      }
      break;

    case 'city':
      if (!isDay) {
        skyglowAlpha = 0.18;
        skyglowColor = 'rgba(255, 175, 110, 0.18)';
        starVisibility = 0.6;
      }
      break;

    case 'town':
      if (!isDay) {
        skyglowAlpha = 0.06;
        starVisibility = 0.85;
      }
      break;

    case 'village':
      // Pure starlight, high contrast midnight, fireflies in evening/night
      if (!isDay) {
        skyglowAlpha = 0;
        starVisibility = 1.0;
        topHsl[2] = Math.max(3, topHsl[2] * 0.9); // Deep pristine velvet
        // Fireflies appear when weather is not stormy or rainy
        if (weather.cat === 'clear' || weather.cat === 'cloudy') {
          fireflyDensity = 1.0;
        }
      }
      break;

    case 'highlands':
      // Alpine crispness: shift slightly towards cool indigo/cyan, sharp starlight
      topHsl[0] = hl(topHsl[0], 225, 0.25);
      topHsl[2] = Math.max(4, topHsl[2] * 0.92);
      starVisibility = isDay ? 0 : 1.1; // Extra sharp mountain stars
      break;
  }

  const top = hslStr(topHsl);
  const bot = hslStr(botHsl);
  const acc = hslStr(accHsl);
  const acc2 = hslStr([(accHsl[0] + 55) % 360, Math.min(100, accHsl[1] * 1.05), accHsl[2]]);
  const glow = hslStr([accHsl[0], 90, 60]);

  // Conic vinyl gradient disc hues
  const h1 = ((accHsl[0] + trackHueOffset) % 360 + 360) % 360;
  const h2 = (h1 + 45) % 360;

  return {
    top,
    bot,
    acc,
    acc2,
    glow,
    skyglowColor,
    skyglowAlpha,
    h1,
    h2,
    ah: accHsl[0],
    h: hr,
    isDay,
    starVisibility,
    fireflyDensity,
  };
}
