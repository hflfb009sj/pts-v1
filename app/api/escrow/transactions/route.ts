import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function GET(req: NextRequest) {
  try {
    const {searchParams}=new URL(req.url);
    const username=searchParams.get('username');
    if(!username) return NextResponse.json({success:false,error:'Username required'},{status:400});
    await connectDB();
    const transactions=await Transaction.find({$or:[{buyerUsername:username},{sellerUsername:username}]}).sort({createdAt:-1}).limit(100);
    return NextResponse.json({success:true,transactions});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
