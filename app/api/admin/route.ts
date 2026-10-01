import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
const ADMIN='GhaithriAHI96';
export async function POST(req: NextRequest) {
  try {
    const {action,username,escrowCode,reason,resolveFor}=await req.json();
    if(username!==ADMIN) return NextResponse.json({success:false,error:'Unauthorized'},{status:403});
    if(action==='getAll'){
      await connectDB();
      const transactions=await Transaction.find().sort({createdAt:-1}).limit(500);
      const stats={
        total:    await Transaction.countDocuments(),
        pending:  await Transaction.countDocuments({status:'PENDING'}),
        accepted: await Transaction.countDocuments({status:'ACCEPTED'}),
        delivered:await Transaction.countDocuments({status:'DELIVERED'}),
        frozen:   await Transaction.countDocuments({status:'FROZEN'}),
        released: await Transaction.countDocuments({status:'RELEASED'}),
        refunded: await Transaction.countDocuments({status:'REFUNDED'}),
        review:   await Transaction.countDocuments({status:'UNDER_REVIEW'}),
      };
      return NextResponse.json({success:true,transactions,stats});
    }
    await connectDB();
    const tx=await Transaction.findOne({escrowCode:escrowCode?.toUpperCase()});
    if(!tx) return NextResponse.json({success:false,error:'Vault not found'},{status:404});
    if(action==='freeze'){tx.status='FROZEN';tx.frozenAt=new Date();tx.adminNote=reason||'Frozen by admin';}
    else if(action==='refund'){tx.status='REFUNDED';tx.adminNote=reason||'Refunded by admin';}
    else if(action==='resolve'){tx.status='RELEASED';tx.releasedAt=new Date();tx.adminNote=`Resolved for ${resolveFor} — ${reason||''}`;}
    else return NextResponse.json({success:false,error:'Unknown action'},{status:400});
    await tx.save();
    return NextResponse.json({success:true,message:`Action "${action}" applied`});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
