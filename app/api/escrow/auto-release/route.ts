import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendPiFromEscrow, sendCommission, validateEscrowBalance } from '@/lib/stellar';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== Bearer ${process.env.CRON_SECRET})
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db  = await getDb();
  const now = new Date();
  const results = { autoReleased: 0, disputeExpired: 0, errors: [] as string[] };
  const cutoff  = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  // Auto-release DELIVERED > 15 days
  const stale = await db.collection('transactions').find({ status: 'DELIVERED', deliveredAt: { $lt: cutoff } }).toArray();
  for (const tx of stale) {
    try {
      await validateEscrowBalance(tx.amount + tx.fee);
      const commTx = await sendCommission({ amount: tx.fee.toFixed(7), memo: Fee ${tx.escrowCode} });
      const sellTx = await sendPiFromEscrow({ destinationWallet: tx.sellerWallet, amount: tx.amount.toFixed(7), memo: PTrust ${tx.escrowCode} });
      await db.collection('transactions').updateOne(
        { escrowCode: tx.escrowCode },
        {
          $set: { status: 'RELEASED', releasedAt: now, updatedAt: now, sellerTxHash: sellTx.txHash, commissionTxHash: commTx.txHash },
          $push: { auditLog: { action: 'AUTO_RELEASED', by: 'system', at: now, note: '15 days buyer silence' } } as any,
        }
      );
      results.autoReleased++;
    } catch (e: any) { results.errors.push(${tx.escrowCode}: ${e.message}); }
  }

  // Expire disputes with no evidence
  const expired = await db.collection('disputes').find({ status: 'EVIDENCE_PENDING', autoReleaseAt: { $lt: now } }).toArray();
  for (const dispute of expired) {
    try {
      const tx = await db.collection('transactions').findOne({ escrowCode: dispute.escrowCode });
      if (!tx) continue;
      await validateEscrowBalance(tx.amount + tx.fee);
      const commTx = await sendCommission({ amount: tx.fee.toFixed(7), memo: Fee ${tx.escrowCode} });
      const sellTx = await sendPiFromEscrow({ destinationWallet: tx.sellerWallet, amount: tx.amount.toFixed(7), memo: PTrust ${tx.escrowCode} });
      await db.collection('disputes').updateOne({ escrowCode: dispute.escrowCode }, { $set: { status: 'EXPIRED', resolvedAt: now, resolvedFor: 'SELLER' } });
      await db.collection('transactions').updateOne(
        { escrowCode: dispute.escrowCode },
        {
          $set: { status: 'RELEASED', releasedAt: now, updatedAt: now, sellerTxHash: sellTx.txHash, commissionTxHash: commTx.txHash },
          $push: { auditLog: { action: 'DISPUTE_EXPIRED', by: 'system', at: now, note: 'No evidence — auto-released to seller' } } as any,
        }
      );
      results.disputeExpired++;
    } catch (e: any) { results.errors.push(Dispute ${dispute.escrowCode}: ${e.message}); }
  }

  return NextResponse.json({ success: true, ...results, timestamp: now.toISOString() });
}