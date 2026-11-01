import React, { useState, useEffect, useRef } from 'react';
import {
  WeatherCategory,
  WeatherData,
  RecentLocation,
  WindLevel,
  InstrumentId,
  Station,
  SettlementType,
} from '../types';
import { searchCities, GeocodingResult } from '../services/geocoding';
import { MANUAL_WX, WIND_LEVELS, getWindIcon } from '../services/weather';
import { formatTime, formatDate, getPeriodOf } from '../services/timezone';
import { SETTLEMENT_DICTIONARY } from '../services/settlement';

interface HeaderProps {
  zonedDate: Date;
  station: Station;
  placeName: string;
  isGps: boolean;
  weather: WeatherData;
  settlement: SettlementType;
  prefWeather: 'default' | WeatherCategory;
  prefWind: 'default' | number;
  prefInstrument: 'default' | InstrumentId;
  recentLocations: RecentLocation[];
  zenMode?: boolean;
  onToggleZenMode?: () => void;
  onSelectGps: () => void;
  onSelectCity: (city: GeocodingResult | RecentLocation) => void;
  onSelectWeather: (cat: 'default' | WeatherCategory) => void;
  onSelectWind: (speed: 'default' | number) => void;
  onSelectInstrument: (inst: 'default' | InstrumentId) => void;
  onSelectSettlement?: (settlement: SettlementType) => void;
}

type DrawerTab = 'location' | 'weather' | 'wind' | 'instrument' | null;

const INSTRUMENT_OPTIONS: { id: InstrumentId; name: string; icon: string; desc: string }[] = [
  { id: 'rhodes', name: 'Warm Rhodes', icon: 'fa-keyboard', desc: 'FM electric piano with lush bell tines' },
  { id: 'kalimba', name: 'Glass Kalimba', icon: 'fa-gem', desc: 'Resonant acoustic thumb piano' },
  { id: 'pad', name: 'Analog Pad', icon: 'fa-water', desc: 'Lush chorused detuned waves' },
  { id: 'flute', name: 'Bamboo Flute', icon: 'fa-wind', desc: 'Expressive airy woodwind' },
  { id: 'harp', name: 'Acoustic Harp', icon: 'fa-music', desc: 'Plucked nylon and acoustic strings' },
  { id: 'synthwave', name: 'Synthwave Lead', icon: 'fa-bolt', desc: 'Punchy 80s detuned saw lead' },
  { id: 'chiptune', name: '8-Bit Chiptune', icon: 'fa-gamepad', desc: 'Classic retro square waves' },
  { id: 'organ', name: 'Pipe Organ', icon: 'fa-church', desc: 'Cathedral pipe organ with majestic acoustic resonance' },
  { id: 'cowbell', name: '808 Cowbell', icon: 'fa-bell', desc: 'Metallic Memphis tuned 808 cowbell with punchy phonk attack' },
];

