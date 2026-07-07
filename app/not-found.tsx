import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#F5C46C,#B8893E 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, opacity: 0.5 }}>
        <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 30, color: '#151310' }}>π</span>
      </div>
      <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 48, color: '#E8E4DC', margin: '0 0 8px' }}>404</h1>
      <p style={{ color: '#8A8378', fontSize: 14, marginBottom: 32 }}>This page doesn&apos;t exist on PTrust Oracle.</p>
      <Link href="/" style={{ background: 'linear-gradient(135deg,#F5C46C,#B8893E)', color: '#151310', fontWeight: 800, fontSize: 13, padding: '14px 28px', borderRadius: 16, textDecoration: 'none', display: 'inline-block' }}>
        Return to App
      </Link>
    </main>
  );
}
