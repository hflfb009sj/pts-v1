import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { accessToken } = await req.json();
        if (!accessToken) throw new Error('accessToken required');

        const res = await fetch('https://api.minepi.com/v2/me', {
            headers: { Authorization: 'Bearer ' + accessToken },
        });

        if (!res.ok) throw new Error('Invalid Pi token');

        const piUser = await res.json();

        return NextResponse.json({
            success: true,
            user: {
                uid: piUser.uid,
                username: piUser.username,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 401 });
    }
}