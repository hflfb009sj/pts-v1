import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
    try {
        const { pi_auth_token, app_id } = await request.json();
        if (!pi_auth_token) return NextResponse.json({ success: false, error: 'pi_auth_token is required' }, { status: 400 });

        const piResponse = await fetch('https://api.minepi.com/v2/me', {
            headers: { Authorization: `Bearer ${pi_auth_token}` },
        });

        if (!piResponse.ok) return NextResponse.json({ success: false, error: 'Invalid Pi access token' }, { status: 401 });

        const piUser = await piResponse.json();
        const db = await getDb();

        await db.collection('users').updateOne(
            { piUid: piUser.uid },
            {
                $set: { piUid: piUser.uid, username: piUser.username, lastLoginAt: new Date(), lastPreviewAppId: app_id || null, updatedAt: new Date() },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true }
        );

        return NextResponse.json({ success: true, user: { uid: piUser.uid, username: piUser.username }, source: 'preview' });

    } catch (error: any) {
        console.error('[Auth Login Preview]', error);
        return NextResponse.json({ success: false, error: error.message || 'Preview login failed' }, { status: 500 });
    }
}
