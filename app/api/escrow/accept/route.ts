import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {escrowCode,sellerUsername,sellerKey}=await req.json();
    if(!escrowCode||!sellerUsername||!sellerKey) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(tx.status!=='PENDING') return NextResponse.json({success:false,error:'Vault not in PENDING status'},{status:400});
    if(tx.sellerKey!==sellerKey) return NextResponse.json({success:false,error:'Invalid partner key'},{status:401});
    if(tx.buyerUsername===sellerUsername) return NextResponse.json({success:false,error:'Buyer cannot be the seller'},{status:400});
    tx.sellerUsername=sellerUsername;tx.status='ACCEPTED';tx.acceptedAt=new Date();
    await tx.save();
    return NextResponse.json({success:true,message:'Deal accepted successfully'});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
