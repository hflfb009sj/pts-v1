import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { pickRandomJudges, addDays } from '@/lib/escrow-helpers';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, buyerUsername, reason } = await request.json();
    if (!escrowCode || !buyerUsername) throw new Error('escrowCode and buyerUsername required');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!tx)                              throw new Error('Escrow not found');
    if (tx.buyerUsername !== buyerUsername) return NextResponse.json({ error: 'Only buyer can dispute' }, { status: 403 });
    if (tx.status !== 'DELIVERED')        throw new Error('Can only dispute after seller confirms delivery');
    if (tx.status === 'FROZEN')           throw new Error('Dispute already open');

    const excluded = [buyerUsername, tx.sellerUsername].filter(Boolean) as string[];
    let judges: string[] = [];
    try { judges = await pickRandomJudges(db, excluded); } catch { judges = []; }

    const now = new Date();
    await db.collection('disputes').insertOne({
      escrowCode:        escrowCode.toUpperCase(),
      transactionNumber: tx.transactionNumber,
      status:            'EVIDENCE_PENDING',
      openedBy:          buyerUsername,
      openedAt:          now,
      evidenceDeadline:  addDays(now, 15),
      reviewDeadline:    addDays(now, 22),
      autoReleaseAt:     addDays(now, 15),
      reason:            reason || 'Buyer did not receive',
      evidence:          [],
      judges,
      votes:             [],
      auditLog: [{ action: 'OPENED', by: buyerUsername, at: now, note: `${judges.length} judges assigned` }],
    });

    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'FROZEN', frozenAt: now, updatedAt: now },
        $push: { auditLog: { action: 'FROZEN', by: buyerUsername, at: now, note: 'Dispute opened — funds frozen' } } as any,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Dispute opened. Funds frozen. Submit evidence within 15 days.',
      evidenceDeadline: addDays(now, 15).toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const code = new URL(request.url).searchParams.get('escrowCode');
    if (!code) throw new Error('escrowCode required');
    const db = await getDb();
    const dispute = await db.collection('disputes').findOne({ escrowCode: code.toUpperCase() });
    if (!dispute) throw new Error('Dispute not found');
    return NextResponse.json({ success: true, dispute });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}