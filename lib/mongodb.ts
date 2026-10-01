import mongoose from 'mongoose';
const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error('Please define MONGODB_URI');
interface MongooseCache { conn: typeof mongoose|null; promise: Promise<typeof mongoose>|null; }
declare global { var mongoose: MongooseCache|undefined; }
const cached: MongooseCache = global.mongoose || { conn:null, promise:null };
if (!global.mongoose) global.mongoose = cached;
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands:false, maxPoolSize:10, serverSelectionTimeoutMS:5000, socketTimeoutMS:45000 });
  }
  try { cached.conn = await cached.promise; } catch(e) { cached.promise=null; throw e; }
  return cached.conn;
}
const EvidenceSchema = new mongoose.Schema({ username:{type:String,required:true}, content:{type:String,required:true}, submittedAt:{type:Date,default:Date.now} });
const TransactionSchema = new mongoose.Schema({
  transactionNumber: {type:String,required:true,unique:true,index:true},
  escrowCode:        {type:String,required:true,unique:true,index:true},
  buyerKey:          {type:String,required:true},
  sellerKey:         {type:String,required:true},
  sellerWallet:      {type:String,required:true},
  buyerUsername:     {type:String,required:true,index:true},
  sellerUsername:    {type:String,index:true},
  amount:            {type:Number,required:true,min:0},
  fee:               {type:Number,required:true,min:0},
  description:       {type:String,default:'No description'},
  status:            {type:String,enum:['PENDING','ACCEPTED','DELIVERED','FROZEN','UNDER_REVIEW','RELEASED','REFUNDED','PENDING_ADMIN','EXPIRED'],default:'PENDING',index:true},
  paymentId:         {type:String},
  txid:              {type:String},
  rating:            {type:Number,min:1,max:5},
  raterUsername:     {type:String},
  evidence:          [EvidenceSchema],
  kycVerified:       {type:Boolean,default:false},
  adminNote:         {type:String},
  evidenceDeadline:  {type:Date},
  autoReleaseDate:   {type:Date},
  acceptedAt:        {type:Date},
  deliveredAt:       {type:Date},
  frozenAt:          {type:Date},
  releasedAt:        {type:Date},
},{timestamps:true,collection:'transactions'});
TransactionSchema.index({buyerUsername:1,status:1});
TransactionSchema.index({sellerUsername:1,status:1});
TransactionSchema.index({createdAt:-1});
const MessageSchema = new mongoose.Schema({
  username: {type:String,required:true,index:true},
  text:     {type:String,required:true,maxlength:500},
  badge:    {type:String},
  score:    {type:Number,default:0},
  pinned:   {type:Boolean,default:false},
},{timestamps:true,collection:'messages'});
MessageSchema.index({createdAt:-1});
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
export const Message     = mongoose.models.Message     || mongoose.model('Message',     MessageSchema);
export function generateTransactionNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random()*100000).toString().padStart(5,'0');
  return `ORACLE-${year}-${rand}`;
}
export function generateEscrowCode(): string {
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code='PTO-';
  for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
export function generateKey(prefix: string): string {
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key=`${prefix}-`;
  for(let i=0;i<16;i++) key+=chars[Math.floor(Math.random()*chars.length)];
  return key;
}
