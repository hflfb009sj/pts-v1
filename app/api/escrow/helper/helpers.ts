// lib/rateLimit.ts — shared rate limiter for all API routes

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  key: string,
  limit: number = 20,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

export function getIp(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}
