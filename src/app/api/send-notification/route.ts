// app/api/send-notification/route.ts
// Unified server-side endpoint for sending push notifications
// Supports: chat, audiolab, calendar, song, media, zone, call

import { NextRequest, NextResponse } from 'next/server';
import { admin, rtdb } from '@/lib/firebase-admin';
import { enforceRateLimit, isInternalRequest, verifyFirebaseIdToken } from '@/lib/api-guards';

// Notification types
type NotificationType = 'chat' | 'audiolab' | 'calendar' | 'song' | 'media' | 'zone' | 'call';

interface NotificationRequest {
  type: NotificationType;
  recipientIds: string[];
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
  excludeUserId?: string;
  senderName?: string;
  senderAvatar?: string;
  senderImage?: string; // For sending images content
}

// Get URL for notification type (returns RELATIVE path)
function getNotificationUrl(type: NotificationType, data?: Record<string, string | undefined>): string {
  // Return relative paths so client handles them with current origin
  switch (type) {
    case 'chat':
      return data?.chatId ? `/pages/groups?chat=${data.chatId}` : `/pages/groups`;
    case 'audiolab':
      return data?.projectId ? `/pages/audiolab?project=${data.projectId}` : `/pages/audiolab`;
    case 'calendar':
      return `/pages/calendar`;
    case 'song':
      return `/pages/submit-song`;
    case 'media':
      return `/pages/media`;
    case 'zone':
      return `/pages/notifications`;
    case 'call':
      return data?.callId ? `/pages/groups?call=${data.callId}&action=answer` : `/pages/groups`;
    default:
      return `/pages/notifications`;
  }
}

// Get notification tag for grouping
function getNotificationTag(type: NotificationType, data?: Record<string, string | undefined>): string {
  switch (type) {
    case 'chat': return data?.chatId ? `chat_${data.chatId}` : 'chat_general';
    case 'call': return data?.callId ? `call_${data.callId}` : 'call_general';
    case 'audiolab': return data?.projectId ? `audiolab_${data.projectId}` : 'audiolab_general';
    default: return type;
  }
}

