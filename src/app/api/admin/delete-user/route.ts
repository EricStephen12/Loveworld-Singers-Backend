import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { enforceRateLimit, verifyFirebaseIdToken } from '@/lib/api-guards'
import { isHQAdminEmail } from '@/config/roles'

/**
 * DELETE USER API
 * Permanently deletes a user from Firebase Auth and Firestore profiles.
 * Requires admin/coordinator verification.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, adminId } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        // Verify caller is HQ admin via signed Firebase ID token (do not trust client headers).
        const caller = await verifyFirebaseIdToken(request)
        const callerEmail = caller?.email
        if (!caller || !callerEmail || !isHQAdminEmail(callerEmail)) {
            return NextResponse.json({ success: false, error: 'Unauthorized. HQ Admin access required.' }, { status: 403 })
        }

        const rate = await enforceRateLimit({
            name: 'admin-delete-user',
            tokensPerInterval: 5,
            intervalMs: 60_000,
            req: request,
            key: () => `uid:${caller.uid}`,
        })
        if (!rate.ok) {
            return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
        }

        // 2. Delete from Firestore profiles
        try {
            await db.collection('profiles').doc(userId).delete();
 console.log(`[DeleteUser] Firestore profile deleted: ${userId}`);
        } catch (firestoreError) {
 console.error('[DeleteUser] Firestore deletion error:', firestoreError);
            // Continue even if profile deletion fails (user might not have one)
        }

        // 3. Delete from Firebase Auth
        try {
            await auth.deleteUser(userId);
 console.log(`[DeleteUser] Auth account deleted: ${userId}`);
        } catch (authError: any) {
 console.error('[DeleteUser] Auth deletion error:', authError);
            // Check for various ways the error code might be presented
            const isUserNotFound =
                authError.code === 'auth/user-not-found' ||
                authError.errorInfo?.code === 'auth/user-not-found' ||
                authError.message?.includes('no user record');

            if (!isUserNotFound) {
                return NextResponse.json({
                    success: false,
                    error: `Auth deletion failed: ${authError.message}`
                }, { status: 500 });
            }
 console.log('[DeleteUser] User already missing from Auth, proceeding.');
        }

        // 4. GLOBAL CLEANUP: Remove user from ALL zones and HQ groups
        // This ensures they don't remain as "orphan" members in other zones
        try {
 console.log(`[DeleteUser] Starting global cleanup for user: ${userId}`);

            // A. Clean up zone_members
            const zoneMembersSnapshot = await db.collection('zone_members').where('userId', '==', userId).get();
            if (!zoneMembersSnapshot.empty) {
                const batch = db.batch();
                zoneMembersSnapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
 console.log(`[DeleteUser] Removed ${zoneMembersSnapshot.size} zone_members records.`);
            }

            // B. Clean up hq_members
            const hqMembersSnapshot = await db.collection('hq_members').where('userId', '==', userId).get();
            if (!hqMembersSnapshot.empty) {
                const batch = db.batch();
                hqMembersSnapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
 console.log(`[DeleteUser] Removed ${hqMembersSnapshot.size} hq_members records.`);
            }

        } catch (cleanupError: any) {
 console.error('[DeleteUser] Global cleanup error:', cleanupError);

            // Check for Quota Exceeded error (Code 8)
            if (cleanupError.code === 8 || cleanupError.message?.includes('Quota exceeded')) {
 console.warn('[DeleteUser] Firebase Quota Exceeded. Skipping global cleanup.');
                return NextResponse.json({
                    success: true,
                    message: 'User deleted, but cleanup of zone memberships was skipped due to server limits. Please try again later to remove residual records.',
                    warning: 'QuotaExceeded'
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'User permanently deleted'
        });

    } catch (error: any) {
 console.error('[DeleteUser] API Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
