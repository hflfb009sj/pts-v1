import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, secretKey } = await request.json();

    if (!escrowCode || !secretKey) {
      return NextResponse.json({ success: false, error: 'escrowCode and secretKey are required' }, { status: 400 });
    }

    const db = await getDb();
    const transactions = db.collection('transactions');

    const tx = await transactions.findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    if (tx.secretKey !== secretKey) return NextResponse.json({ success: false, error: 'Invalid secret key' }, { status: 401 });
    if (tx.status === 'RELEASED') return NextResponse.json({ success: false, error: 'Funds already released' }, { status: 400 });
    if (tx.status !== 'DELIVERED' && tx.status !== 'LOCKED') {
      return NextResponse.json({ success: false, error: 'Escrow cannot be released in current status: ' + tx.status }, { status: 400 });
    }

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      { $set: { status: 'RELEASED', updatedAt: new Date(), releasedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Funds released successfully', escrowCode });

  } catch (error: any) {
    console.error('[Release]', error);
    return NextResponse.json({ success: false, error: error.message || 'Release failed' }, { status: 500 });
  }
}
