import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, rating, raterUsername } = await req.json();
    if (!escrowCode || !rating || !raterUsername) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Rating must be 1-5' }, { status: 400 });
    }

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    if (tx.status !== 'RELEASED') return NextResponse.json({ success: false, error: 'Can only rate completed transactions' }, { status: 400 });

    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      { $set: { rating, ratedBy: raterUsername, ratedAt: new Date(), updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Rating submitted' });
  } catch (e: any) {
    console.error('[Rate]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
