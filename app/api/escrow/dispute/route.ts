import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    try {
        const { transactionId, reason, reportedAt } = await request.json();

        if (!transactionId) return NextResponse.json({ success: false, error: 'transactionId is required' }, { status: 400 });
        if (!reason?.trim()) return NextResponse.json({ success: false, error: 'Reason is required' }, { status: 400 });
        if (reason.trim().length > 1000) return NextResponse.json({ success: false, error: 'Reason too long' }, { status: 400 });

        const db = await getDb();
        let query: any;
        try { query = { _id: new ObjectId(transactionId) }; } catch { query = { paymentId: transactionId }; }

        const transaction = await db.collection('transactions').findOne(query);
        if (!transaction) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
        if (transaction.status !== 'LOCKED') return NextResponse.json({ success: false, error: `Cannot dispute: ${transaction.status}` }, { status: 400 });

        const disputeResult = await db.collection('disputes').insertOne({
            transactionId: transaction._id,
            paymentId: transaction.paymentId,
            reason: reason.trim(),
            reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
            status: 'OPEN',
            createdAt: new Date(),
        });

        await db.collection('transactions').updateOne(query, {
            $set: { status: 'DISPUTED', updatedAt: new Date() }
        });

        return NextResponse.json({ success: true, disputeId: disputeResult.insertedId });

    } catch (error: any) {
        console.error('[Dispute]', error);
        return NextResponse.json({ success: false, error: error.message || 'Dispute failed' }, { status: 500 });
    }
}
