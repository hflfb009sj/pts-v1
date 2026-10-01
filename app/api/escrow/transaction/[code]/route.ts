import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    await connectDB();
    const tx = await Transaction.findOne({ escrowCode: code.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: 'Vault not found' }, { status: 404 });
    return NextResponse.json({ success: true, transaction: tx });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}