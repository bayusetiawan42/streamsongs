export class AmbientEngine {
  private ctx: AudioContext;
  private comp: DynamicsCompressorNode;
  private rainGain: GainNode;
  private windGain: GainNode;
  private noiseLoop: AudioBuffer | null = null;
  private isMuted = false;

  constructor(ctx: AudioContext, destination: DynamicsCompressorNode) {
    this.ctx = ctx;
    this.comp = destination;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0001;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0001;

    this.initLoops();
  }

  private initLoops() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    this.noiseLoop = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseLoop.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Rain sound pipeline (highpass + lowpass filtered noise loop)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseLoop;
    rainSrc.loop = true;

    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 1400;

    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 8500;

    rainSrc.connect(rainHp);
    rainHp.connect(rainLp);
    rainLp.connect(this.rainGain);
    this.rainGain.connect(this.comp);
    rainSrc.start();

    // Wind sound pipeline (lowpass noise modulated by gentle LFO)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseLoop;
    windSrc.loop = true;
    windSrc.loopStart = 0.7;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 460;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 280;

    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.comp);
    windSrc.start();
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    const t = this.ctx.currentTime;
    if (muted) {
      this.rainGain.gain.setTargetAtTime(0, t, 0.3);
      this.windGain.gain.setTargetAtTime(0, t, 0.3);
    }
  }

  public updateAmbient(weatherCat: string, windSpeed: number, instant = false) {
    if (this.isMuted) return;
    const t = this.ctx.currentTime;
    const timeConst = instant ? 0.2 : 2.5;

    const rainVol = weatherCat === 'rain' ? 0.075 : weatherCat === 'storm' ? 0.13 : 0;
    const windVol = Math.min(0.09, (windSpeed / 55) * 0.09) + (weatherCat === 'storm' ? 0.03 : 0);

    this.rainGain.gain.setTargetAtTime(rainVol, t, timeConst);
    this.windGain.gain.setTargetAtTime(windVol, t, timeConst);
  }

  public triggerThunder() {
    if (this.isMuted || !this.noiseLoop) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.2;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseLoop;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 160;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.48, t + 0.18);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.comp);

    src.start(t);
    src.stop(t + 3.5);
  }
}
