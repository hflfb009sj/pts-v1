import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, buyerKey, confirmText, buyerUsername } = await req.json();
    if (!escrowCode  !buyerKey  !buyerUsername) throw new Error('All fields required');
    if (confirmText !== 'CONFIRM') throw new Error('Type CONFIRM to authorize');
    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Escrow not found');
    if (tx.buyerUsername !== buyerUsername)
      return NextResponse.json({ success: false, error: 'Only buyer can release' }, { status: 403 });
    if (tx.status === 'RELEASED') throw new Error('Already released');
    if (tx.status === 'FROZEN') throw new Error('Funds frozen — dispute in progress');
    if (tx.status !== 'DELIVERED') throw new Error('Seller must confirm delivery first');
    if ((tx.buyerKeyAttempts || 0) >= 5) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $set: { status: 'PENDING_ADMIN' } }
      );
      return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 403 });
    }
    const valid = await compare(buyerKey, tx.buyerKey);
    if (!valid) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $inc: { buyerKeyAttempts: 1 } as any }
      );
      const left = 4 - (tx.buyerKeyAttempts || 0);
      return NextResponse.json({ success: false, error: 'Invalid Buyer Key — ' + left + ' attempts remaining' }, { status: 401 });
    }
    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'RELEASED', releasedAt: now, updatedAt: now, buyerKeyAttempts: 0 },
        $push: { auditLog: { action: 'RELEASED', by: buyerUsername, at: now, note: tx.amount + ' Pi released' } } as any,
      }
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
EOFcd ~/Desktop/"ptrust_final 100"

cat > app/api/escrow/release/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { compare } from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, buyerKey, confirmText, buyerUsername } = await req.json();
    if (!escrowCode  !buyerKey  !buyerUsername) throw new Error('All fields required');
    if (confirmText !== 'CONFIRM') throw new Error('Type CONFIRM to authorize');
    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Escrow not found');
    if (tx.buyerUsername !== buyerUsername)
      return NextResponse.json({ success: false, error: 'Only buyer can release' }, { status: 403 });
    if (tx.status === 'RELEASED') throw new Error('Already released');
    if (tx.status === 'FROZEN') throw new Error('Funds frozen — dispute in progress');
    if (tx.status !== 'DELIVERED') throw new Error('Seller must confirm delivery first');
    if ((tx.buyerKeyAttempts || 0) >= 5) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $set: { status: 'PENDING_ADMIN' } }
      );
      return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 403 });
    }
    const valid = await compare(buyerKey, tx.buyerKey);
    if (!valid) {
      await db.collection('transactions').updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { $inc: { buyerKeyAttempts: 1 } as any }
      );
      const left = 4 - (tx.buyerKeyAttempts || 0);
      return NextResponse.json({ success: false, error: 'Invalid Buyer Key — ' + left + ' attempts remaining' }, { status: 401 });
    }
    const now = new Date();
    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: 'RELEASED', releasedAt: now, updatedAt: now, buyerKeyAttempts: 0 },
        $push: { auditLog: { action: 'RELEASED', by: buyerUsername, at: now, note: tx.amount + ' Pi released' } } as any,
      }
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
