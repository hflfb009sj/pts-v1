import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
    try {
        const db = await getDb();
        const transactions = db.collection('transactions');

        const [totalResult, statusCounts, recentTransactions, disputeCount] = await Promise.all([
            transactions.aggregate([
                { $match: { status: { $in: ['LOCKED', 'RELEASED', 'DISPUTED'] } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]).toArray(),
            transactions.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]).toArray(),
            transactions
                .find({}, { projection: { paymentId: 1, sellerWallet: 1, amount: 1, status: 1, createdAt: 1 } })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray(),
            db.collection('disputes').countDocuments({ status: 'OPEN' }),
        ]);

        const totalPi = totalResult[0]?.total || 0;
        const totalTransactions = totalResult[0]?.count || 0;
        const statusMap: Record<string, number> = {};
        statusCounts.forEach((s: any) => { statusMap[s._id] = s.count; });

        const disputeRate = totalTransactions > 0
            ? ((disputeCount / totalTransactions) * 100).toFixed(2)
            : '0.00';

        return NextResponse.json({
            success: true,
            data: {
                totalPiProtected: totalPi,
                totalTransactions,
                activeEscrows: statusMap['LOCKED'] || 0,
                releasedTransactions: statusMap['RELEASED'] || 0,
                disputeRatePercent: disputeRate,
                openDisputes: disputeCount,
                recentTransactions: recentTransactions.map((t: any) => ({
                    id: `#TR-${t._id.toString().slice(-6).toUpperCase()}`,
                    paymentId: t.paymentId,
                    sellerWallet: t.sellerWallet
                        ? `${t.sellerWallet.substring(0, 4)}...${t.sellerWallet.slice(-4)}`
                        : '—',
                    amount: t.amount,
                    status: t.status,
                    createdAt: t.createdAt,
                })),
            },
        });

    } catch (error: any) {
        console.error('[Stats]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
