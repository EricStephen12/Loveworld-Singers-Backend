/**
 * AUDIOLAB AUDIO ENGINE
 * 
 * Core audio processing using Web Audio API
 * Handles: playback, recording, pitch detection, multi-part switching
 */

import type { AudioUrls, VocalPart, PitchData, AudioEngineState } from '../_types';

// AUDIO ENGINE CLASS

class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Playback
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffers: Map<VocalPart, AudioBuffer> = new Map();
  private currentPart: VocalPart = 'full';
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;

  // Recording
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private inputGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;

  // Fallback Playback (HTML5 Audio for CORS-restricted environments)
  private fallbackAudio: HTMLAudioElement | null = null;
  private useFallback: boolean = false;
  private fallbackDuration: number = 0;

  // Pitch detection
  private pitchDetectionActive: boolean = false;
  private pitchAnimationFrame: number | null = null;

  // Callbacks
  public onTimeUpdate: ((time: number) => void) | null = null;
  public onEnded: (() => void) | null = null;
  public onPitchDetected: ((data: PitchData) => void) | null = null;
  public onInputLevel: ((level: number) => void) | null = null;
  public onStateChange: ((state: Partial<AudioEngineState>) => void) | null = null;

  // Concurrency control
  private playRequestId: number = 0;

  // INITIALIZATION

  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      // Create or resume AudioContext
      if (!this.context) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.context = new AudioCtx();
        }
      }

      if (this.context && this.context.state === 'suspended') {
        await this.context.resume();
      }

      if (this.context) {
        // Create master gain node
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.context.destination);

        // Create analyser for visualization
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.connect(this.masterGain);
      }

      this.notifyStateChange({ isInitialized: !!this.context });
      return !!this.context;
    } catch (error) {
 console.warn('[AudioEngine] Web Audio init failed, continuing in Fallback mode.');
      return false;
    }
  }

  async ensureContext(): Promise<AudioContext | null> {
    if (!this.context) {
      await this.initialize();
    }
    return this.context;
  }

  // AUDIO LOADING

  async loadAudio(url: string): Promise<AudioBuffer | null> {
    try {
      const context = await this.ensureContext();
      if (!context) return null;

      const response = await fetch(url);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      return await context.decodeAudioData(arrayBuffer);
    } catch (error) {
      return null;
    }
  }

  async loadSongParts(urls: AudioUrls): Promise<boolean> {
    const requestId = ++this.playRequestId;
    try {
      this.audioBuffers.clear();

      const loadPromises: Promise<void>[] = [];

      for (const [part, url] of Object.entries(urls)) {
        if (url) {
          loadPromises.push(
            this.loadAudio(url).then(buffer => {
              // If a newer request superseded this load, don't store the buffer
              if (requestId === this.playRequestId && buffer) {
                this.audioBuffers.set(part as VocalPart, buffer);
              }
            })
          );
        }
      }

      await Promise.all(loadPromises);

      // If a newer request superseded this load, return failure for this request
      if (requestId !== this.playRequestId) {
        return false;
      }

      const success = this.audioBuffers.size > 0;

      if (!success && urls.full) {

        return await this.loadFallback(urls.full);
      }

      this.useFallback = false;
      return success;
    } catch (error) {
 console.error('[AudioEngine] Critical error in loadSongParts:', error);
      if (urls.full) return await this.loadFallback(urls.full);
      return false;
    }
  }

  private async loadFallback(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.fallbackAudio) {
        this.fallbackAudio.pause();
        this.fallbackAudio.src = '';
        this.fallbackAudio.load();
      }


      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      audio.preload = 'metadata';

      const onMetadata = () => {
        this.useFallback = true;
        this.fallbackDuration = audio.duration;
        this.fallbackAudio = audio;

        audio.ontimeupdate = () => {
          if (this.useFallback) this.onTimeUpdate?.(audio.currentTime);
        };

        audio.onended = () => {
          if (this.useFallback) {
            this.isPlaying = false;
            this.onEnded?.();
          }
        };

        resolve(true);
      };

      const onError = (e: any) => {
 console.error('[AudioEngine] Fallback Player Error:', audio.error || e);
        resolve(false);
      };

      audio.addEventListener('loadedmetadata', onMetadata, { once: true });
      audio.addEventListener('error', onError, { once: true });

      // Force load start
      audio.load();

      // Shorter timeout for faster feedback
      setTimeout(() => resolve(false), 8000);
    });
  }

  // PLAYBACK CONTROLS

  async play(part?: VocalPart): Promise<boolean> {
    if (this.useFallback && this.fallbackAudio) {

      this.isPlaying = true;
      this.fallbackAudio.play();
      return true;
    }

    const requestId = ++this.playRequestId;
    try {
      const context = await this.ensureContext();
      if (!context) {
        if (requestId === this.playRequestId && this.fallbackAudio) {
          this.useFallback = true;
          return this.play();
        }
        return false;
      }

      // Explicitly resume if suspended (crucial for mobile/autoplay)
      if (context.state === 'suspended') {
        await context.resume();
      }

      // If a newer play request has been made while we were waiting, abort this one
      if (requestId !== this.playRequestId) {
        return false;
      }

      if (part) {
        this.currentPart = part;
      }

      const buffer = this.audioBuffers.get(this.currentPart);
      if (!buffer) {
        if (requestId === this.playRequestId && this.fallbackAudio) {
          this.useFallback = true;
          return this.play();
        }
        return false;
      }

      // Stop any existing playback without triggering onEnded
      const wasPlaying = this.isPlaying;
      this.isPlaying = false;
      this.stopSource();

      // Create new source
      this.sourceNode = context.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.connect(this.analyser!);

      // Handle playback end
      this.sourceNode.onended = () => {
        // Only trigger onEnded if we didn't stop it manually
        if (this.isPlaying) {
          this.isPlaying = false;
          this.onEnded?.();
        }
      };

      // Start from pause position
      const offset = this.pauseTime;
      this.startTime = context.currentTime - offset;
      this.sourceNode.start(0, offset);
      this.isPlaying = true;

      // Start time update loop
      this.startTimeUpdateLoop();

      return true;
    } catch (error) {
 console.error('[AudioEngine] Play error:', error);
      if (requestId === this.playRequestId) {
        this.isPlaying = false;
      }
      return false;
    }
  }

  pause(): void {
    this.playRequestId++; // Invalidate any pending play calls

    if (this.useFallback && this.fallbackAudio) {
      this.fallbackAudio.pause();
      this.isPlaying = false;
      return;
    }

    if (!this.isPlaying || !this.context) return;

    this.pauseTime = this.getCurrentTime();
    this.stopSource();
    this.isPlaying = false;
  }

  stop(): void {
    this.playRequestId++; // Invalidate any pending play calls
    this.isPlaying = false;
    this.stopSource();
    this.pauseTime = 0;
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
      this.sourceNode = null;
    }
  }

  seek(time: number): void {
    if (this.useFallback && this.fallbackAudio) {
      const safeTime = Math.max(0, Math.min(time, this.fallbackDuration));
      this.fallbackAudio.currentTime = safeTime;
      this.onTimeUpdate?.(safeTime);
      return;
    }

    const wasPlaying = this.isPlaying;

    if (wasPlaying) {
      this.stopSource();
    }

    this.pauseTime = Math.max(0, Math.min(time, this.getDuration()));

    if (wasPlaying) {
      this.play();
    }

    this.onTimeUpdate?.(this.pauseTime);
  }

  // VOLUME CONTROL

  setVolume(volume: number): void {
    if (this.masterGain) {
      // Clamp between 0 and 1
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.masterGain.gain.setValueAtTime(clampedVolume, this.context?.currentTime || 0);
    }
  }

  getVolume(): number {
    return this.masterGain?.gain.value || 0;
  }

  // PART SWITCHING

  async switchPart(part: VocalPart): Promise<boolean> {
    if (this.useFallback) {
 console.warn('[AudioEngine] Part switching is disabled in Fallback (CORS) mode.');
      return false;
    }

    if (!this.audioBuffers.has(part)) {
 console.error('[AudioEngine] Part not available:', part);
      return false;
    }

    const currentTime = this.getCurrentTime();
    const wasPlaying = this.isPlaying;

    this.currentPart = part;
    this.pauseTime = currentTime;

    if (wasPlaying) {
      this.isPlaying = false;
      this.stopSource();
      await this.play(part);
    }

    return true;
  }

  getAvailableParts(): VocalPart[] {
    return Array.from(this.audioBuffers.keys());
  }

  getCurrentPart(): VocalPart {
    return this.currentPart;
  }

  // TIME & DURATION

  getCurrentTime(): number {
    if (this.useFallback && this.fallbackAudio) {
      return this.fallbackAudio.currentTime;
    }
    if (!this.context || !this.isPlaying) {
      return this.pauseTime;
    }
    return this.context.currentTime - this.startTime;
  }

  getDuration(): number {
    if (this.useFallback) return this.fallbackDuration;
    const buffer = this.audioBuffers.get(this.currentPart);
    return buffer?.duration || 0;
  }

  private startTimeUpdateLoop(): void {
    const update = () => {
      if (this.isPlaying) {
        this.onTimeUpdate?.(this.getCurrentTime());
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  // RECORDING

  async startRecording(): Promise<boolean> {
    try {
      const context = await this.ensureContext();
      if (!context) return false;

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create input nodes for monitoring
      const source = context.createMediaStreamSource(this.mediaStream);
      this.inputGain = context.createGain();
      this.inputAnalyser = context.createAnalyser();
      this.inputAnalyser.fftSize = 2048;

      source.connect(this.inputGain);
      this.inputGain.connect(this.inputAnalyser);
      // Don't connect to destination to avoid feedback

      // Start MediaRecorder
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.getSupportedMimeType()
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms

      // Start input level monitoring
      this.startInputLevelMonitoring();

      this.notifyStateChange({ isRecording: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.getSupportedMimeType()
        });

        // Cleanup
        this.cleanupRecording();
        this.notifyStateChange({ isRecording: false });

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanupRecording(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.inputGain = null;
    this.inputAnalyser = null;
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  // INPUT LEVEL MONITORING

  private startInputLevelMonitoring(): void {
    if (!this.inputAnalyser) return;

    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);

    const monitor = () => {
      if (!this.inputAnalyser || !this.mediaRecorder) return;

      this.inputAnalyser.getByteFrequencyData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = rms / 255; // Normalize to 0-1

      this.onInputLevel?.(level);
      this.notifyStateChange({ inputLevel: level });

      if (this.mediaRecorder?.state === 'recording') {
        requestAnimationFrame(monitor);
      }
    };

    requestAnimationFrame(monitor);
  }

  getInputLevel(): number {
    if (!this.inputAnalyser) return 0;

    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    this.inputAnalyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }

    return Math.sqrt(sum / dataArray.length) / 255;
  }

  // PITCH DETECTION

  startPitchDetection(): void {
    if (this.pitchDetectionActive || !this.inputAnalyser) return;

    this.pitchDetectionActive = true;
    this.detectPitch();
  }

  stopPitchDetection(): void {
    this.pitchDetectionActive = false;
    if (this.pitchAnimationFrame) {
      cancelAnimationFrame(this.pitchAnimationFrame);
      this.pitchAnimationFrame = null;
    }
  }

  private detectPitch(): void {
    if (!this.pitchDetectionActive || !this.inputAnalyser || !this.context) return;

    const bufferLength = this.inputAnalyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    this.inputAnalyser.getFloatTimeDomainData(buffer);

    // Autocorrelation-based pitch detection
    const pitch = this.autoCorrelate(buffer, this.context.sampleRate);

    if (pitch > 0) {
      const noteData = this.frequencyToNote(pitch);
      const pitchData: PitchData = {
        pitch,
        confidence: this.calculateConfidence(buffer),
        note: noteData.note,
        cents: noteData.cents
      };

      this.onPitchDetected?.(pitchData);
      this.notifyStateChange({
        currentPitch: pitch,
        pitchConfidence: pitchData.confidence
      });
    }

    this.pitchAnimationFrame = requestAnimationFrame(() => this.detectPitch());
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    // Find the RMS of the signal
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    // Not enough signal
    if (rms < 0.01) return -1;

    // Autocorrelation
    let r1 = 0, r2 = buffer.length - 1;
    const threshold = 0.2;

    for (let i = 0; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[i]) < threshold) {
        r1 = i;
        break;
      }
    }

    for (let i = 1; i < buffer.length / 2; i++) {
      if (Math.abs(buffer[buffer.length - i]) < threshold) {
        r2 = buffer.length - i;
        break;
      }
    }

    const buf2 = buffer.slice(r1, r2);
    const c = new Array(buf2.length).fill(0);

    for (let i = 0; i < buf2.length; i++) {
      for (let j = 0; j < buf2.length - i; j++) {
        c[i] += buf2[j] * buf2[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;

    let maxVal = -1, maxPos = -1;
    for (let i = d; i < buf2.length; i++) {
      if (c[i] > maxVal) {
        maxVal = c[i];
        maxPos = i;
      }
    }

    let T0 = maxPos;

    // Parabolic interpolation
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;

    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  }

  private frequencyToNote(frequency: number): { note: string; cents: number } {
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);

    const halfSteps = Math.round(12 * Math.log2(frequency / C0));
    const octave = Math.floor(halfSteps / 12);
    const noteIndex = halfSteps % 12;

    const perfectFreq = C0 * Math.pow(2, halfSteps / 12);
    const cents = Math.round(1200 * Math.log2(frequency / perfectFreq));

    return {
      note: noteStrings[noteIndex] + octave,
      cents
    };
  }

  private calculateConfidence(buffer: Float32Array): number {
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    // Map RMS to confidence (0-1)
    return Math.min(1, rms * 10);
  }

  // WAVEFORM DATA

  getWaveformData(samples: number = 100): number[] {
    const buffer = this.audioBuffers.get(this.currentPart);
    if (!buffer) return [];

    const channelData = buffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      waveform.push(sum / blockSize);
    }

    // Normalize
    const max = Math.max(...waveform);
    return waveform.map(v => v / max);
  }

  // STATE & CLEANUP

  getState(): AudioEngineState {
    return {
      isInitialized: !!this.context,
      isRecording: this.mediaRecorder?.state === 'recording',
      inputLevel: this.getInputLevel(),
      currentPitch: 0,
      pitchConfidence: 0
    };
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  private notifyStateChange(state: Partial<AudioEngineState>): void {
    this.onStateChange?.(state);
  }

  dispose(): void {
    this.stop();
    this.cleanupRecording();
    this.stopPitchDetection();
    this.audioBuffers.clear();

    if (this.context) {
      this.context.close();
      this.context = null;
    }

    this.masterGain = null;
    this.analyser = null;
  }
}

// SINGLETON EXPORT

export const audioEngine = new AudioEngine();
export default audioEngine;
