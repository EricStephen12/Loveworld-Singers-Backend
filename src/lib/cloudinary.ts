// Client-side Cloudinary functions (no server-side imports)

import { authedFetch } from '@/lib/authed-fetch'

// Function to upload audio file to Cloudinary
export async function uploadAudioToCloudinary(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/cloudinary/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
 console.error('Error uploading to Cloudinary:', error);
    return null;
  }
}

// Function to delete audio file from Cloudinary
export async function deleteAudioFromCloudinary(publicId: string): Promise<boolean> {
  try {
    const response = await authedFetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicId }),
    });

    return response.ok;
  } catch (error) {
 console.error('Error deleting from Cloudinary:', error);
    return false;
  }
}
