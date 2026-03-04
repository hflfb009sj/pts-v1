import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { approvePiPayment } from '@/lib/pi-server';
import { ORACLE_CONFIG } from '@/app/constants';

function generateCode(prefix: string, length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = prefix + '-';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sellerWallet, amount, fee, description, buyerUsername } = body;

    const paymentId = body.paymentId || 'escrow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    if (!sellerWallet?.trim()) return NextResponse.json({ success: false, error: 'sellerWallet is required' }, { status: 400 });
    if (!amount || amount < ORACLE_CONFIG.MIN_TRANSACTION) return NextResponse.json({ success: false, error: 'Minimum amount is ' + ORACLE_CONFIG.MIN_TRANSACTION + ' Pi' }, { status: 400 });
    if (amount > ORACLE_CONFIG.MAX_TRANSACTION) return NextResponse.json({ success: false, error: 'Maximum amount is ' + ORACLE_CONFIG.MAX_TRANSACTION + ' Pi' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const existing = await transactions.findOne({ paymentId });
    if (existing) return NextResponse.json({ success: true, transactionId: existing._id, escrowCode: existing.escrowCode, secretKey: existing.secretKey });

    if (!paymentId.startsWith('escrow_')) {
      await approvePiPayment(paymentId);
    }

    const escrowCode = generateCode('PTO');
    const secretKey = generateCode('SK');
    const now = new Date();
    const autoReleaseAt = new Date(now.getTime() + ORACLE_CONFIG.ESCROW_TIMEOUT_DAYS * 24 * 60 * 60 * 1000);

    const result = await transactions.insertOne({
      paymentId,
      escrowCode,
      secretKey,
      sellerWallet: sellerWallet.trim(),
      buyerUsername: buyerUsername || 'unknown',
      amount: parseFloat(amount),
      fee: parseFloat(fee) || 0,
      totalAmount: parseFloat(amount) + parseFloat(fee || 0),
      description: description || '',
      status: 'LOCKED',
      commissionWallet: ORACLE_CONFIG.COMMISSION_WALLET,
      createdAt: now,
      updatedAt: now,
      autoReleaseAt,
      txid: null,
    });

    return NextResponse.json({ success: true, transactionId: result.insertedId, paymentId, escrowCode, secretKey, status: 'LOCKED' });

  } catch (error: any) {
    console.error('[Approve]', error);
    return NextResponse.json({ success: false, error: error.message || 'Approval failed' }, { status: 500 });
  }
}