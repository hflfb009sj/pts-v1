const map = new Map<string,{count:number;resetAt:number}>();
export function rateLimit(key:string,options:{windowMs?:number;max?:number}={}): boolean {
  const {windowMs=60_000,max=10}=options;
  const now=Date.now();
  const entry=map.get(key);
  if(!entry||now>entry.resetAt){map.set(key,{count:1,resetAt:now+windowMs});return true;}
  if(entry.count>=max) return false;
  entry.count++;
  return true;
}
export function getRateLimitKey(req:Request,action:string): string {
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  return `${action}:${ip}`;
}
