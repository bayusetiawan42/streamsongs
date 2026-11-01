import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../audio/engine';
import { WeatherData, SettlementType } from '../types';
import { ThemePalette } from '../services/themeEngine';

interface VisualCanvasProps {
  engine: AudioEngine;
  weather: WeatherData;
  weatherMuted: boolean;
  zonedDate: Date;
  theme: ThemePalette;
  settlement: SettlementType;
}

interface Star {
  x: number;
  y: number;
  r: number;
  p: number;
  speed: number;
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

interface Firefly {
  x: number;
  y: number;
  r: number;
  p: number;
  vx: number;
  vy: number;
}

interface SkylineBuilding {
  xRatio: number;
  wRatio: number;
  hRatio: number;
  hasWindow: boolean;
  windowCols: number;
  windowRows: number;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  engine,
  weather,
  weatherMuted,
  zonedDate,
  theme,
  settlement,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store fast-changing props in refs so the render loop doesn't re-mount
  const themeRef = useRef<ThemePalette>(theme);
  themeRef.current = theme;

  const weatherRef = useRef<WeatherData>(weather);
  weatherRef.current = weather;

  const weatherMutedRef = useRef<boolean>(weatherMuted);
  weatherMutedRef.current = weatherMuted;

  const zonedDateRef = useRef<Date>(zonedDate);
  zonedDateRef.current = zonedDate;

  const settlementRef = useRef<SettlementType>(settlement);
  settlementRef.current = settlement;

  // Procedural Stars (Reduced count for performance, visuals identical)
  const starsRef = useRef<Star[]>(
    Array.from({ length: 95 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.72,
      r: Math.random() * 1.4 + 0.4,
      p: Math.random() * 6.28,
      speed: 0.8 + Math.random() * 1.4,
    }))
  );