export const Header: React.FC<HeaderProps> = ({
  zonedDate,
  station,
  placeName,
  isGps,
  weather,
  settlement,
  prefWeather,
  prefWind,
  prefInstrument,
  recentLocations,
  zenMode = false,
  onToggleZenMode,
  onSelectGps,
  onSelectCity,
  onSelectWeather,
  onSelectWind,
  onSelectInstrument,
  onSelectSettlement,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Animation trigger states
  const [animLoc, setAnimLoc] = useState(false);
  const [animWx, setAnimWx] = useState(false);
  const [animWind, setAnimWind] = useState(false);
  const [animInst, setAnimInst] = useState(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close drawer on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeTab && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setActiveTab(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTab]);

  // Debounced geocoding search
  const searchTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = window.setTimeout(async () => {
      const res = await searchCities(searchQuery.trim());
      setSearchResults(res);
      setSearching(false);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const toggleTab = (tab: DrawerTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const triggerAnimation = (type: 'loc' | 'wx' | 'wind' | 'inst') => {
    if (type === 'loc') {
      setAnimLoc(true);
      setTimeout(() => setAnimLoc(false), 500);
    } else if (type === 'wx') {
      setAnimWx(true);
      setTimeout(() => setAnimWx(false), 500);
    } else if (type === 'wind') {
      setAnimWind(true);
      setTimeout(() => setAnimWind(false), 500);
    } else if (type === 'inst') {
      setAnimInst(true);
      setTimeout(() => setAnimInst(false), 500);
    }
  };

  const currentPeriod = getPeriodOf(zonedDate);
  const moodText = `${currentPeriod.toUpperCase()} · ${(station.mood || station.desc || station.name).toUpperCase()}`;

  // Current instrument label & icon
  const currentInstObj = INSTRUMENT_OPTIONS.find((i) => i.id === prefInstrument);
  const instLabel = prefInstrument === 'default' ? 'Auto Inst' : currentInstObj?.name || 'Instrument';
  const instIcon = prefInstrument === 'default' ? 'fa-sliders' : currentInstObj?.icon || 'fa-sliders';

  // Current wind display
  const windIcon =
    prefWind === 'default'
      ? getWindIcon(weather.wind)
      : WIND_LEVELS.find((l) => l.speed === prefWind)?.icon || getWindIcon(weather.wind);

  const windText =
    prefWind === 'default'
      ? `${weather.wind} km/h`
      : `${WIND_LEVELS.find((l) => l.speed === prefWind)?.name || ''} · ${prefWind} km/h`;

  // Current weather display
  const wxText =
    prefWeather === 'default'
      ? `${weather.temp}°C · ${weather.label}`
      : MANUAL_WX[prefWeather]?.label || weather.label;

  const currentSettlement = SETTLEMENT_DICTIONARY[settlement] || SETTLEMENT_DICTIONARY.metropolis;

  return (
    <header className="app-header">
      <div className="top-island" id="top-card" ref={drawerRef}>
        <div className="top-chips">
          {/* Location & Settlement Chip */}
          <button
            type="button"
            className={`chip chip-loc ${activeTab === 'location' ? 'active' : ''} ${animLoc ? 'chip-pulsing' : ''}`}
            id="chip-loc"
            onClick={() => toggleTab('location')}
            aria-expanded={activeTab === 'location'}
            title="Location & settlement vibe"
          >
            <i
              id="loc-icon"
              className={`fa-solid ${isGps ? 'fa-location-dot' : 'fa-map-pin'} ${
                animLoc ? 'icon-pop-in' : ''
              }`}
            />
            <span id="place">{placeName}</span>
            <span className="settlement-badge" title={currentSettlement.description}>
              <i className={`fa-solid ${currentSettlement.icon}`} />
              <span className="settlement-badge-txt">{currentSettlement.label}</span>
            </span>
            <i className="fa-solid fa-chevron-down chev" />
          </button>

          {/* Weather Chip */}
          <button
            type="button"
            className={`chip ${activeTab === 'weather' ? 'active' : ''} ${animWx ? 'chip-pulsing' : ''}`}
            id="chip-wx"
            onClick={() => toggleTab('weather')}
            aria-expanded={activeTab === 'weather'}
            title="Change weather"
          >
            <i
              id="wicon"
              className={`fa-solid ${weather.icon} ${animWx ? 'icon-pop-in' : ''}`}
            />
            <span id="wtxt">{wxText}</span>
            <i className="fa-solid fa-chevron-down chev" />
          </button>

          {/* Wind Chip */}
          <button
            type="button"
            className={`chip ${activeTab === 'wind' ? 'active' : ''} ${animWind ? 'chip-pulsing' : ''}`}
            id="chip-wind"
            onClick={() => toggleTab('wind')}
            aria-expanded={activeTab === 'wind'}
            title="Change wind"
          >
            <i
              id="wind-icon"
              className={`fa-solid ${windIcon} ${animWind ? 'icon-pop-in' : ''}`}
            />
            <span id="wwind">{windText}</span>
            <i className="fa-solid fa-chevron-down chev" />
          </button>

          {/* Instrument Chip */}
          <button
            type="button"
            className={`chip ${activeTab === 'instrument' ? 'active' : ''} ${animInst ? 'chip-pulsing' : ''}`}
            id="chip-inst"
            onClick={() => toggleTab('instrument')}
            aria-expanded={activeTab === 'instrument'}
            title="Change instrument synthesizer"
          >
            <i
              id="inst-icon"
              className={`fa-solid ${instIcon} ${animInst ? 'icon-pop-in' : ''}`}
            />
            <span id="inst-txt">{instLabel}</span>
            <i className="fa-solid fa-chevron-down chev" />
          </button>

          {/* Zen Mode Button */}
          {onToggleZenMode && (
            <button
              type="button"
              className={`chip zen-chip ${zenMode ? 'active' : ''}`}
              onClick={onToggleZenMode}
              title="Toggle Zen Mode (Z)"
              aria-label="Zen Mode"
            >
              <i className={`fa-solid ${zenMode ? 'fa-compress' : 'fa-expand'}`} />
              <span className="zen-txt">Zen</span>
            </button>
          )}
        </div>

        {/* In-Flow Collapsible Accordion Drawer */}
        <div
          id="top-drawer"
          className={`collapse-drawer ${activeTab !== null ? 'open' : ''}`}
          aria-hidden={activeTab === null}
        >
          <div className="drawer-inner">
            <div className="drawer-card">
              {/* Drawer Header */}
              <div className="drawer-head">
                <span id="drawer-title">
                  {activeTab === 'location' && (
                    <>
                      <i className="fa-solid fa-location-dot" /> Location & Atmosphere
                    </>
                  )}
                  {activeTab === 'weather' && (
                    <>
                      <i className="fa-solid fa-cloud-sun" /> Select Weather
                    </>
                  )}
                  {activeTab === 'wind' && (
                    <>
                      <i className="fa-solid fa-wind" /> Wind Preference
                    </>
                  )}
                  {activeTab === 'instrument' && (
                    <>
                      <i className="fa-solid fa-sliders" /> Instrument Synthesizer
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="drawer-close"
                  onClick={() => setActiveTab(null)}
                  title="Close"
                  aria-label="Close drawer"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="drawer-body">
                {/* 1. Location Drawer */}
                {activeTab === 'location' && (
                  <div>
                    {/* Settlement Atmosphere Override / Experience Pills */}
                    {onSelectSettlement && (
                      <div className="settlement-picker-row">
                        <div className="pop-sec-title">Atmosphere Vibe</div>
                        <div className="settlement-options-strip">
                          {(Object.keys(SETTLEMENT_DICTIONARY) as SettlementType[]).map((stKey) => {
                            const info = SETTLEMENT_DICTIONARY[stKey];
                            const isCur = settlement === stKey;
                            return (
                              <button
                                key={stKey}
                                type="button"
                                className={`settlement-pill-btn ${isCur ? 'active' : ''}`}
                                onClick={() => {
                                  onSelectSettlement(stKey);
                                  triggerAnimation('loc');
                                }}
                                title={info.description}
                              >
                                <i className={`fa-solid ${info.icon}`} />
                                <span>{info.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pop-sec-title" style={{ marginTop: '8px' }}>Select Target City</div>

                    <button
                      type="button"
                      className={`pop-opt gps-btn ${isGps ? 'active' : ''}`}
                      onClick={() => {
                        triggerAnimation('loc');
                        onSelectGps();
                        setActiveTab(null);
                      }}
                    >
                      <i className="fa-solid fa-location-crosshairs opt-ic" />
                      <div className="opt-txt">
                        Your location
                        <span className="opt-sub">Use automatic device GPS</span>
                      </div>
                      <i className="fa-solid fa-check opt-chk" />
                    </button>

                    <div className="pop-search">
                      <i className="fa-solid fa-magnifying-glass" />
                      <input
                        type="text"
                        placeholder="Search city (e.g. Tokyo, Ubud, Hallstatt, Zermatt)…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="pop-list">
                      {searching && (
                        <div className="pop-empty">
                          <i className="fa-solid fa-circle-notch fa-spin" /> Searching cities…
                        </div>
                      )}

                      {!searching &&
                        searchResults.length > 0 &&
                        searchResults.map((city, idx) => (
                          <button
                            key={`${city.name}-${city.latitude}-${idx}`}
                            type="button"
                            className="pop-opt"
                            onClick={() => {
                              triggerAnimation('loc');
                              onSelectCity(city);
                              setActiveTab(null);
                              setSearchQuery('');
                            }}
                          >
                            <i className="fa-solid fa-city opt-ic" />
                            <div className="opt-txt">
                              {city.name}
                              <span className="opt-sub">
                                {[city.admin1, city.country].filter(Boolean).join(', ')} (
                                {city.timezone || 'UTC'})
                              </span>
                            </div>
                          </button>
                        ))}

                      {!searching && searchQuery && searchResults.length === 0 && (
                        <div className="pop-empty">No cities found</div>
                      )}

                      {!searchQuery && recentLocations.length > 0 && (
                        <>
                          <div className="pop-sec-title">Recent Locations</div>
                          {recentLocations.map((item, idx) => (
                            <button
                              key={`${item.name}-${idx}`}
                              type="button"
                              className={`pop-opt ${placeName === item.name ? 'active' : ''}`}
                              onClick={() => {
                                triggerAnimation('loc');
                                onSelectCity(item);
                                setActiveTab(null);
                              }}
                            >
                              <i className="fa-solid fa-clock-rotate-left opt-ic" />
                              <div className="opt-txt">
                                {item.name}
                                <span className="opt-sub">{item.timezone || 'Auto'}</span>
                              </div>
                              <i className="fa-solid fa-check opt-chk" />
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Weather Drawer */}
                {activeTab === 'weather' && (
                  <div className="opts-grid">
                    <button
                      type="button"
                      className={`pop-opt def-opt ${prefWeather === 'default' ? 'active' : ''}`}
                      onClick={() => {
                        triggerAnimation('wx');
                        onSelectWeather('default');
                        setActiveTab(null);
                      }}
                    >
                      <i className="fa-solid fa-bolt-auto opt-ic" />
                      <div className="opt-txt">
                        Default (Live)
                        <span className="opt-sub">Follow current location weather</span>
                      </div>
                      <i className="fa-solid fa-check opt-chk" />
                    </button>

                    {(Object.keys(MANUAL_WX) as WeatherCategory[]).map((cat) => {
                      const item = MANUAL_WX[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`pop-opt ${prefWeather === cat ? 'active' : ''}`}
                          onClick={() => {
                            triggerAnimation('wx');
                            onSelectWeather(cat);
                            setActiveTab(null);
                          }}
                        >
                          <i className={`fa-solid ${item.icon} opt-ic`} />
                          <div className="opt-txt">{item.label}</div>
                          <i className="fa-solid fa-check opt-chk" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. Wind Drawer */}
                {activeTab === 'wind' && (
                  <div className="opts-grid">
                    <button
                      type="button"
                      className={`pop-opt def-opt ${prefWind === 'default' ? 'active' : ''}`}
                      onClick={() => {
                        triggerAnimation('wind');
                        onSelectWind('default');
                        setActiveTab(null);
                      }}
                    >
                      <i className="fa-solid fa-bolt-auto opt-ic" />
                      <div className="opt-txt">
                        Default (Live)
                        <span className="opt-sub">Follow current location wind speed</span>
                      </div>
                      <i className="fa-solid fa-check opt-chk" />
                    </button>

                    {WIND_LEVELS.map((lvl: WindLevel) => (
                      <button
                        key={lvl.name}
                        type="button"
                        className={`pop-opt ${prefWind === lvl.speed ? 'active' : ''}`}
                        onClick={() => {
                          triggerAnimation('wind');
                          onSelectWind(lvl.speed);
                          setActiveTab(null);
                        }}
                      >
                        <i className={`fa-solid ${lvl.icon} opt-ic`} />
                        <div className="opt-txt">
                          {lvl.name}
                          <span className="opt-sub">{lvl.speed} km/h</span>
                        </div>
                        <i className="fa-solid fa-check opt-chk" />
                      </button>
                    ))}
                  </div>
                )}

                {/* 4. Instrument Drawer */}
                {activeTab === 'instrument' && (
                  <div className="opts-grid">
                    <button
                      type="button"
                      className={`pop-opt def-opt ${prefInstrument === 'default' ? 'active' : ''}`}
                      onClick={() => {
                        triggerAnimation('inst');
                        onSelectInstrument('default');
                        setActiveTab(null);
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles opt-ic" />
                      <div className="opt-txt">
                        Auto (Station Default)
                        <span className="opt-sub">Adapts intelligently per song & station</span>
                      </div>
                      <i className="fa-solid fa-check opt-chk" />
                    </button>

                    {INSTRUMENT_OPTIONS.map((inst) => (
                      <button
                        key={inst.id}
                        type="button"
                        className={`pop-opt ${prefInstrument === inst.id ? 'active' : ''}`}
                        onClick={() => {
                          triggerAnimation('inst');
                          onSelectInstrument(inst.id);
                          setActiveTab(null);
                        }}
                      >
                        <i className={`fa-solid ${inst.icon} opt-ic`} />
                        <div className="opt-txt">
                          {inst.name}
                          <span className="opt-sub">{inst.desc}</span>
                        </div>
                        <i className="fa-solid fa-check opt-chk" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Minimalist Clock, Date, and Mood */}
      <div className="hero-clock-block">
        <div id="clock">{formatTime(zonedDate)}</div>
        <div id="date">{formatDate(zonedDate)}</div>
        <div id="mood">{moodText}</div>
      </div>
    </header>
  );
};
