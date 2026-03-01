import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });

        const db = await getDb();
        let transaction: any = null;

        try {
            transaction = await db.collection('transactions').findOne({ _id: new ObjectId(id) });
        } catch {
            transaction = await db.collection('transactions').findOne({ paymentId: id });
        }

        if (!transaction) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });

        const dispute = transaction.status === 'DISPUTED'
            ? await db.collection('disputes').findOne({ transactionId: transaction._id })
            : null;

        return NextResponse.json({
            success: true,
            data: {
                ...transaction,
                id: `#TR-${transaction._id.toString().slice(-6).toUpperCase()}`,
                dispute: dispute || null,
            },
        });

    } catch (error: any) {
        console.error('[Transaction GET]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
