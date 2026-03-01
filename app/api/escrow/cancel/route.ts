import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/mongodb';

export async function POST(request: NextRequest) {
    try {
        const { paymentId } = await request.json();
        if (!paymentId) return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });

        const db = await getDb();
        const transaction = await db.collection('transactions').findOne({ paymentId });

        if (!transaction) return NextResponse.json({ success: true, message: 'Payment cancelled' });

        if (!['PENDING', 'LOCKED'].includes(transaction.status)) {
            return NextResponse.json({ success: false, error: `Cannot cancel: ${transaction.status}` }, { status: 400 });
        }

        await db.collection('transactions').updateOne(
            { paymentId },
            { $set: { status: 'CANCELLED', updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true, message: 'Transaction cancelled' });

    } catch (error: any) {
        console.error('[Cancel]', error);
        return NextResponse.json({ success: false, error: error.message || 'Cancel failed' }, { status: 500 });
    }
}
