import React, { useRef, useEffect } from 'react';
import { Station } from '../types';
import { STATIONS } from '../audio/theory/generator';

interface StationsGridProps {
  currentStation: Station;
  playing: boolean;
  onSelectStation: (station: Station) => void;
}

export const StationsGrid: React.FC<StationsGridProps> = ({
  currentStation,
  playing,
  onSelectStation,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll active station into view smoothly
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector<HTMLElement>('.st-pill.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentStation.id]);

  return (
    <section className="stations-section">
      <div className="section-header">
        <h2>STATIONS</h2>
        <span className="station-count">{STATIONS.length} VIBES</span>
      </div>

      <div className="station-ribbon" ref={scrollRef}>
        {STATIONS.map((st, idx) => {
          const isActive = st.id === currentStation.id;
          return (
            <button
              key={st.id}
              type="button"
              className={`st-pill ${isActive ? 'active' : ''}`}
              style={{ '--i': idx } as React.CSSProperties}
              onClick={() => onSelectStation(st)}
              aria-label={`Switch to ${st.name}`}
            >
              <div className="st-pill-glow" />
              
              <div className="st-pill-icon">
                <i className={`fa-solid ${st.icon}`} />
              </div>

              <div className="st-pill-content">
                <div className="st-pill-title-row">
                  <span className="st-name">{st.name}</span>
                  {isActive && (
                    <div className="st-eq" title={playing ? 'Playing live' : 'Paused'}>
                      <span className={`eq-bar b1 ${playing ? 'live' : ''}`} />
                      <span className={`eq-bar b2 ${playing ? 'live' : ''}`} />
                      <span className={`eq-bar b3 ${playing ? 'live' : ''}`} />
                    </div>
                  )}
                </div>
                <span className="st-desc">{st.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
