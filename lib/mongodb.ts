import { MongoClient, Db, MongoClientOptions } from 'mongodb';

/**
 * MONGODB_URI: The connection string from your .env.local file.
 * Ensure this variable is also added to Vercel Environment Variables.
 */
const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global caching to prevent multiple connections in serverless environments (Vercel).
 */
interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = global as typeof globalThis & GlobalWithMongo;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const options: MongoClientOptions = {};

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(MONGODB_URI, options);
  clientPromise = client.connect();
}

/**
 * Main function to connect to the database and initialize indexes.
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const connectedClient = await clientPromise;
  const db = connectedClient.db();

  // Optimized Indexing for PTrust Oracle transactions
  try {
    await db.collection('transactions').createIndexes([
      { key: { paymentId: 1 }, unique: true },
      { key: { buyerUsername: 1 } },
      { key: { sellerWallet: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ]);
  } catch (indexError) {
    console.warn('Indexing warning (can be ignored if already exists):', indexError);
  }

  return { client: connectedClient, db };
}

/**
 * Helper function to quickly get the database instance.
 */
export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export default clientPromise;