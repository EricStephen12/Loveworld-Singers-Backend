import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyFirebaseIdToken } from '@/lib/api-guards';
import { isHQAdminEmail } from '@/config/roles';

/**
 * UPDATE USER ACCESS API
 * Allows HQ Admins to toggle restricted access fields and edit profiles.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, updates } = await request.json();

        if (!userId || !updates) {
            return NextResponse.json({ success: false, error: 'User ID and updates are required' }, { status: 400 });
        }

        // Verify caller is HQ admin
        const caller = await verifyFirebaseIdToken(request);
        const callerEmail = caller?.email;
        
        if (!caller || !callerEmail || !isHQAdminEmail(callerEmail)) {
            return NextResponse.json({ success: false, error: 'Unauthorized. HQ Admin access required.' }, { status: 403 });
        }

        // List of allowed fields to update via this endpoint
        const allowedFields = [
            'can_access_pre_rehearsal', 
            'has_hq_access',
            'first_name',
            'last_name',
            'middle_name',
            'phone',
            'phone_number',
            'gender',
            'birthday',
            'region',
            'church',
            'designation',
            'administration',
            'is_active'
        ];
        
        const sanitizedUpdates: any = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                sanitizedUpdates[key] = updates[key];
            }
        });

        if (Object.keys(sanitizedUpdates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
        }

        // Update Firestore profile using Admin SDK
        await db.collection('profiles').doc(userId).update({
            ...sanitizedUpdates,
            updated_at: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error: any) {
        console.error('[UpdateUserAccess] API Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
