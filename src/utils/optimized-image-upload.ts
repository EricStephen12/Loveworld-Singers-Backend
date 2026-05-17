import { supabase } from '@/lib/supabase-client';

export interface UltraFastUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  uploadTime?: number;
}

export interface UploadProgress {
  stage: 'compressing' | 'uploading' | 'processing' | 'complete';
  progress: number;
  message: string;
}

// Ultra-fast image compression using Canvas API with instant processing
// Backend-safe compression stub
async function compressImage(file: File, quality: number = 0.85, maxWidth: number = 1000): Promise<Blob> {
  return file;
}

// Generate optimized filename
function generateOptimizedFilename(userId: string, originalFile: File): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `${userId}-${timestamp}-${randomId}.webp`;
}

// Ultra-fast upload with progress tracking
export async function ultraFastUploadProfileImage(
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UltraFastUploadResult> {
  const startTime = Date.now();
  
  try {
    
    // Stage 1: Quick validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      };
    }
    
    const maxSize = 10 * 1024 * 1024; // Increased to 10MB for better quality
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Please upload an image smaller than 10MB.'
      };
    }
    
    // Stage 2: Smart compression (only if file is large) - runs in parallel with UI
    let processedFile: Blob = file;
    if (file.size > 1 * 1024 * 1024) { // Compress if > 1MB for faster uploads
      onProgress?.({
        stage: 'compressing',
        progress: 30,
        message: 'Optimizing...'
      });

      processedFile = await compressImage(file, 0.85, 1000); // Optimized size
    }
    
    // Stage 3: Generate optimized path
    const fileName = generateOptimizedFilename(userId, file);
    const filePath = `profile-images/${fileName}`;
    
    onProgress?.({
      stage: 'uploading',
      progress: 50,
      message: 'Uploading to cloud...'
    });
    

    // Stage 4: Ultra-fast upload to Cloudinary
    // Convert Blob to File if needed
    const fileToUpload = processedFile instanceof File
      ? processedFile
      : new File([processedFile], fileName, { type: 'image/webp' });

    const { uploadImageToCloudinary } = await import('@/lib/cloudinary-storage');
    const uploadResult = await uploadImageToCloudinary(fileToUpload, (progress) => {
      onProgress?.({
        stage: 'uploading',
        progress: 50 + (progress / 2), // 50-100%
        message: 'Uploading to cloud...'
      });
    });

    if (!uploadResult) {
 console.error(' [Cloudinary] Upload failed');
      return {
        success: false,
        error: 'Upload failed'
      };
    }
    
    const publicUrl = uploadResult;
    const uploadTime = Date.now() - startTime;

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Upload complete!'
    });

    
    return {
      success: true,
      url: publicUrl.url,
      uploadTime
    };
    
  } catch (error) {
 console.error(' Unexpected error during ultra-fast upload:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during upload.'
    };
  }
}

// Batch upload for multiple images (future use)
export async function batchUploadImages(
  files: File[],
  userId: string,
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<UltraFastUploadResult[]> {
  const uploadPromises = files.map(async (file, index) => {
    return ultraFastUploadProfileImage(file, userId, (progress) => {
      onProgress?.(index, progress);
    });
  });
  
  return Promise.all(uploadPromises);
}

// Preload image for instant preview
// Backend-safe preload stub
export async function preloadImage(url: string): Promise<any> {
  return { src: url };
}

// Delete with ultra-fast cleanup
export async function ultraFastDeleteImage(imageUrl: string): Promise<boolean> {
  try {
    
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const filePath = `profile-images/${fileName}`;
    
    
    const { error } = await supabase.storage
      .from('media-files')
      .remove([filePath]);
    
    if (error) {
 console.error(' Delete error:', error);
      return false;
    }
    
    return true;
    
  } catch (error) {
 console.error(' Unexpected error during deletion:', error);
    return false;
  }
}
