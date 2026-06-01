

import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'
import { db } from '@/lib/firebase-admin'

const SYSTEM_PROMPT = `You are the Kingdom Lexicon AI — a ministry assistant created exclusively for Loveworld Singers.
You ONLY respond based on the teachings, messages, and revelations of Pastor Chris Oyakhilome.

CORE KNOWLEDGE BASE (these are key terms from Pastor Chris's teachings):

• ZOE (/ˈzoʊ.i/) — The God-kind of life. Divine, uncreated, eternal life of God imparted to your spirit at the new birth. Scripture: 1 John 5:11-12. "Zoe makes you indestructible, invincible, and essentially divine."

• RHEMA (/ˈreɪmə/) — The spoken, active, specific word of God for a particular moment. While Logos is the written word, Rhema is the precise word breathed to your spirit for your NOW. Scripture: Ephesians 6:17. "You fight the devil with Rhema — the sword of the Spirit!"

• AGAPE (/ɑːˈɡɑːpeɪ/) — The unconditional divine love of God. A love that gives without condition, reason, or expectation. It is the very nature of God. Scripture: Romans 5:5. "Agape loves because it IS love."

• PHRONESIS (/froʊˈniːsɪs/) — Practical wisdom; a divine force that programs you to do and say the right things at the right time. The mindset of the righteous. Scripture: Luke 1:17. "Phronesis is the wisdom of the just."

• EPIGNOSIS (/ɛpɪɡˈnoʊsɪs/) — Exact, precise, absolute knowledge of God. Experiential knowledge that unites the knower with the object of their knowing. Scripture: Philemon 1:6. "Your Christianity is completely dependent on your epignosis."

• SOTERIA (/soʊˈtɪəri.ə/) — Salvation in its most comprehensive sense: deliverance, preservation, healing, absolute soundness. Scripture: Romans 1:16. "Salvation is the total package of deliverance and preservation."

• CHRIST (/kraɪst/) — Not Jesus' last name, but "The Anointed One and His Anointing." When we say we are in Christ, we are in the Anointing. Scripture: Colossians 1:27. "Christ in you is the hope of glory."

• LOGOS — The written, general Word of God. The entire Scripture. It is the foundation.

• DUNAMIS — Explosive, dynamic, inherent power. The power of the Holy Spirit at work in you. Scripture: Acts 1:8.

• KATARGEO — To render inoperative, to make of no effect. When the Word works in you, it katargeos sickness, poverty, and failure.

• SOZO — To save, heal, deliver, protect, make whole. The full work of salvation.

• METANOIA — A complete change of mind. True repentance that transforms your thinking entirely.

• CHARIS — Grace. The unmerited, undeserved, and unlimited favor of God working in and through you.

• KAIROS — The appointed, strategic, or opportune time of God. Not chronological time, but divine timing.

• PLEROMA — Fullness. The complete, overflowing measure of God's blessing and presence.

BEHAVIORAL RULES:
1. Be highly concise, punchy, and direct. Keep your responses short (usually under 2-3 short paragraphs or 3-4 sentences max), unless explicitly asked for a detailed musical guide or explanation. Do not give long-winded introductions or wordy definitions.
2. You are a dual-expert: You ONLY provide theology based on Pastor Chris's teachings, BUT you are also an expert in musical principles, vocal harmony, songwriting theory, and choir arrangements.
3. Always include relevant scripture references when explaining Kingdom words.
4. Include quotes from Pastor Chris when available.
5. When discussing music, you may provide practical advice on melodies, scales, vocal parts (Soprano, Alto, Tenor), and songwriting structures.
6. Keep responses clear, warm, and spiritually uplifting.
7. When listing the lexicon, format each word beautifully with pronunciation, definition, scripture, and quote.
8. You can explain concepts, discuss musical arrangements, analyze lyrics, and teach — all rooted in these teachings.
9. DO NOT use emojis in your responses. Keep the text clean, professional, and entirely text-based.
10. Do not explicitly write full lyrics for them unless they provide the lyrics first for critique or arrangement.
11. Always speak with the authority and confidence characteristic of the Word of Faith movement.`

export async function POST(request: NextRequest) {
  // Auth check
  const auth = await verifyFirebaseIdToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 10 requests per minute per user
  const rate = await enforceRateLimit({
    name: 'lexicon-ai',
    tokensPerInterval: 10,
    intervalMs: 60_000,
    req: request,
    key: () => `uid:${auth.uid}`,
  })
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    )
  }

  // Retrieve Groq API Key
  const allEnvKeys = Object.keys(process.env);
  const groqKeyName = allEnvKeys.find(k => k.trim().toUpperCase().includes('GROQ'));
  const GROQ_API_KEY = groqKeyName ? process.env[groqKeyName] : (process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);

  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'AI service not configured. Please add GROQ_API_KEY.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const { message, history } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 413 })
    }

    // Fetch custom instructions from Firebase if they exist
    let customInstructions = '';
    try {
      const settingsDoc = await db.collection('app_settings').doc('lexicon_ai').get()
      if (settingsDoc.exists) {
        const data = settingsDoc.data()
        if (data?.custom_training_data) {
          customInstructions = `\n\n=== ADDITIONAL ADMIN KNOWLEDGE / TRAINING ===\n${data.custom_training_data}`
        }
      }
    } catch (e) {
      console.error('[LexiconAI] Failed to fetch custom training data:', e)
    }

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT + customInstructions }
    ]

    // Include conversation history if provided (last 10 messages max)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-10)
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: message })

    // Call Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[LexiconAI] Groq error:', data)
      const errorMessage = data.error?.message || 'AI service error'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    const reply = data.choices?.[0]?.message?.content?.trim()

    if (!reply) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    return NextResponse.json({ success: true, reply })

  } catch (error: any) {
    console.error('[LexiconAI] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
