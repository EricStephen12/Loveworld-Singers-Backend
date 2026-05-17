/**
 * WebRTC Signaling Service for AudioLab
 * Handles SDP/ICE exchange via Firebase Realtime Database
 */

import { ref, set, onValue, remove, push, onDisconnect } from 'firebase/database';
import { realtimeDb, isRealtimeDbAvailable } from '@/lib/firebase-setup';

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'request-offer';
  from: string;
  to: string;
  payload: any;
  timestamp: number;
}

export class WebRTCSignaling {
  private sessionId: string;
  private userId: string;
  private signalRef: any;
  private onMessage: ((message: SignalMessage) => void) | null = null;

  constructor(sessionId: string, userId: string) {
    this.sessionId = sessionId;
    this.userId = userId;
  }

  async sendSignal(toUserId: string, type: SignalMessage['type'], payload: any): Promise<void> {
    try {
      const signalMessage: SignalMessage = {
        type,
        from: this.userId,
        to: toUserId,
        payload,
        timestamp: Date.now()
      };

      if (!isRealtimeDbAvailable() || !realtimeDb) {
 console.warn('[WebRTCSignaling] Realtime Database not available');
        return;
      }
      // Send to specific user's signal queue
      const signalPath = `audiolab_sessions/${this.sessionId}/signals/${toUserId}`;
      const newSignalRef = push(ref(realtimeDb, signalPath));
      await set(newSignalRef, signalMessage);
    } catch (error) {
      // Error sending signal
    }
  }

  startListening(onMessage: (message: SignalMessage) => void): () => void {
    this.onMessage = onMessage;

    if (!isRealtimeDbAvailable() || !realtimeDb) {
 console.warn('[WebRTCSignaling] Realtime Database not available');
      return () => { };
    }
    const mySignalPath = `audiolab_sessions/${this.sessionId}/signals/${this.userId}`;
    const signalRef = ref(realtimeDb, mySignalPath);

    const unsubscribe = onValue(signalRef, (snapshot) => {
      if (snapshot.exists()) {
        const signals = snapshot.val();
        const now = Date.now();

        Object.entries(signals).forEach(([key, signal]: [string, any]) => {
          const sig = signal as SignalMessage;

          // Ignore signals older than 30 seconds to prevent "zombie" connections
          if (now - sig.timestamp < 30000) {
            if (this.onMessage) {
              this.onMessage(sig);
            }
          }

          // Always remove the signal after processing (or if it's too old)
          if (realtimeDb) {
            const itemRef = ref(realtimeDb, `${mySignalPath}/${key}`);
            remove(itemRef);
          }
        });
      }
    });

    // Cleanup: Remove my signal queue if I disconnect abruptly
    onDisconnect(signalRef).remove().catch(() => { });

    return unsubscribe;
  }

  async requestOffer(toUserId: string): Promise<void> {
    await this.sendSignal(toUserId, 'offer', { type: 'request' });
  }
}