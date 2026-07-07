export default function Loading() {
  return (
    <main style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#F5C46C,#B8893E 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 26, color: '#151310' }}>π</span>
      </div>
      <div style={{ width: 28, height: 28, border: '2px solid #F5C46C', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
