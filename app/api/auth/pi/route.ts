import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  try {
    const {uid,username,accessToken}=await req.json();
    if(!uid||!username) return NextResponse.json({success:false,error:'Missing fields'},{status:400});
    const r=await fetch('https://api.minepi.com/v2/me',{headers:{Authorization:`Bearer ${accessToken}`}});
    if(!r.ok) return NextResponse.json({success:false,error:'Token verification failed'},{status:401});
    const piUser=await r.json();
    if(piUser.uid!==uid) return NextResponse.json({success:false,error:'UID mismatch'},{status:401});
    return NextResponse.json({success:true,username:piUser.username});
  } catch { return NextResponse.json({success:false,error:'Internal server error'},{status:500}); }
}
