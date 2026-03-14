import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, sellerUsername, sellerKey } = await request.json();
    if (!escrowCode)     throw new Error('escrowCode required');
    if (!sellerUsername) throw new Error('sellerUsername required');
    if (!sellerKey)      throw new Error('Seller Key required');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!tx)                        throw new Error('Escrow not found');
    if (tx.status !== 'PENDING')    throw new Error('Escrow not available for acceptance');
    if (tx.buyerUsername === sellerUsername) throw new Error('Buyer cannot accept their own escrow');
    if ((tx.sellerKeyAttempts || 0) >= 5)   throw new Error('Too many failed attempts — contact admin');

    const valid = await compare(sellerKey, tx.sellerKey);
    if (!valid) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $inc: { sellerKeyAttempts: 1 } as any }
      );
      throw new Error(`Invalid Seller Key — ${4 - (tx.sellerKeyAttempts || 0)} attempts remaining`);
    }

    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'ACCEPTED', sellerUsername, sellerKeyAttempts: 0, acceptedAt: now, updatedAt: now },
        $push: { auditLog: { action: 'ACCEPTED', by: sellerUsername, at: now, note: 'Seller accepted with Seller Key' } } as any,
      }
    );

    return NextResponse.json({ success: true, message: 'Deal accepted. Funds are locked.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}