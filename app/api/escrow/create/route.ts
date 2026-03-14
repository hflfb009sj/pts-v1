import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hash } from 'bcryptjs';
import { generateEscrowCode, generateBuyerKey, generateSellerKey, generateTransactionNumber } from '@/lib/escrow-helpers';

async function approvePiPayment(paymentId: string) {
  const res = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.PI_API_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Pi approval failed: ${res.status}`);
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId, sellerWallet, amount, fee, description, buyerUsername } = await request.json();

    if (!paymentId)            throw new Error('paymentId is required');
    if (!sellerWallet?.trim()) throw new Error('Seller wallet is required');
    if (!buyerUsername?.trim())throw new Error('Buyer username is required');
    if (!amount || amount < 1) throw new Error('Minimum amount is 1 Pi');
    if (amount > 10000)        throw new Error('Maximum amount is 10,000 Pi');
    if (!sellerWallet.trim().startsWith('G') || sellerWallet.trim().length !== 56)
      throw new Error('Invalid seller wallet address');

    const db = await getDb();

    const blacklisted = await db.collection('blacklist').findOne({ wallet: sellerWallet.trim() });
    if (blacklisted) throw new Error('Seller wallet is blacklisted');

    await approvePiPayment(paymentId);

    let escrowCode = generateEscrowCode();
    let attempts = 0;
    while (await db.collection('transactions').findOne({ escrowCode }) && attempts < 10) {
      escrowCode = generateEscrowCode();
      attempts++;
    }

    const rawBuyerKey  = generateBuyerKey();
    const rawSellerKey = generateSellerKey();
    const hashedBuyerKey  = await hash(rawBuyerKey, 10);
    const hashedSellerKey = await hash(rawSellerKey, 10);
    const transactionNumber = await generateTransactionNumber(db);
    const now = new Date();

    await db.collection('transactions').insertOne({
      transactionNumber,
      escrowCode,
      buyerKey:  hashedBuyerKey,
      sellerKey: hashedSellerKey,
      paymentId,
      piPaymentCompleted: false,
      sellerWallet:  sellerWallet.trim(),
      buyerUsername: buyerUsername.trim(),
      sellerUsername: null,
      amount:      Number(amount),
      fee:         Number(fee) || Number(amount) / 100,
      description: description?.trim() || 'No description',
      status: 'PENDING',
      commissionWallet: process.env.PI_COMMISSION_WALLET,
      escrowWallet:     process.env.PI_ESCROW_WALLET,
      releaseAttempts:   0,
      buyerKeyAttempts:  0,
      sellerKeyAttempts: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      auditLog: [{ action: 'CREATED', by: buyerUsername.trim(), at: now, note: 'Escrow created' }],
    });

    return NextResponse.json({
      success: true,
      transactionNumber,
      escrowCode,
      buyerKey:  rawBuyerKey,
      sellerKey: rawSellerKey,
    });
  } catch (error: any) {
    console.error('[Create]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}