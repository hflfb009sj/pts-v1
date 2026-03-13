import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;
let client: MongoClient;
let db: Db;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('ptrust_oracle');
  await db.collection('transactions').createIndex({ escrowCode: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ buyerUsername: 1 });
  await db.collection('transactions').createIndex({ sellerUsername: 1 });
  await db.collection('disputes').createIndex({ escrowCode: 1 }, { unique: true });
  await db.collection('judges').createIndex({ username: 1 }, { unique: true });
  return db;
}