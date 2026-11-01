export class AmbientEngine {
  private ctx: AudioContext;
  private destination: AudioNode;
  private rainGain: GainNode;
  private windGain: GainNode;
  private noiseLoop: AudioBuffer | null = null;
  private isMuted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
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

    // Paul Kellet's refined 1/f Pink Noise algorithm
    // Soft, organic, and naturally relaxing without harsh high-frequency hiss
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.12; // Normalized with clean headroom
    }

    // ── Rain sound pipeline ──
    // Uses bandpass shaping: 350Hz HP (cuts sub-rumble) to 2600Hz LP (eliminates piercing static hiss)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this.noiseLoop;
    rainSrc.loop = true;

    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 350;
    rainHp.Q.value = 0.7;

    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 2600;
    rainLp.Q.value = 0.7;

    rainSrc.connect(rainHp);
    rainHp.connect(rainLp);
    rainLp.connect(this.rainGain);
    this.rainGain.connect(this.destination);
    rainSrc.start();

    // ── Wind sound pipeline ──
    // Warm low-frequency breeze with gentle organic LFO swell
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noiseLoop;
    windSrc.loop = true;
    windSrc.loopStart = 0.8;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 0.5;

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08; // Very slow natural swell
    lfoGain.gain.value = 140;

    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    windSrc.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.destination);
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

    // Subtly blended levels: sits 18-24dB behind the music without masking instruments
    const rainVol = weatherCat === 'rain' ? 0.012 : weatherCat === 'storm' ? 0.022 : 0;
    const windVol = Math.min(0.016, (windSpeed / 55) * 0.016) + (weatherCat === 'storm' ? 0.008 : 0);

    this.rainGain.gain.setTargetAtTime(rainVol, t, timeConst);
    this.windGain.gain.setTargetAtTime(windVol, t, timeConst);
  }

  public triggerThunder() {
    if (this.isMuted || !this.noiseLoop) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.15;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseLoop;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 130; // Deep distant low rumble

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.destination);

    src.start(t);
    src.stop(t + 4.0);
  }
}
