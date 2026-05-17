// app/api/send-call-notification/route.ts
// Server-side endpoint for sending voice call notifications

import { NextRequest, NextResponse } from 'next/server';
import { admin, rtdb } from '@/lib/firebase-admin';
import { enforceRateLimit, isInternalRequest, verifyFirebaseIdToken } from '@/lib/api-guards';

export async function POST(req: NextRequest) {
  try {
    const isInternal = isInternalRequest(req, 'LWSRH_INTERNAL_API_KEY')
    const auth = isInternal ? null : await verifyFirebaseIdToken(req)
    if (!isInternal && !auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rate = await enforceRateLimit({
      name: 'send-call-notification',
      tokensPerInterval: 10,
      intervalMs: 60_000,
      req,
      key: () => (auth?.uid ? `uid:${auth.uid}` : 'unknown'),
    })
    if (!rate.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    }

    const { receiverId, title, body, data } = await req.json();

    // Get user's FCM tokens (both web and mobile)
    const userTokens = await getUserFCMTokens(receiverId);

    if (userTokens.length === 0) {
      return NextResponse.json({ error: 'No FCM tokens found for user' }, { status: 404 });
    }

    // Determine the URL based on notification type
    // FCM requires absolute URLs for fcmOptions.link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lwsrhp.vercel.app';
    const isVoiceCall = data?.type === 'VOICE_CALL';

    // Relative URL for data.url (so client SW resolves it to its own origin)
    const relativeUrl = isVoiceCall
      ? `/pages/groups?call=${data?.callId}&action=answer`
      : `/pages/notifications`;

    // Absolute URL for fcmOptions (required by spec)
    const targetUrl = `${baseUrl}${relativeUrl}`;

    // Send notification to all user devices
    const stringifiedData: Record<string, string> = {};
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        stringifiedData[key] = String(value);
      });
    }
    stringifiedData.timestamp = Date.now().toString();
    // Use relative URL for our custom data payload
    stringifiedData.url = relativeUrl;

    const messages = userTokens.map(token => ({
      token,
      data: stringifiedData,
      android: {
        priority: 'high' as const,
        notification: {
          title,
          body,
          icon: data?.senderAvatar || undefined,
          channelId: 'voice_calls',
          sound: 'default',
          clickAction: targetUrl
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: { title, body },
            'mutable-content': 1
          }
        },
        fcm_options: {
          image: data?.senderAvatar
        }
      },
      webpush: {
        notification: {
          title,
          body,
          icon: data?.senderAvatar || '/APP ICON/pwa_192_filled.png',
          badge: '/APP ICON/pwa_192_filled.png',
          requireInteraction: true,
          vibrate: [500, 200, 500],
          data: stringifiedData,
          actions: [
            { action: 'answer', title: 'Answer' },
            { action: 'decline', title: 'Decline' }
          ]
        },
        fcmOptions: {
          link: targetUrl
        }
      }
    }));

    // Send notifications using sendEach for better efficiency and simultaneous delivery
    let successCount = 0;
    let failedCount = 0;
    const invalidTokens: string[] = [];

    try {
      const response = await admin.messaging().sendEach(messages);

      response.responses.forEach((result, index) => {
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          const error = result.error;
          if (
            error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token' ||
            error?.message?.includes('not found') ||
            error?.message?.includes('not registered')
          ) {
            invalidTokens.push(userTokens[index]);
          }
          console.error(`[CallNotification] Failed to send to device ${index}:`, error?.message || error);
        }
      });
    } catch (batchError) {
      console.error('[CallNotification] Batch send failed, falling back to individual sends:', batchError);
      
      const results = await Promise.all(messages.map((message, index) =>
        admin.messaging().send(message).then(
          (mId) => ({ success: true as const, messageId: mId }),
          (err) => ({ success: false as const, error: err })
        )
      ));

      results.forEach((result, index) => {
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          const error = result.error;
          if (
            error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token' ||
            error?.message?.includes('not found') ||
            error?.message?.includes('not registered')
          ) {
            invalidTokens.push(userTokens[index]);
          }
        }
      });
    }

    // Surgical cleanup of only invalid tokens
    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        try {
          const tokenRef = rtdb.ref(`fcm_tokens/${receiverId}`);
          const snapshot = await tokenRef.once('value');
          const data = snapshot.val();

          if (data) {
            if (data.token === token) {
              await tokenRef.remove();
            } else if (typeof data === 'object') {
              for (const [key, value] of Object.entries(data)) {
                if ((value as any)?.token === token) {
                  await rtdb.ref(`fcm_tokens/${receiverId}/${key}`).remove();
                  break;
                }
              }
            }
          }
        } catch (cleanupError) {
          console.error('[CallNotification] Error cleaning up token:', cleanupError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount,
      totalTokens: userTokens.length
    });

  } catch (error) {
 console.error('[CallNotification] Error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

// Helper function to get user's FCM tokens from Realtime Database
// Using Realtime DB instead of Firestore to avoid quota issues
async function getUserFCMTokens(userId: string): Promise<string[]> {
  try {
    const tokens: string[] = [];

    // Use Realtime Database - separate quota from Firestore
    const tokenSnapshot = await rtdb.ref(`fcm_tokens/${userId}`).once('value');

    if (tokenSnapshot.exists()) {
      const data = tokenSnapshot.val();
      if (data?.token) {
        tokens.push(data.token);
      }
      // Handle multiple tokens if stored as object
      if (typeof data === 'object' && !data.token) {
        Object.values(data).forEach((item: any) => {
          if (item?.token) tokens.push(item.token);
        });
      }
    }

    return tokens;

  } catch (error) {
 console.error('[CallNotification] Error getting tokens:', error);
    return [];
  }
}
