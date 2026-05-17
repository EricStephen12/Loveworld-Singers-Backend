// Cloudinary Setup for FREE Audio/Image Storage
// 25GB Storage + 25GB Bandwidth FREE!

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '',
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'loveworld-singers'
}

// Upload audio file to Cloudinary (FREE)
export async function uploadAudio(file: File): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', cloudinaryConfig.uploadPreset)
    formData.append('resource_type', 'auto')
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
      {
        method: 'POST',
        body: formData
      }
    )
    
    const data = await response.json()
    return data.secure_url // Returns the audio URL
  } catch (error) {
    // Audio upload error
    return null
  }
}

// Upload image to Cloudinary (FREE)
export async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', cloudinaryConfig.uploadPreset)
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    )
    
    const data = await response.json()
    return data.secure_url // Returns the image URL
  } catch (error) {
    // Image upload error
    return null
  }
}

// Get optimized image URL
export function getOptimizedImageUrl(url: string, width = 800): string {
  if (!url || !url.includes('cloudinary')) return url
  
  // Add transformations for optimization
  const parts = url.split('/upload/')
  if (parts.length === 2) {
    return `${parts[0]}/upload/w_${width},q_auto,f_auto/${parts[1]}`
  }
  return url
}

// Get audio streaming URL
export function getAudioStreamUrl(url: string): string {
  if (!url || !url.includes('cloudinary')) return url
  
  // Add streaming optimizations
  const parts = url.split('/upload/')
  if (parts.length === 2) {
    return `${parts[0]}/upload/q_auto,fl_streaming_attachment/${parts[1]}`
  }
  return url
}

