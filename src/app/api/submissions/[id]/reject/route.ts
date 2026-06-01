import { NextRequest, NextResponse } from 'next/server';
import { rejectSong } from '@/lib/song-submission-service';
import { FirebaseDatabaseService } from '@/lib/firebase-database';
import { isHQAdminEmail } from '@/config/roles';
import { isUserCoordinator } from '@/lib/check-coordinator';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { reviewerId, reviewerName, reviewNotes } = await request.json();

        // Perform security check on reviewerId
        if (!reviewerId) {
            return NextResponse.json({ success: false, error: 'Unauthorized: No reviewer ID provided' }, { status: 401 });
        }

        const userProfile = await FirebaseDatabaseService.getUserProfile(reviewerId);
        const userEmail = (userProfile as any)?.email;

        let isAuthorized = false;

        // Check if user is an HQ Admin
        if (userEmail && isHQAdminEmail(userEmail)) {
            isAuthorized = true;
        } else {
            // Check if user is a Zone Coordinator
            const isCoordinator = await isUserCoordinator(reviewerId);
            if (isCoordinator) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            console.warn(`[API] Unauthorized rejection attempt by user ${reviewerId}`);
            return NextResponse.json({ success: false, error: 'Unauthorized: You do not have permission to reject songs' }, { status: 403 });
        }

        console.log(`[API] Rejecting submission ${id} by ${reviewerName} (${reviewerId})`);

        const result = await rejectSong(id, reviewerId, reviewerName, reviewNotes);

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[API] Error in submission rejection:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
