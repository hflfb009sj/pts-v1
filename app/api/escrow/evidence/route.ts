import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, username, content } = await request.json();
    if (!escrowCode || !username || !content?.trim())
 throw new Error('All fields required');

    const db = await getDb();
    const dispute = await db.collection('disputes').findOne({ escrowCode: escrowCode.toUpperCase() });

    if (!dispute)                          throw new Error('Dispute not found');
    if (dispute.status !== 'EVIDENCE_PENDING') throw new Error('Evidence period has ended');
    if (new Date() > new Date(dispute.evidenceDeadline)) throw new Error('Evidence deadline passed');

    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Transaction not found');
    if (tx.buyerUsername !== username && tx.sellerUsername !== username)
      return NextResponse.json({ error: 'Only buyer or seller can submit evidence' }, { status: 403 });

    const count = (dispute.evidence || []).filter((e: any) => e.submittedBy === username).length;
    if (count >= 5) throw new Error('Maximum 5 evidence items per party');

    const now = new Date();
    await db.collection('disputes').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $push: {
          evidence: { submittedBy: username, type: 'text', content: content.trim(), submittedAt: now },
          auditLog: { action: 'EVIDENCE', by: username, at: now, note: 'Evidence submitted' },
        } as any,
      }
    );

    return NextResponse.json({ success: true, remaining: 4 - count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}