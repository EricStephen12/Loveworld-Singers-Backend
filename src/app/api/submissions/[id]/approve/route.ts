import { NextRequest, NextResponse } from 'next/server';
import { approveSong } from '@/lib/song-submission-service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { reviewerId, reviewerName, reviewNotes } = await request.json();

        console.log(`[API] Approving submission ${id} by ${reviewerName}`);

        const result = await approveSong(id, reviewerId, reviewerName, reviewNotes);

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[API] Error in submission approval:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
