import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from './audio/engine';
import { STATIONS } from './audio/theory/generator';
import { SCALES, ScaleName } from './audio/theory/scales';
import {
  WeatherCategory,
  WeatherData,
  LocationCoords,
  RecentLocation,
  InstrumentId,
  Station,
  Track,
} from './types';
import { GeocodingResult } from './services/geocoding';
import {
  fetchWeatherForecast,
  MANUAL_WX,
  DEFAULT_WEATHER,
  WIND_LEVELS,
} from './services/weather';
import { getZonedDate } from './services/timezone';
import { VisualCanvas } from './components/VisualCanvas';
import { Header } from './components/Header';
import { NowPlaying } from './components/NowPlaying';
import { StationsGrid } from './components/StationsGrid';
import { Toast } from './components/Toast';

// Sky color diurnal keyframe table
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hl = (a: number, b: number, t: number) =>
  (a + (((b - a + 540) % 360) - 180) * t + 360) % 360;
const mix = (a: number[], b: number[], t: number) => [
  hl(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const hslStr = (c: number[]) =>
  `hsl(${c[0].toFixed(1)} ${Math.max(0, c[1]).toFixed(1)}% ${Math.max(0, c[2]).toFixed(1)}%)`;

const K: [number, number[], number[], number[]][] = [
  [0, [250, 50, 7], [270, 45, 14], [290, 80, 65]],
  [5, [245, 45, 13], [335, 55, 34], [340, 85, 68]],
  [7, [205, 70, 45], [30, 85, 62], [35, 95, 62]],
  [11, [205, 75, 52], [190, 70, 72], [45, 95, 60]],
  [15, [215, 70, 50], [195, 65, 68], [40, 95, 60]],
  [18, [235, 55, 28], [20, 85, 50], [15, 95, 62]],
  [21, [250, 50, 12], [285, 50, 24], [300, 80, 68]],
  [24, [250, 50, 7], [270, 45, 14], [290, 80, 65]],
];

export const App: React.FC = () => {
  // Audio Engine instance
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }
  const engine = engineRef.current;

  // App & Audio State
  const [playing, setPlaying] = useState(false);
  const [stationIndex, setStationIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [volume, setVolume] = useState(0.85);
  const [bassLevel, setBassLevel] = useState(0);

  // Location & Timezone State
  const [, setCoords] = useState<LocationCoords>({
    lat: -6.2,
    lon: 106.8,
    place: 'Jakarta',
    isUser: true,
  });
  const [placeName, setPlaceName] = useState('Locating…');
  const [isGps, setIsGps] = useState(true);
  const [targetTimezone, setTargetTimezone] = useState<string | null>(null);
  const [zonedDate, setZonedDate] = useState<Date>(() => getZonedDate(null));

  // Weather State
  const [liveWeather, setLiveWeather] = useState<WeatherData>(DEFAULT_WEATHER);
  const [effectiveWeather, setEffectiveWeather] = useState<WeatherData>(DEFAULT_WEATHER);

  // User Preferences from LocalStorage
  const [prefWeather, setPrefWeather] = useState<'default' | WeatherCategory>(() => {
    return (localStorage.getItem('ss-pref-wx') as WeatherCategory) || 'default';
  });

  const [prefWind, setPrefWind] = useState<'default' | number>(() => {
    const val = localStorage.getItem('ss-pref-wind');
    return val && val !== 'default' ? Number(val) : 'default';
  });

  const [prefInstrument, setPrefInstrument] = useState<'default' | InstrumentId>(() => {
    return (localStorage.getItem('ss-pref-inst') as InstrumentId) || 'default';
  });

  const [prefBpm, setPrefBpm] = useState<'default' | number>(() => {
    const val = localStorage.getItem('ss-pref-bpm');
    return val && val !== 'default' ? Number(val) : 'default';
  });

  const [weatherMuted, setWeatherMuted] = useState<boolean>(() => {
    return localStorage.getItem('ss-pref-wx-muted') === 'true';
  });

  const [lockedKey, setLockedKey] = useState<{ root: number; scale: ScaleName } | null>(null);

  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>(() => {
    try {
      const saved = localStorage.getItem('ss-recents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Theme object
  const [theme, setTheme] = useState({
    top: '#0a0a16',
    bot: '#121026',
    acc: '#8ba2ff',
    acc2: '#c48bff',
    ah: 225,
    h: 12,
  });

  // Keep zonedDate synchronized to targetTimezone every 1000ms
  useEffect(() => {
    const interval = setInterval(() => {
      setZonedDate(getZonedDate(targetTimezone));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTimezone]);

  // Update sky theme gradients according to zonedDate
  useEffect(() => {
    const h =
      zonedDate.getHours() +
      zonedDate.getMinutes() / 60 +
      zonedDate.getSeconds() / 3600;

    let i = 0;
    while (i < K.length - 2 && h >= K[i + 1][0]) i++;
    const t = (h - K[i][0]) / (K[i + 1][0] - K[i][0]);

    const tc = weatherMuted
      ? 0
      : effectiveWeather.cat === 'storm'
      ? 0.6
      : effectiveWeather.cat === 'rain'
      ? 0.35
      : effectiveWeather.cat === 'fog'
      ? 0.2
      : effectiveWeather.cat === 'snow'
      ? 0.1
      : (effectiveWeather.cloud / 100) * 0.4;

    const cloudFactor = weatherMuted ? 0 : effectiveWeather.cloud / 100;
    const adj = (c: number[]) => [
      c[0],
      c[1] * (1 - 0.5 * Math.min(1, cloudFactor)),
      c[2] * (1 - tc),
    ];

    const top = hslStr(adj(mix(K[i][1], K[i + 1][1], t)));
    const bot = hslStr(adj(mix(K[i][2], K[i + 1][2], t)));
    const a = mix(K[i][3], K[i + 1][3], t);
    const acc = hslStr(a);
    const acc2 = hslStr([(a[0] + 55) % 360, a[1], a[2]]);

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--top', top);
    rootStyle.setProperty('--bot', bot);
    rootStyle.setProperty('--acc', acc);
    rootStyle.setProperty('--acc2', acc2);

    // Conic gradient disc hues
    const h1 = ((a[0] + (currentTrack?.hOff || 0)) % 360 + 360) % 360;
    const h2 = (h1 + 45) % 360;
    rootStyle.setProperty('--h1', h1.toFixed(1));
    rootStyle.setProperty('--h2', h2.toFixed(1));

    setTheme({ top, bot, acc, acc2, ah: a[0], h });
  }, [zonedDate, effectiveWeather, weatherMuted, currentTrack]);

  // Compute effective weather based on live data and user preferences
  useEffect(() => {
    const updated: WeatherData = { ...liveWeather };

    // Apply Weather preference
    if (prefWeather !== 'default') {
      const manual = MANUAL_WX[prefWeather] || MANUAL_WX.clear;
      updated.cat = prefWeather;
      updated.label = manual.label;
      updated.icon = manual.icon;
      updated.cloud = manual.cloud;
    }

    // Apply Wind preference
    if (prefWind !== 'default') {
      updated.wind = prefWind;
    }

    setEffectiveWeather(updated);
    engine.updateWeather(updated, weatherMuted);
  }, [liveWeather, prefWeather, prefWind, weatherMuted, engine]);

  // Fetch live weather when coords change
  const loadWeather = useCallback(async (lat: number, lon: number, customTz?: string) => {
    try {
      const forecast = await fetchWeatherForecast(lat, lon);
      setLiveWeather(forecast);

      // Set target timezone
      const tz = customTz || forecast.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTargetTimezone(tz);
      setZonedDate(getZonedDate(tz));
    } catch (err) {
      console.warn('Weather fetch fallback:', err);
    }
  }, []);

  // Initial location detection (GPS)
  const initGps = useCallback(() => {
    setPlaceName('Locating…');
    setIsGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon, place: 'Your location', isUser: true });
          setPlaceName('Your location');
          loadWeather(lat, lon);
        },
        () => {
          // Fallback location (Jakarta)
          setCoords({ lat: -6.2, lon: 106.8, place: 'Jakarta', isUser: true });
          setPlaceName('Your location');
          loadWeather(-6.2, 106.8);
        },
        { timeout: 7000 }
      );
    } else {
      setCoords({ lat: -6.2, lon: 106.8, place: 'Jakarta', isUser: true });
      setPlaceName('Your location');
      loadWeather(-6.2, 106.8);
    }
  }, [loadWeather]);

  useEffect(() => {
    initGps();
  }, [initGps]);

  // Engine event subscriptions
  useEffect(() => {
    engine.onTrackChange = (track) => {
      setCurrentTrack(track);
    };

    // Apply initial stored preferences to engine
    if (prefBpm !== 'default') engine.setBpm(prefBpm);
    if (prefInstrument !== 'default') engine.setInstrument(prefInstrument);
    engine.setWeatherMuted(weatherMuted);
  }, [engine, prefBpm, prefInstrument, weatherMuted]);

  // Play / Pause handler
  const handleTogglePlay = async () => {
    if (!engine.playing) {
      await engine.start();
      setPlaying(true);
      document.body.classList.add('playing');
      showToast(`Streaming ${STATIONS[stationIndex].name}`);
    } else {
      engine.pause();
      setPlaying(false);
      document.body.classList.remove('playing');
      showToast('Stream paused');
    }
  };

  // Station navigation
  const handleSelectStation = (st: Station) => {
    const idx = STATIONS.findIndex((s) => s.id === st.id);
    if (idx !== -1) {
      setStationIndex(idx);
      engine.setStation(st);
      showToast(`Tuned to ${st.name}`);
    }
  };

  const handlePrevStation = () => {
    const nextIdx = (stationIndex - 1 + STATIONS.length) % STATIONS.length;
    setStationIndex(nextIdx);
    engine.setStation(STATIONS[nextIdx]);
    showToast(`Tuned to ${STATIONS[nextIdx].name}`);
  };

  const handleNextStation = () => {
    const nextIdx = (stationIndex + 1) % STATIONS.length;
    setStationIndex(nextIdx);
    engine.setStation(STATIONS[nextIdx]);
    showToast(`Tuned to ${STATIONS[nextIdx].name}`);
  };

  // Volume handler
  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    engine.setVolume(vol);
  };

  // City selection handler
  const handleSelectCity = (city: GeocodingResult | RecentLocation) => {
    const lat = city.latitude;
    const lon = city.longitude;

    setIsGps(false);
    setCoords({ lat, lon, place: city.name, isUser: false, timezone: city.timezone });
    setPlaceName(city.name);

    // Save to recents
    setRecentLocations((prev) => {
      const filtered = prev.filter((r) => r.name !== city.name);
      const updated: RecentLocation[] = [
        {
          name: city.name,
          latitude: lat,
          longitude: lon,
          country: 'country' in city ? city.country : undefined,
          timezone: city.timezone,
        },
        ...filtered,
      ].slice(0, 5);
      localStorage.setItem('ss-recents', JSON.stringify(updated));
      return updated;
    });

    loadWeather(lat, lon, city.timezone);
    showToast(`Location: ${city.name} (${city.timezone || 'Auto'})`);
  };

  // GPS Selection
  const handleSelectGps = () => {
    initGps();
    showToast('Switched to GPS location');
  };

  // Weather Preference
  const handleSelectWeather = (cat: 'default' | WeatherCategory) => {
    setPrefWeather(cat);
    if (cat === 'default') {
      localStorage.removeItem('ss-pref-wx');
      showToast('Weather set to Default (Live)');
    } else {
      localStorage.setItem('ss-pref-wx', cat);
      showToast(`Weather set to ${MANUAL_WX[cat]?.label}`);
    }
  };

  // Wind Preference
  const handleSelectWind = (speed: 'default' | number) => {
    setPrefWind(speed);
    if (speed === 'default') {
      localStorage.removeItem('ss-pref-wind');
      showToast('Wind set to Default (Live)');
    } else {
      localStorage.setItem('ss-pref-wind', String(speed));
      const lvl = WIND_LEVELS.find((l) => l.speed === speed);
      showToast(`Wind set to ${lvl?.name || speed} (${speed} km/h)`);
    }
  };

  // Instrument Preference
  const handleSelectInstrument = (inst: 'default' | InstrumentId) => {
    setPrefInstrument(inst);
    if (inst === 'default') {
      localStorage.removeItem('ss-pref-inst');
      engine.setInstrument(null);
      showToast('Instrument set to Auto');
    } else {
      localStorage.setItem('ss-pref-inst', inst);
      engine.setInstrument(inst);
      showToast(`Instrument set to ${inst.toUpperCase()}`);
    }
  };

  // BPM Preference
  const handleSelectBpm = (bpm: 'default' | number) => {
    setPrefBpm(bpm);
    if (bpm === 'default') {
      localStorage.removeItem('ss-pref-bpm');
      engine.setBpm(null);
      showToast('Tempo set to Default (Auto)');
    } else {
      localStorage.setItem('ss-pref-bpm', String(bpm));
      engine.setBpm(bpm);
      showToast(`Tempo set to ${bpm} BPM`);
    }
  };

  // Key Shuffle & Reset
  const handleShuffleKey = () => {
    const scaleKeys = Object.keys(SCALES) as ScaleName[];
    const randRoot = Math.floor(Math.random() * 12);
    const randScale = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    setLockedKey({ root: randRoot, scale: randScale });
    engine.setKey(randRoot, randScale);

    setCurrentTrack((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pc: randRoot,
        root: 48 + randRoot,
        rootName: noteNames[randRoot],
        scn: randScale,
        scale: randScale,
        key: `${noteNames[randRoot]} ${randScale}`,
      };
    });

    showToast(`Key locked: ${noteNames[randRoot]} ${randScale}`);
  };

  const handleResetKey = () => {
    setLockedKey(null);
    engine.setKey(null, null);
    if (engine.currentTrack) {
      setCurrentTrack({ ...engine.currentTrack });
    }
    showToast('Key unlocked (Auto)');
  };

  // Weather Mute Toggle
  const handleToggleWeatherMute = () => {
    const newMuted = !weatherMuted;
    setWeatherMuted(newMuted);
    localStorage.setItem('ss-pref-wx-muted', String(newMuted));
    engine.setWeatherMuted(newMuted);
    showToast(
      newMuted
        ? 'Weather ambient audio & visual effects muted'
        : 'Weather ambient audio & visual effects restored'
    );
  };

  const currentStation = STATIONS[stationIndex];

  return (
    <>
      {/* Background Animated Blobs */}
      <div className="bg">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      {/* Visual Canvas (Sun, Moon, Stars, Clouds, Rain, Fog, Spectrum Analyzer) */}
      <VisualCanvas
        engine={engine}
        weather={effectiveWeather}
        weatherMuted={weatherMuted}
        zonedDate={zonedDate}
        theme={theme}
        onBassLevelChange={setBassLevel}
      />

      <main>
        {/* Top Header with Clock, Date, Mood, and Collapsible Cards Drawer */}
        <Header
          zonedDate={zonedDate}
          station={currentStation}
          placeName={placeName}
          isGps={isGps}
          weather={effectiveWeather}
          prefWeather={prefWeather}
          prefWind={prefWind}
          prefInstrument={prefInstrument}
          recentLocations={recentLocations}
          onSelectGps={handleSelectGps}
          onSelectCity={handleSelectCity}
          onSelectWeather={handleSelectWeather}
          onSelectWind={handleSelectWind}
          onSelectInstrument={handleSelectInstrument}
        />

        {/* Now Playing Card with Vinyl, Title, BPM Popover, Key Shuffle, Weather Mute */}
        <NowPlaying
          track={currentTrack}
          station={currentStation}
          playing={playing}
          bassLevel={bassLevel}
          weather={effectiveWeather}
          weatherMuted={weatherMuted}
          prefBpm={prefBpm}
          lockedKey={lockedKey}
          volume={volume}
          onTogglePlay={handleTogglePlay}
          onPrevStation={handlePrevStation}
          onNextStation={handleNextStation}
          onVolumeChange={handleVolumeChange}
          onSelectBpm={handleSelectBpm}
          onShuffleKey={handleShuffleKey}
          onResetKey={handleResetKey}
          onToggleWeatherMute={handleToggleWeatherMute}
        />

        {/* Stations Grid */}
        <StationsGrid
          currentStation={currentStation}
          playing={playing}
          onSelectStation={handleSelectStation}
        />

        {/* Minimalist Bottom Toast Pill */}
        <Toast message={toastMessage} />
      </main>
    </>
  );
};
