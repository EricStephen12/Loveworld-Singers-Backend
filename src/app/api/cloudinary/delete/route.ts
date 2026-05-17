import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'

/**
 * DELETE FILE FROM CLOUDINARY
 * 
 * This API route handles deletion because it requires the API secret
 * which should never be exposed to the client
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyFirebaseIdToken(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = await enforceRateLimit({
      name: 'cloudinary-delete',
      tokensPerInterval: 30,
      intervalMs: 60_000,
      req: request,
      key: () => `uid:${auth.uid}`,
    })
    if (!rate.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }

    const { publicId, resourceType = 'image' } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'Public ID is required' },
        { status: 400 }
      );
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
 console.error(' Cloudinary credentials missing');
      return NextResponse.json(
        { error: 'Cloudinary not configured' },
        { status: 500 }
      );
    }

    // Create signature for deletion
    const timestamp = Math.round(new Date().getTime() / 1000);
    const crypto = require('crypto');
    
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    // Delete from Cloudinary
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      {
        method: 'POST',
        body: formData
      }
    );

    const data = await response.json();

    if (data.result === 'ok' || data.result === 'not found') {
      return NextResponse.json({ success: true });
    } else {
 console.error(' [Cloudinary API] Delete failed:', data);
      return NextResponse.json(
        { error: 'Delete failed', details: data },
        { status: 500 }
      );
    }
  } catch (error) {
 console.error(' [Cloudinary API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

