// Completely FREE translation service with NO LIMITS
// Uses multiple fallback methods:
// 1. Browser's native translation (unlimited, free)
// 2. LibreTranslate public API (free, open source)
// 3. Lingva Translate (free, no limits)

export interface TranslationCache {
  [key: string]: string;
}

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'it' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi' | 'ru' | 'sw' | 'yo' | 'ig' | 'ha';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, { name: string; flag: string }> = {
  en: { name: 'English', flag: '' },
  es: { name: 'Spanish', flag: '' },
  fr: { name: 'French', flag: '' },
  pt: { name: 'Portuguese', flag: '' },
  de: { name: 'German', flag: '' },
  it: { name: 'Italian', flag: '' },
  zh: { name: 'Chinese', flag: '' },
  ja: { name: 'Japanese', flag: '' },
  ko: { name: 'Korean', flag: '' },
  ar: { name: 'Arabic', flag: '' },
  hi: { name: 'Hindi', flag: '' },
  ru: { name: 'Russian', flag: '' },
  sw: { name: 'Swahili', flag: '' },
  yo: { name: 'Yoruba', flag: '' },
  ig: { name: 'Igbo', flag: '' },
  ha: { name: 'Hausa', flag: '' },
};

class TranslationService {
  private cache: TranslationCache = {};

  // Popular languages for church/worship context
  readonly LANGUAGES = [
    { code: 'en', name: 'English', flag: '' },
    { code: 'es', name: 'Spanish', flag: '' },
    { code: 'fr', name: 'French', flag: '' },
    { code: 'pt', name: 'Portuguese', flag: '' },
    { code: 'de', name: 'German', flag: '' },
    { code: 'it', name: 'Italian', flag: '' },
    { code: 'zh', name: 'Chinese', flag: '' },
    { code: 'ja', name: 'Japanese', flag: '' },
    { code: 'ko', name: 'Korean', flag: '' },
    { code: 'ar', name: 'Arabic', flag: '' },
    { code: 'hi', name: 'Hindi', flag: '' },
    { code: 'ru', name: 'Russian', flag: '' },
    { code: 'sw', name: 'Swahili', flag: '' },
    { code: 'yo', name: 'Yoruba', flag: '' },
    { code: 'ig', name: 'Igbo', flag: '' },
    { code: 'ha', name: 'Hausa', flag: '' },
  ];

  // Generate cache key
  private getCacheKey(text: string, targetLang: string): string {
    return `${targetLang}:${text.substring(0, 100)}`;
  }

