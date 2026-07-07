import { NextRequest, NextResponse } from 'next/server';

// Rate limiting store (in-memory — resets on redeploy, sufficient for Pi Browser)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;        // max requests
const RATE_WINDOW = 60_000;   // per 60 seconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { accessToken } = body;

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'accessToken is required' },
        { status: 400 }
      );
    }

    // Verify with Pi Network server
    const piRes = await fetch('https://api.minepi.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!piRes.ok) {
      const errText = await piRes.text();
      console.error('[PTrust Auth] Pi verification failed:', piRes.status, errText);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired Pi access token' },
        { status: 401 }
      );
    }

    const piUser = await piRes.json();

    if (!piUser?.uid || !piUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Invalid Pi user data received' },
        { status: 401 }
      );
    }

    console.log('[PTrust Auth] Verified user:', piUser.username);

    return NextResponse.json({
      success: true,
      user: {
        uid:      piUser.uid,
        username: piUser.username,
      },
    });
  } catch (error: any) {
    console.error('[PTrust Auth] Server error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable' },
      { status: 503 }
    );
  }
}
