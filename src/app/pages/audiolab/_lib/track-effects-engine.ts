/**
 * TRACK EFFECTS ENGINE
 * Web Audio API based effects chain for each track
 */

export interface TrackEffects {
  volume: number;      // 0-100
  pan: number;         // -100 to 100
  reverb: number;      // 0-100 (wet/dry mix)
  bass: number;        // -12 to 12 dB
  treble: number;      // -12 to 12 dB
  compression: number; // 0-100
}

export interface EffectPreset {
  id: string;
  name: string;
  effects: Partial<TrackEffects>;
}

export const DEFAULT_EFFECTS: TrackEffects = {
  volume: 80,
  pan: 0,
  reverb: 20,
  bass: 0,
  treble: 0,
  compression: 30
};

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'raw', name: 'Raw', effects: { reverb: 0, bass: 0, treble: 0, compression: 0 } },
  { id: 'vocal', name: 'Vocal', effects: { reverb: 25, bass: -2, treble: 3, compression: 40 } },
  { id: 'warm', name: 'Warm', effects: { reverb: 35, bass: 4, treble: -2, compression: 25 } },
  { id: 'bright', name: 'Bright', effects: { reverb: 15, bass: -3, treble: 5, compression: 35 } },
  { id: 'radio', name: 'Radio', effects: { reverb: 10, bass: -6, treble: 4, compression: 60 } },
  { id: 'hall', name: 'Hall', effects: { reverb: 60, bass: 2, treble: 0, compression: 20 } }
];

interface TrackNodes {
  source: AudioBufferSourceNode | MediaElementAudioSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  bassFilter: BiquadFilterNode;
  trebleFilter: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  reverbGain: GainNode;
  dryGain: GainNode;
  convolver: ConvolverNode;
}

// Track which audio elements already have source nodes
const audioElementSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

class TrackEffectsEngine {
  private context: AudioContext | null = null;
  private trackNodes: Map<string, TrackNodes> = new Map();
  private reverbBuffer: AudioBuffer | null = null;

  async initialize(): Promise<boolean> {
    if (this.context) return true;
    try {
      this.context = new AudioContext();
      await this.createReverbImpulse();
      return true;
    } catch (error) {
 console.error('[TrackEffectsEngine] Init failed:', error);
      return false;
    }
  }

  private async createReverbImpulse(): Promise<void> {
    if (!this.context) return;
    // Create synthetic reverb impulse response
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * 2; // 2 second reverb
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    this.reverbBuffer = impulse;
  }

  createTrackChain(trackId: string, audioElement?: HTMLAudioElement): TrackNodes | null {
    if (!this.context) return null;

        const existing = this.trackNodes.get(trackId);

    // If we have an existing chain and the audio element is the same, return it
    if (existing && audioElement) {
      const source = existing.source as MediaElementAudioSourceNode;
      if (source && source.mediaElement === audioElement) {
        return existing;
      }

      // If audio element is different, disconnect the old source and reconnect the new one
      if (source) {
        source.disconnect();
      }

      let newSource: MediaElementAudioSourceNode;
      const cachedSource = audioElementSources.get(audioElement);
      if (cachedSource) {
        newSource = cachedSource;
      } else {
        newSource = this.context.createMediaElementSource(audioElement);
        audioElementSources.set(audioElement, newSource);
      }

      newSource.connect(existing.gainNode);
      existing.source = newSource;
      return existing;
    }

    if (existing && !audioElement) {
      return existing;
    }

    // Create all nodes
    const gainNode = this.context.createGain();
    const panNode = this.context.createStereoPanner();
    const bassFilter = this.context.createBiquadFilter();
    const trebleFilter = this.context.createBiquadFilter();
    const compressor = this.context.createDynamicsCompressor();
    const reverbGain = this.context.createGain();
    const dryGain = this.context.createGain();
    const convolver = this.context.createConvolver();

    // Configure filters
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 0;

    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 3000;
    trebleFilter.gain.value = 0;

    // Configure compressor
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Set reverb buffer
    if (this.reverbBuffer) {
      convolver.buffer = this.reverbBuffer;
    }

    // Default wet/dry mix
    reverbGain.gain.value = 0.2;
    dryGain.gain.value = 0.8;

    // Create source if audio element provided
    let source: MediaElementAudioSourceNode | null = null;
    if (audioElement) {
            const existingSource = audioElementSources.get(audioElement);
      if (existingSource) {
        source = existingSource;
        // Ensure it's disconnected from previous chains if any
        try { source.disconnect(); } catch (e) { }
      } else {
        source = this.context.createMediaElementSource(audioElement);
        audioElementSources.set(audioElement, source);
      }
    }

    // Connect chain: source -> gain -> pan -> bass -> treble -> compressor -> dry/wet -> destination
    // Dry path
    if (source) source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(bassFilter);
    bassFilter.connect(trebleFilter);
    trebleFilter.connect(compressor);

    // Split to dry and wet
    compressor.connect(dryGain);
    compressor.connect(convolver);
    convolver.connect(reverbGain);

    // Mix to destination
    dryGain.connect(this.context.destination);
    reverbGain.connect(this.context.destination);

    const nodes: TrackNodes = {
      source,
      gainNode,
      panNode,
      bassFilter,
      trebleFilter,
      compressor,
      reverbGain,
      dryGain,
      convolver
    };

    this.trackNodes.set(trackId, nodes);
    return nodes;
  }

