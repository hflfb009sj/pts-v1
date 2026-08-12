'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePiSDK } from '@/components/PiSDKProvider';

interface PiUser { uid: string; username: string; }

type TxStatus = 'PENDING'|'ACCEPTED'|'DELIVERED'|'FROZEN'|'UNDER_REVIEW'|'RELEASED'|'REFUNDED'|'PENDING_ADMIN'|'EXPIRED';

interface Transaction {
  _id: string; transactionNumber: string; escrowCode: string; sellerWallet: string;
  buyerUsername: string; sellerUsername?: string; amount: number; fee: number;
  description: string; status: TxStatus; createdAt: string;
  deliveredAt?: string; releasedAt?: string; rating?: number;
}

interface EscrowResult { transactionNumber: string; escrowCode: string; buyerKey: string; sellerKey: string; }

const C = {
  bg:'#080706', card:'#131110', card2:'#1A1816',
  gold:'#F5C46C', goldD:'#B8893E', goldL:'#FFD97A',
  sage:'#5C8374', terra:'#C44536', sky:'#6FA8C9', violet:'#9B8AC4',
  muted:'#8A8378', text:'#E8E4DC', border:'rgba(245,196,108,0.10)',
} as const;

const STATUS_META: Record<TxStatus,{color:string;bg:string;label:string}> = {
  PENDING:      {color:'#F5C46C',bg:'rgba(245,196,108,0.08)',label:'Pending'},
  ACCEPTED:     {color:'#6FA8C9',bg:'rgba(111,168,201,0.08)',label:'Accepted'},
  DELIVERED:    {color:'#5C8374',bg:'rgba(92,131,116,0.08)', label:'Delivered'},
  FROZEN:       {color:'#6FA8C9',bg:'rgba(111,168,201,0.08)',label:'Frozen'},
  UNDER_REVIEW: {color:'#9B8AC4',bg:'rgba(155,138,196,0.08)',label:'Under Review'},
  RELEASED:     {color:'#5C8374',bg:'rgba(92,131,116,0.08)', label:'Released'},
  REFUNDED:     {color:'#6FA8C9',bg:'rgba(111,168,201,0.08)',label:'Refunded'},
  PENDING_ADMIN:{color:'#C44536',bg:'rgba(196,69,54,0.08)',  label:'Admin Review'},
  EXPIRED:      {color:'#8A8378',bg:'rgba(138,131,120,0.08)',label:'Expired'},
};

async function api(url:string,body?:object):Promise<any> {
  const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{method:'GET'});
  const d=await r.json(); if(!d.success) throw new Error(d.error||'Request failed'); return d;
}

function trustScore(txs:Transaction[]) {
  let score=50;
  const released=txs.filter(t=>t.status==='RELEASED').length;
  const disputed=txs.filter(t=>['FROZEN','UNDER_REVIEW','PENDING_ADMIN'].includes(t.status)).length;
  const refunded=txs.filter(t=>t.status==='REFUNDED').length;
  const ratings=txs.filter(t=>t.rating).map(t=>t.rating as number);
  const avg=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
  if(released>=1) score+=10; if(released>=5) score+=10; if(released>=20) score+=10;
  if(avg>=4.5) score+=10; else if(avg>=3) score+=5;
  score-=disputed*10; score-=refunded*5;
  score=Math.max(0,Math.min(100,score));
  const level=score>=71?'High Trust':score>=41?'Medium Trust':'Low Trust';
  const color=score>=71?C.sage:score>=41?C.gold:C.terra;
  return {score,level,color,disputed};
}

function useOnline() {
  const [on,setOn]=useState(true);
  useEffect(()=>{
    const y=()=>setOn(true),n=()=>setOn(false);
    window.addEventListener('online',y); window.addEventListener('offline',n);
    setOn(navigator.onLine);
    return()=>{window.removeEventListener('online',y);window.removeEventListener('offline',n);};
  },[]);
  return on;
}

const GLOBAL_CSS=`
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
*{-webkit-tap-highlight-color:transparent}
button:active{transform:scale(0.97)}
`;

function Seal({size=36}:{size?:number}) {
  return <div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,background:`radial-gradient(circle at 32% 28%,${C.goldL},${C.goldD} 70%)`,boxShadow:`0 0 0 1px rgba(255,220,120,.25),0 3px 14px rgba(245,196,108,.40),inset 0 1px 3px rgba(255,255,255,.35)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:size*.38,color:'#1A0E00'}}>π</div>;
}

function Spinner({color=C.gold}:{color?:string}) {
  return <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${color}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',flexShrink:0}} />;
}

function Badge({status}:{status:TxStatus}) {
  const m=STATUS_META[status];
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',padding:'3px 8px',borderRadius:999,background:m.bg,color:m.color,border:`1px solid ${m.color}22`}}><span style={{width:4,height:4,borderRadius:'50%',background:m.color,display:'inline-block'}}/>{m.label}</span>;
}

function ErrBox({msg}:{msg:string}) {
  return <div style={{display:'flex',gap:8,padding:'12px 14px',borderRadius:14,fontSize:11,lineHeight:1.6,background:'rgba(196,69,54,.08)',color:C.terra,border:`1px solid rgba(196,69,54,.25)`}}>⚠️ {msg}</div>;
}

function OkBox({msg}:{msg:string}) {
  return <div style={{display:'flex',gap:8,padding:'12px 14px',borderRadius:14,fontSize:11,lineHeight:1.6,background:'rgba(92,131,116,.08)',color:C.sage,border:`1px solid rgba(92,131,116,.25)`}}>✓ {msg}</div>;
}

function InfoBox({msg,type='gold'}:{msg:string;type?:'gold'|'sky'|'terra'}) {
  const col=type==='gold'?C.gold:type==='sky'?C.sky:C.terra;
  return <div style={{display:'flex',gap:8,padding:'10px 13px',borderRadius:13,fontSize:11,lineHeight:1.6,background:`${col}0d`,color:col,border:`1px solid ${col}22`}}>ℹ️ {msg}</div>;
}

function GlassCard({children,style,glow}:{children:React.ReactNode;style?:React.CSSProperties;glow?:boolean}) {
  return <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${glow?'rgba(245,196,108,.22)':'rgba(245,196,108,.09)'}`,borderRadius:22,padding:18,backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',boxShadow:glow?`0 0 0 1px rgba(245,196,108,.06),0 8px 32px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.05)`:`inset 0 1px 1px rgba(255,255,255,.03)`,animation:'fadeIn .25s ease',...style}}>{children}</div>;
}

function PBtn({children,onClick,disabled,variant='gold',type='button'}:{children:React.ReactNode;onClick?:()=>void;disabled?:boolean;variant?:'gold'|'sage'|'terra'|'ghost';type?:'button'|'submit'}) {
  const s:Record<string,React.CSSProperties>={
    gold:{background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',boxShadow:`0 6px 24px rgba(245,196,108,.28),inset 0 1px 1px rgba(255,255,255,.25)`},
    sage:{background:`rgba(92,131,116,.12)`,color:C.sage,border:`1px solid rgba(92,131,116,.28)`},
    terra:{background:`rgba(196,69,54,.09)`,color:C.terra,border:`1px solid rgba(196,69,54,.24)`},
    ghost:{background:`rgba(255,255,255,.04)`,color:C.text,border:`1px solid rgba(245,196,108,.10)`},
  };
  return <button type={type} disabled={disabled} onClick={onClick} style={{width:'100%',padding:'14px 18px',fontWeight:800,fontSize:13,borderRadius:16,border:'none',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.35:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all .2s',letterSpacing:'.02em',...s[variant]}}>{children}</button>;
}

function Inp({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}) {
  return <div style={{display:'flex',flexDirection:'column',gap:6}}><div style={{display:'flex',justifyContent:'space-between',paddingInline:2}}><span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.18em',color:'rgba(245,196,108,.65)'}}>{label}</span>{hint&&<span style={{fontSize:9,color:C.muted}}>{hint}</span>}</div>{children}</div>;
}

const inpStyle:React.CSSProperties={width:'100%',background:'rgba(255,255,255,.04)',border:`1px solid rgba(245,196,108,.10)`,borderRadius:14,padding:'13px 16px',fontSize:13,color:C.text,outline:'none',boxShadow:'inset 0 1px 2px rgba(0,0,0,.3)'};

function Stars({value,onRate}:{value?:number;onRate?:(n:number)=>void}) {
  const [hov,setHov]=useState(0); const [sel,setSel]=useState(value||0);
  return <div style={{display:'flex',gap:8}}>{[1,2,3,4,5].map(n=><button key={n} type="button" disabled={!onRate} onMouseEnter={()=>onRate&&setHov(n)} onMouseLeave={()=>onRate&&setHov(0)} onClick={()=>{if(onRate){setSel(n);onRate(n);}}} style={{background:'none',border:'none',cursor:onRate?'pointer':'default',padding:0,fontSize:22,color:n<=(hov||sel)?C.gold:'#2A2520',transition:'color .15s'}}>★</button>)}</div>;
}

function DealTracker({status}:{status:TxStatus}) {
  const steps=['Created','Accepted','Delivered','Released'];
  const idx=status==='PENDING'?0:status==='ACCEPTED'?1:status==='DELIVERED'?2:status==='RELEASED'?3:0;
  return <div style={{background:'rgba(255,255,255,.03)',border:`1px solid rgba(245,196,108,.08)`,borderRadius:16,padding:'12px 14px',backdropFilter:'blur(8px)'}}><div style={{display:'flex',alignItems:'center'}}>{steps.map((s,i)=><React.Fragment key={s}><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}><div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,background:i<idx?`linear-gradient(135deg,${C.sage},#3D6B5E)`:i===idx?`linear-gradient(135deg,${C.goldL},${C.goldD})`:'rgba(255,255,255,.04)',color:i<idx?'#fff':i===idx?'#1A0E00':C.muted,boxShadow:i===idx?`0 0 0 3px rgba(245,196,108,.18),0 2px 8px rgba(245,196,108,.30)`:i<idx?`0 2px 8px rgba(92,131,116,.30)`:'none',border:i>idx?`1px solid rgba(255,255,255,.06)`:'none'}}>{i<idx?'✓':i+1}</div><span style={{fontSize:8,fontWeight:700,color:i===idx?C.gold:i<idx?C.sage:C.muted}}>{s}</span></div>{i<3&&<div style={{flex:1,height:2,borderRadius:99,margin:'0 4px 16px',background:i<idx?`linear-gradient(90deg,${C.sage},#3D6B5E)`:'rgba(255,255,255,.06)'}}/>}</React.Fragment>)}</div></div>;
}

