import { NextRequest, NextResponse } from 'next/server';
import { connectDB, Transaction } from '@/lib/mongodb';
export async function POST(req: NextRequest) {
  try {
    const {paymentId,txid}=await req.json();
    if(!paymentId||!txid) return NextResponse.json({success:false,error:'Missing paymentId or txid'},{status:400});
    const r=await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`,{method:'POST',headers:{Authorization:`Key ${process.env.PI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({txid})});
    if(!r.ok) return NextResponse.json({success:false,error:'Payment completion failed'},{status:400});
    await connectDB();
    await Transaction.findOneAndUpdate({paymentId},{txid,status:'PENDING'});
    return NextResponse.json({success:true});
  } catch{return NextResponse.json({success:false,error:'Internal server error'},{status:500});}
}
