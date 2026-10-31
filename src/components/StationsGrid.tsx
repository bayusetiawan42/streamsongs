import React from 'react';
import { Station } from '../types';
import { STATIONS } from '../audio/theory/generator';

interface StationsGridProps {
  currentStation: Station;
  playing: boolean;
  onSelectStation: (station: Station) => void;
}

export const StationsGrid: React.FC<StationsGridProps> = ({
  currentStation,
  onSelectStation,
}) => {
  return (
    <section>
      <h2>Stations</h2>
      <div id="stations">
        {STATIONS.map((st, idx) => {
          const isActive = st.id === currentStation.id;
          return (
            <button
              key={st.id}
              type="button"
              className={`st ${isActive ? 'on' : ''}`}
              style={{ '--i': idx } as React.CSSProperties}
              onClick={() => onSelectStation(st)}
            >
              <div className="onair">
                <span>ON AIR</span>
                <div className="eq">
                  <s />
                  <s />
                  <s />
                  <s />
                </div>
              </div>
              <i className={`fa-solid ${st.icon} ic`} />
              <b>{st.name}</b>
              <small>{st.desc}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
};
