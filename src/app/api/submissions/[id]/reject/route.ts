import { NextRequest, NextResponse } from 'next/server';
import { rejectSong } from '@/lib/song-submission-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { reviewerId, reviewerName, reviewNotes } = await request.json();

        console.log(`[API] Rejecting submission ${id} by ${reviewerName}`);

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
