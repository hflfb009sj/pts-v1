import { Db } from 'mongodb';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

export function generateEscrowCode(): string {
  return 'PTO-' + randomChars(6);
}

export function generateBuyerKey(): string {
  return 'BK-' + randomChars(8);
}

export function generateSellerKey(): string {
  return 'SK-' + randomChars(8);
}

export async function generateTransactionNumber(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: 'txn' as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = String(result?.seq ?? 1).padStart(5, '0');
  return 'ORACLE-GHAITH' + year + '-' + seq;
}

export async function pickRandomJudges(db: Db, exclude: string[]): Promise<string[]> {
  const list = await db.collection('judges')
    .find({ isActive: true, username: { $nin: exclude } })
    .toArray();
  if (list.length < 3) throw new Error('Not enough active judges');
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, 3).map((j: any) => j.username);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
