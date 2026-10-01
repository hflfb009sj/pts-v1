import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {escrowCode,rating,raterUsername}=await req.json();
    if(!escrowCode||!rating||!raterUsername) return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    if(rating<1||rating>5) return NextResponse.json({success:false,error:'Rating must be 1-5'},{status:400});
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(tx.status!=='RELEASED') return NextResponse.json({success:false,error:'Can only rate completed deals'},{status:400});
    if(tx.rating) return NextResponse.json({success:false,error:'Already rated'},{status:400});
    if(![tx.buyerUsername,tx.sellerUsername].includes(raterUsername)) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    tx.rating=rating;tx.raterUsername=raterUsername;await tx.save();
    return NextResponse.json({success:true,message:'Rating submitted'});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
