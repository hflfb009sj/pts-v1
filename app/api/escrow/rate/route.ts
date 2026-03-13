cat > app/api/escrow/rate/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { escrowCode, rating, raterUsername } = await request.json();
    if (!escrowCode || !raterUsername) throw new Error('All fields required');
    if (!rating  rating < 1  rating > 5) throw new Error('Rating must be 1-5');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Transaction not found');
    if (tx.status !== 'RELEASED') throw new Error('Can only rate completed transactions');
    if (tx.buyerUsername !== raterUsername && tx.sellerUsername !== raterUsername) throw new Error('Only parties can rate');
    if (tx.rating) throw new Error('Already rated');

    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { rating, ratedBy: raterUsername, ratedAt: now, updatedAt: now },
        $push: { auditLog: { action: 'RATED', by: raterUsername, at: now, note: ${rating}/5 } } as any,
      }
    );
    return NextResponse.json({ success: true, rating });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
EOF