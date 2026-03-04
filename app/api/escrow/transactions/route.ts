import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) return NextResponse.json({ success: false, error: 'username is required' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const txList = await transactions
      .find({ $or: [{ buyerUsername: username }, { sellerUsername: username }] })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const safeTxList = txList.map(({ secretKey, ...tx }) => tx);

    return NextResponse.json({ success: true, transactions: safeTxList });

  } catch (error: any) {
    console.error('[Transactions]', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch transactions' }, { status: 500 });
  }
}