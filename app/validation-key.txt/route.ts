import { NextResponse } from 'next/server';

/**
 * Pi Network Domain Verification
 * Target Domain: https://ptrustoracle4305.pinet.com
 */

export const dynamic = 'force-dynamic';

export async function GET() {
    const VALIDATION_KEY = "79899dd024662a17e8a1b4cfc7e1f14351e258968353621e7c7f7a49687184519072e9d0e7888f3715fd3e9db6133ba48c224cc9f58fac07c83607236ef9ad59";

    return new NextResponse(VALIDATION_KEY, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store, max-age=0',
        },
    });
}