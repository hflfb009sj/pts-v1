import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
    }

    const res = await fetch('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid Pi token' }, { status: 401 });
    }

    const user = await res.json();
    return NextResponse.json({ 
      success: true, 
      user: { uid: user.uid, username: user.username } 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
