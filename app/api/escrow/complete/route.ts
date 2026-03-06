import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, secretKey, confirmText, buyerUsername } = await request.json();

    if (!escrowCode) return NextResponse.json({ success: false, error: 'escrowCode is required' }, { status: 400 });
    if (!secretKey) return NextResponse.json({ success: false, error: 'secretKey is required' }, { status: 400 });
    if (!buyerUsername) return NextResponse.json({ success: false, error: 'buyerUsername is required' }, { status: 400 });
    if (confirmText !== 'CONFIRM') return NextResponse.json({ success: false, error: 'Please type CONFIRM to release funds' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const tx = await transactions.findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Escrow not found' }, { status: 404 });

    // Security checks
    if (tx.buyerUsername !== buyerUsername) return NextResponse.json({ success: false, error: 'Only the buyer can release funds' }, { status: 403 });
    if (tx.status === 'RELEASED') return NextResponse.json({ success: false, error: 'Funds already released' }, { status: 400 });
    if (tx.status === 'DISPUTED') return NextResponse.json({ success: false, error: 'Transaction is disputed - contact admin' }, { status: 400 });
    if (tx.status === 'PENDING_ADMIN') return NextResponse.json({ success: false, error: 'Transaction is under admin review' }, { status: 400 });
    if (tx.status !== 'DELIVERED') return NextResponse.json({ success: false, error: 'Seller must confirm delivery first' }, { status: 400 });

    // Rate limiting - max 5 attempts
    if (tx.releaseAttempts >= 5) {
      await transactions.updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $set: { status: 'PENDING_ADMIN', updatedAt: new Date() } }
      );
      return NextResponse.json({ success: false, error: 'Too many failed attempts - escalated to admin' }, { status: 403 });
    }

    // Verify secret key
    const isValidKey = await compare(secretKey, tx.secretKey);
    if (!isValidKey) {
      await transactions.updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $inc: { releaseAttempts: 1 } as any }
      );
      const remaining = 4 - tx.releaseAttempts;
      return NextResponse.json({ success: false, error: 'Invalid secret key - ' + remaining + ' attempts remaining' }, { status: 401 });
    }

    const now = new Date();

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: {
          status: 'RELEASED',
          releasedAt: now,
          updatedAt: now,
          releaseAttempts: 0,
        }
      }
    );

    await transactions.updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $push: {
          auditLog: {
            action: 'RELEASED',
            by: buyerUsername,
            at: now,
            note: 'Funds released by buyer'
          }
        } as any
      }
    );

    return NextResponse.json({ success: true, message: 'Funds released successfully to seller', escrowCode, transactionNumber: tx.transactionNumber });

  } catch (error: any) {
    console.error('[Release]', error);
    return NextResponse.json({ success: false, error: error.message || 'Release failed' }, { status: 500 });
  }
}