const HOW_STEPS=[
  {n:'01',who:'Buyer', color:C.gold,  title:'Create Escrow',     body:'Buyer pays via Pi Browser. Gets Buyer Key (private) + Seller Key (to share).'},
  {n:'02',who:'Seller',color:C.sky,   title:'Accept Deal',       body:'Seller enters Escrow Code + Seller Key. Funds stay locked.'},
  {n:'03',who:'Seller',color:C.sky,   title:'Confirm Delivery',  body:'Seller delivers goods/service then confirms.'},
  {n:'04',who:'Buyer', color:C.sage,  title:'Release or Dispute',body:'"Received" + Buyer Key → funds released. "Not Received" → dispute opens.'},
  {n:'05',who:'System',color:C.violet,title:'Auto-Resolution',   body:'15 days silence = auto-release. Disputes resolved by admin.'},
];
const FAQS=[
  {q:'Are my funds safe?',                 a:'Yes. Funds live on Pi blockchain. Nobody can move them without your Buyer Key.'},
  {q:'What is the 0.1% fee?',              a:'A small platform fee for operating the escrow service securely.'},
  {q:'What if I lose my Buyer Key?',       a:'The key is shown once. Save it immediately. Contact support if lost.'},
  {q:'What if the seller never delivers?', a:'Open a dispute. Admin reviews evidence and decides within 15 days.'},
  {q:'Does PTrust work without Pi Browser?',a:'No. Pi SDK requires Pi Browser to authenticate and process payments.'},
];

function FaqItem({q,a}:{q:string;a:string}) {
  const [open,setOpen]=useState(false);
  return <div style={{background:'rgba(255,255,255,.03)',border:`1px solid ${open?'rgba(245,196,108,.18)':'rgba(245,196,108,.08)'}`,borderRadius:16,overflow:'hidden',transition:'border-color .2s'}}><button onClick={()=>setOpen(!open)} type="button" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:16,background:'none',border:'none',cursor:'pointer',textAlign:'left',gap:12}}><span style={{fontSize:12,fontWeight:700,color:C.text,lineHeight:1.4}}>{q}</span><span style={{width:24,height:24,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,background:open?`rgba(245,196,108,.15)`:'rgba(255,255,255,.04)',color:open?C.gold:C.muted,transform:open?'rotate(45deg)':'none',transition:'all .2s'}}>+</span></button>{open&&<div style={{padding:'0 16px 16px',fontSize:11,color:C.muted,lineHeight:1.7,borderTop:`1px solid rgba(245,196,108,.08)`,paddingTop:12}}>{a}</div>}</div>;
}

