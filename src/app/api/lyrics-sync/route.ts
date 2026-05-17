/**
 * Lyrics Sync API - Uses Groq Whisper to align existing lyrics with audio timing
 * 
 * This endpoint takes an audio URL and existing lyrics text,
 * then returns the lyrics with accurate timestamps for karaoke display
 */

import { NextRequest, NextResponse } from 'next/server';
import type { LyricLine } from '@/app/pages/audiolab/_types';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

function isAllowedAudioUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    // Basic SSRF protection: allowlist common media hosts you use.
    const allowedHosts = new Set([
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'res.cloudinary.com',
      'cdn.jsdelivr.net',
    ])
    return allowedHosts.has(url.hostname)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyFirebaseIdToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rate = await enforceRateLimit({
    name: 'lyrics-sync',
    tokensPerInterval: 6,
    intervalMs: 60_000,
    req: request,
    key: () => `uid:${auth.uid}`,
  })
  if (!rate.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  }

  const allEnvKeys = Object.keys(process.env);

  // Resilient search for Groq API Key
  const groqKeyName = allEnvKeys.find(k => k.trim().toUpperCase().includes('GROQ'));
  const GROQ_API_KEY = groqKeyName ? process.env[groqKeyName] : null;

  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'Groq API key not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { audioUrl, songId, existingLyrics, provider = 'groq', modalUrl } = body;

    const activeModalUrl = modalUrl || process.env.MODAL_SYNC_URL || process.env.NEXT_PUBLIC_MODAL_SYNC_URL;

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL is required' },
        { status: 400 }
      );
    }

    if (!isAllowedAudioUrl(audioUrl)) {
      return NextResponse.json(
        { error: 'Audio URL host not allowed' },
        { status: 400 }
      )
    }

    if (typeof existingLyrics === 'string' && existingLyrics.length > 30_000) {
      return NextResponse.json({ error: 'Lyrics text too large' }, { status: 413 })
    }

    // --- CASE 1: Modal.com (WhisperX Alignment) ---
    if (provider === 'modal' || activeModalUrl) {
      if (!activeModalUrl) {
        return NextResponse.json(
          { error: 'Modal Sync URL not configured' },
          { status: 400 }
        );
      }

      
      // Increased timeout for Modal.com (serverless GPU cold start can take time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds

      try {
        const modalResponse = await fetch(activeModalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_url: audioUrl,
            text: existingLyrics || ""
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!modalResponse.ok) {
          const errorText = await modalResponse.text();
          console.error('[LyricsSync] Modal error:', errorText);
          return NextResponse.json(
            { error: 'Modal Backend Error', details: errorText },
            { status: 500 }
          );
        }

        const modalData = await modalResponse.json();
        return NextResponse.json({
          success: true,
          songId,
          lrc: modalData.lrc,
          provider: 'modal'
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          return NextResponse.json(
            { error: 'Modal timeout: The AI server took too long to wake up. Please try again in a few seconds.' },
            { status: 504 }
          );
        }
        throw fetchError;
      }
    }

    // --- CASE 2: Groq (Standard Whisper) ---
    
    // 1. Fetch the audio file from URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch audio from URL' },
        { status: 400 }
      );
    }

    const audioBlob = await audioResponse.blob();
    const formData = new FormData();
    // Convert blob to file for Groq API
    const file = new File([audioBlob], 'audio.mp3', { type: audioBlob.type });
    formData.append('file', file);
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');

    // 2. Send to Groq for transcription
    const groqResponse = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
 console.error('[LyricsSync] Groq error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to transcribe audio with Groq' },
        { status: 500 }
      );
    }

    const transcriptData = await groqResponse.json();
    const segments = transcriptData.segments || [];

    let lyrics: LyricLine[];

    if (existingLyrics && existingLyrics.trim()) {
      // Align existing lyrics with detected timestamps
      lyrics = alignLyricsWithSegments(existingLyrics, segments);
    } else {
      // No existing lyrics - just convert segments to lines
      lyrics = segments.map((seg: any) => ({
        time: seg.start,
        text: seg.text.trim(),
        duration: seg.end - seg.start
      }));
    }

    return NextResponse.json({
      success: true,
      songId,
      lyrics,
      rawText: transcriptData.text,
      aligned: !!(existingLyrics && existingLyrics.trim()),
    });

  } catch (error) {
 console.error('[LyricsSync] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Align existing lyrics lines with Groq segments
 */
function alignLyricsWithSegments(
  existingLyrics: string,
  segments: any[]
): LyricLine[] {
  // Clean and split lyrics into lines
  const lyricLines = existingLyrics
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lyricLines.length === 0) return [];

  if (segments.length === 0) {
    return lyricLines.map((text, i) => ({ time: i * 5, text }));
  }

  const alignedLyrics: LyricLine[] = [];
  let segmentIndex = 0;

  for (const line of lyricLines) {
    const matchedSegment = segments[segmentIndex];

    if (matchedSegment) {
      alignedLyrics.push({
        time: matchedSegment.start,
        text: line,
        duration: matchedSegment.end - matchedSegment.start
      });
      segmentIndex++;
    } else {
      const prev = alignedLyrics[alignedLyrics.length - 1];
      alignedLyrics.push({
        time: prev ? prev.time + 5 : 0,
        text: line,
        duration: 5
      });
    }
  }

  return alignedLyrics;
}
