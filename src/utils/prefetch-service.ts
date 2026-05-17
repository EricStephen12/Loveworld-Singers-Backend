import { audioEngine } from '../app/pages/audiolab/_lib/audio-engine';
import { PraiseNightSong } from '@/types/supabase';

class PrefetchService {
  private static instance: PrefetchService;
  private preloadedBuffers = new Map<string, AudioBuffer>();
  private preloadingUrls = new Set<string>();

  static getInstance(): PrefetchService {
    if (!PrefetchService.instance) {
      PrefetchService.instance = new PrefetchService();
    }
    return PrefetchService.instance;
  }

  /**
   * Prefetch a song's audio buffer and decodes it.
   * Useful when a user hovers over a song card or when planning "next" song.
   */
  async prefetchSong(song: PraiseNightSong): Promise<void> {
    const url = song.audioFile;
    if (!url || url.trim() === '' || this.preloadedBuffers.has(url) || this.preloadingUrls.has(url)) {
      return;
    }

    this.preloadingUrls.add(url);
    try {
      const buffer = await audioEngine.loadAudio(url);
      if (buffer) {
        this.preloadedBuffers.set(url, buffer);
      }
    } catch (error) {
    } finally {
      this.preloadingUrls.delete(url);
    }
  }

  /**
   * Get a pre-loaded buffer if it exists.
   */
  getPreloadedBuffer(url: string): AudioBuffer | null {
    return this.preloadedBuffers.get(url) || null;
  }

  /**
   * Clear old buffers to save memory.
   */
  clearCache(): void {
    this.preloadedBuffers.clear();
    this.preloadingUrls.clear();
  }
}

export const prefetchService = PrefetchService.getInstance();
