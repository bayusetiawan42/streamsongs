import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../audio/engine';
import { WeatherData } from '../types';

interface VisualCanvasProps {
  engine: AudioEngine;
  weather: WeatherData;
  weatherMuted: boolean;
  zonedDate: Date;
  theme: { top: string; bot: string; acc: string; acc2: string; ah: number; h: number };
  onBassLevelChange?: (level: number) => void;
}

interface Star {
  x: number;
  y: number;
  r: number;
  p: number;
}

interface Drop {
  x: number;
  y: number;
  l: number;
  v: number;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  v: number;
  p: number;
}

interface Cloud {
  x: number;
  y: number;
  r: number;
  v: number;
  a: number;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  engine,
  weather,
  weatherMuted,
  zonedDate,
  theme,
  onBassLevelChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const starsRef = useRef<Star[]>(
    Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.7,
      r: Math.random() * 1.4 + 0.4,
      p: Math.random() * 6,
    }))
  );

  const dropsRef = useRef<Drop[]>(
    Array.from({ length: 170 }, () => ({
      x: Math.random(),
      y: Math.random(),
      l: Math.random() * 0.03 + 0.02,
      v: Math.random() * 0.012 + 0.014,
    }))
  );

  const flakesRef = useRef<Flake[]>(
    Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 2.4 + 1,
      v: Math.random() * 0.0018 + 0.0012,
      p: Math.random() * 6,
    }))
  );

  const cloudsRef = useRef<Cloud[]>(
    Array.from({ length: 8 }, () => ({
      x: Math.random(),
      y: 0.05 + Math.random() * 0.45,
      r: 0.12 + Math.random() * 0.14,
      v: Math.random() * 0.00008 + 0.00003,
      a: 0.5 + Math.random() * 0.5,
    }))
  );

  const weatherStateRef = useRef({ cloud: 0, rain: 0, snow: 0, fog: 0 });
  const bassLevelRef = useRef(0);
  const flashRef = useRef(0);

  // Periodic thunder trigger when weather is storm and not muted
  useEffect(() => {
    let timer: number;
    const scheduleThunder = () => {
      if (weather.cat === 'storm' && !weatherMuted) {
        flashRef.current = 1.0;
        engine.triggerThunder();
      }
      timer = window.setTimeout(scheduleThunder, 7000 + Math.random() * 14000);
    };
    timer = window.setTimeout(scheduleThunder, 5000);
    return () => clearTimeout(timer);
  }, [weather.cat, weatherMuted, engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cw = 0;
    let ch = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = window.innerWidth;
      ch = window.innerHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    resize();

    let animFrame: number;

    const render = (ts: number) => {
      ctx.clearRect(0, 0, cw, ch);
      const sec = ts / 1000;

      // Weather state target lerp
      const tg = weatherMuted
        ? { cloud: 0, rain: 0, snow: 0, fog: 0 }
        : {
            cloud: weather.cloud / 100,
            rain: weather.cat === 'rain' ? 1 : weather.cat === 'storm' ? 1.4 : 0,
            snow: weather.cat === 'snow' ? 1 : 0,
            fog: weather.cat === 'fog' ? 1 : 0,
          };

      const ws = weatherStateRef.current;
      ws.cloud += (tg.cloud - ws.cloud) * 0.03;
      ws.rain += (tg.rain - ws.rain) * 0.03;
      ws.snow += (tg.snow - ws.snow) * 0.03;
      ws.fog += (tg.fog - ws.fog) * 0.03;

      // Spectrum analyzer & bass level
      let bins: Uint8Array | null = null;
      let tl = 0;
      if (engine.playing && engine.analyser && engine.analyserData) {
        engine.analyser.getByteFrequencyData(engine.analyserData);
        bins = engine.analyserData;
        for (let i = 0; i < 6; i++) {
          tl += bins[i];
        }
        tl /= 6 * 255;
      }
      bassLevelRef.current += (tl - bassLevelRef.current) * 0.25;
      const lvl = bassLevelRef.current;
      if (onBassLevelChange) {
        onBassLevelChange(lvl);
      }

      // Hour of target location (from zonedDate)
      const hr =
        zonedDate.getHours() +
        zonedDate.getMinutes() / 60 +
        zonedDate.getSeconds() / 3600;
      const day = hr >= 6 && hr < 18;

      // Stars (at night)
      if (!day) {
        const sa = (1 - Math.min(1, ws.cloud) * 0.85) * (1 - Math.min(1, ws.rain) * 0.8);
        ctx.fillStyle = '#fff';
        for (const s of starsRef.current) {
          ctx.globalAlpha =
            Math.max(0, sa) * (0.35 + 0.65 * Math.abs(Math.sin(sec * 1.2 + s.p)));
          ctx.beginPath();
          ctx.arc(s.x * cw, s.y * ch, s.r, 0, 7);
          ctx.fill();
        }
      }

      // Celestial body (Sun / Moon)
      const p = day ? (hr - 6) / 12 : ((hr - 18 + 24) % 24) / 12;
      const x = cw * (0.1 + 0.8 * p);
      const y = ch * 0.5 - Math.sin(Math.PI * p) * ch * 0.35;
      const r = 34 + lvl * 28 + Math.sin(sec) * 2;
      const col = day ? theme.acc : 'hsl(220 60% 90%)';
      const dim = 1 - Math.min(1, ws.cloud) * 0.6;

      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
      gr.addColorStop(0, col);
      gr.addColorStop(0.22, col);
      gr.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.5 * dim;
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r * 4.5, 0, 7);
      ctx.fill();

      ctx.globalAlpha = dim;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();

      // Crescent moon cutout
      if (!day) {
        ctx.globalAlpha = dim;
        ctx.fillStyle = theme.top;
        ctx.beginPath();
        ctx.arc(x + r * 0.42, y - r * 0.2, r * 0.86, 0, 7);
        ctx.fill();
      }

      // Clouds
      if (!weatherMuted && ws.cloud > 0.02) {
        const dk = Math.min(1, ws.rain * 0.7 + (day ? 0 : 0.5));
        const cc = [255 - 130 * dk, 255 - 130 * dk, 255 - 100 * dk]
          .map(Math.round)
          .join(',');

        for (const c of cloudsRef.current) {
          c.x = (c.x + c.v * (1 + weather.wind / 12)) % 1.4;
          const cx = (c.x - 0.2) * cw;
          const cy = c.y * ch * 0.9;
          const cr = c.r * cw;
          const a = c.a * Math.min(1, ws.cloud * 1.3) * 0.34;
          if (a >= 0.01) {
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
            cg.addColorStop(0, `rgba(${cc},${a})`);
            cg.addColorStop(1, `rgba(${cc},0)`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = cg;
            ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
          }
        }
      }

      // Fog
      if (!weatherMuted && ws.fog > 0.02) {
        for (let i = 0; i < 3; i++) {
          const fy = ch * (0.45 + i * 0.2) + Math.sin(sec * 0.2 + i) * 18;
          const fg = ctx.createLinearGradient(0, fy - 120, 0, fy + 120);
          fg.addColorStop(0, 'rgba(255,255,255,0)');
          fg.addColorStop(0.5, `rgba(255,255,255,${0.22 * ws.fog})`);
          fg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = fg;
          ctx.fillRect(Math.sin(sec * 0.1 + i) * 40 - 40, fy - 120, cw + 80, 240);
        }
      }

      // Rain
      if (!weatherMuted && ws.rain > 0.02) {
        ctx.strokeStyle = 'rgba(200,220,255,.5)';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = Math.min(1, ws.rain);
        const sl = Math.min(0.4, weather.wind / 80);
        const cnt = Math.floor(dropsRef.current.length * Math.min(1, ws.rain));
        ctx.beginPath();
        for (let i = 0; i < cnt; i++) {
          const d = dropsRef.current[i];
          d.y += d.v * (weather.cat === 'storm' ? 1.4 : 1);
          d.x += d.v * sl * 0.5;
          if (d.y > 1) {
            d.y = -0.05;
            d.x = Math.random();
          }
          if (d.x > 1) d.x = 0;
          ctx.moveTo(d.x * cw, d.y * ch);
          ctx.lineTo(d.x * cw + d.l * ch * sl, d.y * ch + d.l * ch);
        }
        ctx.stroke();
      }

      // Snow
      if (!weatherMuted && ws.snow > 0.02) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8 * Math.min(1, ws.snow);
        for (const f of flakesRef.current) {
          f.y += f.v;
          f.x += Math.sin(sec + f.p) * 0.0007;
          if (f.y > 1) {
            f.y = -0.02;
            f.x = Math.random();
          }
          ctx.beginPath();
          ctx.arc(f.x * cw, f.y * ch, f.r, 0, 7);
          ctx.fill();
        }
      }

      // Lightning flash
      if (!weatherMuted && flashRef.current > 0.02) {
        ctx.globalAlpha = flashRef.current * 0.55;
        ctx.fillStyle = '#e8f0ff';
        ctx.fillRect(0, 0, cw, ch);
        flashRef.current *= 0.9;
      }

      // Frequency visualizer bars at the bottom
      if (bins && engine.playing) {
        const nb = 56;
        const bw = cw / nb;
        ctx.fillStyle = theme.acc;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < nb; i++) {
          const v = Math.max(3, (bins[Math.floor(i * 0.9)] / 255) * ch * 0.3);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(i * bw + 3, ch - v, bw - 6, v, 5);
          } else {
            ctx.rect(i * bw + 3, ch - v, bw - 6, v);
          }
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrame);
    };
  }, [engine, weather, weatherMuted, zonedDate, theme, onBassLevelChange]);

  return <canvas id="v" ref={canvasRef} />;
};
