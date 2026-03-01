import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    try {
        const { transactionId } = await request.json();
        if (!transactionId) return NextResponse.json({ success: false, error: 'transactionId is required' }, { status: 400 });

        const db = await getDb();
        let query: any;
        try { query = { _id: new ObjectId(transactionId) }; } catch { query = { paymentId: transactionId }; }

        const transaction = await db.collection('transactions').findOne(query);
        if (!transaction) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        if (!['LOCKED', 'DISPUTED'].includes(transaction.status)) {
            return NextResponse.json({ success: false, error: `Cannot refund: ${transaction.status}` }, { status: 400 });
        }

        await db.collection('transactions').updateOne(query, {
            $set: { status: 'REFUNDED', refundedAt: new Date(), updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, message: 'Funds refunded to buyer', status: 'REFUNDED' });

    } catch (error: any) {
        console.error('[Refund]', error);
        return NextResponse.json({ success: false, error: error.message || 'Refund failed' }, { status: 500 });
    }
}