function Landing({onLogin,loading}:{onLogin:()=>void;loading:boolean}) {
  const [piPrice,setPiPrice]=useState<number|null>(null);
  const [priceLoad,setPriceLoad]=useState(true);
  const [section,setSection]=useState<string|null>(null);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try {
        const r=await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const d=await r.json();
        const t=d?.result?.PIUSD??d?.result?.['PI/USD'];
        const p=t?parseFloat(t.c[0]):NaN;
        if(!cancelled&&!isNaN(p)){setPiPrice(p);setPriceLoad(false);return;}
        throw new Error('no price');
      } catch {
        try {
          const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
          const d=await r.json();
          if(!cancelled) setPiPrice(d?.['pi-network']?.usd||null);
        } catch {if(!cancelled) setPiPrice(null);}
        if(!cancelled) setPriceLoad(false);
      }
    })();
    const iv=setInterval(async()=>{
      try {
        const r=await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const d=await r.json();
        const t=d?.result?.PIUSD??d?.result?.['PI/USD'];
        const p=t?parseFloat(t.c[0]):NaN;
        if(!isNaN(p)) setPiPrice(p);
      } catch {}
    },60000);
    return()=>{cancelled=true;clearInterval(iv);};
  },[]);

  return (
    <main style={{minHeight:'100vh',background:`radial-gradient(ellipse 400px 300px at 50% -60px,rgba(245,196,108,.07),transparent),radial-gradient(ellipse 600px 400px at 50% 100%,rgba(92,131,116,.04),transparent),${C.bg}`,color:C.text}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{position:'fixed',inset:0,backgroundImage:`linear-gradient(rgba(245,196,108,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(245,196,108,.02) 1px,transparent 1px)`,backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:420,margin:'0 auto',padding:'0 20px 80px',position:'relative',zIndex:1}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:64,paddingBottom:36,gap:20,animation:'fadeIn .5s ease'}}>
          <div style={{position:'relative'}}><Seal size={80}/><div style={{position:'absolute',inset:-8,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,196,108,.12),transparent 70%)',animation:'pulse 3s infinite'}}/></div>
          <div>
            <h1 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:72,lineHeight:1,letterSpacing:'-0.03em',margin:0}}>P<span style={{color:C.gold}}>TRUST</span></h1>
            <p style={{fontSize:10,letterSpacing:'.45em',textTransform:'uppercase',color:C.muted,marginTop:8}}>Oracle · Escrow Protocol</p>
          </div>
          <p style={{fontSize:14,lineHeight:1.7,color:'#C8C0B4',maxWidth:280,margin:0}}>Secure Pi Network escrow — lock funds, verify delivery, release with confidence.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,width:'100%'}}>
            {[{v:'0%',l:'Fraud Rate'},{v:'0.1%',l:'Platform Fee'},{v:'24/7',l:'Active'}].map(s=>(
              <div key={s.l} style={{background:'rgba(255,255,255,.03)',border:`1px solid rgba(245,196,108,.09)`,borderRadius:18,padding:'14px 8px',textAlign:'center',backdropFilter:'blur(8px)'}}>
                <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:20,color:C.gold}}>{s.v}</div>
                <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:C.muted,marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{width:'100%',padding:'14px 16px',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,rgba(245,196,108,.08),rgba(245,196,108,.02))`,border:`1px solid rgba(245,196,108,.18)`,backdropFilter:'blur(12px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <Seal size={40}/>
              <div>
                <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',fontWeight:700,color:C.muted}}>Pi / USD · Kraken</div>
                {priceLoad?<div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}><Spinner/><span style={{fontSize:11,color:C.muted}}>Loading…</span></div>:<div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold,marginTop:2}}>{piPrice?'$'+piPrice.toFixed(4):'Unavailable'}</div>}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:9,fontWeight:800,color:C.sage}}><div style={{width:6,height:6,borderRadius:'50%',background:C.sage,animation:'pulse 2s infinite'}}/>LIVE</div>
          </div>
          <div style={{width:'100%',padding:'13px 16px',borderRadius:20,background:'rgba(155,138,196,.08)',border:'1px solid rgba(155,138,196,.18)',backdropFilter:'blur(8px)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700,color:'rgba(155,138,196,.55)'}}>Pi Consensus Value · GCV</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18,color:'#C4B8F0',marginTop:4}}>1 π = 314,159 GCV</div><div style={{fontSize:9,color:C.muted,marginTop:3}}>Community Consensus · Global Currency Value</div></div>
              <span style={{fontSize:30}}>⚖️</span>
            </div>
          </div>
          <button onClick={onLogin} disabled={loading} type="button" style={{width:'100%',padding:'18px 24px',fontWeight:800,fontSize:14,borderRadius:22,border:'none',background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',boxShadow:`0 12px 40px rgba(245,196,108,.30),inset 0 1px 1px rgba(255,255,255,.28)`,cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1,display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all .2s',letterSpacing:'.02em'}}>
            {loading?<><Spinner color="#1A0E00"/>Connecting…</>:<><span style={{fontSize:22}}>π</span>Connect Pi Wallet<span style={{fontSize:16}}>→</span></>}
          </button>
          <div style={{fontSize:10,color:C.muted,textAlign:'center',lineHeight:1.5}}>🔐 KYC verification required for deals over 100 π</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,flexWrap:'wrap'}}>
            {[{i:'🔒',t:'Blockchain'},{i:'🔑',t:'Your Key Only'},{i:'⚖️',t:'Fair Dispute'},{i:'🛡️',t:'Secure'}].map(({i,t})=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:C.muted}}><span>{i}</span>{t}</div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[
            {key:'how',icon:'🔄',title:'How It Works',sub:'5 steps that protect every deal',content:<div>{HOW_STEPS.map((s,i)=><div key={i} style={{display:'flex',gap:14,padding:'14px 0',borderBottom:i<4?`1px solid rgba(245,196,108,.07)`:'none'}}><div style={{width:34,height:34,borderRadius:10,background:`${s.color}12`,border:`1px solid ${s.color}28`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:s.color,flexShrink:0}}>{s.n}</div><div><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><span style={{fontSize:13,fontWeight:800,color:C.text}}>{s.title}</span><span style={{fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:99,background:`${s.color}12`,color:s.color}}>{s.who}</span></div><p style={{fontSize:11,color:C.muted,lineHeight:1.6,margin:0}}>{s.body}</p></div></div>)}</div>},
            {key:'faq',icon:'❓',title:'FAQ',sub:'Common questions answered',content:<div style={{display:'flex',flexDirection:'column',gap:8}}>{FAQS.map((f,i)=><FaqItem key={i} q={f.q} a={f.a}/>)}</div>},
          ].map(sec=>(
            <div key={sec.key} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${section===sec.key?'rgba(245,196,108,.20)':'rgba(245,196,108,.08)'}`,borderRadius:20,overflow:'hidden',backdropFilter:'blur(8px)',transition:'border-color .2s'}}>
              <button onClick={()=>setSection(section===sec.key?null:sec.key)} type="button" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:18,background:'none',border:'none',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,borderRadius:12,background:`rgba(245,196,108,.08)`,border:`1px solid rgba(245,196,108,.15)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>{sec.icon}</div>
                  <div style={{textAlign:'left'}}><div style={{fontSize:13,fontWeight:800,color:C.text}}>{sec.title}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{sec.sub}</div></div>
                </div>
                <span style={{fontSize:14,color:C.muted,transform:section===sec.key?'rotate(180deg)':'none',transition:'transform .2s'}}>▾</span>
              </button>
              {section===sec.key&&<div style={{padding:'0 18px 20px',borderTop:`1px solid rgba(245,196,108,.08)`,animation:'fadeIn .2s ease'}}><div style={{paddingTop:16}}>{sec.content}</div></div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:32,textAlign:'center'}}>
          <p style={{fontSize:10,color:`${C.muted}55`,marginBottom:8}}>Support: <a href="mailto:Riahig45@gmail.com" style={{color:`${C.gold}70`,textDecoration:'none'}}>Riahig45@gmail.com</a></p>
          <div style={{display:'flex',justifyContent:'center',gap:14}}>
            <a href="/privacy" style={{fontSize:10,color:`${C.muted}45`,textDecoration:'none'}}>Privacy Policy</a>
            <span style={{color:`${C.muted}25`}}>·</span>
            <a href="/terms" style={{fontSize:10,color:`${C.muted}45`,textDecoration:'none'}}>Terms of Service</a>
          </div>
        </div>
      </div>
    </main>
  );
}
function BuyerTab({user}:{user:PiUser}) {
  const [wallet,setWallet]=useState(''); const [amount,setAmount]=useState(''); const [desc,setDesc]=useState('');
  const [busy,setBusy]=useState(false); const [err,setErr]=useState<string|null>(null); const [result,setResult]=useState<EscrowResult|null>(null);
  const [showBK,setShowBK]=useState(false); const [showSK,setShowSK]=useState(false);
  const [showKyc,setShowKyc]=useState(false); const [kycOk,setKycOk]=useState(false);
  const [rCode,setRCode]=useState(''); const [rKey,setRKey]=useState(''); const [rConf,setRConf]=useState('');
  const [rBusy,setRBusy]=useState(false); const [rErr,setRErr]=useState<string|null>(null); const [rOk,setROk]=useState<string|null>(null);
  const [dCode,setDCode]=useState(''); const [dReason,setDReason]=useState('');
  const [dBusy,setDBusy]=useState(false); const [dErr,setDErr]=useState<string|null>(null); const [dOk,setDOk]=useState<string|null>(null);
  const [eCode,setECode]=useState(''); const [eText,setEText]=useState('');
  const [eBusy,setEBusy]=useState(false); const [eErr,setEErr]=useState<string|null>(null); const [eOk,setEOk]=useState(false);
  const fee=useMemo(()=>{const v=parseFloat(amount);return isNaN(v)||v<=0?0:v*0.001;},[amount]);

  const doCreate=async()=>{
    setBusy(true);setErr(null);setResult(null);
    try {
      const win=window as any;
      if(!win.Pi) throw new Error('Please open this app in Pi Browser');
      const total=parseFloat(amount)+fee;
      let pending:EscrowResult|null=null;
      await new Promise<void>((res,rej)=>{
        win.Pi.createPayment({amount:total,memo:('PTrust: '+(desc||'Escrow')).substring(0,28),metadata:{seller:wallet,buyer:user.username}},{
          onReadyForServerApproval:async(pid:string)=>{
            try{const r=await api('/api/escrow/create',{paymentId:pid,sellerWallet:wallet,amount:parseFloat(amount),fee,description:desc||'No description',buyerUsername:user.username});pending={transactionNumber:r.transactionNumber,escrowCode:r.escrowCode,buyerKey:r.buyerKey,sellerKey:r.sellerKey};}catch(e:any){rej(e);}
          },
          onReadyForServerCompletion:async(pid:string,txid:string)=>{
            try{await api('/api/escrow/finalize',{paymentId:pid,txid});setResult(pending);setAmount('');setWallet('');setDesc('');res();}catch(e:any){rej(e);}
          },
          onCancel:()=>rej(new Error('Payment cancelled')),
          onError:(e:Error)=>rej(e),
        });
      });
    }catch(e:any){setErr(e.message);}finally{setBusy(false);}
  };

  const handleCreate=async(e:React.FormEvent)=>{e.preventDefault();if(parseFloat(amount)>=100&&!kycOk){setShowKyc(true);return;}doCreate();};
  const handleRelease=async(e:React.FormEvent)=>{e.preventDefault();setRBusy(true);setRErr(null);setROk(null);try{await api('/api/escrow/release',{escrowCode:rCode.toUpperCase(),buyerKey:rKey,confirmText:rConf,buyerUsername:user.username});setROk('Funds released successfully!');setRCode('');setRKey('');setRConf('');}catch(e:any){setRErr(e.message);}finally{setRBusy(false);};};
  const handleDispute=async(e:React.FormEvent)=>{e.preventDefault();setDBusy(true);setDErr(null);setDOk(null);try{const r=await api('/api/escrow/dispute',{escrowCode:dCode.toUpperCase(),buyerUsername:user.username,reason:dReason});setDOk('Dispute opened. Deadline: '+new Date(r.evidenceDeadline).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));setDCode('');setDReason('');}catch(e:any){setDErr(e.message);}finally{setDBusy(false);};};
  const handleEvidence=async(e:React.FormEvent)=>{e.preventDefault();setEBusy(true);setEErr(null);setEOk(false);try{await api('/api/escrow/evidence',{escrowCode:eCode.toUpperCase(),username:user.username,content:eText});setEOk(true);setEText('');}catch(e:any){setEErr(e.message);}finally{setEBusy(false);};};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease'}}>
      {showKyc&&<div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'rgba(8,7,6,.92)',backdropFilter:'blur(16px)'}}>
        <div style={{maxWidth:360,width:'100%',background:C.card,border:`1.5px solid rgba(245,196,108,.30)`,borderRadius:28,padding:26,display:'flex',flexDirection:'column',gap:18,animation:'scaleIn .2s ease',boxShadow:`0 24px 64px rgba(0,0,0,.7)`}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}><Seal size={46}/><div><div style={{fontWeight:800,fontSize:14,color:C.gold}}>Large Transaction</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>Transactions over 100 π require KYC</div></div></div>
          <p style={{fontSize:12,lineHeight:1.7,color:'#C8C0B4',margin:0}}>Both parties must have completed Pi Network KYC verification to proceed.</p>
          <label style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer'}}><input type="checkbox" checked={kycOk} onChange={e=>setKycOk(e.target.checked)} style={{marginTop:2,accentColor:C.gold,width:16,height:16}}/><span style={{fontSize:11,color:'#C8C0B4',lineHeight:1.5}}>I confirm both parties have completed KYC on Pi Network</span></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <button onClick={()=>setShowKyc(false)} type="button" style={{padding:'13px',borderRadius:16,fontWeight:800,fontSize:12,background:'rgba(255,255,255,.04)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>Cancel</button>
            <button disabled={!kycOk} onClick={()=>{setShowKyc(false);doCreate();}} type="button" style={{padding:'13px',borderRadius:16,fontWeight:800,fontSize:12,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',border:'none',cursor:kycOk?'pointer':'not-allowed',opacity:kycOk?1:.35}}>Proceed</button>
          </div>
        </div>
      </div>}

      {!result?(
        <GlassCard glow>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><div style={{width:42,height:42,borderRadius:14,background:'rgba(245,196,108,.10)',border:`1px solid rgba(245,196,108,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚡</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Create Escrow</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Pay via Pi Browser · 0.1% fee</div></div></div>
          <form onSubmit={handleCreate} style={{display:'flex',flexDirection:'column',gap:14}}>
            <Inp label="Seller Wallet Address"><input required placeholder="G…" value={wallet} onChange={e=>setWallet(e.target.value)} style={{...inpStyle}}/></Inp>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Inp label="Amount (π)"><input required type="number" min="0.000001" max="1000000" step="0.000001" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} style={{...inpStyle,fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold,textAlign:'center',background:'rgba(245,196,108,.06)',border:`1px solid rgba(245,196,108,.16)`}}/></Inp>
              <Inp label="Fee (0.1%)" hint="auto"><div style={{...inpStyle,fontSize:18,fontWeight:800,color:C.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>{fee>0?fee.toFixed(6):'—'}</div></Inp>
            </div>
            <Inp label="Deal Description" hint="optional"><textarea placeholder="Describe goods or service…" value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{...inpStyle,resize:'none',lineHeight:1.6,fontSize:12,color:'#C8C0B4'}}/></Inp>
            {err&&<ErrBox msg={err}/>}
            <PBtn type="submit" disabled={busy||!amount||!wallet}>{busy?<><Spinner color="#1A0E00"/>Processing…</>:<>🔒 Lock Funds in Escrow</>}</PBtn>
          </form>
        </GlassCard>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:12,animation:'fadeIn .3s ease'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,paddingInline:4}}><div style={{width:34,height:34,borderRadius:11,background:'rgba(92,131,116,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>✓</div><div><div style={{fontSize:13,fontWeight:800,color:C.sage}}>Escrow Created!</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>Keys shown only once — save them now</div></div></div>
          <GlassCard><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:C.muted,marginBottom:6}}># Transaction Number</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:12,color:C.gold,marginBottom:10}}>{result.transactionNumber}</div><button onClick={()=>navigator.clipboard?.writeText(result.transactionNumber)} type="button" style={{fontSize:10,fontWeight:700,padding:'5px 12px',borderRadius:9,background:'rgba(255,255,255,.04)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>📋 Copy TX#</button></GlassCard>
          <div style={{background:`linear-gradient(135deg,rgba(245,196,108,.07),rgba(245,196,108,.02))`,border:`1.5px solid rgba(245,196,108,.24)`,borderRadius:20,padding:16,backdropFilter:'blur(12px)'}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:'rgba(245,196,108,.55)',marginBottom:8}}>Escrow Code — Share with Seller</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:32,color:C.gold,letterSpacing:'.1em',marginBottom:12,textShadow:`0 0 24px rgba(245,196,108,.30)`}}>{result.escrowCode}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>navigator.clipboard?.writeText(result.escrowCode)} type="button" style={{fontSize:10,fontWeight:700,padding:'6px 12px',borderRadius:9,background:'rgba(255,255,255,.05)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>📋 Copy Code</button><button onClick={()=>window.open('https://wa.me/?text='+encodeURIComponent(`PTrust Escrow\nCode: ${result.escrowCode}\nSeller Key: ${result.sellerKey}\nLink: https://pts-v1.vercel.app`))} type="button" style={{fontSize:10,fontWeight:700,padding:'6px 12px',borderRadius:9,background:'rgba(92,131,116,.12)',color:C.sage,border:`1px solid rgba(92,131,116,.25)`,cursor:'pointer'}}>📱 WhatsApp</button></div></div>
          <GlassCard><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:'rgba(245,196,108,.60)'}}>Your Buyer Key — Keep Private</div><button onClick={()=>setShowBK(!showBK)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:13}}>{showBK?'🙈':'👁️'}</button></div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:C.text,marginBottom:6}}>{showBK?result.buyerKey:'BK-••••••••••••'}</div><div style={{fontSize:9,color:'rgba(245,196,108,.45)',marginBottom:10}}>Required to release funds or open a dispute. Never share.</div><button onClick={()=>navigator.clipboard?.writeText(result.buyerKey)} type="button" style={{fontSize:10,fontWeight:700,padding:'5px 12px',borderRadius:9,background:'rgba(255,255,255,.04)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>📋 Copy Buyer Key</button></GlassCard>
          <GlassCard><div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:'rgba(111,168,201,.60)'}}>Seller Key — Send to Seller</div><button onClick={()=>setShowSK(!showSK)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:13}}>{showSK?'🙈':'👁️'}</button></div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:C.text,marginBottom:6}}>{showSK?result.sellerKey:'SK-••••••••••••'}</div><div style={{fontSize:9,color:'rgba(111,168,201,.45)',marginBottom:10}}>Share with seller — required to accept the deal.</div><button onClick={()=>navigator.clipboard?.writeText(result.sellerKey)} type="button" style={{fontSize:10,fontWeight:700,padding:'5px 12px',borderRadius:9,background:'rgba(255,255,255,.04)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>📋 Copy Seller Key</button></GlassCard>
          <InfoBox msg="Send the Escrow Code AND Seller Key to the seller. Keep your Buyer Key private."/>
          <button onClick={()=>{setResult(null);setShowBK(false);setShowSK(false);}} type="button" style={{width:'100%',padding:12,fontSize:11,fontWeight:800,color:C.muted,background:'none',border:'none',cursor:'pointer'}}>+ Create Another Escrow</button>
        </div>
      )}

      <GlassCard>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><div style={{width:42,height:42,borderRadius:14,background:'rgba(92,131,116,.10)',border:`1px solid rgba(92,131,116,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>✅</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Confirm Receipt</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Release funds after receiving goods</div></div></div>
        <form onSubmit={handleRelease} style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Escrow Code"><input required placeholder="PTO-XXXXXX" value={rCode} onChange={e=>setRCode(e.target.value.toUpperCase())} style={{...inpStyle,fontFamily:'monospace',fontWeight:800,fontSize:16,color:C.gold,textAlign:'center',letterSpacing:'.12em'}}/></Inp>
          <Inp label="Buyer Key"><input required placeholder="BK-XXXXXXXX" value={rKey} onChange={e=>setRKey(e.target.value)} style={{...inpStyle}}/></Inp>
          <div style={{background:'rgba(245,196,108,.04)',border:`1px solid rgba(245,196,108,.12)`,borderRadius:16,padding:14}}><div style={{fontSize:10,fontWeight:800,color:'rgba(245,196,108,.70)',marginBottom:8}}>Type CONFIRM to authorize this irreversible release</div><input placeholder="CONFIRM" value={rConf} onChange={e=>setRConf(e.target.value)} style={{width:'100%',background:C.bg,border:`1px solid rgba(245,196,108,.20)`,borderRadius:12,padding:'12px 16px',fontSize:14,fontWeight:800,textAlign:'center',letterSpacing:'.3em',color:C.gold,outline:'none'}}/></div>
          {rErr&&<ErrBox msg={rErr}/>}{rOk&&<OkBox msg={rOk}/>}
          <PBtn type="submit" variant="sage" disabled={rBusy||!!rOk||rConf!=='CONFIRM'||!rCode||!rKey}>{rBusy?<><Spinner color={C.sage}/>Releasing…</>:'✓ Received — Release Funds to Seller'}</PBtn>
        </form>
      </GlassCard>

      <GlassCard>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><div style={{width:42,height:42,borderRadius:14,background:'rgba(196,69,54,.10)',border:`1px solid rgba(196,69,54,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>❌</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Not Received — Dispute</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Freeze funds and open dispute</div></div></div>
        <form onSubmit={handleDispute} style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Escrow Code"><input required placeholder="PTO-XXXXXX" value={dCode} onChange={e=>setDCode(e.target.value.toUpperCase())} style={{...inpStyle,fontFamily:'monospace',fontWeight:800,fontSize:16,textAlign:'center',letterSpacing:'.12em'}}/></Inp>
          <Inp label="Describe the Issue"><textarea required placeholder="What went wrong? Be specific…" value={dReason} onChange={e=>setDReason(e.target.value)} rows={3} style={{...inpStyle,resize:'none',lineHeight:1.6,fontSize:12}}/></Inp>
          {dErr&&<ErrBox msg={dErr}/>}{dOk&&<OkBox msg={dOk}/>}
          <PBtn type="submit" variant="terra" disabled={dBusy||!!dOk}>{dBusy?<><Spinner color={C.terra}/>Processing…</>:'❌ Freeze Funds & Open Dispute'}</PBtn>
        </form>
      </GlassCard>

      <GlassCard>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><div style={{width:42,height:42,borderRadius:14,background:'rgba(111,168,201,.10)',border:`1px solid rgba(111,168,201,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📋</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Submit Evidence</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>15-day window after dispute opens</div></div></div>
        <form onSubmit={handleEvidence} style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Escrow Code"><input required placeholder="PTO-XXXXXX" value={eCode} onChange={e=>setECode(e.target.value.toUpperCase())} style={{...inpStyle,fontFamily:'monospace',fontWeight:800,fontSize:16,textAlign:'center',letterSpacing:'.12em'}}/></Inp>
          <Inp label="Evidence" hint="URLs, tracking, proof"><textarea required placeholder="URL, tracking number, screenshot description…" value={eText} onChange={e=>setEText(e.target.value)} rows={4} style={{...inpStyle,resize:'none',lineHeight:1.6,fontSize:12}}/></Inp>
          {eErr&&<ErrBox msg={eErr}/>}{eOk&&<OkBox msg="Evidence submitted successfully."/>}
          <PBtn type="submit" variant="ghost" disabled={eBusy}>{eBusy?<><Spinner/>Submitting…</>:'📋 Submit Evidence'}</PBtn>
        </form>
      </GlassCard>
    </div>
  );
}

function SellerTab({user}:{user:PiUser}) {
  const [code,setCode]=useState(''); const [key,setKey]=useState('');
  const [tx,setTx]=useState<Transaction|null>(null); const [err,setErr]=useState<string|null>(null);
  const [busy,setBusy]=useState(false); const [rated,setRated]=useState(false);
  const delay=tx&&tx.status==='ACCEPTED'&&(Date.now()-new Date(tx.createdAt).getTime())>3*24*60*60*1000;

  const lookup=async(e:React.FormEvent)=>{e.preventDefault();if(!code)return;setBusy(true);setErr(null);setTx(null);try{const r=await fetch('/api/escrow/transaction/'+code.toUpperCase());const d=await r.json();if(!d.success)throw new Error(d.error);setTx(d.transaction);}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const accept=async()=>{if(!tx||!key){setErr('Enter your Seller Key');return;}setBusy(true);setErr(null);try{await api('/api/escrow/accept',{escrowCode:tx.escrowCode,sellerUsername:user.username,sellerKey:key});setTx({...tx,status:'ACCEPTED',sellerUsername:user.username});setKey('');}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const deliver=async()=>{if(!tx)return;setBusy(true);setErr(null);try{await api('/api/escrow/complete',{escrowCode:tx.escrowCode,sellerUsername:user.username});setTx({...tx,status:'DELIVERED'});}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const rate=async(n:number)=>{if(!tx)return;try{await api('/api/escrow/rate',{escrowCode:tx.escrowCode,rating:n,raterUsername:user.username});setRated(true);}catch{}};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease'}}>
      <GlassCard glow>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}><div style={{width:42,height:42,borderRadius:14,background:'rgba(111,168,201,.10)',border:`1px solid rgba(111,168,201,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📦</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Seller Dashboard</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Enter Escrow Code to get started</div></div></div>
        {!tx?(
          <form onSubmit={lookup} style={{display:'flex',flexDirection:'column',gap:14}}>
            <Inp label="Escrow Code" hint="From buyer"><input required placeholder="PTO-XXXXXX" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} style={{...inpStyle,fontFamily:'monospace',fontWeight:900,fontSize:26,textAlign:'center',letterSpacing:'.15em',color:C.gold,background:'rgba(245,196,108,.05)',border:`1px solid rgba(245,196,108,.16)`}}/></Inp>
            <Inp label="Seller Key" hint="From buyer"><input placeholder="SK-XXXXXXXX" value={key} onChange={e=>setKey(e.target.value)} style={{...inpStyle}}/></Inp>
            {err&&<ErrBox msg={err}/>}
            <PBtn type="submit" disabled={busy||!code}>{busy?<><Spinner color="#1A0E00"/>Looking Up…</>:<>🔑 Find Escrow</>}</PBtn>
          </form>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{height:3,borderRadius:99,background:'rgba(255,255,255,.06)',overflow:'hidden'}}><div style={{height:'100%',borderRadius:99,background:`linear-gradient(90deg,${C.gold},${C.sage})`,width:tx.status==='PENDING'?'10%':tx.status==='ACCEPTED'?'40%':tx.status==='DELIVERED'?'75%':tx.status==='RELEASED'?'100%':'10%',transition:'width .8s ease'}}/></div>
            <DealTracker status={tx.status}/>
            {delay&&<InfoBox msg="⚠️ 3 days without delivery — buyer may open a dispute soon" type="terra"/>}
            <div style={{background:'rgba(255,255,255,.03)',border:`1px solid rgba(245,196,108,.08)`,borderRadius:18,padding:16,display:'flex',flexDirection:'column',gap:10}}>
              {[{l:'TX Number',v:<span style={{fontFamily:'monospace',fontWeight:800,fontSize:11,color:C.gold}}>{tx.transactionNumber}</span>},{l:'Escrow Code',v:<span style={{fontFamily:'monospace',fontWeight:800,color:C.gold}}>{tx.escrowCode}</span>},{l:'Amount',v:<span style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:20}}>{tx.amount} <span style={{color:C.gold}}>π</span></span>},{l:'Buyer',v:<span style={{fontWeight:800,fontSize:13}}>@{tx.buyerUsername}</span>},{l:'Status',v:<Badge status={tx.status}/>}].map(({l,v})=><div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.14em',color:C.muted}}>{l}</span>{v}</div>)}
              {tx.description&&<div style={{paddingTop:10,borderTop:`1px solid rgba(245,196,108,.07)`}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.14em',color:C.muted,marginBottom:6}}>Deal Terms</div><p style={{fontSize:13,lineHeight:1.6,color:C.text,margin:0}}>{tx.description}</p></div>}
            </div>
            {tx.status==='PENDING'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><InfoBox msg="Review deal terms. Enter your Seller Key to accept."/><Inp label="Seller Key"><input placeholder="SK-XXXXXXXX" value={key} onChange={e=>setKey(e.target.value)} style={{...inpStyle}}/></Inp><PBtn onClick={accept} disabled={busy}>{busy?<><Spinner color="#1A0E00"/>Processing…</>:<>🛡️ Accept Deal</>}</PBtn></div>}
            {tx.status==='ACCEPTED'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><InfoBox msg="Deal accepted. Deliver goods/service then confirm."/><PBtn onClick={deliver} disabled={busy}>{busy?<><Spinner color="#1A0E00"/>Processing…</>:<>📦 Confirm Delivery Sent</>}</PBtn></div>}
            {tx.status==='DELIVERED'&&<InfoBox msg="Delivery confirmed. Waiting for buyer to release funds." type="sky"/>}
            {tx.status==='FROZEN'&&<InfoBox msg="Dispute opened. Submit your evidence within 15 days." type="sky"/>}
            {tx.status==='UNDER_REVIEW'&&<InfoBox msg="Admin is reviewing evidence. Decision coming soon." type="sky"/>}
            {tx.status==='RELEASED'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><OkBox msg={`Payment of ${tx.amount} π released to your wallet.`}/>{!rated?<GlassCard><div style={{fontSize:10,fontWeight:800,color:C.muted,marginBottom:12}}>Rate this transaction</div><Stars onRate={rate}/></GlassCard>:<OkBox msg="Thank you for rating!"/>}</div>}
            {tx.status==='REFUNDED'&&<InfoBox msg="Dispute resolved in favor of the buyer." type="sky"/>}
            {err&&<ErrBox msg={err}/>}
            <button onClick={()=>{setTx(null);setCode('');setKey('');setErr(null);setRated(false);}} type="button" style={{width:'100%',padding:12,fontSize:11,fontWeight:800,color:C.muted,background:'none',border:'none',cursor:'pointer'}}>← Look Up Another Escrow</button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function TransactionsTab({ user }: { user: PiUser }) {
  const [list,setList]     = useState<Transaction[]>([]);
  const [loading,setLoad]  = useState(false);
  const [search,setSearch] = useState('');

  const load = useCallback(async () => {
    setLoad(true);
    try {
      const r = await fetch('/api/escrow/transactions?username='+user.username);
      const d = await r.json();
      setList(d.transactions||[]);
    } catch { setList([]); }
    finally { setLoad(false); }
  },[user.username]);

  useEffect(()=>{ load(); },[load]);

  const filtered = useMemo(()=>{
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(t =>
      t.escrowCode?.toLowerCase().includes(q)||
      t.transactionNumber?.toLowerCase().includes(q)||
      t.buyerUsername?.toLowerCase().includes(q)||
      t.sellerUsername?.toLowerCase().includes(q)||
      t.description?.toLowerCase().includes(q)
    );
  },[list,search]);

  const rate = async (escrowCode:string, n:number) => {
    try {
      await api('/api/escrow/rate',{ escrowCode, rating:n, raterUsername:user.username });
      setList(prev=>prev.map(t=>t.escrowCode===escrowCode?{...t,rating:n}:t));
    } catch {}
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <div style={{ fontSize:18,fontWeight:800,color:C.text }}>My Deals</div>
        <button onClick={load} type="button" style={{ display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:800,color:C.gold,background:'none',border:'none',cursor:'pointer' }}>
          <span style={{ display:'inline-block',animation:loading?'spin .7s linear infinite':'none' }}>↻</span> Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.03)',border:`1px solid rgba(245,196,108,.08)`,borderRadius:16,padding:'10px 14px',backdropFilter:'blur(8px)' }}>
        <span style={{ fontSize:14,color:C.muted }}>🔍</span>
        <input placeholder="Search by code, username, description…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{ flex:1,background:'none',border:'none',outline:'none',fontSize:13,color:C.text }} />
        {search && <button onClick={()=>setSearch('')} type="button" style={{ background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16 }}>×</button>}
      </div>

      {loading && (
        <div style={{ display:'flex',justifyContent:'center',padding:'48px 0' }}>
          <div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} />
        </div>
      )}

      {!loading && filtered.length===0 && (
        <div style={{ textAlign:'center',padding:'64px 0' }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:16,opacity:.25 }}><Seal size={52} /></div>
          <div style={{ fontWeight:800,fontSize:14,color:C.text }}>{search?'No results found':'No transactions yet'}</div>
          <div style={{ fontSize:11,color:C.muted,marginTop:6 }}>{search?'Try a different term':'Create your first escrow in Buyer tab'}</div>
        </div>
      )}

      {filtered.map(tx=>{
        const delay = tx.status==='ACCEPTED'&&(Date.now()-new Date(tx.createdAt).getTime())>3*24*60*60*1000;
        return (
          <GlassCard key={tx._id} style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontFamily:'monospace',fontWeight:800,fontSize:11,color:C.gold }}>{tx.transactionNumber||tx.escrowCode}</span>
              <Badge status={tx.status} />
            </div>
            {delay && <InfoBox msg="⚠️ 3 days without delivery" type="terra" />}
            {/* Progress bar */}
            <div style={{ height:3,borderRadius:99,background:'rgba(255,255,255,.06)',overflow:'hidden' }}>
              <div style={{ height:'100%',borderRadius:99,background:`linear-gradient(90deg,${C.gold},${C.sage})`,width:tx.status==='PENDING'?'10%':tx.status==='ACCEPTED'?'40%':tx.status==='DELIVERED'?'75%':tx.status==='RELEASED'?'100%':'10%' }} />
            </div>
            <DealTracker status={tx.status} />
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}>
              <span style={{ color:C.muted }}>Amount</span>
              <span style={{ fontWeight:800,color:C.text }}>{tx.amount} <span style={{ color:C.gold }}>π</span></span>
            </div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}>
              <span style={{ color:C.muted }}>Role</span>
              <span style={{ fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:99,background:tx.buyerUsername===user.username?`rgba(245,196,108,.10)`:`rgba(111,168,201,.10)`,color:tx.buyerUsername===user.username?C.gold:C.sky }}>
                {tx.buyerUsername===user.username?'Buyer':'Seller'}
              </span>
            </div>
            {tx.description && <div style={{ fontSize:10,lineHeight:1.6,color:C.muted,borderTop:`1px solid rgba(245,196,108,.07)`,paddingTop:10 }}>{tx.description}</div>}
            <div style={{ fontSize:9,color:`${C.muted}60` }}>🕐 {new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
            {tx.status==='RELEASED'&&!tx.rating && (
              <div style={{ paddingTop:4 }}>
                <div style={{ fontSize:9,color:C.muted,marginBottom:8 }}>Rate this deal</div>
                <Stars onRate={n=>rate(tx.escrowCode,n)} />
              </div>
            )}
            {tx.status==='RELEASED'&&tx.rating && (
              <div style={{ display:'flex',alignItems:'center',gap:6,paddingTop:4 }}>
                <Stars value={tx.rating} />
                <span style={{ fontSize:9,color:C.muted }}>Rated</span>
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ReceiptsTab({ username }: { username: string }) {
  const [list,setList]   = useState<Transaction[]>([]);
  const [loading,setLoad] = useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        const r = await fetch('/api/escrow/transactions?username='+username);
        const d = await r.json();
        setList((d.transactions||[]).filter((t:Transaction)=>t.status==='RELEASED'));
      } catch {}
      finally { setLoad(false); }
    })();
  },[username]);

  const generatePDF = (tx:Transaction) => {
    const w = window.open('','_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${tx.transactionNumber}</title>
    <style>
      body{font-family:Georgia,serif;max-width:580px;margin:48px auto;color:#1C1A17;padding:0 24px}
      .hdr{text-align:center;padding-bottom:24px;margin-bottom:32px;border-bottom:3px solid #F5C46C}
      .logo{font-size:38px;font-weight:900;letter-spacing:-1px}
      .gold{color:#F5C46C}
      .sub{color:#8A8378;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin-top:4px}
      .ok{display:inline-block;background:#5C8374;color:#fff;padding:4px 16px;border-radius:99px;font-size:11px;font-weight:700;margin-top:12px}
      .row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #E8E4DC}
      .row:last-child{border-bottom:none}
      .k{color:#8A8378;font-size:12px}
      .v{font-weight:700;font-size:13px;text-align:right;max-width:65%}
      .ftr{text-align:center;margin-top:40px;color:#8A8378;font-size:10px;line-height:1.9}
    </style></head><body>
    <div class="hdr">
      <div class="logo">P<span class="gold">TRUST</span></div>
      <div class="sub">Oracle · Escrow Protocol</div>
      <div class="ok">✓ OFFICIAL RECEIPT</div>
    </div>
    <div class="row"><span class="k">Transaction Number</span><span class="v">${tx.transactionNumber}</span></div>
    <div class="row"><span class="k">Escrow Code</span><span class="v">${tx.escrowCode}</span></div>
    <div class="row"><span class="k">Date</span><span class="v">${new Date(tx.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</span></div>
    <div class="row"><span class="k">Buyer</span><span class="v">@${tx.buyerUsername}</span></div>
    <div class="row"><span class="k">Amount</span><span class="v">${tx.amount} Pi</span></div>
    <div class="row"><span class="k">Platform Fee (0.1%)</span><span class="v">${(tx.fee||tx.amount*0.001).toFixed(6)} Pi</span></div>
    <div class="row"><span class="k">Description</span><span class="v">${tx.description||'N/A'}</span></div>
    <div class="row"><span class="k">Status</span><span class="v" style="color:#5C8374">✓ RELEASED</span></div>
    <div class="ftr">This receipt is generated by PTrust Oracle<br>Secured on Pi Network Blockchain<br>pts-v1.vercel.app · Support: Riahig45@gmail.com</div>
    </body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease' }}>
      <div style={{ display:'flex',alignItems:'center',gap:12 }}>
        <div style={{ width:42,height:42,borderRadius:14,background:'rgba(245,196,108,.10)',border:`1px solid rgba(245,196,108,.18)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>📄</div>
        <div><div style={{ fontSize:16,fontWeight:800,color:C.text }}>Transaction Receipts</div><div style={{ fontSize:11,color:C.muted,marginTop:2 }}>Download official receipts for completed deals</div></div>
      </div>

      {loading && <div style={{ display:'flex',justifyContent:'center',padding:'48px 0' }}><div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} /></div>}

      {!loading&&list.length===0 && (
        <div style={{ textAlign:'center',padding:'64px 0' }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:16,opacity:.25 }}><Seal size={52} /></div>
          <div style={{ fontWeight:800,fontSize:14,color:C.text }}>No completed transactions yet</div>
          <div style={{ fontSize:11,color:C.muted,marginTop:6 }}>Receipts appear after funds are released</div>
        </div>
      )}

      {list.map(tx=>(
        <GlassCard key={tx._id} style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <span style={{ fontFamily:'monospace',fontWeight:800,fontSize:11,color:C.gold }}>{tx.transactionNumber}</span>
            <Badge status={tx.status} />
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:8,borderTop:`1px solid rgba(245,196,108,.07)`,paddingTop:12 }}>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}><span style={{ color:C.muted }}>Amount</span><span style={{ fontWeight:800 }}>{tx.amount} <span style={{ color:C.gold }}>π</span></span></div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}><span style={{ color:C.muted }}>Fee</span><span style={{ fontWeight:800 }}>{(tx.fee||tx.amount*0.001).toFixed(6)} π</span></div>
            <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}><span style={{ color:C.muted }}>Date</span><span style={{ fontWeight:800 }}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>
            {tx.description && <div style={{ display:'flex',justifyContent:'space-between',fontSize:11 }}><span style={{ color:C.muted }}>Description</span><span style={{ fontWeight:800,textAlign:'right',maxWidth:'60%' }}>{tx.description}</span></div>}
          </div>
          <button onClick={()=>generatePDF(tx)} type="button"
            style={{ width:'100%',padding:'13px',borderRadius:16,fontWeight:800,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',border:'none',background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',boxShadow:`0 6px 20px rgba(245,196,108,.22),inset 0 1px 1px rgba(255,255,255,.22)` }}>
            📄 Download PDF Receipt
          </button>
        </GlassCard>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS TAB
// ─────────────────────────────────────────────────────────────────────────────
function StatsTab({ user }: { user: PiUser }) {
  const [list,setList]         = useState<Transaction[]>([]);
  const [loading,setLoad]      = useState(true);
  const [piPrice,setPiPrice]   = useState<number|null>(null);
  const [priceLoad,setPrLoad]  = useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');
        const d = await r.json();
        const t = d?.result?.PIUSD??d?.result?.['PI/USD'];
        const p = t?parseFloat(t.c[0]):NaN;
        if (!isNaN(p)) { setPiPrice(p); return; }
        throw new Error('no');
      } catch {
        try {
          const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
          const d = await r.json();
          setPiPrice(d?.['pi-network']?.usd||null);
        } catch { setPiPrice(null); }
      } finally { setPrLoad(false); }
    })();
  },[]);

  useEffect(()=>{
    (async()=>{
      try {
        const r = await fetch('/api/escrow/transactions?username='+user.username);
        const d = await r.json();
        setList(d.transactions||[]);
      } catch {}
      finally { setLoad(false); }
    })();
  },[user.username]);

  const s = useMemo(()=>({
    total:    list.length,
    released: list.filter(t=>t.status==='RELEASED').length,
    disputed: list.filter(t=>['FROZEN','UNDER_REVIEW'].includes(t.status)).length,
    totalPi:  list.filter(t=>t.status==='RELEASED').reduce((a,t)=>a+t.amount,0),
    asBuyer:  list.filter(t=>t.buyerUsername===user.username).length,
    asSeller: list.filter(t=>t.sellerUsername===user.username).length,
  }),[list,user.username]);

  if (loading) return <div style={{ display:'flex',justifyContent:'center',padding:'64px 0' }}><div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} /></div>;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease' }}>
      <div style={{ paddingInline:4 }}>
        <div style={{ fontSize:18,fontWeight:800,color:C.text }}>Statistics</div>
        <div style={{ fontSize:11,color:C.muted,marginTop:3 }}>@{user.username}&apos;s overview</div>
      </div>

      {/* Price */}
      <div style={{ padding:'14px 16px',borderRadius:22,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,rgba(245,196,108,.08),rgba(245,196,108,.02))`,border:`1px solid rgba(245,196,108,.18)`,backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <Seal size={42} />
          <div>
            <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',fontWeight:700,color:C.muted }}>Pi / USD · Kraken</div>
            {priceLoad ? <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:4 }}><Spinner /><span style={{ fontSize:11,color:C.muted }}>Loading…</span></div>
              : <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold,marginTop:2 }}>{piPrice?'$'+piPrice.toFixed(4):'Unavailable'}</div>}
          </div>
        </div>
        {piPrice&&s.totalPi>0 && (
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'.08em',color:C.muted,fontWeight:700 }}>Your Total</div>
            <div style={{ fontWeight:800,fontSize:15,color:C.sage,marginTop:2 }}>{'$'+(s.totalPi*piPrice).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        {[
          { l:'Total Deals',     v:s.total,                    c:C.gold  },
          { l:'Completed',       v:s.released,                 c:C.sage  },
          { l:'Active Disputes', v:s.disputed,                 c:C.terra },
          { l:'π Transacted',    v:s.totalPi.toFixed(3)+' π',  c:C.gold  },
        ].map(({l,v,c})=>(
          <GlassCard key={l} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:28,color:c,marginBottom:6 }}>{v}</div>
            <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted }}>{l}</div>
          </GlassCard>
        ))}
      </div>

      {/* Role */}
      <GlassCard>
        <div style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted,marginBottom:14 }}>Role Breakdown</div>
        <div style={{ display:'flex',gap:10 }}>
          <div style={{ flex:1,background:`rgba(245,196,108,.06)`,border:`1px solid rgba(245,196,108,.12)`,borderRadius:18,padding:16,textAlign:'center' }}>
            <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:30,color:C.gold }}>{s.asBuyer}</div>
            <div style={{ fontSize:9,color:C.muted,marginTop:4 }}>As Buyer</div>
          </div>
          <div style={{ flex:1,background:`rgba(111,168,201,.06)`,border:`1px solid rgba(111,168,201,.12)`,borderRadius:18,padding:16,textAlign:'center' }}>
            <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:30,color:C.sky }}>{s.asSeller}</div>
            <div style={{ fontSize:9,color:C.muted,marginTop:4 }}>As Seller</div>
          </div>
        </div>
      </GlassCard>

      {/* Success rate */}
      {s.total>0 && (
        <GlassCard>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:12 }}>
            <span style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted }}>Success Rate</span>
            <span style={{ fontWeight:800,fontSize:14,color:C.sage }}>{Math.round(s.released/s.total*100)}%</span>
          </div>
          <div style={{ height:8,borderRadius:99,overflow:'hidden',background:'rgba(255,255,255,.06)' }}>
            <div style={{ height:'100%',borderRadius:99,width:(s.released/s.total*100)+'%',background:`linear-gradient(90deg,${C.sage},#3D6B5E)`,boxShadow:`0 0 8px rgba(92,131,116,.4)`,transition:'width .8s ease' }} />
          </div>
        </GlassCard>
      )}

      {/* Support */}
      <GlassCard>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:16 }}>
          <Seal size={36} />
          <div><div style={{ fontWeight:800,fontSize:13,color:C.text }}>Support</div><div style={{ fontSize:9,color:C.muted,marginTop:2 }}>Response within 24 hours</div></div>
        </div>
        <PBtn variant="ghost" onClick={()=>window.open('mailto:Riahig45@gmail.com?subject=PTrust Oracle Support')}>✉️ Contact Support</PBtn>
        <div style={{ display:'flex',justifyContent:'center',gap:14,marginTop:14 }}>
          <a href="/privacy" style={{ fontSize:9,color:`${C.muted}55`,textDecoration:'none' }}>Privacy Policy</a>
          <span style={{ color:`${C.muted}25` }}>·</span>
          <a href="/terms" style={{ fontSize:9,color:`${C.muted}55`,textDecoration:'none' }}>Terms of Service</a>
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT TAB
// ─────────────────────────────────────────────────────────────────────────────
function ChatTab({ username }: { username: string }) {
  const [msgs,setMsgs]     = useState<any[]>([]);
  const [text,setText]     = useState('');
  const [sending,setSend]  = useState(false);
  const [loading,setLoad]  = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const EMOJIS = ['😊','👍','🔒','✅','💰','🤝','🚀','❓','⚡','🛡️'];

  const load = useCallback(async()=>{
    try {
      const r = await fetch('/api/messages');
      const d = await r.json();
      if (d.success) setMsgs(d.messages||[]);
    } catch {}
    finally { setLoad(false); }
  },[]);

  useEffect(()=>{ load(); const iv=setInterval(load,30000); return()=>clearInterval(iv); },[load]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[msgs]);

  const send = async () => {
    if (!text.trim()||sending) return;
    setSend(true);
    try { await api('/api/messages',{ username, text:text.trim() }); setText(''); await load(); }
    catch {}
    finally { setSend(false); }
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'calc(100vh - 200px)',minHeight:400,animation:'fadeIn .3s ease' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <div style={{ fontSize:16,fontWeight:800,color:C.text }}>Community Chat</div>
          <span style={{ fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:99,background:`rgba(92,131,116,.10)`,color:C.sage,border:`1px solid rgba(92,131,116,.18)` }}>{msgs.length} msgs</span>
        </div>
        <button onClick={load} type="button" style={{ background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16 }}>↻</button>
      </div>

      {/* Messages */}
      <div style={{ flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingBottom:8 }}>
        {loading && <div style={{ display:'flex',justifyContent:'center',padding:'32px 0' }}><div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} /></div>}
        {!loading&&msgs.length===0 && (
          <div style={{ textAlign:'center',padding:'48px 0' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:12,opacity:.25 }}><Seal size={48} /></div>
            <div style={{ fontWeight:800,fontSize:14,color:C.text }}>No messages yet</div>
            <div style={{ fontSize:11,color:C.muted,marginTop:4 }}>Be the first to say hello!</div>
          </div>
        )}
        {msgs.map((m,i)=>{
          const isMe = m.username===username;
          return (
            <div key={i} style={{ display:'flex',justifyContent:isMe?'flex-end':'flex-start' }}>
              <div style={{ maxWidth:'78%',display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:3 }}>
                {!isMe && <span style={{ fontSize:9,fontWeight:800,color:C.gold,paddingInline:2 }}>@{m.username}</span>}
                <div style={{
                  padding:'10px 14px',fontSize:13,lineHeight:1.4,
                  ...(isMe
                    ? { background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',borderRadius:'18px 18px 4px 18px',fontWeight:700,boxShadow:`0 4px 14px rgba(245,196,108,.22)` }
                    : { background:'rgba(255,255,255,.05)',color:C.text,border:`1px solid rgba(255,255,255,.08)`,borderRadius:'18px 18px 18px 4px',backdropFilter:'blur(8px)' }
                  ),
                }}>{m.text}</div>
                <span style={{ fontSize:7.5,color:`${C.muted}55`,paddingInline:2 }}>{new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Emoji row */}
      <div style={{ display:'flex',gap:6,marginBottom:8,overflowX:'auto',flexShrink:0,paddingBottom:2 }}>
        {EMOJIS.map(e=>(
          <button key={e} onClick={()=>setText(p=>(p+e).slice(0,500))} type="button"
            style={{ width:34,height:34,borderRadius:10,flexShrink:0,fontSize:16,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.07)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)' }}>
            {e}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display:'flex',gap:8,flexShrink:0 }}>
        <input placeholder="Write a message…" value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }}
          maxLength={500}
          style={{ flex:1,background:'rgba(255,255,255,.04)',border:`1px solid rgba(245,196,108,.10)`,borderRadius:18,padding:'12px 16px',fontSize:13,color:C.text,outline:'none',backdropFilter:'blur(8px)' }} />
        <button onClick={send} disabled={sending||!text.trim()} type="button"
          style={{ width:46,height:46,borderRadius:16,border:'none',flexShrink:0,cursor:sending||!text.trim()?'not-allowed':'pointer',opacity:sending||!text.trim()?.4:1,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,boxShadow:`0 4px 14px rgba(245,196,108,.25)` }}>
          ➤
        </button>
      </div>
      <div style={{ textAlign:'right',marginTop:4,fontSize:9,color:`${C.muted}55` }}>{text.length}/500</div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({ username }: { username: string }) {
  const [list,setList]       = useState<Transaction[]>([]);
  const [loading,setLoad]    = useState(true);
  const [showBreak,setBreak] = useState(false);

  useEffect(()=>{
    (async()=>{
      try {
        const r = await fetch('/api/escrow/transactions?username='+username);
        const d = await r.json();
        setList(d.transactions||[]);
      } catch {}
      finally { setLoad(false); }
    })();
  },[username]);

  const stats = useMemo(()=>{
    const total    = list.length;
    const released = list.filter(t=>t.status==='RELEASED').length;
    const asBuyer  = list.filter(t=>t.buyerUsername===username).length;
    const asSeller = list.filter(t=>t.sellerUsername===username).length;
    const ratings  = list.filter(t=>t.rating).map(t=>t.rating as number);
    const avg      = ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;
    const badge    = total>=20?{label:'Elite Merchant',color:C.gold,bg:`rgba(245,196,108,.10)`,emoji:'💎'}
                   : total>=5 ?{label:'Trusted Trader', color:C.sage,bg:`rgba(92,131,116,.10)`,  emoji:'🤝'}
                   :            {label:'New Pioneer',    color:C.sky, bg:`rgba(111,168,201,.10)`, emoji:'🚀'};
    const since = list.length>0?new Date(list[list.length-1].createdAt):new Date();
    return { total, released, asBuyer, asSeller, avg, badge, since };
  },[list,username]);

  const trust = useMemo(()=>trustScore(list),[list]);

  if (loading) return <div style={{ display:'flex',justifyContent:'center',padding:'64px 0' }}><div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} /></div>;

  const circ = 2*Math.PI*40;
  const dash = circ-(trust.score/100)*circ;

  // Trust score breakdown
  const released = list.filter(t=>t.status==='RELEASED').length;
  const disputed = list.filter(t=>['FROZEN','UNDER_REVIEW','PENDING_ADMIN'].includes(t.status)).length;
  const refunded = list.filter(t=>t.status==='REFUNDED').length;
  const ratings  = list.filter(t=>t.rating).map(t=>t.rating as number);
  const avg      = ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease' }}>

      {/* Profile banner */}
      <div style={{ background:`linear-gradient(135deg,rgba(245,196,108,.06),rgba(92,131,116,.04))`,border:`1px solid rgba(245,196,108,.14)`,borderRadius:24,padding:20,backdropFilter:'blur(12px)',boxShadow:`inset 0 1px 1px rgba(255,255,255,.05)` }}>

        {/* Avatar + info */}
        <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:20 }}>
          <div style={{ width:58,height:58,borderRadius:20,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,fontWeight:900,color:'#1A0E00',boxShadow:`0 4px 18px rgba(245,196,108,.28)`,flexShrink:0 }}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18,color:C.text }}>@{username}</div>
            <div style={{ display:'inline-flex',alignItems:'center',gap:5,marginTop:6,padding:'3px 10px',borderRadius:99,background:stats.badge.bg,color:stats.badge.color,fontSize:10,fontWeight:800,border:`1px solid ${stats.badge.color}20` }}>
              {stats.badge.emoji} {stats.badge.label}
            </div>
            <div style={{ fontSize:9,color:C.muted,marginTop:5 }}>Member since {stats.since.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
          </div>
        </div>

        {/* Trust ring */}
        <div style={{ display:'flex',alignItems:'center',gap:18 }}>
          <div style={{ position:'relative',width:96,height:96,flexShrink:0 }}>
            <svg width="96" height="96" viewBox="0 0 96 96" style={{ position:'absolute',inset:0 }}>
              <defs>
                <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={trust.color} />
                  <stop offset="100%" stopColor={trust.color} stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#rg)" strokeWidth="8"
                strokeDasharray={circ} strokeDashoffset={dash}
                strokeLinecap="round" transform="rotate(-90 48 48)"
                style={{ transition:'stroke-dashoffset 1s ease,stroke .5s ease' }} />
            </svg>
            <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
              <span style={{ fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:24,color:trust.color }}>{trust.score}</span>
              <span style={{ fontSize:8,fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',color:`${trust.color}60` }}>/ 100</span>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:4 }}>{trust.level}</div>
            {trust.score<30 && <InfoBox msg="Low trust score — build it by completing deals" type="terra" />}

            <button onClick={()=>setBreak(!showBreak)} type="button"
              style={{ fontSize:10,fontWeight:800,color:`rgba(245,196,108,.60)`,background:'none',border:'none',cursor:'pointer',marginTop:8,padding:0 }}>
              {showBreak?'Hide':'Show'} score breakdown {showBreak?'▲':'▼'}
            </button>

            {showBreak && (
              <div style={{ marginTop:10,display:'flex',flexDirection:'column',gap:5,animation:'fadeIn .2s ease' }}>
                {[
                  { l:'Base score',       v:'+50', c:C.muted },
                  { l:'1st deal',         v:released>=1?'+10':'0', c:released>=1?C.sage:C.muted },
                  { l:'5+ deals',         v:released>=5?'+10':'0', c:released>=5?C.sage:C.muted },
                  { l:'20+ deals',        v:released>=20?'+10':'0',c:released>=20?C.sage:C.muted },
                  { l:'Rating ≥ 4.5',     v:avg>=4.5?'+10':'0',   c:avg>=4.5?C.sage:C.muted },
                  { l:'Rating ≥ 3',       v:avg>=3&&avg<4.5?'+5':'0',c:avg>=3&&avg<4.5?C.sage:C.muted },
                  { l:'Active disputes',  v:disputed>0?`-${disputed*10}`:'0', c:disputed>0?C.terra:C.muted },
                  { l:'Refunded deals',   v:refunded>0?`-${refunded*5}`:'0',  c:refunded>0?C.terra:C.muted },
                ].map(({l,v,c})=>(
                  <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:10 }}>
                    <span style={{ color:C.muted }}>{l}</span>
                    <span style={{ fontWeight:800,color:c }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop:`1px solid rgba(245,196,108,.10)`,paddingTop:6,display:'flex',justifyContent:'space-between',fontSize:11,fontWeight:800 }}>
                  <span style={{ color:C.text }}>Total</span>
                  <span style={{ color:trust.color }}>{trust.score} / 100</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        {[
          { l:'Total Deals',v:stats.total,    c:C.gold },
          { l:'Completed',  v:stats.released, c:C.sage },
          { l:'As Buyer',   v:stats.asBuyer,  c:C.gold },
          { l:'As Seller',  v:stats.asSeller, c:C.sky  },
        ].map(({l,v,c})=>(
          <GlassCard key={l} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:30,color:c }}>{v}</div>
            <div style={{ fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted,marginTop:6 }}>{l}</div>
          </GlassCard>
        ))}
      </div>

      {/* Rating */}
      {stats.avg>0 && (
        <GlassCard>
          <div style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted,marginBottom:12 }}>Average Rating</div>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <Stars value={Math.round(stats.avg)} />
            <span style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold }}>{stats.avg.toFixed(1)}</span>
          </div>
        </GlassCard>
      )}

      {/* Recent deals */}
      <GlassCard style={{ padding:0,overflow:'hidden' }}>
        <div style={{ padding:'14px 18px',borderBottom:`1px solid rgba(245,196,108,.07)` }}>
          <div style={{ fontWeight:800,fontSize:13,color:C.text }}>Recent Deals</div>
        </div>
        {list.length===0 ? (
          <div style={{ textAlign:'center',padding:'32px 20px' }}>
            <div style={{ display:'flex',justifyContent:'center',marginBottom:10,opacity:.2 }}><Seal size={40} /></div>
            <div style={{ fontSize:13,fontWeight:800,color:C.muted }}>No transactions yet</div>
          </div>
        ) : list.slice(0,5).map((tx,i)=>(
          <div key={tx._id||i} style={{ padding:'12px 18px',display:'flex',alignItems:'center',gap:10,borderBottom:i<4?`1px solid rgba(245,196,108,.06)`:'none' }}>
            <span style={{ fontSize:8,fontWeight:800,padding:'2px 8px',borderRadius:8,flexShrink:0,background:tx.buyerUsername===username?`rgba(245,196,108,.08)`:`rgba(111,168,201,.08)`,color:tx.buyerUsername===username?C.gold:C.sky,border:`1px solid ${tx.buyerUsername===username?C.gold:C.sky}18` }}>
              {tx.buyerUsername===username?'Buyer':'Seller'}
            </span>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontFamily:'monospace',fontSize:11,fontWeight:800,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.transactionNumber||tx.escrowCode}</div>
              <div style={{ fontSize:9,color:C.muted,marginTop:2 }}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
            </div>
            <div style={{ textAlign:'right',flexShrink:0 }}>
              <div style={{ fontSize:11,fontWeight:800,color:C.text }}>{tx.amount} <span style={{ color:C.gold }}>π</span></div>
              <div style={{ marginTop:3 }}><Badge status={tx.status} /></div>
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TAB
// ─────────────────────────────────────────────────────────────────────────────
function AdminTab({ username }: { username: string }) {
  const [txs,setTxs]       = useState<Transaction[]>([]);
  const [stats,setStats]   = useState<any>(null);
  const [loading,setLoad]  = useState(false);
  const [selected,setSel]  = useState<Transaction|null>(null);
  const [reason,setReason] = useState('');
  const [msg,setMsg]       = useState<string|null>(null);
  const [err,setErr]       = useState<string|null>(null);
  const [filter,setFilter] = useState('ALL');

  const load = useCallback(async()=>{
    setLoad(true);
    try {
      const r = await api('/api/admin',{ action:'getAll', username });
      setTxs(r.transactions);
      setStats(r.stats);
    } catch(e:any) { setErr(e.message); }
    finally { setLoad(false); }
  },[username]);

  useEffect(()=>{ load(); },[load]);

  const doAction = async (action:string, escrowCode:string, extra?:object) => {
    setMsg(null); setErr(null);
    try {
      const r = await api('/api/admin',{ action, username, escrowCode, reason, ...extra });
      setMsg(r.message); setSel(null); setReason(''); load();
    } catch(e:any) { setErr(e.message); }
  };

  const FILTERS = ['ALL','PENDING','ACCEPTED','DELIVERED','FROZEN','RELEASED','REFUNDED','PENDING_ADMIN'];
  const filtered = filter==='ALL'?txs:txs.filter(t=>t.status===filter);

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease' }}>

      {/* Admin header */}
      <div style={{ display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:22,background:`linear-gradient(135deg,rgba(196,69,54,.12),rgba(155,138,196,.06))`,border:`1px solid rgba(196,69,54,.22)`,backdropFilter:'blur(8px)' }}>
        <div style={{ width:46,height:46,borderRadius:15,background:`rgba(196,69,54,.18)`,border:`1px solid rgba(196,69,54,.28)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🛡️</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.terra }}>Admin Panel</div>
          <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>Full control · @{username}</div>
        </div>
        <button onClick={load} type="button"
          style={{ width:36,height:36,borderRadius:12,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.08)`,color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>
          <span style={{ display:'inline-block',animation:loading?'spin .7s linear infinite':'none' }}>↻</span>
        </button>
      </div>

      {/* Platform stats */}
      {stats && (
        <GlassCard>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14 }}>
            <span style={{ fontSize:14 }}>📊</span>
            <span style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.gold }}>Platform Overview</span>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10 }}>
            {[
              { l:'Total Pi',  v:txs.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+t.amount,0).toFixed(3)+' π', c:C.gold },
              { l:'Revenue',   v:txs.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+(t.fee||t.amount*.001),0).toFixed(4)+' π', c:C.sage },
              { l:'Users',     v:new Set([...txs.map(t=>t.buyerUsername),...txs.filter(t=>t.sellerUsername).map(t=>t.sellerUsername!)]).size, c:C.sky },
            ].map(s=>(
              <div key={s.l} style={{ textAlign:'center',background:'rgba(255,255,255,.03)',border:`1px solid rgba(245,196,108,.08)`,borderRadius:14,padding:'10px 8px' }}>
                <div style={{ fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:14,color:s.c }}>{s.v}</div>
                <div style={{ fontSize:7.5,textTransform:'uppercase',letterSpacing:'.07em',color:C.muted,marginTop:3 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5 }}>
            {[
              { l:'Total',     v:stats.total,     c:C.text  },
              { l:'Pending',   v:stats.pending,   c:C.gold  },
              { l:'Delivered', v:stats.delivered, c:C.sky   },
              { l:'Frozen',    v:stats.frozen,    c:C.terra },
              { l:'Released',  v:stats.released,  c:C.sage  },
            ].map(s=>(
              <div key={s.l} style={{ background:'rgba(0,0,0,.3)',border:`1px solid rgba(255,255,255,.05)`,borderRadius:10,padding:'7px 4px',textAlign:'center' }}>
                <div style={{ fontWeight:800,fontSize:16,color:s.c }}>{s.v}</div>
                <div style={{ fontSize:6.5,textTransform:'uppercase',color:C.muted,marginTop:2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Filters */}
      <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} type="button"
            style={{ padding:'5px 10px',borderRadius:10,fontSize:8.5,fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',cursor:'pointer',border:'none',background:filter===f?`rgba(196,69,54,.18)`:'rgba(255,255,255,.04)',color:filter===f?C.terra:C.muted,borderWidth:1,borderStyle:'solid',borderColor:filter===f?`rgba(196,69,54,.30)`:'rgba(255,255,255,.07)' }}>
            {f}
          </button>
        ))}
      </div>

      {msg && <OkBox  msg={msg} />}
      {err && <ErrBox msg={err} />}

      {/* Action panel */}
      {selected && (
        <div style={{ padding:18,borderRadius:22,background:`rgba(196,69,54,.07)`,border:`1px solid rgba(196,69,54,.22)`,display:'flex',flexDirection:'column',gap:14,animation:'scaleIn .2s ease',backdropFilter:'blur(8px)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.1em',color:C.muted }}>Selected</div>
              <div style={{ fontFamily:'monospace',fontWeight:800,fontSize:13,color:C.terra,marginTop:3 }}>{selected.escrowCode}</div>
              <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>{selected.amount} π · @{selected.buyerUsername}</div>
            </div>
            <button onClick={()=>setSel(null)} type="button"
              style={{ width:32,height:32,borderRadius:10,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:16 }}>×</button>
          </div>
          <Inp label="Reason / Note">
            <input placeholder="Reason for this action…" value={reason} onChange={e=>setReason(e.target.value)} style={{ ...inpStyle }} />
          </Inp>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
            {[
              { label:'Refund Buyer',    action:'refund',  extra:{},                      c:C.sage   },
              { label:'Freeze',          action:'freeze',  extra:{},                      c:C.sky    },
              { label:'Release Seller',  action:'resolve', extra:{ resolveFor:'seller' }, c:C.gold   },
              { label:'Resolve Buyer',   action:'resolve', extra:{ resolveFor:'buyer'  }, c:C.violet },
            ].map(({label,action,extra,c})=>(
              <button key={label} onClick={()=>doAction(action,selected.escrowCode,extra)} type="button"
                style={{ padding:'11px 8px',borderRadius:14,fontSize:11,fontWeight:800,cursor:'pointer',background:`${c}12`,border:`1px solid ${c}28`,color:c }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={{ display:'flex',justifyContent:'center',padding:'32px 0' }}><div style={{ width:24,height:24,borderRadius:'50%',border:`2px solid ${C.terra}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} /></div>}

      {filtered.map(tx=>(
        <div key={tx._id} onClick={()=>setSel(selected?.escrowCode===tx.escrowCode?null:tx)}
          style={{ padding:16,borderRadius:22,cursor:'pointer',display:'flex',flexDirection:'column',gap:8,transition:'all .15s',background:selected?.escrowCode===tx.escrowCode?`rgba(196,69,54,.08)`:'rgba(255,255,255,.03)',border:`1px solid ${selected?.escrowCode===tx.escrowCode?'rgba(196,69,54,.35)':'rgba(245,196,108,.08)'}`,backdropFilter:'blur(8px)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <span style={{ fontFamily:'monospace',fontSize:11,fontWeight:800,color:`rgba(196,69,54,.80)` }}>{tx.transactionNumber||tx.escrowCode}</span>
            <Badge status={tx.status} />
          </div>
          <div style={{ display:'flex',justifyContent:'space-between',fontSize:10 }}>
            <span style={{ color:C.muted }}>@{tx.buyerUsername} → @{tx.sellerUsername||'?'}</span>
            <span style={{ fontWeight:800,color:C.text }}>{tx.amount} <span style={{ color:C.gold }}>π</span></span>
          </div>
          {tx.description && <div style={{ fontSize:9,color:`${C.muted}65`,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{tx.description}</div>}
          <div style={{ fontSize:9,color:`${C.muted}50` }}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
        </div>
      ))}

      {!loading&&filtered.length===0 && (
        <div style={{ textAlign:'center',padding:'48px 0' }}>
          <div style={{ display:'flex',justifyContent:'center',marginBottom:12,opacity:.2 }}><div style={{ fontSize:32 }}>🛡️</div></div>
          <div style={{ fontSize:14,fontWeight:800,color:C.text }}>No transactions</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
type TabKey = 'home'|'buyer'|'seller'|'transactions'|'receipts'|'stats'|'chat'|'profile'|'admin';

function App({ user, onLogout }: { user: PiUser; onLogout: ()=>void }) {
  const isOnline = useOnline();
  const [tab,setTab] = useState<TabKey>('home');
  const isAdmin = user.username==='GhaithriAHI96';

  const ICONS: { key:TabKey; label:string; emoji:string; bg:string; border?:string }[] = [
    { key:'buyer',        label:'Buyer',    emoji:'🔒', bg:'linear-gradient(160deg,#2B2419,#0E0C0B)' },
    { key:'seller',       label:'Seller',   emoji:'📦', bg:'linear-gradient(160deg,#1A2329,#0E0C0B)' },
    { key:'transactions', label:'Deals',    emoji:'🤝', bg:'linear-gradient(160deg,#1A2318,#0E0C0B)' },
    { key:'receipts',     label:'Receipts', emoji:'📄', bg:'linear-gradient(160deg,#2B2419,#0E0C0B)' },
    { key:'stats',        label:'Stats',    emoji:'📊', bg:'linear-gradient(160deg,#1E1A28,#0E0C0B)' },
    { key:'chat',         label:'Chat',     emoji:'💬', bg:'linear-gradient(160deg,#1A2329,#0E0C0B)' },
    { key:'profile',      label:'Profile',  emoji:'👤', bg:'linear-gradient(160deg,#2B2419,#0E0C0B)' },
    ...(isAdmin?[{ key:'admin' as TabKey, label:'Admin', emoji:'🛡️', bg:'linear-gradient(160deg,#281815,#0E0C0B)', border:'rgba(196,69,54,.22)' }]:[]),
  ];

  return (
    <main style={{ minHeight:'100vh',background:C.bg,color:C.text,paddingBottom:48 }}>
      <style>{GLOBAL_CSS}</style>

      {/* Top ambient glow */}
      <div style={{ position:'fixed',top:0,left:0,right:0,height:220,background:`radial-gradient(ellipse at 50% -30%,rgba(245,196,108,.06),transparent 70%)`,pointerEvents:'none',zIndex:0 }} />

      {/* Grid texture */}
      <div style={{ position:'fixed',inset:0,backgroundImage:`linear-gradient(rgba(245,196,108,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(245,196,108,.015) 1px,transparent 1px)`,backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0 }} />

      <div style={{ maxWidth:440,margin:'0 auto',padding:'24px 16px 0',position:'relative',zIndex:1 }}>

        {/* Offline banner */}
        {!isOnline && (
          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:16,fontSize:11,fontWeight:800,marginBottom:16,background:'rgba(196,69,54,.10)',color:C.terra,border:`1px solid rgba(196,69,54,.25)`,backdropFilter:'blur(8px)' }}>
            📡 No internet connection
          </div>
        )}

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <Seal size={44} />
            <div>
              <h1 style={{ fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:24,lineHeight:1,letterSpacing:'-0.02em',margin:0 }}>
                P<span style={{ color:C.gold }}>TRUST</span>
              </h1>
              <p style={{ fontSize:10,color:C.muted,margin:'2px 0 0' }}>@{user.username}</p>
            </div>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {tab!=='home' && (
              <button onClick={()=>setTab('home')} type="button"
                style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:12,fontSize:10,fontWeight:800,cursor:'pointer',background:'rgba(255,255,255,.04)',border:`1px solid rgba(245,196,108,.09)`,color:C.muted,backdropFilter:'blur(8px)' }}>
                🏠 Home
              </button>
            )}
            <div style={{ width:38,height:38,borderRadius:14,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#1A0E00',boxShadow:`0 3px 12px rgba(245,196,108,.25)` }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <button onClick={onLogout} type="button"
              style={{ width:38,height:38,borderRadius:14,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.07)`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted,fontSize:16,backdropFilter:'blur(8px)' }}>
              ⎋
            </button>
          </div>
        </div>

        {/* HOME — Icon Grid */}
        {tab==='home' && (
          <div style={{ animation:'fadeIn .3s ease' }}>
            {/* Onboarding tip */}
            <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',borderRadius:18,marginBottom:20,background:`rgba(245,196,108,.05)`,border:`1px solid rgba(245,196,108,.10)`,backdropFilter:'blur(8px)' }}>
              <span style={{ fontSize:18,flexShrink:0,lineHeight:1.3 }}>💡</span>
              <div>
                <div style={{ fontSize:12,fontWeight:800,color:C.text }}>New to PTrust?</div>
                <div style={{ fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5 }}>
                  Tap <strong style={{ color:C.gold }}>Buyer</strong> to create a secure escrow, or <strong style={{ color:C.sky }}>Seller</strong> to accept one. Funds stay locked until both parties confirm.
                </div>
              </div>
            </div>

            <div style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.2em',color:C.muted,marginBottom:14 }}>Quick Access</div>

            {/* ═══ ICON GRID — paddingBottom trick for Pi Browser ═══ */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
              {ICONS.map(({ key, label, emoji, bg, border })=>(
                <button key={key} onClick={()=>setTab(key)} type="button"
                  style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:0 }}>
                  {/* Outer square — paddingBottom:100% makes it a perfect square */}
                  <div style={{ width:'100%',paddingBottom:'100%',position:'relative',borderRadius:22,background:bg,border:`1px solid ${border||'rgba(245,196,108,.09)'}`,boxShadow:'0 6px 24px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.06)',overflow:'hidden' }}>
                    {/* Inner div centers emoji absolutely */}
                    <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34 }}>
                      {emoji}
                    </div>
                  </div>
                  <span style={{ fontSize:12,fontWeight:700,color:key==='admin'?C.terra:'#C8C0B4' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab content */}
        <div>
          {tab==='buyer'        && <BuyerTab        user={user} />}
          {tab==='seller'       && <SellerTab        user={user} />}
          {tab==='transactions' && <TransactionsTab  user={user} />}
          {tab==='receipts'     && <ReceiptsTab      username={user.username} />}
          {tab==='stats'        && <StatsTab         user={user} />}
          {tab==='chat'         && <ChatTab          username={user.username} />}
          {tab==='profile'      && <ProfileTab       username={user.username} />}
          {tab==='admin'        && isAdmin && <AdminTab username={user.username} />}
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading, authenticateUser } = usePiSDK();
  const [expired,setExpired] = useState(false);
  const [mounted,setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{ setMounted(true); },[]);

  const resetTimer = useCallback(()=>{
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(()=>setExpired(true), 30*60*1000);
  },[]);

  useEffect(()=>{
    if (!user) return;
    const events = ['mousemove','keydown','touchstart','click'];
    events.forEach(e=>window.addEventListener(e,resetTimer));
    resetTimer();
    return ()=>{
      events.forEach(e=>window.removeEventListener(e,resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  },[user,resetTimer]);

  if (!mounted) return null;

  if (expired) return (
    <main style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:C.bg,color:C.text }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ textAlign:'center',maxWidth:320,display:'flex',flexDirection:'column',alignItems:'center',gap:22,animation:'fadeIn .5s ease' }}>
        <Seal size={68} />
        <div>
          <h2 style={{ fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:28,margin:'0 0 8px' }}>Session Expired</h2>
          <p style={{ fontSize:13,color:C.muted,lineHeight:1.6,margin:0 }}>You were inactive for 30 minutes. Please sign in again.</p>
        </div>
        <PBtn onClick={()=>{ setExpired(false); authenticateUser(); }}>
          <span style={{ fontSize:20 }}>π</span> Sign In Again
        </PBtn>
      </div>
    </main>
  );

  if (loading) return (
    <main style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:22,animation:'fadeIn .5s ease' }}>
        <Seal size={76} />
        <h1 style={{ fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:40,color:C.text,margin:0 }}>
          P<span style={{ color:C.gold }}>TRUST</span>
        </h1>
        <div style={{ width:28,height:28,borderRadius:'50%',border:`2px solid ${C.gold}`,borderTopColor:'transparent',animation:'spin .7s linear infinite' }} />
        <p style={{ fontSize:11,textTransform:'uppercase',letterSpacing:'.3em',color:C.muted,margin:0 }}>Connecting to Pi Network…</p>
      </div>
    </main>
  );

  if (!user) return <Landing onLogin={authenticateUser} loading={loading} />;
  return <App user={user} onLogout={()=>window.location.reload()} />;
}