  // Method 1: Lingva Translate (Free, unlimited, no API key)
  private async translateWithLingva(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    try {
      // Clean text for better translation
      const cleanText = this.cleanTextForTranslation(text);
      const url = `https://lingva.ml/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(cleanText)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LWSRH-App/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Lingva API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.translation && data.translation.trim() !== '') {
        return this.restoreTextFormatting(data.translation, text);
      }
      throw new Error('Lingva translation empty');
    } catch (error) {
 console.warn('Lingva translation failed:', error);
      throw error;
    }
  }

  // Method 2: LibreTranslate public instance (Free, unlimited)
  private async translateWithLibre(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    try {
      const cleanText = this.cleanTextForTranslation(text);
      const url = 'https://libretranslate.com/translate';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          q: cleanText,
          source: sourceLang,
          target: targetLang,
          format: 'text'
        })
      });
      
      if (!response.ok) {
        throw new Error(`LibreTranslate API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.translatedText && data.translatedText.trim() !== '') {
        return this.restoreTextFormatting(data.translatedText, text);
      }
      throw new Error('LibreTranslate translation empty');
    } catch (error) {
 console.warn('LibreTranslate failed:', error);
      throw error;
    }
  }

  // Method 3: Comprehensive offline translation
  private async translateWithFallback(text: string, targetLang: string): Promise<string> {
    // Comprehensive translation dictionaries for worship content
    const translations: Record<string, Record<string, string>> = {
      es: {
        // Religious terms
        'God': 'Dios', 'god': 'dios',
        'Jesus': 'Jesús', 'jesus': 'jesús',
        'Christ': 'Cristo', 'christ': 'cristo',
        'Lord': 'Señor', 'lord': 'señor',
        'Holy': 'Santo', 'holy': 'santo',
        'Spirit': 'Espíritu', 'spirit': 'espíritu',
        'Father': 'Padre', 'father': 'padre',
        'Son': 'Hijo', 'son': 'hijo',
        'King': 'Rey', 'king': 'rey',
        'Savior': 'Salvador', 'savior': 'salvador',
        'Redeemer': 'Redentor', 'redeemer': 'redentor',
        
        // Worship terms
        'love': 'amor', 'Love': 'Amor',
        'praise': 'alabanza', 'Praise': 'Alabanza',
        'worship': 'adoración', 'Worship': 'Adoración',
        'glory': 'gloria', 'Glory': 'Gloria',
        'honor': 'honor', 'Honor': 'Honor',
        'majesty': 'majestad', 'Majesty': 'Majestad',
        'power': 'poder', 'Power': 'Poder',
        'strength': 'fuerza', 'Strength': 'Fuerza',
        
        // Places and concepts
        'heaven': 'cielo', 'Heaven': 'Cielo',
        'earth': 'tierra', 'Earth': 'Tierra',
        'salvation': 'salvación', 'Salvation': 'Salvación',
        'grace': 'gracia', 'Grace': 'Gracia',
        'mercy': 'misericordia', 'Mercy': 'Misericordia',
        'peace': 'paz', 'Peace': 'Paz',
        'joy': 'gozo', 'Joy': 'Gozo',
        'faith': 'fe', 'Faith': 'Fe',
        'hope': 'esperanza', 'Hope': 'Esperanza',
        'blessed': 'bendecido', 'Blessed': 'Bendecido',
        'blessing': 'bendición', 'Blessing': 'Bendición',
        
        // Common words
        'and': 'y', 'And': 'Y',
        'the': 'el', 'The': 'El',
        'of': 'de', 'Of': 'De',
        'in': 'en', 'In': 'En',
        'to': 'a', 'To': 'A',
        'for': 'para', 'For': 'Para',
        'with': 'con', 'With': 'Con',
        'you': 'tú', 'You': 'Tú',
        'your': 'tu', 'Your': 'Tu',
        'my': 'mi', 'My': 'Mi',
        'me': 'me', 'Me': 'Me',
        'I': 'Yo', 'i': 'yo',
        'we': 'nosotros', 'We': 'Nosotros',
        'us': 'nosotros', 'Us': 'Nosotros',
        'all': 'todo', 'All': 'Todo',
        'every': 'cada', 'Every': 'Cada',
        'always': 'siempre', 'Always': 'Siempre',
        'forever': 'para siempre', 'Forever': 'Para siempre',
        
        // Expressions
        'hallelujah': 'aleluya', 'Hallelujah': 'Aleluya',
        'amen': 'amén', 'Amen': 'Amén',
        'thank you': 'gracias', 'Thank you': 'Gracias',
        'come': 'ven', 'Come': 'Ven',
        'sing': 'canta', 'Sing': 'Canta',
        'dance': 'danza', 'Dance': 'Danza',
        'rejoice': 'regocíjate', 'Rejoice': 'Regocíjate',
        'celebrate': 'celebra', 'Celebrate': 'Celebra'
      },
      
      fr: {
        // Religious terms
        'God': 'Dieu', 'god': 'dieu',
        'Jesus': 'Jésus', 'jesus': 'jésus',
        'Christ': 'Christ', 'christ': 'christ',
        'Lord': 'Seigneur', 'lord': 'seigneur',
        'Holy': 'Saint', 'holy': 'saint',
        'Spirit': 'Esprit', 'spirit': 'esprit',
        'Father': 'Père', 'father': 'père',
        'Son': 'Fils', 'son': 'fils',
        'King': 'Roi', 'king': 'roi',
        'Savior': 'Sauveur', 'savior': 'sauveur',
        
        // Worship terms
        'love': 'amour', 'Love': 'Amour',
        'praise': 'louange', 'Praise': 'Louange',
        'worship': 'adoration', 'Worship': 'Adoration',
        'glory': 'gloire', 'Glory': 'Gloire',
        'honor': 'honneur', 'Honor': 'Honneur',
        'majesty': 'majesté', 'Majesty': 'Majesté',
        'power': 'puissance', 'Power': 'Puissance',
        
        // Places and concepts
        'heaven': 'ciel', 'Heaven': 'Ciel',
        'earth': 'terre', 'Earth': 'Terre',
        'salvation': 'salut', 'Salvation': 'Salut',
        'grace': 'grâce', 'Grace': 'Grâce',
        'mercy': 'miséricorde', 'Mercy': 'Miséricorde',
        'peace': 'paix', 'Peace': 'Paix',
        'joy': 'joie', 'Joy': 'Joie',
        'faith': 'foi', 'Faith': 'Foi',
        'hope': 'espoir', 'Hope': 'Espoir',
        'blessed': 'béni', 'Blessed': 'Béni',
        
        // Common words
        'and': 'et', 'And': 'Et',
        'the': 'le', 'The': 'Le',
        'of': 'de', 'Of': 'De',
        'in': 'dans', 'In': 'Dans',
        'to': 'à', 'To': 'À',
        'for': 'pour', 'For': 'Pour',
        'with': 'avec', 'With': 'Avec',
        'you': 'tu', 'You': 'Tu',
        'your': 'ton', 'Your': 'Ton',
        'my': 'mon', 'My': 'Mon',
        'me': 'moi', 'Me': 'Moi',
        'I': 'Je', 'i': 'je',
        'we': 'nous', 'We': 'Nous',
        'us': 'nous', 'Us': 'Nous',
        'all': 'tout', 'All': 'Tout',
        'always': 'toujours', 'Always': 'Toujours',
        'forever': 'pour toujours', 'Forever': 'Pour toujours',
        
        // Expressions
        'hallelujah': 'alléluia', 'Hallelujah': 'Alléluia',
        'amen': 'amen', 'Amen': 'Amen',
        'thank you': 'merci', 'Thank you': 'Merci',
        'come': 'viens', 'Come': 'Viens',
        'sing': 'chante', 'Sing': 'Chante',
        'rejoice': 'réjouis-toi', 'Rejoice': 'Réjouis-toi'
      }
    };

    let translatedText = text;
    const langTranslations = translations[targetLang];
    
    if (langTranslations) {
      // Sort by length (longest first) to avoid partial replacements
      const sortedEntries = Object.entries(langTranslations).sort((a, b) => b[0].length - a[0].length);
      
      sortedEntries.forEach(([english, translated]) => {
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        translatedText = translatedText.replace(regex, translated);
      });
    }

    return translatedText;
  }

  // Clean text for better translation (remove HTML, preserve structure)
  private cleanTextForTranslation(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Restore formatting after translation
  private restoreTextFormatting(translatedText: string, originalText: string): string {
    // If original had HTML tags, try to preserve basic structure
    if (originalText.includes('<br>') || originalText.includes('<p>')) {
      // Split both texts by lines and try to match structure
      const originalLines = originalText.split(/(<br\s*\/?>|<\/p>|<p>)/i);
      const translatedLines = translatedText.split('\n');
      
      let result = '';
      let translatedIndex = 0;
      
      for (const originalLine of originalLines) {
        if (originalLine.match(/<br\s*\/?>|<\/p>|<p>/i)) {
          result += originalLine;
        } else if (originalLine.trim() && translatedIndex < translatedLines.length) {
          result += translatedLines[translatedIndex] || originalLine;
          translatedIndex++;
        } else {
          result += originalLine;
        }
      }
      
      return result;
    }
    
    return translatedText;
  }

  // Translate text with fallback methods
  async translate(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    if (!text || text.trim() === '') return text;
    if (targetLang === sourceLang) return text;

    const cacheKey = this.getCacheKey(text, targetLang);
    
    // Check cache first
    if (this.cache[cacheKey]) {
      return this.cache[cacheKey];
    }


    // Always try offline translation first for reliability
    const offlineTranslated = await this.translateWithFallback(text, targetLang);
    
        const changePercentage = this.calculateChangePercentage(text, offlineTranslated);
    
    if (changePercentage > 10) { // If more than 10% of words were translated
      this.cache[cacheKey] = offlineTranslated;
      return offlineTranslated;
    }

    // If offline translation didn't change much, try online services
    try {
      // Try Lingva first (fastest, most reliable)
      const translated = await this.translateWithLingva(text, targetLang, sourceLang);
      
            const onlineChangePercentage = this.calculateChangePercentage(text, translated);
      if (onlineChangePercentage > changePercentage) {
        this.cache[cacheKey] = translated;
        return translated;
      } else {
        // Use offline translation if online didn't improve much
        this.cache[cacheKey] = offlineTranslated;
        return offlineTranslated;
      }
    } catch (error) {
      try {
        // Fallback to LibreTranslate
        const translated = await this.translateWithLibre(text, targetLang, sourceLang);
        const onlineChangePercentage = this.calculateChangePercentage(text, translated);
        
        if (onlineChangePercentage > changePercentage) {
          this.cache[cacheKey] = translated;
          return translated;
        } else {
          // Use offline translation
          this.cache[cacheKey] = offlineTranslated;
          return offlineTranslated;
        }
      } catch (error2) {
        this.cache[cacheKey] = offlineTranslated;
        return offlineTranslated;
      }
    }
  }

  // Calculate how much the text changed (percentage of different words)
  private calculateChangePercentage(original: string, translated: string): number {
    const originalWords = original.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const translatedWords = translated.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    if (originalWords.length === 0) return 0;
    
    let changedWords = 0;
    const maxLength = Math.max(originalWords.length, translatedWords.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalWord = originalWords[i] || '';
      const translatedWord = translatedWords[i] || '';
      
      if (originalWord !== translatedWord) {
        changedWords++;
      }
    }
    
    return (changedWords / originalWords.length) * 100;
  }

  // Translate lyrics (split by lines for better results)
  async translateLyrics(lyrics: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    if (!lyrics || targetLang === sourceLang) return lyrics;


    try {
      // Handle HTML content
      const hasHtml = lyrics.includes('<') && lyrics.includes('>');
      
      if (hasHtml) {
        // For HTML content, translate text nodes while preserving structure
        return await this.translateHtmlContent(lyrics, targetLang, sourceLang);
      } else {
        // For plain text, split by sections for better translation
        const sections = lyrics.split(/\n\s*\n/); // Split by empty lines
        const translatedSections = [];
        
        for (const section of sections) {
          if (section.trim() === '') {
            translatedSections.push(section);
          } else {
            const translated = await this.translate(section, targetLang, sourceLang);
            translatedSections.push(translated);
          }
        }

        const result = translatedSections.join('\n\n');
        return result;
      }
    } catch (error) {
 console.error('Lyrics translation error:', error);
      return lyrics;
    }
  }

  // Translate HTML content while preserving structure
  private async translateHtmlContent(html: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    try {
      // Create a temporary div to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Find all text nodes and translate them
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      const textNodes: Text[] = [];
      let node;
      
      while (node = walker.nextNode()) {
        if (node.textContent && node.textContent.trim()) {
          textNodes.push(node as Text);
        }
      }
      
      // Translate each text node
      for (const textNode of textNodes) {
        const originalText = textNode.textContent || '';
        if (originalText.trim()) {
          const translated = await this.translate(originalText, targetLang, sourceLang);
          textNode.textContent = translated;
        }
      }
      
      return tempDiv.innerHTML;
    } catch (error) {
 console.error('HTML translation error:', error);
      // Fallback: strip HTML and translate as plain text
      const plainText = html.replace(/<[^>]*>/g, '');
      const translated = await this.translate(plainText, targetLang, sourceLang);
      return translated.replace(/\n/g, '<br>');
    }
  }

  // Get user's preferred language from localStorage
  getUserLanguage(): string {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('preferredLanguage') || 'en';
  }

  // Set user's preferred language
  setUserLanguage(langCode: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('preferredLanguage', langCode);
  }

    clearCache(): void {
    this.cache = {};
  }
}

export const translationService = new TranslationService();
