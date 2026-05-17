// Cloudinary Storage Service (25GB Storage + 25GB Bandwidth FREE)

import { authedFetch } from '@/lib/authed-fetch'

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '',
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'loveworld-singers'
};

interface UploadResult {
  url: string;
  path: string;
  publicId: string;
  resourceType: string;
}

// Upload file to Cloudinary with progress tracking
export async function uploadToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResult | null> {
  try {
    const fileType = file.type.split('/')[0];
    let resourceType: 'image' | 'video' | 'raw' = 'raw';

    if (fileType === 'image') resourceType = 'image';
    else if (fileType === 'video' || file.type.includes('audio')) resourceType = 'video';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('resource_type', resourceType);

    const folder = getFolder(file.type);
    if (folder) formData.append('folder', folder);

    // Simulate progress for better UX
    let progressInterval: NodeJS.Timeout | null = null;
    if (onProgress) {
      let progress = 0;
      progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        onProgress(Math.min(progress, 90));
      }, 200);
    }

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`,
        { method: 'POST', body: formData }
      );

      if (progressInterval) clearInterval(progressInterval);
      onProgress?.(100);

      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

      const data = await response.json();
      return {
        url: data.secure_url,
        path: data.public_id,
        publicId: data.public_id,
        resourceType: data.resource_type
      };
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      throw error;
    }
  } catch (error) {
    // Cloudinary upload error
    return null;
  }
}

// Delete file from Cloudinary
export async function deleteFromCloudinary(publicId: string, resourceType: string = 'image'): Promise<boolean> {
  try {
    const response = await authedFetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, resourceType })
    });

    if (!response.ok) throw new Error(`Delete failed: ${response.statusText}`);
    return true;
  } catch (error) {
 console.error('Cloudinary delete error:', error);
    return false;
  }
}

// URL transformation helpers
export function getOptimizedImageUrl(url: string, width: number = 800, quality: number = 80): string {
  if (!url?.includes('cloudinary')) return url;
  const parts = url.split('/upload/');
  return parts.length === 2 ? `${parts[0]}/upload/w_${width},q_${quality},f_auto/${parts[1]}` : url;
}

export function getAudioStreamUrl(url: string): string {
  if (!url?.includes('cloudinary')) return url;
  const parts = url.split('/upload/');
  return parts.length === 2 ? `${parts[0]}/upload/q_auto,fl_streaming_attachment/${parts[1]}` : url;
}

export function getVideoStreamUrl(url: string, quality: string = 'auto'): string {
  if (!url?.includes('cloudinary')) return url;
  const parts = url.split('/upload/');
  return parts.length === 2 ? `${parts[0]}/upload/q_${quality},f_auto/${parts[1]}` : url;
}

export function getThumbnailUrl(url: string, width: number = 300): string {
  if (!url?.includes('cloudinary')) return url;
  const parts = url.split('/upload/');
  return parts.length === 2
    ? `${parts[0]}/upload/w_${width},h_${width},c_fill,f_jpg/${parts[1].replace(/\.[^.]+$/, '.jpg')}`
    : url;
}

// Helper functions
function getFolder(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'loveworld-singers/images';
  if (mimeType.startsWith('audio/')) return 'loveworld-singers/audio';
  if (mimeType.startsWith('video/')) return 'loveworld-singers/videos';
  return 'loveworld-singers/documents';
}

export function getFileType(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

// Convenience upload functions
export async function uploadAudioToCloudinary(file: File, onProgress?: (progress: number) => void) {
  const result = await uploadToCloudinary(file, onProgress);
  return result ? { url: result.url, path: result.publicId } : null;
}

export async function uploadImageToCloudinary(file: File, onProgress?: (progress: number) => void) {
  const result = await uploadToCloudinary(file, onProgress);
  return result ? { url: result.url, path: result.publicId } : null;
}

// Convenience delete functions
export const deleteAudioFromCloudinary = (publicId: string) => deleteFromCloudinary(publicId, 'video');
export const deleteImageFromCloudinary = (publicId: string) => deleteFromCloudinary(publicId, 'image');

