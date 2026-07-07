import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, sellerUsername, sellerKey } = await req.json();
    if (!escrowCode || !sellerUsername) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    if (tx.status !== 'PENDING') return NextResponse.json({ success: false, error: 'Escrow not in PENDING status' }, { status: 400 });
    if (tx.buyerUsername === sellerUsername) return NextResponse.json({ success: false, error: 'Buyer cannot accept own escrow' }, { status: 400 });

    if (sellerKey && tx.sellerKey) {
      const valid = await compare(sellerKey, tx.sellerKey);
      if (!valid) return NextResponse.json({ success: false, error: 'Invalid Seller Key' }, { status: 401 });
    }

    const now = new Date();
    await db.collection('transactions').updateOne({ escrowCode: escrowCode.toUpperCase() }, {
      $set: { status: 'ACCEPTED', sellerUsername, acceptedAt: now, updatedAt: now },
      $push: { auditLog: { action: 'ACCEPTED', by: sellerUsername, at: now, note: 'Deal accepted by seller' } } as any,
    });

    return NextResponse.json({ success: true, message: 'Deal accepted — funds locked' });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