// Get Android notification channel
function getAndroidChannel(type: NotificationType): string {
  switch (type) {
    case 'chat': return 'chat_messages';
    case 'call': return 'voice_calls';
    case 'song': return 'song_submissions';
    case 'media': return 'media_updates';
    case 'calendar': return 'calendar_events';
    default: return 'general_notifications';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: NotificationRequest = await req.json();
    const { type, recipientIds, title, body: notifBody, data, excludeUserId, senderName, senderAvatar, senderImage } = body;

    // AuthZ: require Firebase user OR internal key (server-to-server).
    // This endpoint can spam push notifications; do not leave it public.
    const isInternal = isInternalRequest(req, 'LWSRH_INTERNAL_API_KEY')
    const auth = isInternal ? null : await verifyFirebaseIdToken(req)
    if (!isInternal && !auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (in-memory per instance; still valuable as a backstop)
    const rate = await enforceRateLimit({
      name: 'send-notification',
      tokensPerInterval: 20,
      intervalMs: 60_000,
      req,
      key: (r) => (auth?.uid ? `uid:${auth.uid}` : `ip:${r.headers.get('x-forwarded-for') || 'unknown'}`),
    })
    if (!rate.ok) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
    }

    if (!recipientIds || recipientIds.length === 0) {
      return NextResponse.json({ error: 'No recipients specified' }, { status: 400 });
    }

    // Filter recipients and fetch tokens
    const filteredRecipients = recipientIds.filter(id => id !== excludeUserId);
    const tokenPromises = filteredRecipients.map(id => getUserFCMTokens(id));
    const tokenResults = await Promise.all(tokenPromises);

    const allTokens: { userId: string; token: string }[] = [];
    tokenResults.forEach((tokens, index) => {
      const userId = filteredRecipients[index];
      tokens.forEach(token => {
        allTokens.push({ userId, token });
      });
    });

    if (allTokens.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No active FCM tokens found' });
    }

    // Build notification URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lwsrhp.vercel.app';
    const relativeUrl = getNotificationUrl(type, data);
    const targetUrl = `${baseUrl}${relativeUrl}`; // Absolute URL for FCM link

    const tag = getNotificationTag(type, data);
    const channelId = getAndroidChannel(type);

    // Build display text
    const displayTitle = (senderName && type === 'chat') ? `${senderName}` : title;
    const displayBody = notifBody;
    const isHighPriority = type === 'chat' || type === 'call';

    // Stringify data for FCM (all values must be strings)
    const stringifiedData: Record<string, string> = { type };
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          stringifiedData[key] = String(value);
        }
      });
    }
    if (senderName) stringifiedData.senderName = senderName;
    stringifiedData.timestamp = Date.now().toString();
    stringifiedData.url = relativeUrl; // Use RELATIVE URL for client data
    stringifiedData.tag = tag;

    // Build FCM messages
    const messages = allTokens.map(({ token }) => ({
      token,
      data: stringifiedData,
      android: {
        priority: (isHighPriority ? 'high' : 'normal') as 'high' | 'normal',
        notification: {
          title: displayTitle,
          body: displayBody,
          // Use sender avatar if available, fallback to default icon on client if undefined/null
          icon: senderAvatar || undefined,
          imageUrl: senderImage || undefined,
          channelId,
          sound: 'default',
          clickAction: targetUrl
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: { title: displayTitle, body: displayBody },
            'mutable-content': 1 // Enable rich notifications
          }
        },
        fcm_options: {
          image: senderImage // Apple supports image in fcm_options
        }
      },
      webpush: {
        notification: {
          title: displayTitle,
          body: displayBody,
          icon: senderAvatar || '/APP ICON/pwa_192_filled.png',
          image: senderImage || undefined, // Web push huge image
          badge: '/APP ICON/pwa_192_filled.png',
          tag,
          requireInteraction: type === 'call',
          vibrate: type === 'call' ? [500, 200, 500] : [200, 100, 200],
          data: stringifiedData,
          actions: type === 'chat' ? [
            { action: 'reply', title: 'Reply' },
            { action: 'mark_read', title: 'Mark as Read' }
          ] : undefined
        },
        fcmOptions: {
          link: targetUrl // Required absolute URL for FCM web click
        }
      }
    }));

    // Send notifications using sendEach for better efficiency
    let successCount = 0;
    let failedCount = 0;
    const invalidTokens: { userId: string; token: string }[] = [];

    // Use sendEach if available (Firebase Admin SDK v11+), otherwise fall back to individual sends
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
            invalidTokens.push(allTokens[index]);
          }
 console.error(`[Notification] Failed to send to ${allTokens[index].userId}:`, error?.message || error);
        }
      });
    } catch (batchError) {
      // Fallback to individual sends if sendEach fails

      const sendPromises = messages.map((message, index) =>
        admin.messaging().send(message).then(
          () => ({ success: true as const, ...allTokens[index] }),
          (error) => ({ success: false as const, error, ...allTokens[index] })
        )
      );

      const results = await Promise.all(sendPromises);
      results.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          const error = (result as any).error;
          if (
            error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token' ||
            error?.message?.includes('not found') ||
            error?.message?.includes('not registered')
          ) {
            invalidTokens.push({ userId: result.userId, token: result.token });
          }
        }
      });
    }

    // Clean up only the specific invalid tokens (not entire user node)
    if (invalidTokens.length > 0) {

      for (const { userId, token } of invalidTokens) {
        try {
          // Get user's tokens and remove only the invalid one
          const tokenRef = rtdb.ref(`fcm_tokens/${userId}`);
          const snapshot = await tokenRef.once('value');
          const data = snapshot.val();

          if (data) {
            if (data.token === token) {
              // Single token structure - remove it
              await tokenRef.remove();
            } else if (typeof data === 'object') {
              // Multiple tokens - find and remove only the invalid one
              for (const [key, value] of Object.entries(data)) {
                if ((value as any)?.token === token) {
                  await rtdb.ref(`fcm_tokens/${userId}/${key}`).remove();
                  break;
                }
              }
            }
          }
        } catch (cleanupError) {
 console.error('[Notification] Error cleaning up token:', cleanupError);
        }
      }
    }


    return NextResponse.json({
      success: true,
      sentCount: successCount,
      failedCount,
      totalRecipients: filteredRecipients.length,
      totalTokens: allTokens.length
    });

  } catch (error) {
 console.error('[Notification] Error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

// Helper function to get user's FCM tokens from Realtime Database
async function getUserFCMTokens(userId: string): Promise<string[]> {
  try {
    const tokens: string[] = [];
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
 console.error('[Notification] Error getting tokens for user', userId, ':', error);
    return [];
  }
}
