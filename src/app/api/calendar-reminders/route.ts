// app/api/calendar-reminders/route.ts
// Scheduled endpoint for sending calendar event reminders
// Call this via cron job every hour

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  // Verify cron secret (optional security)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = admin.firestore();
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    let remindersSent = 0;

    // Check multiple collections for events
    const collections = ['upcoming_events', 'calendar_events', 'zone_praise_nights'];

    for (const collectionName of collections) {
      try {
        const eventsRef = db.collection(collectionName);
        const snapshot = await eventsRef.get();

        for (const doc of snapshot.docs) {
          const event = doc.data();
          const eventDate = parseEventDate(event);

          if (!eventDate) continue;

          const eventId = doc.id;
          const eventTitle = event.title || event.name || 'Event';
          const zoneId = event.zoneId;

          if (eventDate >= in24Hours && eventDate <= in25Hours) {
            const alreadySent = await checkReminderSent(db, eventId, '24h');
            if (!alreadySent) {
              await sendEventReminder(eventId, eventTitle, eventDate, zoneId, '24h');
              await markReminderSent(db, eventId, '24h');
              remindersSent++;
            }
          }

          if (eventDate >= in1Hour && eventDate <= in2Hours) {
            const alreadySent = await checkReminderSent(db, eventId, '1h');
            if (!alreadySent) {
              await sendEventReminder(eventId, eventTitle, eventDate, zoneId, '1h');
              await markReminderSent(db, eventId, '1h');
              remindersSent++;
            }
          }

        }
      } catch (collectionError) {
 console.error(`[CalendarReminders] Collection error:`, collectionError);
      }
    }

    // Check for birthdays (outside the event loops)
    try {
      const birthdayCount = await processBirthdays(db);
      remindersSent += birthdayCount;
    } catch (birthdayError) {
 console.error('[CalendarReminders] Birthday Error:', birthdayError);
    }

    return NextResponse.json({ success: true, remindersSent });

  } catch (error) {
 console.error('[CalendarReminders] Error:', error);
    return NextResponse.json({ error: 'Failed to process reminders' }, { status: 500 });
  }
}

function parseEventDate(event: any): Date | null {
  const dateField = event.date || event.eventDate || event.startDate;
  if (!dateField) return null;

  try {
    if (dateField.toDate) {
      return dateField.toDate();
    }
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

async function checkReminderSent(db: admin.firestore.Firestore, eventId: string, type: string): Promise<boolean> {
  try {
    const reminderDoc = await db.collection('sent_reminders').doc(`${eventId}_${type}`).get();
    return reminderDoc.exists;
  } catch {
    return false;
  }
}

async function markReminderSent(db: admin.firestore.Firestore, eventId: string, type: string): Promise<void> {
  try {
    await db.collection('sent_reminders').doc(`${eventId}_${type}`).set({
      eventId,
      type,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
 console.error('[CalendarReminders] Error marking reminder sent:', error);
  }
}

async function sendEventReminder(
  eventId: string,
  eventTitle: string,
  eventDate: Date,
  zoneId: string | undefined,
  reminderType: '24h' | '1h'
): Promise<void> {
  try {
    const db = admin.firestore();

    // Get zone members
    const membersCollection = zoneId ? 'zone_members' : 'hq_members';
    let membersQuery = db.collection(membersCollection);

    if (zoneId) {
      membersQuery = membersQuery.where('zoneId', '==', zoneId) as any;
    }

    const membersSnapshot = await membersQuery.limit(500).get();

    const recipientIds: string[] = [];
    membersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        recipientIds.push(data.userId);
      }
    });

    if (recipientIds.length === 0) {
      return;
    }

    const timeStr = eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const title = reminderType === '24h' ? ' Event Tomorrow' : ' Event Starting Soon';
    const body = reminderType === '24h'
      ? `"${eventTitle}" is tomorrow at ${timeStr}`
      : `"${eventTitle}" starts in 1 hour at ${timeStr}`;

    // Send via unified notification API (internal call)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lwsrhp.vercel.app';

    // Send in batches
    const batchSize = 100;
    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batch = recipientIds.slice(i, i + batchSize);

      await fetch(`${baseUrl}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.LWSRH_INTERNAL_API_KEY ? { 'x-internal-api-key': process.env.LWSRH_INTERNAL_API_KEY } : {})
        },
        body: JSON.stringify({
          type: 'calendar',
          recipientIds: batch,
          title,
          body,
          data: { eventId, eventTitle }
        })
      });
    }

  } catch (error) {
 console.error('[CalendarReminders] Error sending reminder:', error);
  }
}
async function processBirthdays(db: admin.firestore.Firestore): Promise<number> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  // Format MM-DD for matching birthday strings (assuming YYYY-MM-DD format)
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const dayStr = day < 10 ? `0${day}` : `${day}`;
  const birthdaySuffix = `-${monthStr}-${dayStr}`;

  let sentCount = 0;

  try {
    // Note: Firestore doesn't support substring match efficiently. 
    // We'd ideally search for all profiles and filter in JS, or if we have thousands, use a more optimized field.
    // For now, let's fetch profiles.
    const profilesSnapshot = await db.collection('profiles').get();

    for (const doc of profilesSnapshot.docs) {
      const profile = doc.data();
      const birthday = profile.birthday; // Expected: YYYY-MM-DD

      if (birthday && birthday.endsWith(birthdaySuffix)) {
        const userId = doc.id;
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'A member';
        const zoneId = profile.zoneId;

        // Check if already sent today
        const alreadySent = await db.collection('sent_reminders').doc(`birthday_${userId}_${year}`).get();
        if (!alreadySent.exists) {
          await sendBirthdayGreeting(userId, name, zoneId);
          await db.collection('sent_reminders').doc(`birthday_${userId}_${year}`).set({
            userId,
            type: 'birthday',
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sentCount++;
        }
      }
    }
  } catch (error) {
 console.error('[CalendarReminders] processBirthdays Error:', error);
  }

  return sentCount;
}

async function sendBirthdayGreeting(userId: string, name: string, zoneId: string | undefined): Promise<void> {
  try {
    const db = admin.firestore();
    const membersCollection = zoneId ? 'zone_members' : 'hq_members';
    let membersQuery = db.collection(membersCollection);

    if (zoneId) {
      membersQuery = membersQuery.where('zoneId', '==', zoneId) as any;
    }

    const membersSnapshot = await membersQuery.limit(500).get();
    const recipientIds: string[] = [];

    membersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId && data.userId !== userId) { // Don't notify the person themselves or we can if we want a "Happy Birthday to you"
        recipientIds.push(data.userId);
      }
    });

    if (recipientIds.length === 0) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lwsrhp.vercel.app';
    const batchSize = 100;

    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const batch = recipientIds.slice(i, i + batchSize);
      await fetch(`${baseUrl}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.LWSRH_INTERNAL_API_KEY ? { 'x-internal-api-key': process.env.LWSRH_INTERNAL_API_KEY } : {})
        },
        body: JSON.stringify({
          type: 'zone',
          recipientIds: batch,
          title: ' Birthday Celebration!',
          body: `It's ${name}'s birthday today! Let's celebrate! `,
          data: { userId, type: 'birthday' }
        })
      });
    }
  } catch (error) {
 console.error('[CalendarReminders] sendBirthdayGreeting Error:', error);
  }
}
