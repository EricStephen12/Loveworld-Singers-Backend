/**
 * Shared Route Configuration
 * 
 * Centralizing these paths ensures consistency between the PageLoader, 
 * SplashPage, and other navigation-aware components.
 */

export const PUBLIC_PATHS = [
    '/auth',
    '/',
    '/splash',
    '/signup-success',
    '/success',
    '/qr-code',
    '/support',
    '/pages/support',
    '/subscription/callback' // KingsPay callback is publicly accessible
];

/**
 * Helper to check if a path is public
 */
export const isPublicPath = (pathname: string | null): boolean => {
    if (!pathname) return false;
    return PUBLIC_PATHS.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    );
};

/**
 * Cache keys for instant loading
 * We use these to make optimistic decisions before Firebase Auth initializes
 */
export const AUTH_CACHE_KEY = 'lwsrh_has_user';
export const ZONE_CACHE_KEY = 'lwsrh-zone-cache-v6';
