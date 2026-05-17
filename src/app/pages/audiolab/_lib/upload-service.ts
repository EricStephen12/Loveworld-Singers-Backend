/**
 * AUDIOLAB UPLOAD SERVICE
 * 
 * Handles uploading recordings to Cloudinary and saving metadata
 */

import { createCloudinaryMedia } from '@/lib/cloudinary-media-service';
import { updateTrackAudio } from './project-service';

// Cloudinary upload preset for unsigned uploads
// Use the same preset as other uploads for consistency
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'loveworld-singers';
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

// Log configuration status (helpful for debugging)
if (typeof window !== 'undefined') {
}

interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  duration?: number;
  error?: string;
}

/**
 * Upload audio blob to Cloudinary
 */
export async function uploadRecording(
  blob: Blob,
  fileName: string,
  projectId?: string,
  trackId?: string,
  zoneId?: string
): Promise<UploadResult> {
  try {
    if (!CLOUD_NAME) {
 console.error('[UploadService] Cloudinary not configured - missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
      return { success: false, error: 'Cloudinary not configured. Please check environment variables.' };
    }

    if (!UPLOAD_PRESET) {
 console.error('[UploadService] Upload preset not configured');
      return { success: false, error: 'Upload preset not configured' };
    }


    // Create form data for upload
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('resource_type', 'video'); // Cloudinary uses 'video' for audio
    if (projectId) {
      formData.append('folder', `audiolab/${projectId}`);
    }
    
    // Upload to Cloudinary
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
 console.error('[UploadService] Upload failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Parse error if it's JSON
      let errorMessage = `Upload failed: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      return { success: false, error: errorMessage };
    }
    
    const data = await response.json();
    
    const result: UploadResult = {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      duration: data.duration || 0
    };
    
    // Save metadata to Firestore
    await createCloudinaryMedia({
      name: fileName,
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: 'raw',
      type: 'audio',
      size: blob.size,
      folder: `audiolab/${projectId || 'recordings'}`,
      format: 'webm',
      duration: data.duration || 0
    }, zoneId);
    
        if (projectId && trackId) {
      await updateTrackAudio(
        projectId,
        trackId,
        data.secure_url,
        data.duration || 0
      );
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Upload recording with progress callback
 */
export async function uploadRecordingWithProgress(
  blob: Blob,
  fileName: string,
  onProgress: (percent: number) => void,
  projectId?: string,
  trackId?: string,
  zoneId?: string
): Promise<UploadResult> {
  try {
    if (!CLOUD_NAME) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('resource_type', 'video');
    formData.append('folder', `audiolab/${projectId || 'recordings'}`);
    
    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });
      
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let data;
          try {
            data = JSON.parse(xhr.responseText);
          } catch (parseError) {
 console.error('[UploadService] Failed to parse response:', xhr.responseText);
            resolve({ success: false, error: 'Invalid response from server' });
            return;
          }
          
          // Save metadata
          await createCloudinaryMedia({
            name: fileName,
            url: data.secure_url,
            publicId: data.public_id,
            resourceType: 'raw',
            type: 'audio',
            size: blob.size,
            folder: `audiolab/${projectId || 'recordings'}`,
            format: 'webm',
            duration: data.duration || 0
          }, zoneId);
          
                    if (projectId && trackId) {
            await updateTrackAudio(projectId, trackId, data.secure_url, data.duration || 0);
          }
          
          resolve({
            success: true,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0
          });
        } else {
          resolve({ success: false, error: 'Upload failed' });
        }
      });
      
      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error' });
      });
      
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
      xhr.send(formData);
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Generate a unique filename for recording
 */
export function generateRecordingFileName(projectName?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = projectName?.replace(/\s+/g, '_').toLowerCase() || 'recording';
  return `${prefix}_${timestamp}.webm`;
}
