import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, sellerUsername } = await request.json();

    if (!escrowCode) return NextResponse.json({ success: false, error: 'escrowCode is required' }, { status: 400 });
    if (!sellerUsername) return NextResponse.json({ success: false, error: 'sellerUsername is required' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const tx = await transactions.findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });
    if (tx.status !== 'PENDING') return NextResponse.json({ success: false, error: 'Escrow is not in PENDING status' }, { status: 400 });
    if (tx.buyerUsername === sellerUsername) return NextResponse.json({ success: false, error: 'Buyer cannot accept their own escrow' }, { status: 400 });

    const now = new Date();
    const deliveryDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: {
          status: 'ACCEPTED',
          sellerUsername,
          acceptedAt: now,
          deliveryDeadline,
          updatedAt: now,
        }
      }
    );

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $push: {
          auditLog: {
            action: 'ACCEPTED',
            by: sellerUsername,
            at: now,
            note: 'Deal accepted by seller - funds locked'
          }
        } as any
      }
    );

    return NextResponse.json({ success: true, message: 'Deal accepted - funds are now locked', escrowCode, deliveryDeadline });

  } catch (error: any) {
    console.error('[Accept]', error);
    return NextResponse.json({ success: false, error: error.message || 'Accept failed' }, { status: 500 });
  }
}