  applyEffects(trackId: string, effects: TrackEffects): void {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes || !this.context) return;

    const now = this.context.currentTime;

    // Volume (0-100 -> 0-1)
    nodes.gainNode.gain.setValueAtTime(effects.volume / 100, now);

    // Pan (-100 to 100 -> -1 to 1)
    nodes.panNode.pan.setValueAtTime(effects.pan / 100, now);

    // Bass EQ (-12 to 12 dB)
    nodes.bassFilter.gain.setValueAtTime(effects.bass, now);

    // Treble EQ (-12 to 12 dB)
    nodes.trebleFilter.gain.setValueAtTime(effects.treble, now);

    // Reverb wet/dry (0-100)
    const wetAmount = effects.reverb / 100;
    nodes.reverbGain.gain.setValueAtTime(wetAmount, now);
    nodes.dryGain.gain.setValueAtTime(1 - wetAmount * 0.5, now);

    // Compression (0-100 -> threshold -50 to -10)
    const threshold = -50 + (effects.compression / 100) * 40;
    nodes.compressor.threshold.setValueAtTime(threshold, now);
  }

  setVolume(trackId: string, volume: number): void {
    const nodes = this.trackNodes.get(trackId);
    if (nodes && this.context) {
      nodes.gainNode.gain.setValueAtTime(volume / 100, this.context.currentTime);
    }
  }

  setPan(trackId: string, pan: number): void {
    const nodes = this.trackNodes.get(trackId);
    if (nodes && this.context) {
      nodes.panNode.pan.setValueAtTime(pan / 100, this.context.currentTime);
    }
  }

  setReverb(trackId: string, amount: number): void {
    const nodes = this.trackNodes.get(trackId);
    if (nodes && this.context) {
      const wet = amount / 100;
      nodes.reverbGain.gain.setValueAtTime(wet, this.context.currentTime);
      nodes.dryGain.gain.setValueAtTime(1 - wet * 0.5, this.context.currentTime);
    }
  }

  removeTrack(trackId: string): void {
    const nodes = this.trackNodes.get(trackId);
    if (nodes) {
      nodes.source?.disconnect();
      nodes.gainNode.disconnect();
      nodes.panNode.disconnect();
      nodes.bassFilter.disconnect();
      nodes.trebleFilter.disconnect();
      nodes.compressor.disconnect();
      nodes.reverbGain.disconnect();
      nodes.dryGain.disconnect();
      nodes.convolver.disconnect();
      this.trackNodes.delete(trackId);
    }
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  dispose(): void {
    this.trackNodes.forEach((_, id) => this.removeTrack(id));
    this.context?.close();
    this.context = null;
  }
}

export const trackEffectsEngine = new TrackEffectsEngine();
export default trackEffectsEngine;
