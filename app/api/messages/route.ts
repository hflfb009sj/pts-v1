import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction, Message } from '@/lib/mongodb';
import { rateLimit, getRateLimitKey } from '@/lib/rateLimit';
export async function GET() {
  try {
    await connectDB();
    const messages=await Message.find().sort({createdAt:-1}).limit(60);
    return NextResponse.json({success:true,messages:messages.reverse()});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
export async function POST(req: NextRequest) {
  try {
    if(!rateLimit(getRateLimitKey(req,'message'),{windowMs:30_000,max:5}))
      return NextResponse.json({success:false,error:'Too many messages'},{status:429});
    const {username,text}=await req.json();
    if(!username||!text?.trim()) return NextResponse.json({success:false,error:'Missing fields'},{status:400});
    if(text.length>500) return NextResponse.json({success:false,error:'Message too long'},{status:400});
    await connectDB();
    const userTxs=await Transaction.find({$or:[{buyerUsername:username},{sellerUsername:username}]});
    const released=userTxs.filter((t:any)=>t.status==='RELEASED').length;
    const badge=released>=50?'💎':released>=25?'⭐':released>=10?'🤝':released>=1?'🌱':'';
    const message=await Message.create({username,text:text.trim(),badge,score:released});
    return NextResponse.json({success:true,message});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
