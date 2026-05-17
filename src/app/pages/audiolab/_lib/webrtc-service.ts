/**
 * WebRTC Service for AudioLab
 * Handles peer-to-peer audio connections for live sessions
 * Optimized for low latency and reliable connections
 */

import { WebRTCSignaling, SignalMessage } from './webrtc-signaling';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
  bundlePolicy?: RTCBundlePolicy;
  rtcpMuxPolicy?: RTCRtcpMuxPolicy;
}

export interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  audioStream?: MediaStream;
  isHost: boolean;
  pendingCandidates: RTCIceCandidateInit[]; // Queue for ICE candidates before remote description
}

export class WebRTCService {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private videoEnabled: boolean = false;
  private isScreenSharing: boolean = false;
  private config: WebRTCConfig;
  private onRemoteStreamAdded: ((userId: string, stream: MediaStream) => void) | null = null;
  private onDataReceived: ((userId: string, data: any) => void) | null = null;
  private onConnectionStateChanged: ((userId: string, state: string) => void) | null = null;
  private signalingService: WebRTCSignaling | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;

  constructor(config?: Partial<WebRTCConfig>) {
    // Optimized ICE servers - prioritize faster STUN servers
    this.config = {
      iceServers: config?.iceServers || [
        // Google STUN servers (fastest, most reliable)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Free TURN servers from Open Relay Project (for NAT traversal)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      // Optimization settings for faster connection
      iceCandidatePoolSize: 10, // Pre-gather candidates
      bundlePolicy: 'max-bundle', // Bundle all media for efficiency
      rtcpMuxPolicy: 'require' // Multiplex RTP and RTCP
    };
  }

  initializeSignaling(sessionId: string, userId: string): void {
    this.sessionId = sessionId;
    this.userId = userId;
    this.signalingService = new WebRTCSignaling(sessionId, userId);

    // Start listening for incoming signals
    this.signalingService.startListening((message) => {
      this.handleSignalMessage(message);
    });
  }

  async initializeLocalStream(): Promise<boolean> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Optimize for voice
          sampleRate: 48000,
          channelCount: 1
        }
      });
      return true;
    } catch (error) {
 console.error('Error initializing local stream:', error);
      return false;
    }
  }

  private async handleSignalMessage(message: SignalMessage): Promise<void> {
    const { type, from, payload } = message;

    // Create peer connection if it doesn't exist
    if (!this.peerConnections.has(from)) {
      this.createPeerConnection(from, false);
    }

    const peer = this.peerConnections.get(from);
    const pc = peer?.connection;
    if (!pc || !peer) {
 console.error('[WebRTC] No peer connection found for:', from);
      return;
    }

    try {
      switch (type) {
        case 'offer':

          // Reset connection if in wrong state
          if (pc.signalingState !== 'stable') {
            // Close and recreate
            pc.close();
            this.peerConnections.delete(from);
            this.createPeerConnection(from, false);
            const newPeer = this.peerConnections.get(from);
            if (!newPeer) return;

            await newPeer.connection.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await newPeer.connection.createAnswer();
            await newPeer.connection.setLocalDescription(answer);
            await this.signalingService?.sendSignal(from, 'answer', answer);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload));

          // Process any queued ICE candidates
          if (peer.pendingCandidates.length > 0) {
            for (const candidate of peer.pendingCandidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
 console.warn('[WebRTC] Error adding queued ICE candidate:', e);
              }
            }
            peer.pendingCandidates = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await this.signalingService?.sendSignal(from, 'answer', answer);
          break;

        case 'answer':

          // Only set remote description if we're expecting an answer
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));

            // Process any queued ICE candidates
            if (peer.pendingCandidates.length > 0) {
              for (const candidate of peer.pendingCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
 console.warn('[WebRTC] Error adding queued ICE candidate:', e);
                }
              }
              peer.pendingCandidates = [];
            }
          } else {
 console.warn('[WebRTC] Received answer but not in have-local-offer state:', pc.signalingState);
          }
          break;

        case 'ice-candidate':
          if (!payload) {
            return;
          }

          // Queue ICE candidates if remote description not set yet
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            // Limit queue size to prevent memory leaks
            if (peer.pendingCandidates.length < 50) {
              peer.pendingCandidates.push(payload);
            } else {
 console.warn('[WebRTC] ICE candidate queue full, dropping candidate');
            }
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload));
            } catch (e) {
 console.warn('[WebRTC] Error adding ICE candidate:', e);
            }
          }
          break;

        case 'request-offer':
          // Someone is requesting us to send them an offer
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await this.signalingService?.sendSignal(from, 'offer', offer);
          } catch (e) {
 console.error('[WebRTC] Error creating offer on request:', e);
          }
          break;
      }
    } catch (error) {
 console.error('[WebRTC] Error handling signal message:', error);
    }
  }

  createPeerConnection(userId: string, isHost: boolean): RTCPeerConnection {
    // Create peer connection with optimized config
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: this.config.iceCandidatePoolSize || 10,
      bundlePolicy: this.config.bundlePolicy || 'max-bundle',
      rtcpMuxPolicy: this.config.rtcpMuxPolicy || 'require'
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote streams
    pc.ontrack = (event) => {
      if (this.onRemoteStreamAdded) {
        this.onRemoteStreamAdded(userId, event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.signalingService) {
        // Send candidate to remote peer via signaling
        this.signalingService.sendSignal(userId, 'ice-candidate', event.candidate);
      }
    };

    // Monitor ICE connection state for faster feedback
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      }
      if (this.onConnectionStateChanged) {
        this.onConnectionStateChanged(userId, pc.iceConnectionState);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeerConnection(userId);
      }
    };

    // Create data channel for text chat and signaling
    const dataChannel = pc.createDataChannel('chat', {
      ordered: true,
    });

    dataChannel.onopen = () => {
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onDataReceived) {
          this.onDataReceived(userId, data);
        }
      } catch (e) {
 console.error('Error parsing data channel message:', e);
      }
    };

    pc.ondatachannel = (event) => {
      event.channel.onmessage = (dataEvent) => {
        try {
          const data = JSON.parse(dataEvent.data);
          if (this.onDataReceived) {
            this.onDataReceived(userId, data);
          }
        } catch (e) {
 console.error('Error parsing data channel message:', e);
        }
      };
    };

    this.peerConnections.set(userId, {
      id: userId,
      connection: pc,
      dataChannel,
      isHost,
      pendingCandidates: []
    });

    return pc;
  }

  async setVideoEnabled(enabled: boolean): Promise<boolean> {
    this.videoEnabled = enabled;

    // If we already have a stream, we need to add/remove the video track
    if (this.localStream) {
      if (enabled) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 15 } // Lower frame rate for rehearsal efficiency
            }
          });
          const videoTrack = videoStream.getVideoTracks()[0];
          this.localStream.addTrack(videoTrack);

          // Add to all peer connections
          this.peerConnections.forEach(peer => {
            peer.connection.addTrack(videoTrack, this.localStream!);
            // Renegotiate
            this.initiateConnection(peer.id);
          });
          return true;
        } catch (e) {
 console.error('[WebRTC] Error enabling video:', e);
          return false;
        }
      } else {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          this.localStream.removeTrack(videoTrack);

          // Remove from all peer connections
          this.peerConnections.forEach(peer => {
            const sender = peer.connection.getSenders().find(s => s.track?.id === videoTrack.id);
            if (sender) peer.connection.removeTrack(sender);
            // Renegotiate
            this.initiateConnection(peer.id);
          });
        }
        return true;
      }
    }
    return false;
  }

  async startScreenShare(): Promise<boolean> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false // Screen audio is complex, keeping it simple for now
      });

      this.isScreenSharing = true;
      const screenTrack = this.screenStream.getVideoTracks()[0];

      // Stop screen sharing if track ends (user clicks "Stop sharing" in browser)
      screenTrack.onended = () => this.stopScreenShare();

      // Replace video track in all active connections
      this.peerConnections.forEach(peer => {
        const senders = peer.connection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          // If no video track exists, add the screen track
          peer.connection.addTrack(screenTrack, this.screenStream!);
          this.initiateConnection(peer.id); // Renegotiate
        }
      });

      return true;
    } catch (e) {
 console.error('[WebRTC] Error starting screen share:', e);
      return false;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    this.isScreenSharing = false;

    // Switch back to camera video if it was enabled
    const videoTrack = this.localStream?.getVideoTracks()[0];

    this.peerConnections.forEach(peer => {
      const videoSender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(videoTrack || null);
        if (!videoTrack) {
          peer.connection.removeTrack(videoSender);
          this.initiateConnection(peer.id); // Renegotiate to clean up
        }
      }
    });
  }

  async createOffer(userId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.getPeerConnection(userId);
    if (!pc) throw new Error('Peer connection not found');

    // Optimized offer settings for audio
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(userId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.getPeerConnection(userId);
    if (!pc) throw new Error('Peer connection not found');

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(userId: string, desc: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(userId);
    if (!pc) throw new Error('Peer connection not found');

    await pc.setRemoteDescription(new RTCSessionDescription(desc));
  }

  async addIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.getPeerConnection(userId);
    if (!pc) throw new Error('Peer connection not found');

    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  sendToPeer(userId: string, data: any): boolean {
    const peer = this.peerConnections.get(userId);
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      return false;
    }

    peer.dataChannel.send(JSON.stringify(data));
    return true;
  }

  sendToAll(data: any): void {
    this.peerConnections.forEach((peer, userId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(JSON.stringify(data));
      }
    });
  }

  getPeerConnection(userId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(userId)?.connection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getAllPeerIds(): string[] {
    return Array.from(this.peerConnections.keys());
  }

  removePeerConnection(userId: string): void {
    const peer = this.peerConnections.get(userId);
    if (peer) {
      peer.connection.close();
      this.peerConnections.delete(userId);
    }
  }

  closeAllConnections(): void {
    this.peerConnections.forEach(peer => {
      peer.connection.close();
    });
    this.peerConnections.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // Public method to send signals through the signaling service
  async sendSignal(toUserId: string, type: string, payload: any): Promise<void> {
    if (this.signalingService) {
      await this.signalingService.sendSignal(toUserId, type as any, payload);
    }
  }

  // Request an offer from another peer (for when joining a session)
  async requestOfferFrom(userId: string): Promise<void> {
    if (this.signalingService) {
      await this.signalingService.sendSignal(userId, 'request-offer' as any, { type: 'request' });
    }
  }

  // Initiate connection to a peer (create offer and send)
  async initiateConnection(userId: string): Promise<void> {

    if (!this.peerConnections.has(userId)) {
      this.createPeerConnection(userId, true);
    }

    const pc = this.getPeerConnection(userId);
    if (!pc) {
 console.error('[WebRTC] No peer connection for:', userId);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.signalingService?.sendSignal(userId, 'offer', offer);
    } catch (error) {
 console.error('[WebRTC] Error initiating connection:', error);
    }
  }

  // Set callback handlers
  setOnRemoteStreamAdded(handler: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStreamAdded = handler;
  }

  setOnDataReceived(handler: (userId: string, data: any) => void): void {
    this.onDataReceived = handler;
  }

  setOnConnectionStateChanged(handler: (userId: string, state: string) => void): void {
    this.onConnectionStateChanged = handler;
  }

  // Toggle local audio track
  toggleMute(isMuted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }

  // Cleanup
  dispose(): void {
    this.closeAllConnections();
  }
}
