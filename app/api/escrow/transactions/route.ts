import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    if (!username) throw new Error('username required');
    const db = await getDb();
    const transactions = await db.collection('transactions')
      .find({ $or: [{ buyerUsername: username }, { sellerUsername: username }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({ success: true, transactions });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
