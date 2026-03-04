import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, sellerUsername } = await request.json();

    if (!escrowCode) return NextResponse.json({ success: false, error: 'escrowCode is required' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const tx = await transactions.findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    if (tx.status !== 'LOCKED') return NextResponse.json({ success: false, error: 'Escrow is not in LOCKED status' }, { status: 400 });

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      { $set: { status: 'DELIVERED', sellerUsername: sellerUsername || 'unknown', updatedAt: new Date(), deliveredAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Delivery confirmed', escrowCode });

  } catch (error: any) {
    console.error('[Complete]', error);
    return NextResponse.json({ success: false, error: error.message || 'Completion failed' }, { status: 500 });
  }
}