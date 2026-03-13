import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, sellerUsername } = await request.json();
    if (!escrowCode || !sellerUsername) throw new Error('escrowCode and sellerUsername required');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!tx)                              throw new Error('Escrow not found');
    if (tx.sellerUsername !== sellerUsername) throw new Error('Only the seller can confirm delivery');
    if (tx.status !== 'ACCEPTED')         throw new Error('Escrow must be ACCEPTED first');

    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'DELIVERED', deliveredAt: now, updatedAt: now },
        $push: { auditLog: { action: 'DELIVERED', by: sellerUsername, at: now, note: 'Seller confirmed delivery' } } as any,
      }
    );

    return NextResponse.json({ success: true, message: 'Delivery confirmed. Waiting for buyer.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}