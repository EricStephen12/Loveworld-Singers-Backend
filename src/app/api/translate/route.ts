import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = await enforceRateLimit({
      name: 'translate',
      tokensPerInterval: 15,
      intervalMs: 60_000,
      req: request,
      key: () => `uid:${auth.uid}`,
    })
    if (!rate.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    }

    const body = await request.json()
    const { text, targetLanguage, userId, songId } = body

    // Validate input
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (typeof text === 'string' && text.length > 10_000) {
      return NextResponse.json({ error: 'Text too large' }, { status: 413 })
    }

    // For now, use a simple translation API (Google Translate or OpenAI)
    // You can replace this with your preferred translation service
    
    // Option 1: Use Google Translate API (requires API key)
    const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY
    
    if (googleApiKey) {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: text,
            target: targetLanguage,
            format: 'text'
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
 console.error('Google Translate error:', data)
        return NextResponse.json(
          { error: 'Translation service error' },
          { status: 500 }
        )
      }

      const translatedText = data.data.translations[0].translatedText

      return NextResponse.json({
        success: true,
        translatedText
      })
    }

    // Option 2: Use OpenAI GPT for translation (requires OpenAI API key)
    const openaiApiKey = process.env.OPENAI_API_KEY
    
    if (openaiApiKey) {
      const languageNames: Record<string, string> = {
        en: 'English',
        fr: 'French',
        es: 'Spanish',
        pt: 'Portuguese',
        sw: 'Swahili',
        yo: 'Yoruba',
        ig: 'Igbo',
        ha: 'Hausa',
        ar: 'Arabic',
        zh: 'Chinese'
      }

      const targetLanguageName = languageNames[targetLanguage] || targetLanguage

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following song lyrics to ${targetLanguageName}. Maintain the poetic nature and meaning of the lyrics. Only return the translated text, nothing else.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      })

      const data = await response.json()

      if (!response.ok) {
 console.error('OpenAI error:', data)
        return NextResponse.json(
          { error: 'Translation service error' },
          { status: 500 }
        )
      }

      const translatedText = data.choices[0].message.content.trim()

      return NextResponse.json({
        success: true,
        translatedText
      })
    }

    // If no API keys are configured, return error
    return NextResponse.json(
      { error: 'Translation service not configured. Please add GOOGLE_TRANSLATE_API_KEY or OPENAI_API_KEY to environment variables.' },
      { status: 500 }
    )

  } catch (error) {
 console.error('Translation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
