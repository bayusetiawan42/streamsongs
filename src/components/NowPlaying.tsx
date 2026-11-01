import React, { useState, useEffect, useRef } from 'react';
import { Track, Station, WeatherData } from '../types';
import { ScaleName, NOTE_NAMES } from '../audio/theory/scales';

interface NowPlayingProps {
  track: Track | null;
  station: Station;
  playing: boolean;
  weather: WeatherData;
  weatherMuted: boolean;
  prefBpm: 'default' | number;
  lockedKey: { root: number; scale: ScaleName } | null;
  volume: number;
  hdAudioStatus?: 'idle' | 'loading' | 'ready';
  onTogglePlay: () => void;
  onPrevStation: () => void;
  onNextStation: () => void;
  onVolumeChange: (vol: number) => void;
  onSelectBpm: (bpm: 'default' | number) => void;
  onShuffleKey: () => void;
  onResetKey: () => void;
  onToggleWeatherMute: () => void;
}

const BPM_OPTIONS: { label: string; val: 'default' | number; sub?: string }[] = [
  { label: 'Default (Auto)', val: 'default', sub: 'Adapts per song & period' },
  { label: '60 BPM', val: 60, sub: 'Deep ambient, meditation' },
  { label: '70 BPM', val: 70, sub: 'Very slow, relaxed' },
  { label: '80 BPM', val: 80, sub: 'Classic chill lo-fi' },
  { label: '90 BPM', val: 90, sub: 'Gentle groove, focus' },
  { label: '100 BPM', val: 100, sub: 'Medium upbeat, study' },
  { label: '110 BPM', val: 110, sub: 'Lively, walking groove' },
  { label: '120 BPM', val: 120, sub: 'Driving synthwave, arcade' },
  { label: '130 BPM', val: 130, sub: 'Fast energetic tempo' },
  { label: '140 BPM', val: 140, sub: 'High energy chiptune' },
];

