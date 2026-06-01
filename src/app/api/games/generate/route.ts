import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export async function POST(request: NextRequest) {
  // 1. Auth check
  const auth = await verifyFirebaseIdToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limit: 20 requests per minute per user for games
  const rate = await enforceRateLimit({
    name: 'games-generate',
    tokensPerInterval: 20,
    intervalMs: 60_000,
    req: request,
    key: () => `uid:${auth.uid}`,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  // 3. Retrieve Groq API Key
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'Groq service not configured. Please add GROQ_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { lyricLine, songTitle } = body;

    if (!lyricLine || typeof lyricLine !== 'string') {
      return NextResponse.json({ error: 'lyricLine is required' }, { status: 400 });
    }

    // 4. Construct prompt for scripture generation
    const systemPrompt = `You are a scriptural analysis assistant for Loveworld Singers.
Given a worship/praise lyric line from a song, you must identify the exact or closest Bible passage/verse that inspired it.

Your task is to:
1. Find the inspiring scripture passage reference (e.g. "Psalm 23:1", "John 3:16", "Revelation 4:8", "Exodus 15:11").
2. Generate 3 other incorrect but highly realistic-sounding Bible passage options that fit the style/context.
3. Provide the full text of the correct Bible passage.
4. Write a 1-2 sentence devotional reflection showing how this lyric connects to the Scripture, in the style of Pastor Chris Oyakhilome's teachings (focusing on Zoe, Rhema, Dunamis, or faith).

You MUST respond ONLY with a JSON object in this exact format:
{
  "correctPassage": "Scripture Reference",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "scriptureText": "Full Bible verse text",
  "reflection": "1-2 sentence devotional connection"
}
Ensure "correctPassage" is exactly present as one of the items in the "options" array. Shuffle the "options" array so the correct answer is at a random index.`;

    const userContent = `Lyric Line: "${lyricLine}"${songTitle ? `\nSong Title: "${songTitle}"` : ''}`;

    // 5. Query Groq Chat Completions API
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[GamesGenerate] Groq API error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to generate scripture mapping with Groq' },
        { status: 500 }
      );
    }

    const jsonString = data.choices?.[0]?.message?.content?.trim();
    if (!jsonString) {
      return NextResponse.json({ error: 'No output from Groq API' }, { status: 500 });
    }

    const gameData = JSON.parse(jsonString);
    return NextResponse.json({ success: true, data: gameData });

  } catch (error: any) {
    console.error('[GamesGenerate] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}
