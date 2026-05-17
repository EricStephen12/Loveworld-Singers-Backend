/**
 * Cloudinary Helper Utilities
 */

/**
 * Generates a thumbnail URL from a Cloudinary video URL.
 * Uses 'so_auto' to find a representative frame and switches to the /image/ endpoint.
 */
export function getCloudinaryThumbnailUrl(videoUrl: string | undefined): string {
    if (!videoUrl) return '/movie/default-hero.jpeg';

    // Skip non-cloudinary or already transformed URLs that don't need this specific logic
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) return videoUrl;
    if (!videoUrl.includes('cloudinary.com')) return videoUrl;

    try {
        // Standard Cloudinary frame extraction logic:
        // 1. Keep the resource type (e.g., /video/upload/)
        // 2. Use 'so_0' (start session) for the fastest and most reliable frame extraction
        // 3. Change extension to .jpg (which tells Cloudinary to return an image frame)
        return videoUrl
            .replace(/\/upload\//, '/upload/so_0,c_limit,h_480,f_auto,q_auto/')
            .replace(/\.[^/.]+$/, '.jpg');
    } catch (error) {
 console.warn('[CloudinaryUtils] Failed to transform URL:', videoUrl);
        return '/movie/default-hero.jpeg';
    }
}
