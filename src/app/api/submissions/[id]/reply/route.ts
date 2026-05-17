import { NextRequest, NextResponse } from 'next/server';
import { replyToSubmission, userReplyToSubmission } from '@/lib/song-submission-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { adminName, userName, userId, message, sender } = await request.json();

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        console.log(`[API] Replying to submission ${id} (Sender: ${sender})`);

        let result;
        if (sender === 'user') {
            if (!userId) {
                return NextResponse.json({ success: false, error: 'User ID is required for user replies' }, { status: 400 });
            }
            result = await userReplyToSubmission(id, userId, message, userName);
        } else {
            result = await replyToSubmission(id, adminName || 'Admin', message);
        }

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[API] Error in submission reply:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
