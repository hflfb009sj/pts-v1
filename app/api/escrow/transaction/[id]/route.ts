import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const transactions = db.collection('transactions');

    const escrowCode = params.id.toUpperCase();
    const tx = await transactions.findOne({ escrowCode });

    if (!tx) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    const { secretKey, ...safeTx } = tx;
    return NextResponse.json({ success: true, transaction: safeTx });

  } catch (error: any) {
    console.error('[Transaction]', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch transaction' }, { status: 500 });
  }
}