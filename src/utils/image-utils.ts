/**
 * Normalizes and sanitizes image URLs to prevent rendering dead links
 * or triggering server-side fetch failures in Next.js Image Optimizer.
 */

const DEAD_DOMAINS = [
  'dumhphyhvnyyqnmnahno.supabase.co'
];

const DEFAULT_BANNER = "/Ecards/1000876785.png";
const DEFAULT_AVATAR = "/logo.png";

/**
 * Sanitizes an image URL. If it's a known dead domain or empty, returns a fallback.
 * 
 * @param url The image URL to sanitize
 * @param type The type of image (banner, avatar, or icon) to determine the fallback
 * @returns A safe URL string
 */
export function sanitizeImageUrl(url: string | null | undefined, type: 'banner' | 'avatar' | 'icon' = 'banner'): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    if (type === 'icon') return ""; // Return empty for icon to allow component-level fallbacks
    return type === 'banner' ? DEFAULT_BANNER : DEFAULT_AVATAR;
  }

  const trimmedUrl = url.trim();

  // Check for dead domains
  const isDead = DEAD_DOMAINS.some(domain => trimmedUrl.includes(domain));
  if (isDead) {
    if (type === 'icon') return "";
    return type === 'banner' ? DEFAULT_BANNER : DEFAULT_AVATAR;
  }

  return trimmedUrl;
}

/**
 * Validates if an image URL is likely to load correctly.
 * Useful for filtering out stale data at the source.
 */
export function isUrlSafe(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  return !DEAD_DOMAINS.some(domain => url.includes(domain));
}