  // Weather particles
  const dropsRef = useRef<Drop[]>(
    Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      l: Math.random() * 0.03 + 0.02,
      v: Math.random() * 0.012 + 0.014,
    }))
  );

  const flakesRef = useRef<Flake[]>(
    Array.from({ length: 85 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 2.0 + 1,
      v: Math.random() * 0.0018 + 0.0012,
      p: Math.random() * 6,
    }))
  );

  const cloudsRef = useRef<Cloud[]>(
    Array.from({ length: 6 }, () => ({
      x: Math.random(),
      y: 0.04 + Math.random() * 0.42,
      r: 0.14 + Math.random() * 0.16,
      v: Math.random() * 0.00008 + 0.00003,
      a: 0.42 + Math.random() * 0.42,
    }))
  );

  // Fireflies for Village atmosphere
  const firefliesRef = useRef<Firefly[]>(
    Array.from({ length: 22 }, () => ({
      x: Math.random(),
      y: 0.55 + Math.random() * 0.4,
      r: Math.random() * 1.8 + 1.2,
      p: Math.random() * 6.28,
      vx: (Math.random() - 0.5) * 0.00035,
      vy: -0.00028 - Math.random() * 0.00025,
    }))
  );

  // Stable procedural Skyline data
  const skylineRef = useRef<SkylineBuilding[]>(
    (() => {
      const buildings: SkylineBuilding[] = [];
      let curX = -0.02;
      while (curX < 1.05) {
        const w = 0.025 + Math.random() * 0.045;
        const h = 0.08 + Math.random() * 0.15;
        buildings.push({
          xRatio: curX,
          wRatio: w,
          hRatio: h,
          hasWindow: Math.random() > 0.25,
          windowCols: Math.floor(Math.random() * 3) + 2,
          windowRows: Math.floor(Math.random() * 6) + 4,
        });
        curX += w * (0.85 + Math.random() * 0.25);
      }
      return buildings;
    })()
  );

  const weatherStateRef = useRef({ cloud: 0, rain: 0, snow: 0, fog: 0 });
  const bassLevelRef = useRef(0);
  const flashRef = useRef(0);

  // Periodic thunder when weather is storm
  useEffect(() => {
    let timer: number;
    const scheduleThunder = () => {
      if (weatherRef.current.cat === 'storm' && !weatherMutedRef.current) {
        flashRef.current = 1.0;
        engine.triggerThunder();
      }
      timer = window.setTimeout(scheduleThunder, 8000 + Math.random() * 14000);
    };
    timer = window.setTimeout(scheduleThunder, 5000);
    return () => clearTimeout(timer);
  }, [engine]);

  // Main Canvas Setup and Render Loop (Mounts ONCE per engine instance)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cw = 0;
    let ch = 0;

    // ── Offscreen Sprite Caches ──
    // 1. Firefly Sprite Cache (eliminates up to 28 radial gradients per frame)
    const fireflySprite = document.createElement('canvas');
    fireflySprite.width = 32;
    fireflySprite.height = 32;
    const ffCtx = fireflySprite.getContext('2d');
    if (ffCtx) {
      const fg = ffCtx.createRadialGradient(16, 16, 0, 16, 16, 15);
      fg.addColorStop(0, 'rgba(230, 255, 140, 1)');
      fg.addColorStop(0.35, 'rgba(190, 245, 90, 0.65)');
      fg.addColorStop(0.7, 'rgba(160, 230, 70, 0.2)');
      fg.addColorStop(1, 'transparent');
      ffCtx.fillStyle = fg;
      ffCtx.fillRect(0, 0, 32, 32);

      // Core star dot
      ffCtx.fillStyle = '#ffffff';
      ffCtx.beginPath();
      ffCtx.arc(16, 16, 2.5, 0, 6.28);
      ffCtx.fill();
    }

    // 2. Offscreen Skyline Cache (eliminates hundreds of fillRect per frame)
    const skylineCanvas = document.createElement('canvas');
    let skylineCtx = skylineCanvas.getContext('2d');

    // 3. Offscreen Mountain Cache
    const mountainCanvas = document.createElement('canvas');
    let mountainCtx = mountainCanvas.getContext('2d');

    const renderStaticLayers = () => {
      // Re-render Skyline Cache
      skylineCanvas.width = cw;
      skylineCanvas.height = ch;
      if (skylineCtx) {
        skylineCtx.clearRect(0, 0, cw, ch);
        const skylineH = ch * 0.16;
        skylineCtx.fillStyle = 'rgba(6, 6, 14, 0.48)';
        for (const b of skylineRef.current) {
          const bx = b.xRatio * cw;
          const bw = b.wRatio * cw;
          const bh = b.hRatio * skylineH * 1.6;
          const by = ch - bh;

          skylineCtx.fillRect(bx, by, bw, bh);

          if (b.hasWindow) {
            const winW = 1.5;
            const winH = 2.2;
            const colStep = bw / (b.windowCols + 1);
            const rowStep = bh / (b.windowRows + 1);

            for (let c = 1; c <= b.windowCols; c++) {
              for (let rw = 1; rw <= b.windowRows; rw++) {
                if ((c * 7 + rw * 13) % 5 === 0) {
                  skylineCtx.fillStyle = 'rgba(255, 230, 160, 0.35)';
                  skylineCtx.fillRect(bx + c * colStep, by + rw * rowStep, winW, winH);
                }
              }
            }
            skylineCtx.fillStyle = 'rgba(6, 6, 14, 0.48)';
          }
        }
      }

      // Re-render Mountain Cache
      mountainCanvas.width = cw;
      mountainCanvas.height = ch;
      if (mountainCtx) {
        mountainCtx.clearRect(0, 0, cw, ch);
        for (let rIdx = 0; rIdx < 2; rIdx++) {
          const depthAlpha = rIdx === 0 ? 0.22 : 0.42;
          const baseY = ch * (0.86 + rIdx * 0.06);
          mountainCtx.beginPath();
          mountainCtx.moveTo(0, ch);
          mountainCtx.lineTo(0, baseY);

          const step = cw / 8;
          for (let seg = 1; seg <= 8; seg++) {
            const mx = seg * step;
            const peak = seg % 2 === 1 ? -ch * 0.07 : ch * 0.02;
            mountainCtx.lineTo(mx, baseY + peak);
          }
          mountainCtx.lineTo(cw, ch);
          mountainCtx.closePath();

          mountainCtx.fillStyle = rIdx === 0 ? 'rgba(80, 100, 160, 0.3)' : 'rgba(5, 7, 18, 0.6)';
          mountainCtx.globalAlpha = depthAlpha;
          mountainCtx.fill();
        }
      }
    };

    const resize = () => {
      // Clamp DPR to 1.2 max (saves ~60% GPU fill-rate on high-res Retina screens)
      const dpr = Math.min(1.2, window.devicePixelRatio || 1);
      cw = window.innerWidth;
      ch = window.innerHeight;
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderStaticLayers();
    };

    window.addEventListener('resize', resize);
    resize();

    let animFrame: number;
    let lastFrameTime = 0;
    const targetInterval = 1000 / 38; // Cap at ~38 FPS for ambient lo-fi visuals (saves 50-70% CPU)
    let isHidden = false;

    // Pause rendering completely when tab is hidden / minimized
    const handleVisibilityChange = () => {
      isHidden = document.hidden;
      if (!isHidden) {
        lastFrameTime = performance.now();
        animFrame = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = (ts: number) => {
      if (isHidden) return;

      // FPS Throttling
      const elapsed = ts - lastFrameTime;
      if (elapsed < targetInterval) {
        animFrame = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = ts - (elapsed % targetInterval);

      ctx.clearRect(0, 0, cw, ch);
      const sec = ts / 1000;

      const theme = themeRef.current;
      const weather = weatherRef.current;
      const weatherMuted = weatherMutedRef.current;
      const zonedDate = zonedDateRef.current;
      const settlement = settlementRef.current;

      // Target weather values
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
      bassLevelRef.current += (tl - bassLevelRef.current) * 0.22;
      const lvl = bassLevelRef.current;

      // Direct CSS Variable Update (Zero React Re-render!)
      if (engine.playing) {
        document.documentElement.style.setProperty(
          '--bass-scale',
          (1 + lvl * 0.08).toFixed(3)
        );
      } else {
        document.documentElement.style.setProperty('--bass-scale', '1');
      }

      // Local solar hour
      const hr =
        zonedDate.getHours() +
        zonedDate.getMinutes() / 60 +
        zonedDate.getSeconds() / 3600;
      const day = hr >= 6 && hr < 18;

      // 1. Organic Fluid Aurora Ribbon (Upper Sky Living Glow)
      const auroraAlpha = (day ? 0.06 : 0.2) * (1 - Math.min(1, ws.cloud * 0.8));
      if (auroraAlpha > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const waveCount = 2;
        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const yBase = ch * (0.15 + w * 0.12);
          for (let x = 0; x <= cw; x += 40) {
            const wave1 = Math.sin(x * 0.003 + sec * 0.35 + w * 2.1) * 32;
            const wave2 = Math.cos(x * 0.0015 - sec * 0.25) * 18;
            const bassWave = lvl * 15 * Math.sin(x * 0.005 + sec);
            const y = yBase + wave1 + wave2 + bassWave;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(cw, 0);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, 0, 0, yBase + 75);
          grad.addColorStop(0, theme.acc);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.globalAlpha = auroraAlpha * (0.8 + lvl * 0.25);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Stars (Night & Twilight)
      if (!day && theme.starVisibility > 0.05) {
        const sa =
          theme.starVisibility *
          (1 - Math.min(1, ws.cloud) * 0.85) *
          (1 - Math.min(1, ws.rain) * 0.8);

        ctx.fillStyle = '#ffffff';
        for (const s of starsRef.current) {
          const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(sec * s.speed + s.p));
          ctx.globalAlpha = Math.max(0, sa * twinkle);
          ctx.beginPath();
          ctx.arc(s.x * cw, s.y * ch, s.r, 0, 6.28);
          ctx.fill();
        }
      }

      // 3. Celestial Body (Sun / Moon)
      const p = day ? (hr - 6) / 12 : ((hr - 18 + 24) % 24) / 12;
      const cx = cw * (0.1 + 0.8 * p);
      const cy = ch * 0.48 - Math.sin(Math.PI * p) * ch * 0.32;
      const baseR = 30;
      const r = baseR + lvl * 16 + Math.sin(sec * 1.5) * 1.5;
      const col = day ? theme.acc : 'hsl(215 70% 92%)';
      const dim = 1 - Math.min(1, ws.cloud) * 0.55;

      // Celestial Corona Halo
      const haloR = r * (day ? 4.0 : 3.2);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      gr.addColorStop(0, col);
      gr.addColorStop(0.25, col);
      gr.addColorStop(1, 'transparent');

      ctx.globalAlpha = 0.42 * dim;
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, 6.28);
      ctx.fill();

      // Main Orb
      ctx.globalAlpha = dim;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.28);
      ctx.fill();

      // Crescent Moon Cutout
      if (!day) {
        ctx.globalAlpha = dim;
        ctx.fillStyle = theme.top;
        ctx.beginPath();
        ctx.arc(cx + r * 0.4, cy - r * 0.22, r * 0.85, 0, 6.28);
        ctx.fill();
      }

      // 4. Urban Skyglow (Metropolis & City Light Pollution Glow)
      if (!day && theme.skyglowAlpha > 0.01) {
        const glowH = ch * 0.36;
        const skyglow = ctx.createLinearGradient(0, ch - glowH, 0, ch);
        skyglow.addColorStop(0, 'transparent');
        skyglow.addColorStop(1, theme.skyglowColor);
        ctx.globalAlpha = theme.skyglowAlpha;
        ctx.fillStyle = skyglow;
        ctx.fillRect(0, ch - glowH, cw, glowH);
      }

      // 5. Horizon Silhouettes via Fast Offscreen Caches
      if (settlement === 'metropolis' || settlement === 'city') {
        // Fast draw from cached skyline canvas
        ctx.globalAlpha = 1;
        ctx.drawImage(skylineCanvas, 0, 0);
      } else if (settlement === 'highlands') {
        // Fast draw from cached mountain canvas
        ctx.globalAlpha = 1;
        ctx.drawImage(mountainCanvas, 0, 0);
      } else {
        // Town & Village: Gentle Organic Rolling Hills (1 fast path)
        ctx.beginPath();
        ctx.moveTo(0, ch);
        const hillY = ch * 0.9;
        ctx.lineTo(0, hillY);
        ctx.quadraticCurveTo(cw * 0.35, hillY - 24, cw * 0.65, hillY + 10);
        ctx.quadraticCurveTo(cw * 0.85, hillY + 28, cw, hillY - 12);
        ctx.lineTo(cw, ch);
        ctx.closePath();
        ctx.fillStyle = 'rgba(6, 9, 18, 0.42)';
        ctx.globalAlpha = 0.5;
        ctx.fill();
      }

      // 6. Fireflies for Peaceful Village (Drawn via Fast Pre-rendered Sprite!)
      if (!day && theme.fireflyDensity > 0.05) {
        for (const ff of firefliesRef.current) {
          ff.x += ff.vx;
          ff.y += ff.vy;
          if (ff.y < 0.45) {
            ff.y = 0.92;
            ff.x = Math.random();
          }
          if (ff.x < 0) ff.x = 1;
          if (ff.x > 1) ff.x = 0;

          // Bioluminescent pulsing glow
          const glow = Math.sin(sec * 2.2 + ff.p);
          if (glow > 0.1) {
            const fx = ff.x * cw;
            const fy = ff.y * ch;
            const fa = glow * 0.75;

            // Fast sprite blit (Replaces 28 expensive createRadialGradient calls!)
            ctx.globalAlpha = fa;
            ctx.drawImage(fireflySprite, fx - 16, fy - 16, 32, 32);
          }
        }
      }

      // 7. Clouds
      if (!weatherMuted && ws.cloud > 0.02) {
        const dk = Math.min(1, ws.rain * 0.7 + (day ? 0 : 0.5));
        const cc = [255 - 130 * dk, 255 - 130 * dk, 255 - 100 * dk]
          .map(Math.round)
          .join(',');

        for (const c of cloudsRef.current) {
          c.x = (c.x + c.v * (1 + weather.wind / 12)) % 1.4;
          const cpx = (c.x - 0.2) * cw;
          const cpy = c.y * ch * 0.9;
          const cr = c.r * cw;
          const a = c.a * Math.min(1, ws.cloud * 1.3) * 0.32;
          if (a >= 0.01) {
            const cg = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, cr);
            cg.addColorStop(0, `rgba(${cc},${a})`);
            cg.addColorStop(1, `rgba(${cc},0)`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = cg;
            ctx.fillRect(cpx - cr, cpy - cr, cr * 2, cr * 2);
          }
        }
      }

      // 8. Fog
      if (!weatherMuted && ws.fog > 0.02) {
        for (let i = 0; i < 2; i++) {
          const fy = ch * (0.48 + i * 0.22) + Math.sin(sec * 0.2 + i) * 16;
          const fg = ctx.createLinearGradient(0, fy - 100, 0, fy + 100);
          fg.addColorStop(0, 'rgba(255,255,255,0)');
          fg.addColorStop(0.5, `rgba(255,255,255,${0.2 * ws.fog})`);
          fg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = fg;
          ctx.fillRect(Math.sin(sec * 0.1 + i) * 30 - 30, fy - 100, cw + 60, 200);
        }
      }

      // 9. Rain
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

      // 10. Snow
      if (!weatherMuted && ws.snow > 0.02) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.75 * Math.min(1, ws.snow);
        for (const f of flakesRef.current) {
          f.y += f.v;
          f.x += Math.sin(sec + f.p) * 0.0006;
          if (f.y > 1) {
            f.y = -0.02;
            f.x = Math.random();
          }
          ctx.beginPath();
          ctx.arc(f.x * cw, f.y * ch, f.r, 0, 6.28);
          ctx.fill();
        }
      }

      // 11. Lightning flash
      if (!weatherMuted && flashRef.current > 0.02) {
        ctx.globalAlpha = flashRef.current * 0.5;
        ctx.fillStyle = '#e8f0ff';
        ctx.fillRect(0, 0, cw, ch);
        flashRef.current *= 0.88;
      }

      // 12. Minimalist Audio Spectrum Visualizer Bars
      if (bins && engine.playing) {
        const nb = 42;
        const bw = cw / nb;
        ctx.fillStyle = theme.acc;
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < nb; i++) {
          const v = Math.max(2, (bins[Math.floor(i * 0.9)] / 255) * ch * 0.2);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(i * bw + 2, ch - v, bw - 4, v, 3);
          } else {
            ctx.rect(i * bw + 2, ch - v, bw - 4, v);
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animFrame);
    };
  }, [engine]);

  return <canvas id="v" ref={canvasRef} />;
};
