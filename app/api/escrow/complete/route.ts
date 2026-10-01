import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {escrowCode,sellerUsername}=await req.json();
    if(!escrowCode||!sellerUsername) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(tx.sellerUsername!==sellerUsername) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if(tx.status!=='ACCEPTED') return NextResponse.json({success:false,error:'Deal must be ACCEPTED first'},{status:400});
    tx.status='DELIVERED';tx.deliveredAt=new Date();
    tx.autoReleaseDate=new Date(Date.now()+15*24*60*60*1000);
    await tx.save();
    return NextResponse.json({success:true,message:'Delivery confirmed'});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
