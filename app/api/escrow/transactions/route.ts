import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const username = new URL(request.url).searchParams.get('username');
    if (!username) throw new Error('username required');
    const db = await getDb();
    const transactions = await db.collection('transactions')
      .find({ $or: [{ buyerUsername: username }, { sellerUsername: username }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .project({ buyerKey: 0, sellerKey: 0 })
      .toArray();
    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}