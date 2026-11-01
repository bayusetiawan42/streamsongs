import { InstrumentId } from '../../types';

export class VoiceManager {
  private ctx: AudioContext;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.initNoiseBuffer();
  }

  private initNoiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Automatic Node Lifecycle Cleanup:
   * When the audio source stops, cleanly disconnects all attached nodes
   * to immediately free memory, stop graph traversal, and avoid audio glitches / GC pauses.
   */
  private cleanupOnEnd(source: AudioScheduledSourceNode, ...nodes: (AudioNode | null | undefined)[]) {
    source.onended = () => {
      try {
        source.disconnect();
        for (let i = 0; i < nodes.length; i++) {
          nodes[i]?.disconnect();
        }
      } catch {
        // Safe ignore if already disconnected
      }
    };
  }

  /**
   * Main Melodic Voice Generator
   * Routes to specific instrument algorithm based on instrumentId.
   */
  public playMelodicNote(
    inst: InstrumentId,
    freq: number,
    time: number,
    duration: number,
    velocity: number,
    cutoff: number,
    wetSend: GainNode,
    dryBus: GainNode
  ) {
    switch (inst) {
      case 'rhodes':
        this.playRhodes(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'pluck':
        this.playKalimba(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'pad':
        this.playAnalogPad(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'flute':
        this.playBambooFlute(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'harp':
        this.playAcousticHarp(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'synthwave':
        this.playSynthwaveLead(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'chiptune':
        this.playChiptune(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'organ':
        this.playPipeOrgan(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'cowbell':
        this.playPhonkCowbell(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'piano':
        this.playConcertPiano(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      case 'space':
        this.playSpaceDrone(freq, time, duration, velocity, cutoff, wetSend, dryBus);
        break;
      default:
        this.playRhodes(freq, time, duration, velocity, cutoff, wetSend, dryBus);
    }
  }

  // 1. Warm FM Electric Piano (Rhodes / Tine)
  private playRhodes(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const carrier = c.createOscillator();
    const modulator = c.createOscillator();
    const modGain = c.createGain();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(f, t);

    // Modulator at 3x frequency creates that signature metallic Rhodes "tine" bell
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(f * 3, t);

    const modIntensity = f * 1.8 * vel;
    modGain.gain.setValueAtTime(modIntensity, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + Math.min(0.4, dur));

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 1.5, 4500), t);

    const gainVal = 0.08 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.015);
    env.gain.exponentialRampToValueAtTime(gainVal * 0.4, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);

    carrier.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.45;
    env.connect(wetTap);
    wetTap.connect(wet);

    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + dur + 0.65);
    modulator.stop(t + dur + 0.65);
  }

  // 2. Glass Kalimba / Crystal Pluck
  private playKalimba(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const subOsc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(f * 2, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.max(cut, f * 1.5), t);
    filter.Q.value = 4.0;

    const gainVal = 0.09 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur * 1.2));

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.7; // Generous reverb for dreamy sparkle
    env.connect(wetTap);
    wetTap.connect(wet);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + dur + 0.8);
    subOsc.stop(t + dur + 0.8);
  }

  // 3. Lush Analog Pad
  private playAnalogPad(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(f, t);
    // Slight detune for warm analog chorus
    osc2.frequency.setValueAtTime(f * 1.004, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(400, cut * 0.8), t);
    filter.frequency.exponentialRampToValueAtTime(Math.min(cut * 1.2, 2800), t + dur * 0.5);

    const gainVal = 0.05 * vel;
    const attack = Math.min(0.35, dur * 0.3);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + attack);
    env.gain.setValueAtTime(gainVal, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.8;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 1.25);
    osc2.stop(t + dur + 1.25);
  }

  // 4. Bamboo Flute / Whistle with Delayed Vibrato & Breath
  private playBambooFlute(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const vibrato = c.createOscillator();
    const vibGain = c.createGain();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);

    // Delayed vibrato (5.5 Hz starting after 200ms)
    vibrato.frequency.setValueAtTime(5.5, t);
    vibGain.gain.setValueAtTime(0.001, t);
    vibGain.gain.setValueAtTime(0.001, t + 0.18);
    vibGain.gain.linearRampToValueAtTime(f * 0.015, t + 0.5);

    vibrato.connect(vibGain);
    vibGain.connect(osc.frequency);

    // Filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 1.3, 3000), t);

    const gainVal = 0.075 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.08); // Soft breath attack
    env.gain.setValueAtTime(gainVal, t + dur * 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);

    osc.connect(filter);
    filter.connect(env);
    env.connect(dry);

    // Breath noise component
    if (this.noiseBuffer) {
      const breath = c.createBufferSource();
      breath.buffer = this.noiseBuffer;
      const bFilter = c.createBiquadFilter();
      bFilter.type = 'bandpass';
      bFilter.frequency.setValueAtTime(f * 2.2, t);
      bFilter.Q.value = 3.0;

      const bEnv = c.createGain();
      bEnv.gain.setValueAtTime(0.0001, t);
      bEnv.gain.linearRampToValueAtTime(0.012 * vel, t + 0.06);
      bEnv.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.35, dur));

      breath.connect(bFilter);
      bFilter.connect(bEnv);
      bEnv.connect(dry);

      breath.start(t);
      breath.stop(t + dur + 0.1);
    }

    const wetTap = c.createGain();
    wetTap.gain.value = 0.65;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + dur + 0.55);
    vibrato.stop(t + dur + 0.55);
  }

  // 5. Acoustic Harp / Guitar Pluck
  private playAcousticHarp(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 2, 4000), t);
    filter.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.3);

    const gainVal = 0.08 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);

    osc.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.6;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc.start(t);
    osc.stop(t + dur + 0.85);
  }

  // 6. Synthwave Neon Lead
  private playSynthwaveLead(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(f, t);
    osc2.frequency.setValueAtTime(f * 1.006, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(cut, 1200), t);
    filter.Q.value = 3.5;

    const gainVal = 0.06 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.02);
    env.gain.setValueAtTime(gainVal, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.4;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.3);
    osc2.stop(t + dur + 0.3);
  }

  // 7. Chiptune (8-bit NES Pulse)
  private playChiptune(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(f, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 2, 6000), t);

    const gainVal = 0.05 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.005);
    env.gain.setValueAtTime(gainVal, t + dur * 0.9);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);

    osc.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.2;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc.start(t);
    osc.stop(t + dur + 0.08);
  }

  // 8. Cathedral Pipe Organ (Hans Zimmer / Interstellar Style)
  private playPipeOrgan(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    // 3 Pipe Ranks: 8' (sawtooth fundamental), 4' (octave sine), and 2 2/3' (Nazard fifth triangle)
    const rank1 = c.createOscillator();
    const rank2 = c.createOscillator();
    const rank3 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    rank1.type = 'sawtooth';
    rank1.frequency.setValueAtTime(f, t);

    rank2.type = 'sine';
    rank2.frequency.setValueAtTime(f * 2, t);

    rank3.type = 'triangle';
    rank3.frequency.setValueAtTime(f * 3, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 1.5, 4200), t);
    filter.Q.value = 1.0;

    const gainVal = 0.06 * vel;
    env.gain.setValueAtTime(0.0001, t);
    // Church organ wind-chest attack swell
    env.gain.linearRampToValueAtTime(gainVal, t + 0.035);
    env.gain.setValueAtTime(gainVal * 0.9, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.55);

    rank1.connect(filter);
    rank2.connect(filter);
    rank3.connect(filter);
    filter.connect(env);
    env.connect(dry);

    // Deep cathedral space reverb
    const wetTap = c.createGain();
    wetTap.gain.value = 0.88;
    env.connect(wetTap);
    wetTap.connect(wet);

    rank1.start(t);
    rank2.start(t);
    rank3.start(t);
    rank1.stop(t + dur + 0.6);
    rank2.stop(t + dur + 0.6);
    rank3.stop(t + dur + 0.6);
  }

  // 9. Roland TR-808 Tuned Cowbell (Phonk Style: DVRST, Kordhell)
  private playPhonkCowbell(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    // Standard 808 cowbell fundamental ratios (540 Hz and 800 Hz)
    const ratio = f / 261.63; // relative to middle C
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(540 * ratio, t);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800 * ratio, t);

    // Resonant bandpass filter creates the signature metallic "tink"
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.min(cut * 1.6, 750 * ratio), t);
    filter.Q.value = 4.2;

    const gainVal = 0.085 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.002);
    // Punchy exponential decay
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.24, Math.max(0.12, dur)));

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dry);

    const wetTap = c.createGain();
    wetTap.gain.value = 0.35;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.3);
    osc2.stop(t + 0.3);
  }

  // 10. Concert Grand Piano (Ludovico Einaudi / Yiruma / Chopin style)
  private playConcertPiano(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    // Piano soundboard body (triangle) + hammer strike overtone (sine octave)
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(f, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f * 2, t);

    // Dynamic hammer filter envelope (sharp bright attack decaying into warm woody body)
    filter.type = 'lowpass';
    const initialCut = Math.min(cut * 2.2, 5200);
    const sustainCut = Math.min(cut * 0.9, 1800);
    filter.frequency.setValueAtTime(initialCut, t);
    filter.frequency.exponentialRampToValueAtTime(sustainCut, t + 0.12);

    const gainVal = 0.09 * vel;
    env.gain.setValueAtTime(0.0001, t);
    // Hammer impact
    env.gain.linearRampToValueAtTime(gainVal, t + 0.004);
    // Natural acoustic piano decay curve
    env.gain.exponentialRampToValueAtTime(gainVal * 0.45, t + 0.22);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dry);

    // Rich acoustic concert hall reverb
    const wetTap = c.createGain();
    wetTap.gain.value = 0.55;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 1.25);
    osc2.stop(t + dur + 1.25);
  }

  // 11. Deep Cosmos Space Drone (Brian Eno / Carbon Based Lifeforms)
  private playSpaceDrone(
    f: number, t: number, dur: number, vel: number, cut: number,
    wet: GainNode, dry: GainNode
  ) {
    const c = this.ctx;
    // Shimmer pad: two slightly detuned sine drones with slow beating
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f * 0.998, t);   // -3 cents (slow cosmic beating)

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f * 1.002, t);   // +3 cents (slow cosmic beating)

    // Slow harmonic morph: octave harmonic sine
    const osc3 = c.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(f * 2.0, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(cut * 0.6, 1200), t);
    filter.Q.value = 0.5;

    const gainVal = 0.07 * vel;
    env.gain.setValueAtTime(0.0001, t);
    // Eno-style glacial attack (2s swell)
    env.gain.linearRampToValueAtTime(gainVal, t + 2.0);
    env.gain.setValueAtTime(gainVal, t + Math.max(2.5, dur));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 3.0);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(env);
    env.connect(dry);

    // Wash of deep infinite space reverb
    const wetTap = c.createGain();
    wetTap.gain.value = 0.95;
    env.connect(wetTap);
    wetTap.connect(wet);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);
    osc1.stop(t + dur + 3.1);
    osc2.stop(t + dur + 3.1);
    osc3.stop(t + dur + 3.1);
  }

  /**
   * Instrument-Adaptive Pad & Harmonic Drone Voice
   * Adjusts oscillator waveforms, filter behavior, attack/decay envelopes,
   * FM harmonics, and space according to the selected instrument.
   */
  public playPadChord(
    inst: InstrumentId,
    freq: number,
    t: number,
    dur: number,
    voiceIndex: number,
    cutoff: number,
    wetAmt: number,
    wetSend: GainNode,
    dryBus: GainNode
  ) {
    const c = this.ctx;
    const hold = t + Math.max(0.6, dur);
    const isTopVoice = voiceIndex > 0;
    const baseGain = isTopVoice ? 0.024 : 0.032;

    switch (inst) {
      // 1. Warm Rhodes: Soft FM Electric Piano / Bell Tine Pad Bed
      case 'rhodes': {
        const carrier = c.createOscillator();
        const mod = c.createOscillator();
        const modGain = c.createGain();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, t);

        mod.type = 'sine';
        mod.frequency.setValueAtTime(freq * 2, t);
        modGain.gain.setValueAtTime(freq * 0.4, t);
        modGain.gain.exponentialRampToValueAtTime(1, hold);

        mod.connect(modGain);
        modGain.connect(carrier.frequency);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.9, 1800), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.1, t + 0.45);
        env.gain.setValueAtTime(baseGain * 1.1, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.4);

        carrier.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.6;
          env.connect(s);
          s.connect(wetSend);
        }

        carrier.start(t);
        mod.start(t);
        carrier.stop(hold + 1.5);
        mod.stop(hold + 1.5);
        break;
      }

      // 2. Glass Kalimba: Ethereal Shimmering Crystal Drone
      case 'kalimba':
      case 'pluck': {
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, t);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.01, t); // Slight detuned glass harmonic

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 1.25, 2600), t);
        filter.Q.value = 1.8;

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 0.9, t + 0.6);
        env.gain.setValueAtTime(baseGain * 0.9, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.8);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.85;
          env.connect(s);
          s.connect(wetSend);
        }

        osc1.start(t);
        osc2.start(t);
        osc1.stop(hold + 1.9);
        osc2.stop(hold + 1.9);
        break;
      }

      // 3. Lush Analog Pad: Rich Dual-Detuned Sawtooth + Triangle Warmth
      case 'pad': {
        const saw1 = c.createOscillator();
        const saw2 = c.createOscillator();
        const tri = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        saw1.type = 'sawtooth';
        saw1.frequency.setValueAtTime(freq * 0.997, t); // -5 cents

        saw2.type = 'sawtooth';
        saw2.frequency.setValueAtTime(freq * 1.004, t); // +7 cents

        tri.type = 'triangle';
        tri.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.Q.value = 1.4;
        filter.frequency.setValueAtTime(cutoff * 0.5, t);
        filter.frequency.linearRampToValueAtTime(Math.min(cutoff * 1.15, 3200), t + 1.2);
        filter.frequency.exponentialRampToValueAtTime(cutoff * 0.75, hold + 1.2);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.2, t + 1.1);
        env.gain.setValueAtTime(baseGain * 1.2, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 2.0);

        saw1.connect(filter);
        saw2.connect(filter);
        tri.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.8;
          env.connect(s);
          s.connect(wetSend);
        }

        saw1.start(t);
        saw2.start(t);
        tri.start(t);
        saw1.stop(hold + 2.1);
        saw2.stop(hold + 2.1);
        tri.stop(hold + 2.1);
        break;
      }

      // 4. Bamboo Flute: Meditative Breathy Wind Drone
      case 'flute': {
        const osc = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.85, 1400), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.05, t + 0.8);
        env.gain.setValueAtTime(baseGain * 1.05, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.6);

        osc.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        // Breath noise overtone whisper
        if (this.noiseBuffer) {
          const noise = c.createBufferSource();
          noise.buffer = this.noiseBuffer;
          const noiseFilter = c.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.setValueAtTime(Math.min(freq * 1.6, 2400), t);
          noiseFilter.Q.value = 2.5;

          const noiseEnv = c.createGain();
          noiseEnv.gain.setValueAtTime(0.0001, t);
          noiseEnv.gain.linearRampToValueAtTime(0.006, t + 0.6);
          noiseEnv.gain.exponentialRampToValueAtTime(0.0001, hold + 1.2);

          noise.connect(noiseFilter);
          noiseFilter.connect(noiseEnv);
          noiseEnv.connect(dryBus);
          noise.start(t);
          noise.stop(hold + 1.3);
        }

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.7;
          env.connect(s);
          s.connect(wetSend);
        }

        osc.start(t);
        osc.stop(hold + 1.7);
        break;
      }

      // 5. Acoustic Harp: Warm Plucked String Bloom & Soundboard Resonance
      case 'harp': {
        const tri = c.createOscillator();
        const saw = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        tri.type = 'triangle';
        tri.frequency.setValueAtTime(freq, t);

        saw.type = 'sawtooth';
        saw.frequency.setValueAtTime(freq * 1.002, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.8, 1600), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 0.95, t + 0.35);
        env.gain.setValueAtTime(baseGain * 0.95, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.5);

        tri.connect(filter);
        saw.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.65;
          env.connect(s);
          s.connect(wetSend);
        }

        tri.start(t);
        saw.start(t);
        tri.stop(hold + 1.6);
        saw.stop(hold + 1.6);
        break;
      }

      // 6. Neon Synthwave: Punchy 80s Resonant Analog Synth Pad
      case 'synthwave': {
        const saw1 = c.createOscillator();
        const saw2 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        saw1.type = 'sawtooth';
        saw1.frequency.setValueAtTime(freq, t);

        saw2.type = 'sawtooth';
        saw2.frequency.setValueAtTime(freq * 1.006, t); // Thick +10 cents detune

        filter.type = 'lowpass';
        filter.Q.value = 2.2;
        filter.frequency.setValueAtTime(2800, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(650, cutoff * 0.9), t + 0.9);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.15, t + 0.25);
        env.gain.setValueAtTime(baseGain * 1.15, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.2);

        saw1.connect(filter);
        saw2.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.85;
          env.connect(s);
          s.connect(wetSend);
        }

        saw1.start(t);
        saw2.start(t);
        saw1.stop(hold + 1.3);
        saw2.stop(hold + 1.3);
        break;
      }

      // 7. 8-Bit Chiptune: Authentic NES/GameBoy Square/Triangle Drone
      case 'chiptune': {
        const sq = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        sq.type = 'square';
        sq.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4200, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 0.55, t + 0.08);
        env.gain.setValueAtTime(baseGain * 0.55, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 0.6);

        sq.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.25;
          env.connect(s);
          s.connect(wetSend);
        }

        sq.start(t);
        sq.stop(hold + 0.7);
        break;
      }

      // 8. Cathedral Pipe Organ: Majestic Multi-Rank Choir Bed
      case 'organ': {
        const o1 = c.createOscillator();
        const o2 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(freq, t);

        o2.type = 'sine';
        o2.frequency.setValueAtTime(freq * 2, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 1.3, 3600), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.25, t + 0.35);
        env.gain.setValueAtTime(baseGain * 1.25, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.6);

        o1.connect(filter);
        o2.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.9;
          env.connect(s);
          s.connect(wetSend);
        }

        o1.start(t);
        o2.start(t);
        o1.stop(hold + 1.8);
        o2.stop(hold + 1.8);
        break;
      }

      // 9. Phonk Dark Memphis Brass Pad
      case 'cowbell': {
        const o1 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.85, 1600), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 0.9, t + 0.1);
        env.gain.setValueAtTime(baseGain * 0.9, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 0.8);

        o1.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.4;
          env.connect(s);
          s.connect(wetSend);
        }

        o1.start(t);
        o1.stop(hold + 0.9);
        break;
      }

      // 10. Melancholic Piano: Emotional Bowing Cello & Chamber Strings
      case 'piano': {
        const s1 = c.createOscillator();
        const s2 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        s1.type = 'sawtooth';
        s1.frequency.setValueAtTime(freq * 0.996, t); // -7 cents detune

        s2.type = 'sawtooth';
        s2.frequency.setValueAtTime(freq * 1.004, t); // +7 cents detune

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.85, 1700), t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 0.95, t + 0.7); // gentle string swell
        env.gain.setValueAtTime(baseGain * 0.95, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.8);

        s1.connect(filter);
        s2.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.85;
          env.connect(s);
          s.connect(wetSend);
        }

        s1.start(t);
        s2.start(t);
        s1.stop(hold + 2.0);
        s2.stop(hold + 2.0);
        break;
      }

      // 11. Deep Cosmos: Infinite Shimmer Pad with Lydian Drone (Brian Eno style)
      case 'space': {
        const d1 = c.createOscillator();
        const d2 = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        d1.type = 'sine';
        d1.frequency.setValueAtTime(freq * 0.999, t); // -2 cents slow cosmic beat

        d2.type = 'sine';
        d2.frequency.setValueAtTime(freq * 1.001, t); // +2 cents slow cosmic beat

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(cutoff * 0.55, 1000), t);
        filter.Q.value = 0.4;

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain * 1.1, t + 1.8); // Eno slow swell
        env.gain.setValueAtTime(baseGain * 1.1, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 3.5);

        d1.connect(filter);
        d2.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt * 0.98;
          env.connect(s);
          s.connect(wetSend);
        }

        d1.start(t);
        d2.start(t);
        d1.stop(hold + 3.6);
        d2.stop(hold + 3.6);
        break;
      }

      // Fallback
      default: {
        const osc = c.createOscillator();
        const filter = c.createBiquadFilter();
        const env = c.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, t);

        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(baseGain, t + 0.6);
        env.gain.setValueAtTime(baseGain, hold);
        env.gain.exponentialRampToValueAtTime(0.0001, hold + 1.4);

        osc.connect(filter);
        filter.connect(env);
        env.connect(dryBus);

        if (wetAmt > 0) {
          const s = c.createGain();
          s.gain.value = wetAmt;
          env.connect(s);
          s.connect(wetSend);
        }

        osc.start(t);
        osc.stop(hold + 1.5);
      }
    }
  }

  /**
   * Instrument-Adaptive Bassline Voice
   * Generates warm sub, plucked acoustic, deep Moog analog, or punchy synthwave bass.
   */
  public playBassNote(
    inst: InstrumentId,
    freq: number,
    t: number,
    dur: number,
    isPulse: boolean,
    dryBus: GainNode
  ) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const env = c.createGain();

    switch (inst) {
      // 1. Rhodes: Vintage Electric Sub / Warm Fingered Bass
      case 'rhodes': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, t);

        const gain = isPulse ? 0.22 : 0.28;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.015);
        env.gain.setValueAtTime(gain * 0.75, t + Math.max(0.1, dur * 0.6));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
        break;
      }

      // 2. Glass Kalimba: Woody Acoustic Plucked Bass
      case 'kalimba':
      case 'pluck': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, t);

        const gain = isPulse ? 0.2 : 0.25;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.01);
        env.gain.exponentialRampToValueAtTime(gain * 0.4, t + 0.18);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
        break;
      }

      // 3. Analog Pad: Deep Resonant Moog Sub Bass
      case 'pad': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.Q.value = 1.8;
        filter.frequency.setValueAtTime(210, t);

        const gain = isPulse ? 0.22 : 0.3;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.025);
        env.gain.setValueAtTime(gain * 0.85, t + Math.max(0.1, dur * 0.75));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
        break;
      }

      // 4. Bamboo Flute: Gentle Organic Earth Sub Bass
      case 'flute': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, t);

        const gain = isPulse ? 0.18 : 0.26;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.04); // Gentle breath entry
        env.gain.setValueAtTime(gain, t + Math.max(0.1, dur * 0.7));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
        break;
      }

      // 5. Acoustic Harp: Plucked Upright Acoustic Bass
      case 'harp': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(360, t);

        const gain = isPulse ? 0.22 : 0.27;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.012);
        env.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.22);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
        break;
      }

      // 6. Neon Synthwave: Punchy Rolling 80s Analog Bass
      case 'synthwave': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.Q.value = 2.4;
        filter.frequency.setValueAtTime(540, t);
        filter.frequency.exponentialRampToValueAtTime(260, t + 0.18);

        const gain = 0.24;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.01);
        env.gain.exponentialRampToValueAtTime(gain * 0.6, t + 0.12);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
        break;
      }

      // 7. 8-Bit Chiptune: Authentic NES Triangle Wave Bass
      case 'chiptune': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);

        const gain = 0.26;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.008);
        env.gain.setValueAtTime(gain, t + Math.max(0.05, dur * 0.7));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
        break;
      }

      // 8. Pipe Organ: Deep 32-Foot Pedal Bourdon Sub Bass
      case 'organ': {
        osc.type = isPulse ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, t);

        const gain = isPulse ? 0.28 : 0.36;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.04);
        env.gain.setValueAtTime(gain * 0.9, t + Math.max(0.1, dur * 0.8));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
        break;
      }

      // 9. Phonk Saturated 808 Sub-bass with Pitch Drop
      case 'cowbell': {
        osc.type = 'sine';
        // 808 punchy pitch-drop attack (starts ~35Hz higher and drops in 22ms)
        osc.frequency.setValueAtTime(freq + 35, t);
        osc.frequency.exponentialRampToValueAtTime(freq, t + 0.022);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, t);

        const gain = 0.38; // Heavy saturated 808 presence
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.006);
        env.gain.setValueAtTime(gain * 0.85, t + Math.max(0.08, dur * 0.7));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
        break;
      }

      // 10. Concert Piano: Deep Grand Piano Low Bass String Resonance
      case 'piano': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, t);

        const gain = 0.28;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.005);
        env.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.35);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
        break;
      }

      // 11. Deep Cosmos Space: Slow sine sub drone (Brian Eno / ambient bass)
      case 'space': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, t);

        const gain = 0.2;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 1.5); // extremely slow swell
        env.gain.setValueAtTime(gain, t + Math.max(2.0, dur * 0.8));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.5);
        break;
      }

      // Fallback
      default: {
        osc.type = isPulse ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(isPulse ? 650 : 380, t);

        const gain = isPulse ? 0.18 : 0.28;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.015);
        env.gain.setValueAtTime(gain, t + Math.max(0.1, dur * 0.7));
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
      }
    }

    osc.connect(filter);
    filter.connect(env);
    env.connect(dryBus);

    osc.start(t);
    osc.stop(t + dur + 0.35);
  }

  // Kick Drum (Sub Sine Sweep)
  public playKick(t: number, vol: number, dryBus: GainNode) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const env = c.createGain();

    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);

    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(env);
    env.connect(dryBus);

    osc.start(t);
    osc.stop(t + 0.35);
    this.cleanupOnEnd(osc, env);
  }

  // Snare, Hi-hat, Foley Noise
  public playNoiseHit(
    t: number, dur: number, vol: number, type: BiquadFilterType, freq: number,
    dryBus: GainNode
  ) {
    if (!this.noiseBuffer) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;

    const env = c.createGain();
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(dryBus);

    src.start(t);
    src.stop(t + dur + 0.05);
    this.cleanupOnEnd(src, filter, env);
  }
}
