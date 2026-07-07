import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: code.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    const { buyerKey, sellerKey, secretKey, ...safe } = tx as any;
    return NextResponse.json({ success: true, transaction: safe });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
