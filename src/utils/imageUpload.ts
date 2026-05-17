import { supabase } from '@/lib/supabase-client';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadProfileImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  try {
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      };
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Please upload an image smaller than 5MB.'
      };
    }
    

    // Upload file to Cloudinary
    const { uploadImageToCloudinary } = await import('@/lib/cloudinary-storage');
    const uploadResult = await uploadImageToCloudinary(file);

    if (!uploadResult) {
      return {
        success: false,
        error: 'Failed to upload image to Cloudinary'
      };
    }

    const publicUrl = uploadResult.url;

    return {
      success: true,
      url: publicUrl
    };
    
  } catch (error) {
 console.error(' Unexpected error during upload:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during upload.'
    };
  }
}

export async function deleteProfileImage(imageUrl: string): Promise<boolean> {
  try {
    
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const bucketName = pathParts[pathParts.length - 2];
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

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
    };
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size too large. Please upload an image smaller than 5MB.'
    };
  }
  
  return { valid: true };
}

// Ultra-fast banner image upload function for admin pages
export async function uploadBannerImage(
  file: File,
  pageId: number | string
): Promise<UploadResult> {
  try {

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      };
    }

    // Validate file size (max 5MB for faster uploads)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size too large. Please upload an image smaller than 5MB.'
      };
    }

    // Compress image for faster upload
    const compressedFile = await compressImage(file);

    // Create unique filename (sanitize pageId for filename)
    const fileExt = 'webp'; // Use WebP for better compression
    const sanitizedPageId = String(pageId).replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `page-${sanitizedPageId}-banner-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `banner-images/${fileName}`;


    // Upload directly without timeout (Supabase handles timeouts internally)
    const { data, error: uploadError } = await supabase.storage
      .from('media-files')
      .upload(filePath, compressedFile, {
        cacheControl: '31536000', // 1 year cache
        upsert: true, // Overwrite if exists
        contentType: 'image/webp'
      });

    if (uploadError) {
 console.error(' Supabase upload error:', uploadError);
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      };
    }


    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media-files')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    return {
      success: true,
      url: publicUrl
    };

  } catch (error: any) {
 console.error(' Unexpected error during banner upload:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during upload.'
    };
  }
}

// Backend-safe compression stub (real compression should use sharp or similar if needed)
async function compressImage(file: File, quality: number = 0.8): Promise<File> {
  return file;
}
