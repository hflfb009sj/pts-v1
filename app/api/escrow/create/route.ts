import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction, generateTransactionNumber, generateEscrowCode, generateKey } from '@/lib/mongodb';
import { rateLimit, getRateLimitKey } from '@/lib/rateLimit';
export async function POST(req: NextRequest) {
  try {
    if(!rateLimit(getRateLimitKey(req,'create'),{windowMs:60_000,max:5}))
      return NextResponse.json({success:false,error:'Too many requests. Please wait a minute.'},{status:429});
    const {paymentId,sellerWallet,amount,fee,description,buyerUsername}=await req.json();
    if(!paymentId||!sellerWallet||!amount||!buyerUsername)
      return NextResponse.json({success:false,error:'Missing required fields'},{status:400});
    if(typeof amount!=='number'||amount<=0)
      return NextResponse.json({success:false,error:'Invalid amount'},{status:400});
    await connectDB();
    const piRes=await fetch(`https://api.minepi.com/v2/payments/${paymentId}`,{headers:{Authorization:`Key ${process.env.PI_API_KEY}`}});
    if(!piRes.ok) return NextResponse.json({success:false,error:'Payment verification failed'},{status:400});
    const approveRes=await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`,{method:'POST',headers:{Authorization:`Key ${process.env.PI_API_KEY}`}});
    if(!approveRes.ok) return NextResponse.json({success:false,error:'Payment approval failed'},{status:400});
    let transactionNumber=generateTransactionNumber(),escrowCode=generateEscrowCode(),attempts=0;
    while(attempts<10){const ex=await Transaction.findOne({$or:[{transactionNumber},{escrowCode}]});if(!ex)break;transactionNumber=generateTransactionNumber();escrowCode=generateEscrowCode();attempts++;}
    const buyerKey=generateKey('BK'),sellerKey=generateKey('SK');
    const calculatedFee=amount*0.0001;
    const autoReleaseDate=new Date(Date.now()+15*24*60*60*1000);
    const tx=await Transaction.create({transactionNumber,escrowCode,buyerKey,sellerKey,sellerWallet,buyerUsername,amount,fee:calculatedFee,description:description||'No description',status:'PENDING',paymentId,autoReleaseDate});
    return NextResponse.json({success:true,transactionNumber:tx.transactionNumber,escrowCode:tx.escrowCode,buyerKey,sellerKey});
  } catch(e:any){console.error('Create error:',e);return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
