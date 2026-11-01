import { SplendidGrandPiano, Soundfont, CacheStorage } from 'smplr';
import { InstrumentId } from '../../types';

export type SamplerStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Manages HD Acoustic and Electronic Samplers:
 * 1. TR-808 HD Sampler (Real Roland TR-808 cowbell, kicks, snares, claps, hats)
 * 2. SplendidGrandPiano (Steinway Model B Concert Grand)
 * 3. MusyngKite Soundfonts (Church Organ, Electric Piano, Cello, Strings, Ambient Pad)
 *
 * Automatically falls back to procedural synthesis if offline or while samples are buffering.
 */
export class SamplerManager {
  private ctx: AudioContext;
  private dryBus: GainNode;
  private wetSend: GainNode;
  private cacheStorage: unknown;

  // Real TR-808 AudioBuffers
  private tr808Buffers: Map<string, AudioBuffer> = new Map();
  private tr808Loading = false;
  private tr808Ready = false;

  // smplr instruments
  private pianoInstance: any = null;
  private organInstance: any = null;
  private rhodesInstance: any = null;
  private celloInstance: any = null;
  private padInstance: any = null;

  // Status map
  public status: Record<string, SamplerStatus> = {
    tr808: 'idle',
    piano: 'idle',
    organ: 'idle',
    rhodes: 'idle',
    strings: 'idle',
    pad: 'idle'
  };

  public onStatusChange?: (instrumentKey: string, status: SamplerStatus) => void;

  constructor(ctx: AudioContext, dryBus: GainNode, wetSend: GainNode) {
    this.ctx = ctx;
    this.dryBus = dryBus;
    this.wetSend = wetSend;

    try {
      this.cacheStorage = CacheStorage('streamsongs-samples-v1');
    } catch {
      this.cacheStorage = undefined;
    }
  }

  private setStatus(key: string, s: SamplerStatus) {
    this.status[key] = s;
    this.onStatusChange?.(key, s);
  }

  /**
   * Pre-loads the relevant sampler for the current station/instrument
   */
  public preloadForStation(stationId: string, preferredInst: InstrumentId) {
    if (stationId === 'phonk' || preferredInst === 'cowbell') {
      this.loadTr808();
    }
    if (stationId === 'sad' || preferredInst === 'piano') {
      this.loadPiano();
      this.loadCello();
    }
    if (stationId === 'interstellar' || preferredInst === 'organ') {
      this.loadOrgan();
    }
    if (stationId === 'lofi' || preferredInst === 'rhodes') {
      this.loadRhodes();
    }
    if (stationId === 'cosmos' || stationId === 'focus' || preferredInst === 'space' || preferredInst === 'pad') {
      this.loadPad();
    }
  }

