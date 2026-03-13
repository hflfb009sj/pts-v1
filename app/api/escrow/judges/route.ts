cat > app/api/escrow/judges/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendPiFromEscrow, sendCommission, validateEscrowBalance } from '@/lib/stellar';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, judgeUsername, vote, reasoning } = await request.json();
    if (!escrowCode  !judgeUsername  !vote) throw new Error('All fields required');
    if (!['SELLER', 'BUYER'].includes(vote)) throw new Error('vote must be SELLER or BUYER');

    const db = await getDb();
    const dispute = await db.collection('disputes').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!dispute) throw new Error('Dispute not found');
    if (!['EVIDENCE_PENDING', 'UNDER_REVIEW'].includes(dispute.status)) throw new Error('Voting not open');
    if (!dispute.judges.includes(judgeUsername)) return NextResponse.json({ error: 'Not assigned to this dispute' }, { status: 403 });
    if ((dispute.votes || []).find((v: any) => v.judgeUsername === judgeUsername)) throw new Error('Already voted');

    const now = new Date();
    await db.collection('disputes').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $push: { votes: { judgeUsername, vote, votedAt: now, reasoning: reasoning || '' } } as any,
        $set: { status: 'UNDER_REVIEW' },
      }
    );

    const updated = await db.collection('disputes').findOne({ escrowCode: escrowCode.toUpperCase() });
    const sellerVotes = (updated?.votes || []).filter((v: any) => v.vote === 'SELLER').length;
    const buyerVotes  = (updated?.votes || []).filter((v: any) => v.vote === 'BUYER').length;

    if (sellerVotes >= 2 || buyerVotes >= 2) {
      const winner: 'SELLER' | 'BUYER' = sellerVotes >= 2 ? 'SELLER' : 'BUYER';
      const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
      if (!tx) throw new Error('Transaction not found');

      await validateEscrowBalance(tx.amount + tx.fee);

      let sellerTxHash = '';
      let commissionTxHash = '';
      let newStatus = '';

      if (winner === 'SELLER') {
        const commTx = await sendCommission({ amount: tx.fee.toFixed(7), memo: Fee ${tx.escrowCode} });
        const sellTx = await sendPiFromEscrow({ destinationWallet: tx.sellerWallet, amount: tx.amount.toFixed(7), memo: PTrust ${tx.escrowCode} });
        sellerTxHash     = sellTx.txHash;
        commissionTxHash = commTx.txHash;
        newStatus = 'RELEASED';
      } else {
        newStatus = 'REFUNDED';
      }

      await db.collection('disputes').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $set: { status: winner === 'SELLER' ? 'RESOLVED_SELLER' : 'RESOLVED_BUYER', resolvedAt: now, resolvedFor: winner } }
      );

      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        {
          $set: { status: newStatus, releasedAt: now, updatedAt: now, sellerTxHash: sellerTxHash  undefined, commissionTxHash: commissionTxHash  undefined },
          $push: { auditLog: { action: DISPUTE_${winner}_WON, by: 'judges', at: now, note: Judges ruled for ${winner} } } as any,
        }
      );

      return NextResponse.json({ success: true, resolved: true, winner });
    }

    return NextResponse.json({ success: true, resolved: false, votes: { seller: sellerVotes, buyer: buyerVotes } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
EOF