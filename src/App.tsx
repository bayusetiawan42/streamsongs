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
  SettlementType,
} from './types';
import { GeocodingResult } from './services/geocoding';
import {
  fetchWeatherForecast,
  MANUAL_WX,
  DEFAULT_WEATHER,
  WIND_LEVELS,
} from './services/weather';
import { getZonedDate } from './services/timezone';
import { classifySettlement, reverseGeocodeGPS } from './services/settlement';
import { computeTheme, ThemePalette } from './services/themeEngine';
import { VisualCanvas } from './components/VisualCanvas';
import { Header } from './components/Header';
import { NowPlaying } from './components/NowPlaying';
import { StationsGrid } from './components/StationsGrid';
import { Toast } from './components/Toast';

const DEFAULT_THEME: ThemePalette = {
  top: 'hsl(248 52% 6%)',
  bot: 'hsl(268 48% 12%)',
  acc: 'hsl(280 80% 68%)',
  acc2: 'hsl(335 85% 68%)',
  glow: 'hsl(280 90% 60%)',
  skyglowColor: 'rgba(255,160,90,0.25)',
  skyglowAlpha: 0,
  h1: 225,
  h2: 275,
  ah: 280,
  h: 0,
  isDay: false,
  starVisibility: 1.0,
  fireflyDensity: 0,
};

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

  // Zen Mode
  const [zenMode, setZenMode] = useState(false);

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

  // Settlement
  const [settlement, setSettlement] = useState<SettlementType>('metropolis');
  const [settlementLocked, setSettlementLocked] = useState(false);

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

  // Studio HD Sampler Status
  const [hdStatus, setHdStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  // Generative Transformation Bridge Info
  const [transitionInfo, setTransitionInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!engine) return;
    const updateSamplerState = () => {
      if (!engine.samplers) return;
      engine.samplers.onStatusChange = (inst, status) => {
        const statuses = Object.values(engine.samplers.status);
        const anyLoading = statuses.some((s) => s === 'loading');
        const anyReady = statuses.some((s) => s === 'ready');
        setHdStatus(anyLoading ? 'loading' : anyReady ? 'ready' : 'idle');

        if (status === 'ready') {
          const names: Record<string, string> = {
            tr808: 'Roland TR-808 Kit',
            piano: 'Steinway Concert Grand',
            organ: 'Cathedral Pipe Organ',
            rhodes: 'Rhodes Electric Piano',
            strings: 'Cello String Ensemble',
            pad: 'Cosmos Shimmer Pad'
          };
          showToast(`✨ ${names[inst] || inst} HD Samples Active`);
        }
      };
    };

    updateSamplerState();

    // Listen to drop / bridge / morph transitions (copy is mode-aware)
    engine.onTransitionChange = (inTransition, description) => {
      if (inTransition && description) {
        setTransitionInfo(description);
        showToast(description);
      } else {
        setTransitionInfo(null);
      }
    };
  }, [engine, showToast]);

  // Theme Object (fully managed by themeEngine)
  const [theme, setTheme] = useState<ThemePalette>(DEFAULT_THEME);

  // Keep zonedDate synchronized to targetTimezone every 1000ms
  useEffect(() => {
    const interval = setInterval(() => {
      setZonedDate(getZonedDate(targetTimezone));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTimezone]);

  // Recompute theme whenever any relevant state changes
  useEffect(() => {
    const currentStation = STATIONS[stationIndex];
    const newTheme = computeTheme({
      zonedDate,
      station: currentStation,
      weather: effectiveWeather,
      settlement,
      weatherMuted,
      trackHueOffset: currentTrack?.hOff || 0,
    });

    setTheme(newTheme);

    // Write CSS variables for UI components to consume
    const rs = document.documentElement.style;
    rs.setProperty('--top', newTheme.top);
    rs.setProperty('--bot', newTheme.bot);
    rs.setProperty('--acc', newTheme.acc);
    rs.setProperty('--acc2', newTheme.acc2);
    rs.setProperty('--glow', newTheme.glow);
    rs.setProperty('--h1', newTheme.h1.toFixed(1));
    rs.setProperty('--h2', newTheme.h2.toFixed(1));
  }, [zonedDate, stationIndex, effectiveWeather, settlement, weatherMuted, currentTrack]);

  // Compute effective weather based on live data and user preferences
  useEffect(() => {
    const updated: WeatherData = { ...liveWeather };

    if (prefWeather !== 'default') {
      const manual = MANUAL_WX[prefWeather] || MANUAL_WX.clear;
      updated.cat = prefWeather;
      updated.label = manual.label;
      updated.icon = manual.icon;
      updated.cloud = manual.cloud;
    }

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

      const tz = customTz || forecast.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTargetTimezone(tz);
      setZonedDate(getZonedDate(tz));
    } catch (err) {
      console.warn('Weather fetch fallback:', err);
    }
  }, []);

  // Classify settlement from GeocodingResult metadata
  const updateSettlementFromGeocode = useCallback(
    (city: GeocodingResult | RecentLocation) => {
      if (settlementLocked) return;
      const pop = 'population' in city ? city.population : undefined;
      const elev = 'elevation' in city ? city.elevation : undefined;
      const featureCode = 'feature_code' in city ? city.feature_code : undefined;
      const type = classifySettlement({
        population: pop,
        elevation: elev,
        featureCode,
      });
      setSettlement(type);
    },
    [settlementLocked]
  );

  // Initial GPS location detection
  const initGps = useCallback(() => {
    setPlaceName('Locating…');
    setIsGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon, place: 'Your location', isUser: true });

          // Reverse geocode for settlement info
          if (!settlementLocked) {
            reverseGeocodeGPS(lat, lon).then((info) => {
              setPlaceName(info.placeName || 'Your location');
              setSettlement(info.settlement);
            });
          }

          loadWeather(lat, lon);
        },
        () => {
          setCoords({ lat: -6.2, lon: 106.8, place: 'Jakarta', isUser: true });
          setPlaceName('Jakarta');
          if (!settlementLocked) setSettlement('metropolis'); // Jakarta default
          loadWeather(-6.2, 106.8);
        },
        { timeout: 7000 }
      );
    } else {
      setCoords({ lat: -6.2, lon: 106.8, place: 'Jakarta', isUser: true });
      setPlaceName('Jakarta');
      if (!settlementLocked) setSettlement('metropolis');
      loadWeather(-6.2, 106.8);
    }
  }, [loadWeather, settlementLocked]);

  useEffect(() => {
    initGps();
  }, [initGps]);

  // Zen Mode keyboard toggle
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          setZenMode((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Engine event subscriptions
  useEffect(() => {
    engine.onTrackChange = (track) => {
      setCurrentTrack(track);
    };

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

    // Classify settlement from geocode metadata
    updateSettlementFromGeocode(city);

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
          population: 'population' in city ? (city as GeocodingResult).population : undefined,
          elevation: 'elevation' in city ? (city as GeocodingResult).elevation : undefined,
        },
        ...filtered,
      ].slice(0, 5);
      localStorage.setItem('ss-recents', JSON.stringify(updated));
      return updated;
    });

    loadWeather(lat, lon, city.timezone);
    showToast(`Location: ${city.name} (${city.timezone || 'Auto'})`);
  };

  const handleSelectGps = () => {
    initGps();
    showToast('Switched to GPS location');
  };

  // Settlement manual override
  const handleSelectSettlement = (type: SettlementType) => {
    setSettlement(type);
    setSettlementLocked(true);
    showToast(`Atmosphere: ${type.charAt(0).toUpperCase() + type.slice(1)} vibe locked`);
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
      {/* Grain Texture Overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* Dynamic Background Blobs */}
      <div className="bg">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      {/* Living Visual Canvas */}
      <VisualCanvas
        engine={engine}
        weather={effectiveWeather}
        weatherMuted={weatherMuted}
        zonedDate={zonedDate}
        theme={theme}
        settlement={settlement}
      />

      {/* Main Content */}
      <main className={zenMode ? 'zen-active' : ''}>
        <Header
          zonedDate={zonedDate}
          station={currentStation}
          placeName={placeName}
          isGps={isGps}
          weather={effectiveWeather}
          settlement={settlement}
          prefWeather={prefWeather}
          prefWind={prefWind}
          prefInstrument={prefInstrument}
          recentLocations={recentLocations}
          zenMode={zenMode}
          onToggleZenMode={() => setZenMode((v) => !v)}
          onSelectGps={handleSelectGps}
          onSelectCity={handleSelectCity}
          onSelectWeather={handleSelectWeather}
          onSelectWind={handleSelectWind}
          onSelectInstrument={handleSelectInstrument}
          onSelectSettlement={handleSelectSettlement}
        />

        <NowPlaying
          track={currentTrack}
          station={currentStation}
          playing={playing}
          weather={effectiveWeather}
          weatherMuted={weatherMuted}
          prefBpm={prefBpm}
          lockedKey={lockedKey}
          volume={volume}
          hdAudioStatus={hdStatus}
          transitionInfo={transitionInfo}
          onTogglePlay={handleTogglePlay}
          onPrevStation={handlePrevStation}
          onNextStation={handleNextStation}
          onVolumeChange={handleVolumeChange}
          onSelectBpm={handleSelectBpm}
          onShuffleKey={handleShuffleKey}
          onResetKey={handleResetKey}
          onToggleWeatherMute={handleToggleWeatherMute}
        />

        <StationsGrid
          currentStation={currentStation}
          playing={playing}
          onSelectStation={handleSelectStation}
        />

        <Toast message={toastMessage} />
      </main>

      {/* Zen Mode Overlay - minimal clock + song name when UI hidden */}
      {zenMode && (
        <div className="zen-overlay" onClick={() => setZenMode(false)}>
          <div className="zen-clock">{currentTrack?.title || 'Streaming…'}</div>
          <div className="zen-hint">Click anywhere or press Z to exit</div>
        </div>
      )}
    </>
  );
};
