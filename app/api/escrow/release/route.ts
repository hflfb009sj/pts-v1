import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';
import { sendPiFromEscrow, sendCommission, validateEscrowBalance } from '@/lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, buyerKey, confirmText, buyerUsername } = await request.json();

    if (!escrowCode  !buyerKey  !buyerUsername) throw new Error('All fields required');
    if (confirmText !== 'CONFIRM') throw new Error('Type CONFIRM to authorize');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!tx)                                  throw new Error('Escrow not found');
    if (tx.buyerUsername !== buyerUsername)   return NextResponse.json({ error: 'Only buyer can release' }, { status: 403 });
    if (tx.status === 'RELEASED')             throw new Error('Already released');
    if (tx.status === 'FROZEN')               throw new Error('Funds frozen — dispute in progress');
    if (tx.status === 'PENDING_ADMIN')        throw new Error('Under admin review');
    if (tx.status !== 'DELIVERED')            throw new Error('Seller must confirm delivery first');

    if ((tx.buyerKeyAttempts || 0) >= 5) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $set: { status: 'PENDING_ADMIN', updatedAt: new Date() } }
      );
      return NextResponse.json({ error: 'Too many attempts — escalated to admin' }, { status: 403 });
    }

    const valid = await compare(buyerKey, tx.buyerKey);
    if (!valid) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $inc: { buyerKeyAttempts: 1 } as any }
      );
      return NextResponse.json({ error: Invalid Buyer Key — ${4 - (tx.buyerKeyAttempts || 0)} attempts remaining }, { status: 401 });
    }

    await validateEscrowBalance(tx.amount + tx.fee);
    const commTx = await sendCommission({ amount: tx.fee.toFixed(7), memo: Fee ${tx.escrowCode} });
    const sellTx = await sendPiFromEscrow({ destinationWallet: tx.sellerWallet, amount: tx.amount.toFixed(7), memo: PTrust ${tx.escrowCode} });

    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'RELEASED', releasedAt: now, updatedAt: now, buyerKeyAttempts: 0, sellerTxHash: sellTx.txHash, commissionTxHash: commTx.txHash },
        $push: { auditLog: { action: 'RELEASED', by: buyerUsername, at: now, note: ${tx.amount} Pi → seller | TxHash: ${sellTx.txHash} } } as any,
      }
    );

    return NextResponse.json({ success: true, message: 'Funds released!', sellerTxHash: sellTx.txHash });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}