import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { status: 'Awake', time: new Date().toISOString() },
    { status: 200 }
  );
}
