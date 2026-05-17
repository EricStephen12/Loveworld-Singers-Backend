/**
 * Voice Recording Service for AudioLab
 * Handles voice note recording and playback
 */

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private inputStream: MediaStream | null = null;
  private onLevelUpdate: ((level: number) => void) | null | undefined = null;

  constructor() {}

  async startRecording(onLevelUpdate?: (level: number) => void) {
    try {
      this.onLevelUpdate = onLevelUpdate;
      
      // Request microphone access
      this.inputStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Create audio context for visualization
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.inputStream);
      
      this.microphone.connect(this.analyser);
      this.analyser.fftSize = 256;
      
      // Start level monitoring
      this.monitorAudioLevel();
      
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.inputStream, {
        mimeType: 'audio/webm' // Good balance of quality/compression
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start();
      
      return true;
    } catch (error) {
 console.error('Error starting recording:', error);
      return false;
    }
  }

  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.cleanup();
          resolve(audioBlob);
        };
        
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }

  private monitorAudioLevel() {
    if (!this.analyser) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateLevel = () => {
      if (!this.analyser) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Normalize to 0-1 range
      const level = average / 255;
      
      if (this.onLevelUpdate) {
        this.onLevelUpdate(level);
      }
      
      if (this.mediaRecorder?.state === 'recording') {
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  }

  private cleanup() {
    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
      this.inputStream = null;
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.onLevelUpdate = null;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}