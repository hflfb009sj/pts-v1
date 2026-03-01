import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username');
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
        const skip = (page - 1) * limit;

        const db = await getDb();
        const filter: any = {};
        if (username) filter.buyerUsername = username;
        if (status) filter.status = status.toUpperCase();

        const [total, data] = await Promise.all([
            db.collection('transactions').countDocuments(filter),
            db.collection('transactions')
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
        ]);

        return NextResponse.json({
            success: true,
            data: data.map((t: any) => ({
                ...t,
                id: `#TR-${t._id.toString().slice(-6).toUpperCase()}`,
                sellerWalletShort: t.sellerWallet
                    ? `${t.sellerWallet.substring(0, 4)}...${t.sellerWallet.slice(-4)}`
                    : '—',
            })),
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });

    } catch (error: any) {
        console.error('[Transactions]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
