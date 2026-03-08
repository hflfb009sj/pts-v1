import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, secretKey, confirmText, buyerUsername } = await request.json();

    if (!escrowCode || !secretKey) {
      return NextResponse.json({ success: false, error: 'escrowCode and secretKey are required' }, { status: 400 });
    }

    if (confirmText !== 'CONFIRM') {
      return NextResponse.json({ success: false, error: 'Please type CONFIRM to release funds' }, { status: 400 });
    }

    const db = await getDb();
    const transactions = db.collection('transactions');

    const tx = await transactions.findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });

    const keyMatch = await compare(secretKey, tx.secretKey);
    if (!keyMatch) return NextResponse.json({ success: false, error: 'Invalid secret key' }, { status: 401 });

    if (tx.status === 'RELEASED') return NextResponse.json({ success: false, error: 'Funds already released' }, { status: 400 });
    if (tx.status !== 'DELIVERED') {
      return NextResponse.json({ success: false, error: 'Escrow cannot be released in current status: ' + tx.status }, { status: 400 });
    }

    const now = new Date();
    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: {
          status: 'RELEASED',
          updatedAt: now,
          releasedAt: now
        },
        $push: {
          auditLog: {
            action: 'RELEASED',
            by: buyerUsername || 'buyer',
            at: now,
            note: 'Funds released by buyer'
          }
        }
      } as any
    );

    return NextResponse.json({ success: true, message: 'Funds released successfully', escrowCode });

  } catch (error: any) {
    console.error('[Release]', error);
    return NextResponse.json({ success: false, error: error.message || 'Release failed' }, { status: 500 });
  }
}
