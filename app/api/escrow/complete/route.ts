import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/mongodb';
import { completePiPayment } from '@/app/lib/pi-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { paymentId, txid } = body;

        if (!paymentId) return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });
        if (!txid) return NextResponse.json({ success: false, error: 'txid is required' }, { status: 400 });

        const db = await getDb();
        const transaction = await db.collection('transactions').findOne({ paymentId });

        if (!transaction) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        if (transaction.txid) return NextResponse.json({ success: true, status: transaction.status });

        await completePiPayment(paymentId, txid);

        await db.collection('transactions').updateOne(
            { paymentId },
            { $set: { txid, status: 'LOCKED', updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true, txid, status: 'LOCKED' });

    } catch (error: any) {
        console.error('[Complete]', error);
        return NextResponse.json({ success: false, error: error.message || 'Completion failed' }, { status: 500 });
    }
}