export const NowPlaying: React.FC<NowPlayingProps> = ({
  track,
  station,
  playing,
  weather,
  weatherMuted,
  prefBpm,
  lockedKey,
  volume,
  hdAudioStatus,
  onTogglePlay,
  onPrevStation,
  onNextStation,
  onVolumeChange,
  onSelectBpm,
  onShuffleKey,
  onResetKey,
  onToggleWeatherMute,
}) => {
  // Floating Popover for BPM
  const [bpmPopoverOpen, setBpmPopoverOpen] = useState(false);
  const bpmTagRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Key tag long-press handling
  const longPressTimerRef = useRef<number | null>(null);
  const [isPressingKey, setIsPressingKey] = useState(false);
  const [keyShuffleAnim, setKeyShuffleAnim] = useState(false);
  const [bpmAnim, setBpmAnim] = useState(false);
  const [wxAnim, setWxAnim] = useState(false);

  // Title swap animation
  const [titleSwap, setTitleSwap] = useState(false);
  const prevTitleRef = useRef(track?.title);

  useEffect(() => {
    if (track?.title && track.title !== prevTitleRef.current) {
      prevTitleRef.current = track.title;
      setTitleSwap(true);
      const timer = setTimeout(() => setTitleSwap(false), 700);
      return () => clearTimeout(timer);
    }
  }, [track?.title]);

  const toggleBpmPopover = () => {
    setBpmPopoverOpen((prev) => !prev);
  };

  // Close BPM popover on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        bpmPopoverOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        bpmTagRef.current &&
        !bpmTagRef.current.contains(e.target as Node)
      ) {
        setBpmPopoverOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && bpmPopoverOpen) {
        setBpmPopoverOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [bpmPopoverOpen]);

  // Handle Key tag tap vs long press
  const handleKeyPointerDown = () => {
    setIsPressingKey(true);
    longPressTimerRef.current = window.setTimeout(() => {
      // Long press fired -> Reset to default (Auto)
      setIsPressingKey(false);
      longPressTimerRef.current = null;
      onResetKey();
    }, 550);
  };

  const handleKeyPointerUp = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      // Normal click -> Shuffle key
      setKeyShuffleAnim(true);
      setTimeout(() => setKeyShuffleAnim(false), 500);
      onShuffleKey();
    }
    setIsPressingKey(false);
  };

  const handleKeyPointerLeave = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsPressingKey(false);
  };

  // BPM: Round to integer so it never displays decimals (e.g. 83.192318)
  const currentBpm = track ? Math.round(track.bpm) : 80;
  const bpmIcon =
    currentBpm < 75
      ? 'fa-gauge-simple'
      : currentBpm < 105
      ? 'fa-gauge-simple-high'
      : 'fa-gauge-high';

  // Key display: uses lockedKey immediately if set, otherwise track key
  const keyDisplay = lockedKey
    ? `${NOTE_NAMES[lockedKey.root]} ${lockedKey.scale}`
    : track
    ? `${track.rootName || NOTE_NAMES[track.pc]} ${track.scale || track.scn}`
    : 'C major';

  return (
    <div className="card">
      <div className="now">
        {/* Vinyl Disc with Direct CSS Variable Bass Pulsing (Zero React re-render) */}
        <div className="art" id="art">
          <div className="disc" />
        </div>

        {/* Track and Station Information */}
        <div id="tinfo" className={`info ${titleSwap ? 'swap' : ''}`}>
          <div className="label">
            <span id="sname">{station.name}</span>
            <span className="live">
              <i />
              <span className="on">ON AIR</span>
              <span className="off">READY</span>
            </span>
          </div>

          <div id="title">{track?.title || 'Waiting for stream…'}</div>

          {/* Interactive Tags Row */}
          <div className="tags">
            {/* 1. Key / Scale Tag: Tap to Shuffle, Long-press to Unlock (Reset) */}
            <button
              type="button"
              className={`tag ${lockedKey ? 'active' : ''} ${isPressingKey ? 'pressing' : ''}`}
              id="tag-key"
              onPointerDown={handleKeyPointerDown}
              onPointerUp={handleKeyPointerUp}
              onPointerLeave={handleKeyPointerLeave}
              title="Tap to shuffle key/scale · Long-press to reset to Auto"
            >
              <i
                className={`fa-solid ${
                  keyShuffleAnim ? 'fa-shuffle icon-pop-in' : 'fa-music'
                }`}
              />
              <span id="key-txt">{keyDisplay}</span>
              <span className={`pin-dot ${lockedKey ? 'active' : ''}`} />
            </button>

            {/* 2. BPM Tag with Popover Anchored Directly Below It */}
            <div className="bpm-wrapper">
              <button
                ref={bpmTagRef}
                type="button"
                className={`tag ${prefBpm !== 'default' ? 'active' : ''} ${bpmAnim ? 'chip-pulsing' : ''}`}
                id="tag-bpm"
                onClick={toggleBpmPopover}
                aria-expanded={bpmPopoverOpen}
                title="Change tempo (BPM)"
              >
                <i className={`fa-solid ${bpmIcon} ${bpmAnim ? 'icon-pop-in' : ''}`} />
                <span id="bpm-txt">{currentBpm} BPM</span>
                <i className="fa-solid fa-chevron-down chev" />
              </button>

              {/* Floating Glass Popover directly anchored below BPM button */}
              <div
                ref={popoverRef}
                id="pop-bpm"
                className={`popover ${bpmPopoverOpen ? 'open' : ''}`}
              >
                <div className="pop-header">
                  <span>
                    <i className="fa-solid fa-gauge-simple-high" /> Tempo (BPM)
                  </span>
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={() => setBpmPopoverOpen(false)}
                    aria-label="Close BPM menu"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>

                <div className="pop-list">
                  {BPM_OPTIONS.map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      className={`pop-opt ${prefBpm === opt.val ? 'active' : ''}`}
                      onClick={() => {
                        setBpmAnim(true);
                        setTimeout(() => setBpmAnim(false), 500);
                        onSelectBpm(opt.val);
                        setBpmPopoverOpen(false);
                      }}
                    >
                      <i className="fa-solid fa-gauge opt-ic" />
                      <div className="opt-txt">
                        {opt.label}
                        {opt.sub && <span className="opt-sub">{opt.sub}</span>}
                      </div>
                      <i className="fa-solid fa-check opt-chk" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Weather Tag: Tap to Toggle Mute Weather Effects */}
            <button
              type="button"
              className={`tag ${weatherMuted ? 'muted' : ''} ${wxAnim ? 'chip-pulsing' : ''}`}
              id="tag-wx"
              onClick={() => {
                setWxAnim(true);
                setTimeout(() => setWxAnim(false), 450);
                onToggleWeatherMute();
              }}
              title={
                weatherMuted
                  ? 'Click to restore ambient sound & weather visual effects'
                  : 'Click to mute ambient sound & weather visual effects'
              }
            >
              <i
                className={`fa-solid ${
                  weatherMuted ? 'fa-ban icon-pop-in' : `${weather.icon} ${wxAnim ? 'icon-pop-in' : ''}`
                }`}
              />
              <span id="twx">{weather.label}</span>
            </button>

            {/* 4. Studio HD Sampler Status Tag */}
            {hdAudioStatus === 'loading' && (
              <span className="tag" title="Loading studio audio samples...">
                <i className="fa-solid fa-circle-notch fa-spin" />
                <span>HD Buffering…</span>
              </span>
            )}
            {hdAudioStatus === 'ready' && (
              <span className="tag active" title="Studio HD Sampler Active (Authentic multi-sampled instruments)">
                <i className="fa-solid fa-wand-magic-sparkles" />
                <span>HD Audio</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="ctl">
        <button
          type="button"
          className="ctl-btn"
          id="prev"
          onClick={onPrevStation}
          title="Previous station"
          aria-label="Previous station"
        >
          <i className="fa-solid fa-backward-step" />
        </button>

        <button
          type="button"
          id="play"
          onClick={onTogglePlay}
          title={playing ? 'Pause stream' : 'Play stream'}
          aria-label={playing ? 'Pause stream' : 'Play stream'}
        >
          <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} />
        </button>

        <button
          type="button"
          className="ctl-btn"
          id="next"
          onClick={onNextStation}
          title="Next station"
          aria-label="Next station"
        >
          <i className="fa-solid fa-forward-step" />
        </button>
      </div>

      {/* Volume Slider Row */}
      <div className="volrow">
        <i
          className={`fa-solid ${
            volume === 0
              ? 'fa-volume-xmark'
              : volume < 0.5
              ? 'fa-volume-low'
              : 'fa-volume-high'
          }`}
        />
        <input
          type="range"
          id="vol"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          title="Master volume"
          aria-label="Master volume"
        />
      </div>
    </div>
  );
};
