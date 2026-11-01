import { Track, Deck, Station, WeatherCategory, InstrumentId, PeriodName } from '../types';
import { VoiceManager } from './synths/voices';
import { AmbientEngine } from './ambient';
import { SamplerManager } from './sampler/samplerManager';
import { generateTrack, STATIONS } from './theory/generator';
import { m2f, NOTE_NAMES, SCALES, ScaleName } from './theory/scales';
import { planModulation, planModulationChain, getFifthsDistance, ModulationPath } from './theory/modulation';
import { voiceLead } from './theory/chords';
import { generateMelodicFiller } from './theory/fillers';
import { getDrumFillStep } from './theory/drumFills';
import {
  computeTransitionEnergy,
  planTransitionStrategy,
  TransitionContext,
  TransitionMode,
  TransitionPlan,
  TransitionStyle
} from './theory/strategy';
import {
  morphEase,
  morphCutoffScale,
  morphWetScale,
  morphVelocity,
  morphDropout,
  morphTimingJitter,
  ghostProbability,
  morphNoteToKey
} from './theory/morph';

export interface TransitionBridge {
  barStart: number;
  barsTotal: number;
  mode: TransitionMode;
  style: TransitionStyle;
  modulation: ModulationPath;
  /** Multi-bar pivot chord chain, morph mode only */
  chain?: ModulationPath[];
  melodicFiller: (number | null)[];
  startBpm: number;
  targetBpm: number;
  targetKey: { pc: number; scn: string };
  reason: 'key' | 'bpm' | 'station' | 'track_end';
  completed?: boolean;
}

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
  public samplers!: SamplerManager;
  public ambient!: AmbientEngine;

  public playing = false;
  private started = false;
  /** Look-ahead scheduler: uses setTimeout instead of setInterval to avoid drift */
  private schedTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly LOOKAHEAD = 0.12;   // seconds to schedule ahead
  private readonly SCHED_INTERVAL = 25; // ms between scheduler wakeups
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
  public onTransitionChange?: (inTransition: boolean, description?: string) => void;

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

    // Convolver Reverb with impulse buffer — 1.6s tail (reduced from 3.2s for CPU savings)
    this.verb = this.ctx.createConvolver();
    const len = Math.floor(this.ctx.sampleRate * 1.6);
    const impulse = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
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
    this.samplers = new SamplerManager(this.ctx, this.dryBus, this.vsend);
    this.samplers.preloadForStation(this.station.id, this.prefInstrument);

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
    this.schedLoop();
    this.onPlayStateChange?.(this.playing);
  }

  public pause() {
    if (!this.ctx) return;
    this.playing = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.35);

    // Stop the look-ahead scheduler
    if (this.schedTimer !== null) {
      clearTimeout(this.schedTimer);
      this.schedTimer = null;
    }

    setTimeout(() => {
      if (!this.playing && this.ctx) {
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
    let b = T.bpm;

    // Metric BPM interpolation during transition bridge (eased for morph drift)
    if (D.bridge && D.bridge.startBpm !== D.bridge.targetBpm) {
      const stepStart = D.bridge.barStart * 16;
      const stepEnd = stepStart + D.bridge.barsTotal * 16;
      if (D.step >= stepStart && D.step < stepEnd) {
        const raw = (D.step - stepStart) / (stepEnd - stepStart);
        const progress = D.bridge.mode === 'morph' ? morphEase(raw) : raw;
        b = D.bridge.startBpm + (D.bridge.targetBpm - D.bridge.startBpm) * progress;
      }
    } else if (D.next && D.step >= T.bars * 16 - 128) {
      const total = T.bars * 16;
      b = T.bpm + (D.next.bpm - T.bpm) * Math.min(1, (D.step - (total - 128)) / 64);
    }

    return 60 / b / 4;
  }

  /**
   * Retunes a live track object into a new key, rebuilding the voice-led
   * voicings and bass program so post-transition playback stays 100% legal.
   */
  private applyKeyToTrack(tr: Track, pc: number, scn: string) {
    const sc = SCALES[scn as ScaleName] || SCALES.minor;
    tr.pc = pc;
    tr.root = 48 + pc;
    tr.rootName = NOTE_NAMES[pc];
    tr.scn = scn;
    tr.scale = scn;
    tr.sc = sc;
    tr.key = `${NOTE_NAMES[pc]} ${scn}`;
    tr.bassProg = tr.prog.map(d => sc[((d % sc.length) + sc.length) % sc.length] + tr.root - 24);
    const voicings: number[][] = [];
    let prev: number[] = [];
    for (const rootDeg of tr.prog) {
      const voiced = voiceLead(prev, [rootDeg, rootDeg + 2, rootDeg + 4, rootDeg + 6], sc, tr.root);
      voicings.push(voiced);
      prev = voiced;
    }
    tr.voicings = voicings;
  }

  private playStep(D: Deck, s: number, t: number, sd: number) {
    // GC: clear any stale completed bridge that wasn't nulled (safety net)
    if (D.bridge?.completed) D.bridge = null;

    const st = s % 16;
    const bar = Math.floor(s / 16);
    const bridge: TransitionBridge | undefined = D.bridge;
    const isBridging = !!(bridge && bar >= bridge.barStart && bar < (bridge.barStart + bridge.barsTotal));
    const isLandingBar = !!(bridge && bar >= (bridge.barStart + bridge.barsTotal) && st === 0 && !bridge.completed);

    // 1. THE DROP / LANDING IMPACT on step 0 of new section!
    if (isLandingBar && bridge) {
      bridge.completed = true;
      const { pc, scn } = bridge.targetKey;
      this.applyKeyToTrack(D.tr, pc, scn);
      D.tr.bpm = bridge.targetBpm;
      if (D.next) this.applyKeyToTrack(D.next, pc, scn);
      D.bridge = null;
      this.pendingKeyChange = null;
      this.onTrackChange?.(D.tr);
      this.onTransitionChange?.(false);

      if (bridge.mode === 'morph') {
        // Soft landing: the new key already arrived via ghost infiltration —
        // swell the tonic dyad instead of hammering an impact kick.
        const activeInst = this.prefInstrument !== 'auto' ? this.prefInstrument : D.tr.instrument;
        [48 + pc, 55 + pc].forEach((midi, i) => {
          this.voices.playPadChord(
            activeInst,
            m2f(midi),
            t,
            sd * 16,
            i,
            D.tr.cut,
            0.9 * D.tr.wet,
            D.wet,
            D.dry
          );
        });
      } else {
        // Downbeat impact: heavy kick punch + sub-impact
        if (!this.samplers.playTr808Drum('kick', t, 1.0)) {
          this.voices.playKick(t, 1.0, D.dry);
        }
        if (D.tr.stId === 'phonk') {
          this.samplers.playTr808Drum('clap', t, 0.9);
        }
      }
    }

    // 2. GENERATIVE BRIDGE FILLER EXECUTION (drop / bridge modes only —
    //    morph dissolves through the normal playback path instead)
    if (isBridging && bridge && bridge.mode !== 'morph') {
      const bridgeStep = (s - bridge.barStart * 16) % 16;
      const activeInst = this.prefInstrument !== 'auto' ? this.prefInstrument : D.tr.instrument;

      // A. Bridge Chords (Pivot / Secondary Dominant) on step 0 of bridge — skipped on hard drops
      if (bridgeStep === 0 && bridge.mode !== 'drop') {
        bridge.modulation.bridgeVoicing.forEach((midi, i) => {
          const freq = m2f(midi);
          let handled = false;
          if (activeInst === 'piano') {
            handled = this.samplers.playCello(midi - 12, t, sd * 14, 0.85);
          } else if (activeInst === 'space') {
            handled = this.samplers.playPad(midi, t, sd * 14, 0.8);
          }
          if (!handled) {
            this.voices.playPadChord(
              activeInst,
              freq,
              t,
              sd * 14,
              i,
              D.tr.cut * 1.25,
              0.8 * D.tr.wet,
              D.wet,
              D.dry
            );
          }
        });
      }

      // B. Bridge Bass (Voice-led pathway) — skipped on hard drops
      if ((bridgeStep === 0 || bridgeStep === 8) && bridge.mode !== 'drop') {
        const bassMidi = bridgeStep === 0 ? bridge.modulation.bridgeBass[0] : bridge.modulation.bridgeBass[1];
        this.voices.playBassNote(activeInst, m2f(bassMidi), t, sd * 7.0, false, D.dry);
      }

      // C. Bridge Melodic Filler
      const fillNote = bridge.melodicFiller[bridgeStep];
      if (fillNote !== null) {
        const freq = m2f(fillNote);
        let handled = false;
        if (activeInst === 'cowbell') {
          handled = this.samplers.playPhonkCowbell(fillNote, t, sd * 1.2, 0.95);
        } else if (activeInst === 'piano') {
          handled = this.samplers.playPiano(fillNote, t, sd * 1.5, 0.95);
        } else if (activeInst === 'organ') {
          handled = this.samplers.playOrgan(fillNote, t, sd * 1.5, 0.95);
        } else if (activeInst === 'rhodes') {
          handled = this.samplers.playRhodes(fillNote, t, sd * 1.6, 0.9);
        } else if (activeInst === 'space') {
          handled = this.samplers.playPad(fillNote, t, sd * 2.5, 0.85);
        }

        if (!handled) {
          this.voices.playMelodicNote(
            activeInst,
            freq,
            t,
            sd * 1.5,
            0.92,
            D.tr.cut * 1.3,
            D.wet,
            D.dry
          );
        }
      }

      // D. Bridge Drum Riser & Pre-Drop Choke
      const fill = getDrumFillStep(D.tr.dr, bridgeStep, D.tr.stId);
      if (!fill.isChoke) {
        if (fill.kick) {
          if (!this.samplers.playTr808Drum('kick', t, fill.kickVol)) {
            this.voices.playKick(t, fill.kickVol, D.dry);
          }
        }
        if (fill.snare) {
          if (!this.samplers.playTr808Drum('snare', t, fill.snareVol)) {
            this.voices.playNoiseHit(t, 0.16, fill.snareVol * 0.45, 'bandpass', 1900, D.dry);
          }
        }
        if (fill.hihat) {
          if (!this.samplers.playTr808Drum('hihat', t, fill.hihatVol)) {
            this.voices.playNoiseHit(t, 0.035, fill.hihatVol * 0.12, 'highpass', 7600, D.dry);
          }
        }
      }

      return; // Bridge step handled!
    }

    // Fallback instant harmonic transition if no bridge queued
    if (st === 0 && this.pendingKeyChange) {
      const { pc, scn } = this.pendingKeyChange;
      this.applyKeyToTrack(D.tr, pc, scn);
      if (D.next) this.applyKeyToTrack(D.next, pc, scn);
      this.pendingKeyChange = null;
      this.onTrackChange?.(D.tr);
    }

    // 3. MORPH CONTEXT — normal playback keeps running while the key dissolves:
    //    ghost notes infiltrate, pivot-chain chords steer the harmony,
    //    BPM drifts on an eased curve and the flavor matches the station.
    const morphing = !!(isBridging && bridge && bridge.mode === 'morph');
    const mStyle: TransitionStyle = bridge?.mode === 'morph' ? bridge.style : 'generic-morph';
    let mProg = 0;
    let morphChainEntry: ModulationPath | undefined;
    if (morphing && bridge) {
      const barIdx = Math.min(bar - bridge.barStart, bridge.barsTotal - 1);
      mProg = (barIdx + st / 16) / bridge.barsTotal;
      morphChainEntry = bridge.chain?.[barIdx];
    }

    const T = D.tr;
    const chordIndex = bar % 4;
    const voicing = (morphing && morphChainEntry ? morphChainEntry.bridgeVoicing : T.voicings[chordIndex]) || [T.root, T.root + 7];

    let cm = T.cut * (1 + 0.25 * Math.sin(bar * 0.5 + T.ph));
    let wm = T.wet * (1 + 0.25 * Math.sin(bar * 0.37 + T.ph * 2));
    if (morphing) {
      cm *= morphCutoffScale(mProg, mStyle);
      wm *= morphWetScale(mProg, mStyle);
    }
    const mVel = morphing ? morphVelocity(mProg, mStyle) : 1;

    const activeInst = this.prefInstrument !== 'auto' ? this.prefInstrument : T.instrument;

    // 1. Play Chords / Pad layer on bar beat 1 (Adaptive to selected instrument)
    if (st === 0) {
      voicing.forEach((midi, i) => {
        const freq = m2f(midi);
        let handled = false;
        if (activeInst === 'piano') {
          handled = this.samplers.playCello(midi - 12, t, sd * 14, 0.75);
        } else if (activeInst === 'space') {
          handled = this.samplers.playPad(midi, t, sd * 14, 0.7);
        }

        if (!handled) {
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
        }
      });
    }

    // 2. Play Bassline (Adaptive to selected instrument) — follows the
    //    multi-step chord journey during a morph
    if (T.bassOn[bar]) {
      const bassRoot = morphing && morphChainEntry ? morphChainEntry.targetRoot - 24 : T.bassProg[chordIndex];
      const isPulseBass = T.pulse || activeInst === 'synthwave';
      if (isPulseBass) {
        if (st % 2 === 0) {
          const oct = st % 4 === 2 ? 12 : 0;
          this.voices.playBassNote(activeInst, m2f(bassRoot + oct), t, sd * 1.5, true, D.dry);
        }
      } else if (st === 0 || st === 8) {
        this.voices.playBassNote(activeInst, m2f(bassRoot), t, sd * 7.5, false, D.dry);
      }
    }

    // 3. Play Melodic Voice (Prioritizes HD Sampler with automatic Synth fallback)
    if (T.melOn[bar]) {
      const m = T.mel[bar][st];
      if (m !== null) {
        let melMidi = T.root + 12 + T.sc[((m % T.sc.length) + T.sc.length) % T.sc.length] + Math.floor(m / T.sc.length) * 12;

        // Ghost note infiltration: outgoing notes get re-tuned into the
        // incoming key with rising probability; rubato styles thin out.
        let ghosted = false;
        if (morphing && bridge) {
          if (Math.random() < morphDropout(mProg, mStyle)) {
            melMidi = -1;
          } else if (Math.random() < ghostProbability(mProg, mStyle)) {
            melMidi = morphNoteToKey(melMidi, 48 + bridge.targetKey.pc, SCALES[bridge.targetKey.scn as ScaleName] || SCALES.minor);
            ghosted = true;
          }
        }

        if (melMidi >= 0) {
        const freq = m2f(melMidi);
        const velocity = (st % 4 === 0 ? 1.0 : 0.82) * mVel; // Dynamic accents, dissolving across a morph
        const tMel = t + (morphing ? morphTimingJitter(mProg, mStyle, sd) : 0);
        const melDur = morphing && mStyle === 'sad-rubato' ? sd * (2.2 + 1.3 * mProg) : sd * 2.2;
        let handled = false;

        if (activeInst === 'cowbell') {
          // Authentic chromatically tuned Roland TR-808 cowbell
          handled = this.samplers.playPhonkCowbell(melMidi, tMel, sd * 1.5, velocity);
        } else if (activeInst === 'piano') {
          // Steinway Concert Grand multi-sample
          handled = this.samplers.playPiano(melMidi, tMel, sd * 2.5, velocity);
        } else if (activeInst === 'organ') {
          // Multi-rank Cathedral Church Organ
          handled = this.samplers.playOrgan(melMidi, tMel, sd * 2.0, velocity);
        } else if (activeInst === 'rhodes') {
          // Vintage Electric Piano Rhodes
          handled = this.samplers.playRhodes(melMidi, tMel, sd * 2.2, velocity);
        } else if (activeInst === 'space') {
          // Deep cosmic shimmer pad
          handled = this.samplers.playPad(melMidi, tMel, sd * 3.5, velocity);
        }

        if (!handled) {
          this.voices.playMelodicNote(
            activeInst,
            freq,
            tMel,
            melDur,
            ghosted ? velocity * 0.8 : velocity,
            cm,
            D.wet,
            D.dry
          );
        }
        }
      }
    }

    // 4. Play Drums (thin out progressively while a morph dissolves)
    const drumF = morphing ? 1 - 0.45 * mProg : 1;
    if (T.dr && T.drOn[bar]) {
      if (T.dr === 3) {
        // Phonk Trap Beat: Real hardware TR-808 punchy kicks, crisp claps, and fast hats
        if ([0, 6, 10].includes(st)) {
          if (!this.samplers.playTr808Drum('kick', t, 0.95 * drumF)) {
            this.voices.playKick(t, 0.85 * drumF, D.dry);
          }
        }
        if (st === 8) {
          if (!this.samplers.playTr808Drum('clap', t, 0.88 * drumF)) {
            this.voices.playNoiseHit(t, 0.22, 0.42 * drumF, 'bandpass', 1600, D.dry);
          }
        }
        // Rapid 16th trap hats with velocity dynamics
        const hVol = st % 2 === 0 ? 0.65 : 0.4;
        if (!this.samplers.playTr808Drum('hihat', t, hVol * drumF)) {
          const hVolSynth = st % 2 === 0 ? 0.11 : 0.07;
          this.voices.playNoiseHit(t, 0.035, hVolSynth * drumF, 'highpass', 7800, D.dry);
        }
      } else {
        if (T.kick.includes(st)) {
          this.voices.playKick(t, (T.dr === 2 ? 0.7 : 0.45) * drumF, D.dry);
        }
        if (T.dr === 2 && (st === 4 || st === 12)) {
          this.voices.playNoiseHit(t, 0.18, 0.28 * drumF, 'bandpass', 1850, D.dry);
        }
        if (T.dr === 2 ? st % 2 === 0 : st % 4 === 2) {
          const hVol = (st % 4 === 2 ? 0.09 : 0.055) * drumF;
          this.voices.playNoiseHit(t, 0.04, hVol, 'highpass', 7200, D.dry);
        }
      }
    }
  }

  /**
   * Look-ahead scheduler — reschedules itself via setTimeout.
   * This pattern avoids setInterval drift and keeps the JS thread responsive.
   * Notes are scheduled up to LOOKAHEAD seconds ahead using AudioContext.currentTime,
   * which is sample-accurate regardless of JS timer jitter.
   */
  private schedLoop() {
    if (!this.playing) return;
    this.sched();
    this.schedTimer = setTimeout(() => this.schedLoop(), this.SCHED_INTERVAL);
  }

  private sched() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (const D of this.decks) {
      // Smooth BPM Gliding — skip when bridge is already ramping BPM
      if (this.prefBpm !== 'default' && !(D.bridge && D.bridge.reason === 'bpm')) {
        const targetB = Number(this.prefBpm);
        if (Math.abs(D.tr.bpm - targetB) > 0.3) {
          D.tr.bpm += (targetB - D.tr.bpm) * 0.04;
          if (Math.abs(D.tr.bpm - targetB) <= 0.3) D.tr.bpm = targetB;
          if (this.currentTrack === D.tr) this.onTrackChange?.(D.tr);
        }
        if (D.next && D.next.bpm !== targetB) D.next.bpm = targetB;
      }

      const lim = Math.min(now + this.LOOKAHEAD, D.stopAt);
      const total = D.tr.bars * 16;

      while (D.nt < lim && D.step < total) {
        if (!D.queued && D.stopAt === Infinity && D.step === total - 64) {
          D.queued = true;
          if (D.next && (D.next.pc !== D.tr.pc || D.next.scn !== D.tr.scn)) {
            this.triggerDeckOutroBridge(D, D.next);
          }
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

    // Clean up finished decks — disconnect promptly to free audio graph nodes
    this.decks = this.decks.filter(D => {
      if (now > D.stopAt + 4) {
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

  /**
   * Transition Strategy Director — the single funnel for every bridge.
   * Builds the live TransitionContext, lets the energy score pick
   * DROP / BRIDGE / MORPH, and queues the matching bridge on one deck.
   */
  private queueDeckTransition(
    D: Deck,
    opts: {
      reason: TransitionBridge['reason'];
      targetKey?: { pc: number; scn: string };
      targetBpm?: number;
      fatigue?: boolean;
    }
  ): TransitionPlan | null {
    const targetKey = opts.targetKey ?? { pc: D.tr.pc, scn: D.tr.scn };
    const targetBpm = opts.targetBpm ?? D.tr.bpm;

    const currentBar = Math.floor(D.step / 16);
    const barStart = currentBar + 1;
    const barsRemaining = D.tr.bars - barStart;
    if (barsRemaining < 1) return null;

    const st = STATIONS.find(s => s.id === D.tr.stId) ?? this.station;
    const ctx: TransitionContext = {
      stationId: D.tr.stId,
      energy: computeTransitionEnergy(st, D.tr.bpm, this.weatherCat, this.period),
      deltaFifths: getFifthsDistance(D.tr.pc, targetKey.pc),
      deltaBpm: targetBpm - D.tr.bpm,
      barPosition: currentBar,
      barsRemaining,
      keysOnBeat: (D.step % 16) <= 8,
      fatigue: opts.fatigue ?? currentBar > D.tr.bars - 4,
      weather: this.weatherCat,
      period: this.period
    };

    const plan = planTransitionStrategy(ctx);
    const barsTotal = Math.max(1, Math.min(plan.bars, barsRemaining));

    const currentVoicing = D.tr.voicings[currentBar % 4] || [D.tr.root, D.tr.root + 7];
    const targetRoot = 48 + targetKey.pc;
    const targetScale = SCALES[targetKey.scn as ScaleName] || SCALES.minor;

    let chain: ModulationPath[] | undefined;
    let modulation: ModulationPath;
    if (plan.mode === 'morph') {
      chain = planModulationChain(
        D.tr.root, D.tr.pc, D.tr.scn,
        targetRoot, targetKey.pc, targetKey.scn,
        currentVoicing, barsTotal
      );
      modulation = chain[chain.length - 1];
    } else {
      modulation = planModulation(
        D.tr.root, D.tr.pc, D.tr.scn,
        targetRoot, targetKey.pc, targetKey.scn,
        currentVoicing
      );
    }

    const activeInst = this.prefInstrument !== 'auto' ? this.prefInstrument : D.tr.instrument;
    const melodicFiller = generateMelodicFiller(D.tr.stId, activeInst, D.tr.root, targetRoot, targetScale, plan.mode);

    D.bridge = {
      barStart,
      barsTotal,
      mode: plan.mode,
      style: plan.style,
      modulation,
      chain,
      melodicFiller,
      startBpm: D.tr.bpm,
      targetBpm: plan.rampBpm ? targetBpm : D.tr.bpm,
      targetKey,
      reason: opts.reason
    };
    return plan;
  }

  public queueTransition(opts: {
    reason: TransitionBridge['reason'];
    targetKey?: { pc: number; scn: string };
    targetBpm?: number;
    fatigue?: boolean;
  }) {
    let plan: TransitionPlan | null = null;
    for (const D of this.decks) {
      if (D.stopAt < Infinity) continue;
      const p = this.queueDeckTransition(D, opts);
      if (p && !plan) plan = p;
    }
    if (plan) {
      this.onTransitionChange?.(true, this.describeTransition(plan, opts));
    }
  }

  private describeTransition(
    plan: TransitionPlan,
    opts: { targetKey?: { pc: number; scn: string }; targetBpm?: number }
  ): string {
    if (!opts.targetKey) {
      const bpm = Math.round(opts.targetBpm ?? plan.bars);
      if (plan.mode === 'drop') return `⚡ Tempo drop to ${bpm} BPM`;
      if (plan.mode === 'bridge') return `🎭 Tempo bridge to ${bpm} BPM`;
      return `🌫️ Tempo drift to ${bpm} BPM`;
    }
    const key = `${NOTE_NAMES[opts.targetKey.pc]} ${opts.targetKey.scn}`;
    if (plan.mode === 'drop') return `⚡ Dropping into ${key}`;
    if (plan.mode === 'bridge') return `🎭 Bridging into ${key}`;
    return `🌫️ Morphing into ${key}…`;
  }

  /**
   * Outro Bridge for Seamless Song Crossfading:
   * Outgoing deck transitions into the incoming deck's key — the strategy
   * director decides drop vs bridge vs morph (fatigue favors morph).
   */
  public triggerDeckOutroBridge(D: Deck, nextTrack: Track) {
    const plan = this.queueDeckTransition(D, {
      reason: 'track_end',
      targetKey: { pc: nextTrack.pc, scn: nextTrack.scn },
      targetBpm: nextTrack.bpm,
      fatigue: true
    });
    if (plan) {
      this.onTransitionChange?.(true, this.describeTransition(plan, { targetKey: { pc: nextTrack.pc, scn: nextTrack.scn } }));
    }
  }

  public tuneStation(st: Station) {
    this.station = st;
    this.samplers?.preloadForStation(st.id, this.prefInstrument);
    this.currentTrack = this.generateNextTrack();
    if (!this.started || !this.ctx) {
      this.onTrackChange?.(this.currentTrack);
      return;
    }

    // Station identity rule: phonk & arcade switch as a hard drop-cut with
    // impact; mellow stations keep the slow crossfade morph.
    const hardDrop = st.id === 'phonk' || st.id === 'arcade';
    const t = this.ctx.currentTime + 0.05;
    this.decks.forEach(D => {
      if (D.stopAt > t + 2.6) this.fadeOutDeck(D, t, hardDrop ? 0.2 : 2.5);
    });
    const newDeck = this.startDeck(this.currentTrack, t, hardDrop ? 0.12 : 2.5);
    if (hardDrop) {
      const hit = t + 0.15;
      if (!this.samplers.playTr808Drum('kick', hit, 1.0)) {
        this.voices.playKick(hit, 1.0, newDeck.dry);
      }
      if (st.id === 'phonk') this.samplers.playTr808Drum('clap', hit, 0.9);
    }
    this.onTrackChange?.(this.currentTrack);
  }

  public setStation(st: Station) {
    this.tuneStation(st);
  }

  public setBpm(bpm: number | null | 'default') {
    this.prefBpm = bpm === null ? 'default' : bpm;
    if (typeof bpm === 'number' && this.playing && this.decks.length > 0) {
      this.queueTransition({ reason: 'bpm', targetBpm: bpm });
    }
  }

  public setKey(pc: number | null, scn: string | null) {
    if (pc === null || scn === null) {
      this.prefKey = null;
      this.pendingKeyChange = null;
    } else {
      this.prefKey = { pc, scn };
      if (this.playing && this.decks.length > 0) {
        this.queueTransition({ reason: 'key', targetKey: { pc, scn } });
      } else {
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
  }

  public setInstrument(inst: InstrumentId | null | 'default' | 'auto') {
    this.prefInstrument = !inst || inst === 'default' ? 'auto' : inst;
    this.samplers?.preloadForStation(this.station.id, this.prefInstrument);
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
