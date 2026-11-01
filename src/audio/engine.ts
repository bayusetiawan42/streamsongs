import { Track, Deck, Station, WeatherCategory, InstrumentId, PeriodName } from '../types';
import { VoiceManager } from './synths/voices';
import { AmbientEngine } from './ambient';
import { generateTrack, STATIONS } from './theory/generator';
import { m2f, NOTE_NAMES } from './theory/scales';

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public master!: GainNode;
  public comp!: DynamicsCompressorNode;
  public analyser!: AnalyserNode;
  public analyserData!: Uint8Array;
  public verb!: ConvolverNode;
  public vsend!: GainNode;
  public dryBus!: GainNode;

  public voices!: VoiceManager;
  public ambient!: AmbientEngine;

  public playing = false;
  private started = false;
  private timer: number | null = null;
  private decks: Deck[] = [];

  // Current track & state
  public currentTrack: Track | null = null;
  public station: Station = STATIONS[0];
  public weatherCat: WeatherCategory = 'clear';
  public tempC = 28;
  public windSpeed = 6;
  public period: PeriodName = 'afternoon';

  // Manual Overrides
  public prefBpm: number | 'default' = 'default';
  public prefKey: { pc: number; scn: string } | null = null;
  public prefInstrument: InstrumentId = 'auto';
  public weatherEffectsMuted = false;

  public pendingKeyChange: { pc: number; scn: string } | null = null;
  private trackCount = 0;

  // Listeners
  public onTrackChange?: (track: Track) => void;
  public onPlayStateChange?: (playing: boolean) => void;

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -24;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 3.5;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.82;
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

    // Convolver Reverb with impulse buffer
    this.verb = this.ctx.createConvolver();
    const len = this.ctx.sampleRate * 3.2;
    const impulse = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
    }
    this.verb.buffer = impulse;

    const verbGain = this.ctx.createGain();
    verbGain.gain.value = 0.42;

    this.vsend = this.ctx.createGain();
    this.dryBus = this.ctx.createGain();

    this.vsend.connect(this.verb);
    this.verb.connect(verbGain);
    verbGain.connect(this.comp);
    this.dryBus.connect(this.comp);

    this.comp.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.voices = new VoiceManager(this.ctx);
    // Connect ambient to master bus (post-compressor) so weather noise doesn't trigger sidechain pumping on music
    this.ambient = new AmbientEngine(this.ctx, this.master);

    this.ambient.setMute(this.weatherEffectsMuted);
    this.ambient.updateAmbient(this.weatherCat, this.windSpeed, true);
  }

  public async start(targetVolume = 0.7) {
    this.init();
    if (!this.ctx) return;
    await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(targetVolume, t + 0.6);

    if (!this.started) {
      this.started = true;
      if (!this.currentTrack) {
        this.currentTrack = this.generateNextTrack();
      }
      this.startDeck(this.currentTrack, t + 0.1, 2.5);
      this.onTrackChange?.(this.currentTrack);
    }

    this.playing = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = window.setInterval(() => this.sched(), 30);
    this.onPlayStateChange?.(this.playing);
  }

  public pause() {
    if (!this.ctx) return;
    this.playing = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.35);

    setTimeout(() => {
      if (!this.playing && this.ctx) {
        if (this.timer) clearInterval(this.timer);
        this.ctx.suspend();
      }
    }, 400);
    this.onPlayStateChange?.(this.playing);
  }

  public async togglePlay(targetVolume = 0.7) {
    if (!this.playing) {
      await this.start(targetVolume);
    } else {
      this.pause();
    }
  }

  public setVolume(vol: number) {
    if (!this.ctx || !this.playing) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.05);
  }

  public generateNextTrack(prevTrack: Track | null = null): Track {
    const d = new Date();
    const seed = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${this.period}-${this.weatherCat}-${this.station.id}:${this.trackCount++}`;

    return generateTrack(
      seed,
      this.period,
      this.station,
      this.weatherCat,
      this.tempC,
      prevTrack,
      {
        key: this.prefKey,
        bpm: this.prefBpm,
        instrument: this.prefInstrument
      }
    );
  }

  private startDeck(track: Track, start: number, fin: number): Deck {
    if (!this.ctx) throw new Error('AudioContext not ready');
    const D: Deck = {
      tr: track,
      step: 0,
      nt: start,
      t0: start,
      fin,
      stopAt: Infinity,
      queued: false,
      f1: this.ctx.createGain(),
      f2: this.ctx.createGain(),
      dry: this.ctx.createGain(),
      wet: this.ctx.createGain()
    };

    D.dry.connect(D.f1);
    D.f1.connect(this.dryBus);
    D.wet.connect(D.f2);
    D.f2.connect(this.vsend);

    [D.f1, D.f2].forEach(f => {
      f.gain.setValueAtTime(0.0001, start);
      f.gain.linearRampToValueAtTime(1, start + fin);
    });

    D.next = this.generateNextTrack(track);
    this.decks.push(D);
    return D;
  }

  private fadeOutDeck(D: Deck, t: number, dur: number) {
    [D.f1, D.f2].forEach(f => {
      f.gain.cancelScheduledValues(t);
      f.gain.setValueAtTime(f.gain.value, t);
      f.gain.linearRampToValueAtTime(0.0001, t + dur);
    });
    D.stopAt = Math.min(D.stopAt, t + dur + 0.05);
  }

  private stepDuration(D: Deck): number {
    const T = D.tr;
    const total = T.bars * 16;
    let b = T.bpm;
    if (D.next && D.step >= total - 128) {
      b = T.bpm + (D.next.bpm - T.bpm) * Math.min(1, (D.step - (total - 128)) / 64);
    }
    return 60 / b / 4;
  }

  private playStep(D: Deck, s: number, t: number, sd: number) {
    const st = s % 16;

    // Smooth harmonic transition on bar 1 beat 1
    if (st === 0 && this.pendingKeyChange) {
      const { pc, scn } = this.pendingKeyChange;
      D.tr.pc = pc;
      D.tr.root = 48 + pc;
      D.tr.rootName = NOTE_NAMES[pc];
      D.tr.scn = scn;
      D.tr.scale = scn;
      D.tr.key = `${NOTE_NAMES[pc]} ${scn}`;
      if (D.next) {
        D.next.pc = pc;
        D.next.root = 48 + pc;
        D.next.rootName = NOTE_NAMES[pc];
        D.next.scn = scn;
        D.next.scale = scn;
        D.next.key = `${NOTE_NAMES[pc]} ${scn}`;
      }
      this.pendingKeyChange = null;
      this.onTrackChange?.(D.tr);
    }

    const T = D.tr;
    const bar = Math.floor(s / 16);
    const chordIndex = bar % 4;
    const voicing = T.voicings[chordIndex] || [T.root, T.root + 7];

    const cm = T.cut * (1 + 0.25 * Math.sin(bar * 0.5 + T.ph));
    const wm = T.wet * (1 + 0.25 * Math.sin(bar * 0.37 + T.ph * 2));

    const activeInst = this.prefInstrument !== 'auto' ? this.prefInstrument : T.instrument;

    // 1. Play Chords / Pad layer on bar beat 1 (Adaptive to selected instrument)
    if (st === 0) {
      voicing.forEach((midi, i) => {
        const freq = m2f(midi);
        this.voices.playPadChord(
          activeInst,
          freq,
          t,
          sd * 15,
          i,
          cm,
          0.6 * wm,
          D.wet,
          D.dry
        );
      });
    }

    // 2. Play Bassline (Adaptive to selected instrument)
    if (T.bassOn[bar]) {
      const bassFreq = m2f(T.bassProg[chordIndex]);
      const isPulseBass = T.pulse || activeInst === 'synthwave';
      if (isPulseBass) {
        if (st % 2 === 0) {
          const oct = st % 4 === 2 ? 12 : 0;
          this.voices.playBassNote(activeInst, m2f(T.bassProg[chordIndex] + oct), t, sd * 1.5, true, D.dry);
        }
      } else if (st === 0 || st === 8) {
        this.voices.playBassNote(activeInst, bassFreq, t, sd * 7.5, false, D.dry);
      }
    }

    // 3. Play Melodic Voice (using active instrument)
    if (T.melOn[bar]) {
      const m = T.mel[bar][st];
      if (m !== null) {
        const melMidi = T.root + 12 + T.sc[((m % T.sc.length) + T.sc.length) % T.sc.length] + Math.floor(m / T.sc.length) * 12;
        const freq = m2f(melMidi);
        const velocity = st % 4 === 0 ? 1.0 : 0.82; // Dynamic accent on downbeats
        this.voices.playMelodicNote(
          activeInst,
          freq,
          t,
          sd * 2.2,
          velocity,
          cm,
          D.wet,
          D.dry
        );
      }
    }

    // 4. Play Drums
    if (T.dr && T.drOn[bar]) {
      if (T.kick.includes(st)) {
        this.voices.playKick(t, T.dr === 2 ? 0.7 : 0.45, D.dry);
      }
      if (T.dr === 2 && (st === 4 || st === 12)) {
        this.voices.playNoiseHit(t, 0.18, 0.28, 'bandpass', 1850, D.dry);
      }
      if (T.dr === 2 ? st % 2 === 0 : st % 4 === 2) {
        const hVol = st % 4 === 2 ? 0.09 : 0.055;
        this.voices.playNoiseHit(t, 0.04, hVol, 'highpass', 7200, D.dry);
      }
    }
  }

  private sched() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (const D of this.decks) {
      // Smooth BPM Gliding
      if (this.prefBpm !== 'default') {
        const targetB = Number(this.prefBpm);
        if (Math.abs(D.tr.bpm - targetB) > 0.3) {
          D.tr.bpm += (targetB - D.tr.bpm) * 0.04;
          if (Math.abs(D.tr.bpm - targetB) <= 0.3) D.tr.bpm = targetB;
          if (this.currentTrack === D.tr) this.onTrackChange?.(D.tr);
        }
        if (D.next && D.next.bpm !== targetB) D.next.bpm = targetB;
      }

      const lim = Math.min(now + 0.15, D.stopAt);
      const total = D.tr.bars * 16;

      while (D.nt < lim && D.step < total) {
        if (!D.queued && D.stopAt === Infinity && D.step === total - 64) {
          D.queued = true;
          const xf = 960 / (D.next ? D.next.bpm : D.tr.bpm);
          this.fadeOutDeck(D, D.nt, xf);
          if (D.next) this.startDeck(D.next, D.nt, xf);
        }

        const sd = this.stepDuration(D);
        const sw = D.step % 2 && D.tr.swing ? D.tr.swing * sd : 0;
        this.playStep(D, D.step, D.nt + sw, sd);
        D.nt += sd;
        D.step++;
      }

      if (D.step >= total && D.stopAt === Infinity) D.stopAt = D.nt;
    }

    // Clean up finished decks
    this.decks = this.decks.filter(D => {
      if (now > D.stopAt + 10) {
        [D.f1, D.f2, D.dry, D.wet].forEach(x => x.disconnect());
        return false;
      }
      return true;
    });

    // Update active track presentation
    if (this.started) {
      let cur: Deck | null = null;
      for (const D of this.decks) {
        if (D.t0 + D.fin * 0.5 <= now && (!cur || D.t0 > cur.t0)) cur = D;
      }
      if (cur && cur.tr !== this.currentTrack) {
        this.currentTrack = cur.tr;
        this.onTrackChange?.(cur.tr);
      }
    }
  }

  public tuneStation(st: Station) {
    this.station = st;
    this.currentTrack = this.generateNextTrack();
    if (!this.started || !this.ctx) {
      this.onTrackChange?.(this.currentTrack);
      return;
    }

    const t = this.ctx.currentTime + 0.05;
    this.decks.forEach(D => {
      if (D.stopAt > t + 2.6) this.fadeOutDeck(D, t, 2.5);
    });
    this.startDeck(this.currentTrack, t, 2.5);
    this.onTrackChange?.(this.currentTrack);
  }

  public setStation(st: Station) {
    this.tuneStation(st);
  }

  public setBpm(bpm: number | null | 'default') {
    this.prefBpm = bpm === null ? 'default' : bpm;
  }

  public setKey(pc: number | null, scn: string | null) {
    if (pc === null || scn === null) {
      this.prefKey = null;
      this.pendingKeyChange = null;
    } else {
      this.prefKey = { pc, scn };
      this.pendingKeyChange = { pc, scn };
      if (this.currentTrack) {
        this.currentTrack.pc = pc;
        this.currentTrack.root = 48 + pc;
        this.currentTrack.rootName = NOTE_NAMES[pc];
        this.currentTrack.scn = scn;
        this.currentTrack.scale = scn;
        this.currentTrack.key = `${NOTE_NAMES[pc]} ${scn}`;
        this.onTrackChange?.(this.currentTrack);
      }
    }
  }

  public setInstrument(inst: InstrumentId | null | 'default' | 'auto') {
    this.prefInstrument = !inst || inst === 'default' ? 'auto' : inst;
  }

  public setWeatherMuted(muted: boolean) {
    this.weatherEffectsMuted = muted;
    if (this.ambient) {
      this.ambient.setMute(muted);
    }
  }

  public updateWeather(weather: { cat: WeatherCategory; wind: number; temp: number }, muted?: boolean) {
    this.weatherCat = weather.cat;
    this.windSpeed = weather.wind;
    this.tempC = weather.temp;
    if (muted !== undefined) this.weatherEffectsMuted = muted;
    if (this.ambient) {
      this.ambient.setMute(this.weatherEffectsMuted);
      this.ambient.updateAmbient(this.weatherCat, this.windSpeed);
    }
  }

  public triggerThunder() {
    if (this.ambient) {
      this.ambient.triggerThunder();
    }
  }
}
