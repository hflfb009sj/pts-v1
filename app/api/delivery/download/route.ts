import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, deliveryCode, buyerUsername } = await req.json();
    if (!escrowCode || !deliveryCode) throw new Error('Missing fields');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Escrow not found');
    if (tx.buyerUsername !== buyerUsername) throw new Error('Only buyer can download');
    if (tx.deliveryCode !== deliveryCode) throw new Error('Invalid delivery code');
    if (!tx.deliveryFile?.url) throw new Error('No file uploaded yet');

    return NextResponse.json({ success: true, fileUrl: tx.deliveryFile.url, fileName: tx.deliveryFile.fileName });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
