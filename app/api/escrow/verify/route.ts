import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/lib/mongodb';
import { getPiPayment } from '@/app/lib/pi-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const paymentId = searchParams.get('paymentId');

        if (!paymentId) return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });

        const db = await getDb();
        const transaction = await db.collection('transactions').findOne({ paymentId });

        let piPayment = null;
        try { piPayment = await getPiPayment(paymentId); } catch (_) {}

        if (!transaction && !piPayment) return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });

        return NextResponse.json({
            success: true,
            data: {
                paymentId,
                localStatus: transaction?.status || 'NOT_FOUND',
                txid: transaction?.txid || piPayment?.transaction?.txid || null,
                amount: transaction?.amount || piPayment?.amount || null,
                verified: piPayment?.transaction?.verified || false,
                createdAt: transaction?.createdAt || null,
            },
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { accessToken } = await request.json();
        if (!accessToken) return NextResponse.json({ success: false, error: 'accessToken is required' }, { status: 400 });

        const response = await fetch('https://api.minepi.com/v2/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) return NextResponse.json({ success: false, error: 'Invalid access token' }, { status: 401 });

        const user = await response.json();
        return NextResponse.json({ success: true, user: { uid: user.uid, username: user.username } });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
