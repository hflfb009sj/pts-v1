import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function GET(req: NextRequest) {
  try {
    if(req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)
      return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    await connectDB();
    const now=new Date();
    const toRelease=await Transaction.find({status:'DELIVERED',autoReleaseDate:{$lte:now}});
    let released=0;
    for(const tx of toRelease){tx.status='RELEASED';tx.releasedAt=now;tx.adminNote='Auto-released after 15 days';await tx.save();released++;}
    return NextResponse.json({success:true,released,message:`Auto-released ${released} vaults`});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
