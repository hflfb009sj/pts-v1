import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
import { rateLimit, getRateLimitKey } from '@/lib/rateLimit';
export async function POST(req: NextRequest) {
  try {
    if(!rateLimit(getRateLimitKey(req,'release'),{windowMs:60_000,max:3}))
      return NextResponse.json({success:false,error:'Too many requests'},{status:429});
    const {escrowCode,buyerKey,confirmText,buyerUsername}=await req.json();
    if(!escrowCode||!buyerKey||!confirmText||!buyerUsername) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    if(confirmText!=='CONFIRM') return NextResponse.json({success:false,error:'Please type CONFIRM to proceed'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(tx.buyerUsername!==buyerUsername) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if(tx.buyerKey!==buyerKey) return NextResponse.json({success:false,error:'Invalid vault key'},{status:401});
    if(!['ACCEPTED','DELIVERED'].includes(tx.status)) return NextResponse.json({success:false,error:'Cannot release in current status'},{status:400});
    tx.status='RELEASED';tx.releasedAt=new Date();
    await tx.save();
    return NextResponse.json({success:true,message:'Funds released to seller'});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
