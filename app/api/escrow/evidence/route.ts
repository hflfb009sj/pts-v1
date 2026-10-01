import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {escrowCode,username,content}=await req.json();
    if(!escrowCode||!username||!content) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(!['FROZEN','UNDER_REVIEW'].includes(tx.status)) return NextResponse.json({success:false,error:'No active dispute'},{status:400});
    if(![tx.buyerUsername,tx.sellerUsername].includes(username)) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    if(tx.evidenceDeadline&&new Date()>tx.evidenceDeadline) return NextResponse.json({success:false,error:'Evidence deadline has passed'},{status:400});
    if(tx.evidence&&tx.evidence.length>=10) return NextResponse.json({success:false,error:'Maximum evidence items reached'},{status:400});
    tx.evidence.push({username,content,submittedAt:new Date()});tx.status='UNDER_REVIEW';
    await tx.save();
    return NextResponse.json({success:true,message:'Evidence submitted'});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