  // -------------------------------------------------------------
  // 1. TR-808 Real Hardware Sampler
  // -------------------------------------------------------------
  public async loadTr808(): Promise<void> {
    if (this.tr808Ready || this.tr808Loading) return;
    this.tr808Loading = true;
    this.setStatus('tr808', 'loading');

    const BASE_URL = 'https://smpldsnds.github.io/drum-machines/TR-808/';
    const SAMPLES: Record<string, string> = {
      cowbell: 'cowbell/cb.ogg',
      kick: 'kick/bd0000.ogg',
      snare: 'snare/sd0000.ogg',
      hihat: 'hihat-close/ch.ogg',
      clap: 'clap/cp.ogg'
    };

    try {
      const entries = Object.entries(SAMPLES);
      await Promise.all(
        entries.map(async ([name, relPath]) => {
          const url = `${BASE_URL}${relPath}`;
          let buffer: ArrayBuffer | null = null;

          // Try browser Cache API first
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              const cache = await caches.open('streamsongs-tr808-v1');
              const match = await cache.match(url);
              if (match) {
                buffer = await match.arrayBuffer();
              } else {
                const res = await fetch(url);
                if (res.ok) {
                  cache.put(url, res.clone());
                  buffer = await res.arrayBuffer();
                }
              }
            } catch {
              // Ignore cache error, fallback to normal fetch
            }
          }

          if (!buffer) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            buffer = await res.arrayBuffer();
          }

          const audioBuffer = await this.ctx.decodeAudioData(buffer);
          this.tr808Buffers.set(name, audioBuffer);
        })
      );

      this.tr808Ready = true;
      this.tr808Loading = false;
      this.setStatus('tr808', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Failed to load TR-808 samples, will use fallback synth:', err);
      this.tr808Loading = false;
      this.setStatus('tr808', 'error');
    }
  }

  /**
   * Plays a chromatically pitched TR-808 cowbell sample
   * Authentic Drift Phonk sound: pitched TR-808 cowbell with staccato choke & saturation
   */
  public playPhonkCowbell(midi: number, time: number, duration: number, velocity: number): boolean {
    const buffer = this.tr808Buffers.get('cowbell');
    if (!buffer) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    // TR-808 cowbell fundamental sample pitch is approximately G#5 / Ab5 (MIDI ~80)
    const baseMidi = 80;
    const semitones = midi - baseMidi;
    src.playbackRate.setValueAtTime(Math.pow(2, semitones / 12), time);

    // Filter to add aggressive phone-band mid punch
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.Q.value = 1.6;

    // Gain envelope with staccato decay
    const gain = this.ctx.createGain();
    const peak = 0.42 * velocity;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.28, Math.max(0.08, duration)));

    // Reverb tap
    const wetTap = this.ctx.createGain();
    wetTap.gain.value = 0.28;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(wetTap);
    wetTap.connect(this.wetSend);

    src.start(time);
    src.stop(time + 0.3);

    src.onended = () => {
      try {
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
        wetTap.disconnect();
      } catch {
        // Safe ignore
      }
    };

    return true;
  }

  /**
   * Plays a real TR-808 drum sample (kick, snare, hihat, clap)
   */
  public playTr808Drum(type: 'kick' | 'snare' | 'hihat' | 'clap', time: number, velocity: number): boolean {
    const buffer = this.tr808Buffers.get(type);
    if (!buffer) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const gain = this.ctx.createGain();
    const vol = (type === 'kick' ? 0.9 : type === 'snare' ? 0.65 : 0.3) * velocity;
    gain.gain.setValueAtTime(vol, time);

    src.connect(gain);
    gain.connect(this.dryBus);

    src.start(time);

    src.onended = () => {
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        // Safe ignore
      }
    };

    return true;
  }

  // -------------------------------------------------------------
  // 2. Splendid Grand Piano (Steinway Model B)
  // -------------------------------------------------------------
  public async loadPiano(): Promise<void> {
    if (this.pianoInstance || this.status.piano === 'loading') return;
    this.setStatus('piano', 'loading');

    try {
      this.pianoInstance = SplendidGrandPiano(this.ctx, {
        destination: this.dryBus,
        storage: this.cacheStorage as any,
        volume: 95
      });
      await this.pianoInstance.load;
      this.setStatus('piano', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Piano failed to load, using synth fallback:', err);
      this.pianoInstance = null;
      this.setStatus('piano', 'error');
    }
  }

  public playPiano(midi: number, time: number, duration: number, velocity: number): boolean {
    if (!this.pianoInstance || this.status.piano !== 'ready') return false;

    try {
      this.pianoInstance.start({
        note: midi,
        time,
        duration: Math.max(0.4, duration),
        velocity: Math.round(velocity * 105)
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------
  // 3. Cathedral Pipe Organ (Soundfont church_organ)
  // -------------------------------------------------------------
  public async loadOrgan(): Promise<void> {
    if (this.organInstance || this.status.organ === 'loading') return;
    this.setStatus('organ', 'loading');

    try {
      this.organInstance = Soundfont(this.ctx, {
        instrument: 'church_organ',
        destination: this.dryBus,
        storage: this.cacheStorage as any,
        extraGain: 2.2
      });
      await this.organInstance.load;
      this.setStatus('organ', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Church organ failed to load:', err);
      this.organInstance = null;
      this.setStatus('organ', 'error');
    }
  }

  public playOrgan(midi: number, time: number, duration: number, velocity: number): boolean {
    if (!this.organInstance || this.status.organ !== 'ready') return false;

    try {
      this.organInstance.start({
        note: midi,
        time,
        duration: Math.max(0.5, duration),
        velocity: Math.round(velocity * 90)
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------
  // 4. Electric Piano Rhodes (Soundfont electric_piano_1)
  // -------------------------------------------------------------
  public async loadRhodes(): Promise<void> {
    if (this.rhodesInstance || this.status.rhodes === 'loading') return;
    this.setStatus('rhodes', 'loading');

    try {
      this.rhodesInstance = Soundfont(this.ctx, {
        instrument: 'electric_piano_1',
        destination: this.dryBus,
        storage: this.cacheStorage as any,
        extraGain: 2.5
      });
      await this.rhodesInstance.load;
      this.setStatus('rhodes', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Rhodes failed to load:', err);
      this.rhodesInstance = null;
      this.setStatus('rhodes', 'error');
    }
  }

  public playRhodes(midi: number, time: number, duration: number, velocity: number): boolean {
    if (!this.rhodesInstance || this.status.rhodes !== 'ready') return false;

    try {
      this.rhodesInstance.start({
        note: midi,
        time,
        duration: Math.max(0.3, duration),
        velocity: Math.round(velocity * 95)
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------
  // 5. Cello / String Ensemble (Soundfont cello)
  // -------------------------------------------------------------
  public async loadCello(): Promise<void> {
    if (this.celloInstance || this.status.strings === 'loading') return;
    this.setStatus('strings', 'loading');

    try {
      this.celloInstance = Soundfont(this.ctx, {
        instrument: 'cello',
        destination: this.dryBus,
        storage: this.cacheStorage as any,
        extraGain: 2.0
      });
      await this.celloInstance.load;
      this.setStatus('strings', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Cello failed to load:', err);
      this.celloInstance = null;
      this.setStatus('strings', 'error');
    }
  }

  public playCello(midi: number, time: number, duration: number, velocity: number): boolean {
    if (!this.celloInstance || this.status.strings !== 'ready') return false;

    try {
      this.celloInstance.start({
        note: midi,
        time,
        duration: Math.max(0.8, duration),
        velocity: Math.round(velocity * 80)
      });
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------
  // 6. Deep Cosmos Shimmer Pad (Soundfont pad_1_new_age)
  // -------------------------------------------------------------
  public async loadPad(): Promise<void> {
    if (this.padInstance || this.status.pad === 'loading') return;
    this.setStatus('pad', 'loading');

    try {
      this.padInstance = Soundfont(this.ctx, {
        instrument: 'pad_1_new_age',
        destination: this.dryBus,
        storage: this.cacheStorage as any,
        extraGain: 2.0
      });
      await this.padInstance.load;
      this.setStatus('pad', 'ready');
    } catch (err) {
      console.warn('[SamplerManager] Pad failed to load:', err);
      this.padInstance = null;
      this.setStatus('pad', 'error');
    }
  }

  public playPad(midi: number, time: number, duration: number, velocity: number): boolean {
    if (!this.padInstance || this.status.pad !== 'ready') return false;

    try {
      this.padInstance.start({
        note: midi,
        time,
        duration: Math.max(1.2, duration),
        velocity: Math.round(velocity * 85)
      });
      return true;
    } catch {
      return false;
    }
  }
}
