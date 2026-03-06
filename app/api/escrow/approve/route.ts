import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { approvePiPayment } from '@/lib/pi-server';
import { ORACLE_CONFIG } from '@/app/constants';
import { hash } from 'bcryptjs';

async function generateTransactionNumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.collection('transactions').countDocuments();
  const number = String(count + 1).padStart(5, '0');
  return 'ORACLE-GHAITH' + year + '-' + number;
}

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

    if (!sellerWallet?.trim()) return NextResponse.json({ success: false, error: 'Seller wallet is required' }, { status: 400 });
    if (!buyerUsername?.trim()) return NextResponse.json({ success: false, error: 'Buyer username is required' }, { status: 400 });
    if (!amount || amount < ORACLE_CONFIG.MIN_TRANSACTION) return NextResponse.json({ success: false, error: 'Minimum amount is ' + ORACLE_CONFIG.MIN_TRANSACTION + ' Pi' }, { status: 400 });
    if (amount > ORACLE_CONFIG.MAX_TRANSACTION) return NextResponse.json({ success: false, error: 'Maximum amount is ' + ORACLE_CONFIG.MAX_TRANSACTION + ' Pi' }, { status: 400 });

    const db = await getDb();
    const transactions = db.collection('transactions');

    const blacklisted = await db.collection('blacklist').findOne({ wallet: sellerWallet.trim() });
    if (blacklisted) return NextResponse.json({ success: false, error: 'This wallet is restricted' }, { status: 403 });

    const existing = await transactions.findOne({ paymentId });
    if (existing) return NextResponse.json({ success: true, transactionId: existing._id, escrowCode: existing.escrowCode, transactionNumber: existing.transactionNumber });

    if (!paymentId.startsWith('escrow_')) {
      await approvePiPayment(paymentId);
    }

    const escrowCode = generateCode('PTO');
    const rawSecretKey = generateCode('SK');
    const hashedSecretKey = await hash(rawSecretKey, 10);
    const transactionNumber = await generateTransactionNumber(db);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await transactions.insertOne({
      paymentId,
      transactionNumber,
      escrowCode,
      secretKey: hashedSecretKey,
      sellerWallet: sellerWallet.trim(),
      buyerUsername,
      amount: parseFloat(amount),
      fee: parseFloat(fee) || 0,
      totalAmount: parseFloat(amount) + parseFloat(fee || 0),
      description: description || '',
      status: 'PENDING',
      commissionWallet: ORACLE_CONFIG.COMMISSION_WALLET,
      releaseAttempts: 0,
      rating: null,
      auditLog: [{
        action: 'CREATED',
        by: buyerUsername,
        at: now,
        note: 'Escrow created by buyer'
      }],
      createdAt: now,
      updatedAt: now,
      expiresAt,
      acceptedAt: null,
      deliveredAt: null,
      releasedAt: null,
      disputedAt: null,
    });

    return NextResponse.json({
      success: true,
      transactionNumber,
      escrowCode,
      secretKey: rawSecretKey,
      status: 'PENDING'
    });

  } catch (error: any) {
    console.error('[Approve]', error);
    return NextResponse.json({ success: false, error: error.message || 'Approval failed' }, { status: 500 });
  }
}