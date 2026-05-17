// Voice Recording Service for Voice Messages
export interface VoiceMessage {
  id: string
  audioBlob: Blob
  duration: number
  timestamp: string
  senderId: string
  senderName: string
  groupId?: string
  friendId?: string
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
}

export class VoiceRecordingService {
  private static instance: VoiceRecordingService
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null
  }
  private recordingTimer: NodeJS.Timeout | null = null
  private startTime: number = 0

  private callbacks: {
    onRecordingStateChange?: (state: RecordingState) => void
    onRecordingComplete?: (voiceMessage: VoiceMessage) => void
    onRecordingError?: (error: Error) => void
  } = {}

  static getInstance(): VoiceRecordingService {
    if (!VoiceRecordingService.instance) {
      VoiceRecordingService.instance = new VoiceRecordingService()
    }
    return VoiceRecordingService.instance
  }

  // Set callbacks
  setCallbacks(callbacks: typeof this.callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  // Get current recording state
  getRecordingState(): RecordingState {
    return { ...this.recordingState }
  }

  // Start recording
  async startRecording(): Promise<boolean> {
    try {
      
            if (!MediaRecorder.isTypeSupported('audio/webm') && !MediaRecorder.isTypeSupported('audio/mp4')) {
        throw new Error('Voice recording not supported on this device')
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      this.mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      // Reset audio chunks
      this.audioChunks = []
      
      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        this.recordingState = {
          ...this.recordingState,
          isRecording: false,
          audioBlob,
          audioUrl
        }
        
        this.updateRecordingState()
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      // Handle errors
      this.mediaRecorder.onerror = (event) => {
 console.error('Recording error:', event)
        this.callbacks.onRecordingError?.(new Error('Recording failed'))
        this.stopRecording()
      }
      
      // Start recording
      this.mediaRecorder.start(100) // Collect data every 100ms
      this.startTime = Date.now()
      
      // Start timer
      this.recordingTimer = setInterval(() => {
        this.recordingState.duration = Math.floor((Date.now() - this.startTime) / 1000)
        this.updateRecordingState()
      }, 1000)
      
            this.recordingState = {
        ...this.recordingState,
        isRecording: true,
        isPaused: false,
        duration: 0
      }
      
      this.updateRecordingState()
      return true
    } catch (error) {
 console.error('Error starting recording:', error)
      this.callbacks.onRecordingError?.(error as Error)
      return false
    }
  }

  // Stop recording
  stopRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording) {
      this.mediaRecorder.stop()
      
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }
    }
  }

  // Pause recording
  pauseRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording && !this.recordingState.isPaused) {
      this.mediaRecorder.pause()
      this.recordingState.isPaused = true
      this.updateRecordingState()
    }
  }

  // Resume recording
  resumeRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording && this.recordingState.isPaused) {
      this.mediaRecorder.resume()
      this.recordingState.isPaused = false
      this.updateRecordingState()
    }
  }

  // Cancel recording
  cancelRecording(): void {
    
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
    }
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer)
      this.recordingTimer = null
    }
    
    // Reset state
    this.recordingState = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null
    }
    
    this.updateRecordingState()
  }

  // Create voice message
  createVoiceMessage(senderId: string, senderName: string, groupId?: string, friendId?: string): VoiceMessage | null {
    if (!this.recordingState.audioBlob) return null
    
    return {
      id: Date.now().toString(),
      audioBlob: this.recordingState.audioBlob,
      duration: this.recordingState.duration,
      timestamp: new Date().toISOString(),
      senderId,
      senderName,
      groupId,
      friendId
    }
  }

  // Play voice message
  playVoiceMessage(voiceMessage: VoiceMessage): HTMLAudioElement | null {
    if (!voiceMessage.audioBlob) return null
    
    const audioUrl = URL.createObjectURL(voiceMessage.audioBlob)
    const audio = new Audio(audioUrl)
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl)
    }
    
    audio.play().catch(error => {
 console.error('Error playing voice message:', error)
      URL.revokeObjectURL(audioUrl)
    })
    
    return audio
  }

  // Format duration
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

    private updateRecordingState(): void {
    this.callbacks.onRecordingStateChange?.(this.getRecordingState())
  }

    static isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.MediaRecorder &&
      window.navigator.mediaDevices &&
      window.navigator.mediaDevices.getUserMedia
    )
  }
}







