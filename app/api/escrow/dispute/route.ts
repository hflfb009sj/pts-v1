import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {escrowCode,buyerUsername,reason}=await req.json();
    if(!escrowCode||!buyerUsername||!reason) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(tx.buyerUsername!==buyerUsername) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if(!['ACCEPTED','DELIVERED'].includes(tx.status)) return NextResponse.json({success:false,error:'Cannot dispute in current status'},{status:400});
    const evidenceDeadline=new Date(Date.now()+15*24*60*60*1000);
    tx.status='FROZEN';tx.frozenAt=new Date();tx.evidenceDeadline=evidenceDeadline;
    tx.adminNote=`Dispute: ${reason}`;
    await tx.save();
    return NextResponse.json({success:true,message:'Dispute opened',evidenceDeadline});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
