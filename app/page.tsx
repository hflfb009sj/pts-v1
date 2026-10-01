'use client';
import React,{useState,useEffect,useCallback,useRef,useMemo} from 'react';
import{usePiSDK}from'@/components/PiSDKProvider';

// ── TYPES ────────────────────────────────────────────────────────────────────
interface PiUser{uid:string;username:string;}
type TxStatus='PENDING'|'ACCEPTED'|'DELIVERED'|'FROZEN'|'UNDER_REVIEW'|'RELEASED'|'REFUNDED'|'PENDING_ADMIN'|'EXPIRED';
interface Transaction{_id:string;transactionNumber:string;escrowCode:string;sellerWallet:string;buyerUsername:string;sellerUsername?:string;amount:number;fee:number;description:string;status:TxStatus;createdAt:string;deliveredAt?:string;releasedAt?:string;frozenAt?:string;evidenceDeadline?:string;autoReleaseDate?:string;rating?:number;kycVerified?:boolean;}
interface EscrowResult{transactionNumber:string;escrowCode:string;buyerKey:string;sellerKey:string;}

// ── DESIGN SYSTEM ────────────────────────────────────────────────────────────
const C={
  bg:'#060504',surface:'#0E0C0A',card:'#131110',card2:'#1A1816',
  gold:'#F5C46C',goldL:'#FFD97A',goldD:'#B8893E',
  steel:'#8A9BB0',sage:'#4A9B7F',terra:'#C44536',sky:'#5B9BD5',violet:'#9B8AC4',
  muted:'#8A8378',text:'#E8E4DC',textDim:'#C8C0B4',
  border:'rgba(245,196,108,0.08)',borderG:'rgba(245,196,108,0.18)',
} as const;

const STATUS_META:Record<TxStatus,{color:string;bg:string;label:string;icon:string}>={
  PENDING:      {color:'#F5C46C',bg:'rgba(245,196,108,0.08)',label:'Pending',     icon:'⏳'},
  ACCEPTED:     {color:'#5B9BD5',bg:'rgba(91,155,213,0.08)', label:'Accepted',    icon:'🤝'},
  DELIVERED:    {color:'#4A9B7F',bg:'rgba(74,155,127,0.08)', label:'Delivered',   icon:'📦'},
  FROZEN:       {color:'#5B9BD5',bg:'rgba(91,155,213,0.08)', label:'Frozen',      icon:'🧊'},
  UNDER_REVIEW: {color:'#9B8AC4',bg:'rgba(155,138,196,0.08)',label:'Under Review',icon:'⚖️'},
  RELEASED:     {color:'#4A9B7F',bg:'rgba(74,155,127,0.08)', label:'Released',    icon:'✅'},
  REFUNDED:     {color:'#5B9BD5',bg:'rgba(91,155,213,0.08)', label:'Refunded',    icon:'↩️'},
  PENDING_ADMIN:{color:'#C44536',bg:'rgba(196,69,54,0.08)',  label:'Admin Review',icon:'🛡️'},
  EXPIRED:      {color:'#8A8378',bg:'rgba(138,131,120,0.08)',label:'Expired',     icon:'⌛'},
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
async function api(url:string,body?:object):Promise<any>{
  const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{method:'GET'});
  const d=await r.json();if(!d.success)throw new Error(d.error||'Request failed');return d;
}
function calcTrust(txs:Transaction[]){
  let s=50;
  const rel=txs.filter(t=>t.status==='RELEASED').length;
  const dis=txs.filter(t=>['FROZEN','UNDER_REVIEW','PENDING_ADMIN'].includes(t.status)).length;
  const ref=txs.filter(t=>t.status==='REFUNDED').length;
  const rats=txs.filter(t=>t.rating).map(t=>t.rating as number);
  const avg=rats.length?rats.reduce((a,b)=>a+b,0)/rats.length:0;
  if(rel>=1)s+=5;if(rel>=5)s+=10;if(rel>=20)s+=15;if(rel>=50)s+=20;
  if(avg>=4.5)s+=10;else if(avg>=3.5)s+=5;
  s-=dis*15;s-=ref*10;s=Math.max(0,Math.min(100,s));
  const lv=s>=91?{label:'💎 Institutional',color:C.violet}:s>=71?{label:'⭐ Elite',color:C.sage}:s>=51?{label:'🟡 Trusted',color:C.gold}:s>=31?{label:'🔵 Pioneer',color:C.sky}:{label:'⚪ New User',color:C.muted};
  return{score:s,level:lv,disputed:dis};
}
function getBadge(r:number){return r>=50?'💎':r>=25?'⭐':r>=10?'🤝':r>=1?'🌱':'';}
function useOnline(){const[on,set]=useState(true);useEffect(()=>{const y=()=>set(true),n=()=>set(false);window.addEventListener('online',y);window.addEventListener('offline',n);if(typeof navigator!=='undefined')set(navigator.onLine);return()=>{window.removeEventListener('online',y);window.removeEventListener('offline',n);};},[]);return on;}
function usePiPrice(){
  const[price,setPrice]=useState<number|null>(null);const[loading,setLoad]=useState(true);const[src,setSrc]=useState('Kraken');
  useEffect(()=>{
    let c=false;
    const f=async()=>{try{const r=await fetch('https://api.kraken.com/0/public/Ticker?pair=PIUSD');const d=await r.json();const t=d?.result?.PIUSD??d?.result?.['PI/USD'];const p=t?parseFloat(t.c[0]):NaN;if(!c&&!isNaN(p)){setPrice(p);setSrc('Kraken');setLoad(false);return;}throw new Error('');}catch{try{const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');const d=await r.json();if(!c){setPrice(d?.['pi-network']?.usd??null);setSrc('CoinGecko');}}catch{if(!c)setPrice(null);}if(!c)setLoad(false);}};
    f();const iv=setInterval(f,60_000);return()=>{c=true;clearInterval(iv);};
  },[]);
  return{price,loading,src};
}

// ── GLOBAL CSS ───────────────────────────────────────────────────────────────
const GCSS=`
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes vaultSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(245,196,108,.15)}50%{box-shadow:0 0 45px rgba(245,196,108,.32)}}
@keyframes slideUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes countUp{from{opacity:0}to{opacity:1}}
*{-webkit-tap-highlight-color:transparent;}
button{transition:transform .15s ease,opacity .15s ease;}
button:active{transform:scale(0.96)!important;}
input,textarea{font-size:16px!important;}
`;

// ── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Seal({size=36}:{size?:number}){
  return<div style={{width:size,height:size,borderRadius:'50%',flexShrink:0,background:`radial-gradient(circle at 32% 28%,${C.goldL},${C.goldD} 65%,#8B5E1A)`,boxShadow:`0 0 0 1px rgba(255,220,120,.30),0 4px 20px rgba(245,196,108,.45),inset 0 2px 4px rgba(255,255,255,.35)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:size*.38,color:'#1A0E00',position:'relative'}}>π</div>;
}
function VaultDoor({size=80,spinning=false}:{size?:number;spinning?:boolean}){
  return<svg width={size} height={size} viewBox="0 0 80 80" style={{filter:'drop-shadow(0 4px 24px rgba(245,196,108,.38))'}}>
    <defs><radialGradient id="vg" cx="40%" cy="35%" r="60%"><stop offset="0%" stopColor="#2A2215"/><stop offset="100%" stopColor="#0E0C0A"/></radialGradient></defs>
    <circle cx="40" cy="40" r="38" fill="none" stroke={C.goldD} strokeWidth="2.5"/>
    <circle cx="40" cy="40" r="34" fill="url(#vg)" stroke="rgba(245,196,108,.18)" strokeWidth="1"/>
    <g transform="translate(40,40)" style={{animation:spinning?'vaultSpin 10s linear infinite':'none',transformOrigin:'0 0'}}>
      {[0,45,90,135,180,225,270,315].map(a=><line key={a} x1="0" y1="0" x2={Math.cos(a*Math.PI/180)*22} y2={Math.sin(a*Math.PI/180)*22} stroke={C.goldD} strokeWidth="2" strokeLinecap="round"/>)}
      <circle cx="0" cy="0" r="7" fill={C.goldD}/><circle cx="0" cy="0" r="4" fill={C.goldL}/>
    </g>
    {[{x:16,y:16},{x:64,y:16},{x:16,y:64},{x:64,y:64}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4.5" fill="none" stroke={C.goldD} strokeWidth="1.5"/>)}
    <text x="40" y="47" textAnchor="middle" fontFamily="'Fraunces',serif" fontWeight="900" fontSize="18" fill={C.gold} opacity=".92">π</text>
  </svg>;
}
function Spinner({color=C.gold,size=16}:{color?:string;size?:number}){return<div style={{width:size,height:size,borderRadius:'50%',border:`2px solid ${color}`,borderTopColor:'transparent',animation:'spin .7s linear infinite',flexShrink:0}}/>;}
function StatusBadge({status}:{status:TxStatus}){
  const m=STATUS_META[status]||STATUS_META.PENDING;
  return<span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.10em',padding:'3px 9px',borderRadius:999,background:m.bg,color:m.color,border:`1px solid ${m.color}22`}}><span style={{width:4,height:4,borderRadius:'50%',background:m.color,display:'inline-block'}}/>{m.label}</span>;
}
function ErrBox({msg}:{msg:string}){return<div style={{display:'flex',gap:10,padding:'12px 14px',borderRadius:14,fontSize:11,lineHeight:1.6,background:'rgba(196,69,54,.08)',color:C.terra,border:`1px solid rgba(196,69,54,.22)`,animation:'fadeIn .2s ease'}}>⚠️ {msg}</div>;}
function OkBox({msg}:{msg:string}){return<div style={{display:'flex',gap:10,padding:'12px 14px',borderRadius:14,fontSize:11,lineHeight:1.6,background:'rgba(74,155,127,.08)',color:C.sage,border:`1px solid rgba(74,155,127,.22)`,animation:'fadeIn .2s ease'}}>✓ {msg}</div>;}
function InfoBox({msg,type='gold'}:{msg:string;type?:'gold'|'sky'|'terra'|'sage'}){
  const col=type==='gold'?C.gold:type==='sky'?C.sky:type==='terra'?C.terra:C.sage;
  return<div style={{display:'flex',gap:8,padding:'11px 14px',borderRadius:14,fontSize:11,lineHeight:1.6,background:`${col}0d`,color:col,border:`1px solid ${col}22`}}>ℹ️ {msg}</div>;
}
function Glass({children,style,glow,onClick}:{children:React.ReactNode;style?:React.CSSProperties;glow?:boolean;onClick?:()=>void}){
  return<div onClick={onClick} style={{background:'rgba(255,255,255,0.025)',border:`1px solid ${glow?C.borderG:C.border}`,borderRadius:22,padding:18,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',boxShadow:glow?`0 0 0 1px rgba(245,196,108,.05),0 8px 40px rgba(0,0,0,.55),inset 0 1px 1px rgba(255,255,255,.06)`:`inset 0 1px 1px rgba(255,255,255,.03),0 4px 20px rgba(0,0,0,.35)`,animation:'fadeIn .3s ease',cursor:onClick?'pointer':'default',...style}}>{children}</div>;
}
function Btn({children,onClick,disabled,variant='gold',type='button',small=false}:{children:React.ReactNode;onClick?:()=>void;disabled?:boolean;variant?:'gold'|'sage'|'terra'|'ghost'|'sky';type?:'button'|'submit';small?:boolean}){
  const S:Record<string,React.CSSProperties>={
    gold:{background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',boxShadow:`0 6px 28px rgba(245,196,108,.30),inset 0 1px 1px rgba(255,255,255,.28)`},
    sage:{background:'rgba(74,155,127,.12)',color:C.sage,border:`1px solid rgba(74,155,127,.28)`},
    terra:{background:'rgba(196,69,54,.09)',color:C.terra,border:`1px solid rgba(196,69,54,.24)`},
    ghost:{background:'rgba(255,255,255,.04)',color:C.text,border:`1px solid rgba(245,196,108,.10)`},
    sky:{background:'rgba(91,155,213,.10)',color:C.sky,border:`1px solid rgba(91,155,213,.25)`},
  };
  return<button type={type} disabled={disabled} onClick={onClick} style={{width:'100%',padding:small?'10px 16px':'15px 20px',fontWeight:800,fontSize:small?12:13,borderRadius:small?13:17,border:'none',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.35:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,letterSpacing:'.02em',...S[variant]}}>{children}</button>;
}
function Field({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return<div style={{display:'flex',flexDirection:'column',gap:7}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingInline:2}}><span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.18em',color:'rgba(245,196,108,.65)'}}>{label}</span>{hint&&<span style={{fontSize:9,color:C.muted}}>{hint}</span>}</div>{children}</div>;
}
const IS:React.CSSProperties={width:'100%',background:'rgba(255,255,255,.04)',border:`1px solid ${C.border}`,borderRadius:15,padding:'13px 16px',color:C.text,outline:'none',boxShadow:'inset 0 1px 3px rgba(0,0,0,.35)',fontSize:13};
function Stars({value,onRate}:{value?:number;onRate?:(n:number)=>void}){
  const[hov,setHov]=useState(0);const[sel,setSel]=useState(value||0);
  return<div style={{display:'flex',gap:8}}>{[1,2,3,4,5].map(n=><button key={n} type="button" disabled={!onRate} onMouseEnter={()=>onRate&&setHov(n)} onMouseLeave={()=>onRate&&setHov(0)} onClick={()=>{if(onRate){setSel(n);onRate(n);}}} style={{background:'none',border:'none',cursor:onRate?'pointer':'default',padding:0,fontSize:24,color:n<=(hov||sel)?C.gold:'#2A2420',transition:'color .15s'}}>★</button>)}</div>;
}
function DealTracker({status}:{status:TxStatus}){
  const steps=['Created','Accepted','Delivered','Released'];
  const idx=status==='PENDING'?0:status==='ACCEPTED'?1:status==='DELIVERED'?2:status==='RELEASED'?3:0;
  return<div style={{background:'rgba(255,255,255,.02)',border:`1px solid ${C.border}`,borderRadius:16,padding:'14px 16px'}}><div style={{display:'flex',alignItems:'center'}}>{steps.map((s,i)=><React.Fragment key={s}><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5}}><div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,background:i<idx?`linear-gradient(135deg,${C.sage},#2D7A5F)`:i===idx?`linear-gradient(135deg,${C.goldL},${C.goldD})`:'rgba(255,255,255,.04)',color:i<idx?'#fff':i===idx?'#1A0E00':C.muted,boxShadow:i===idx?`0 0 0 4px rgba(245,196,108,.16),0 2px 10px rgba(245,196,108,.30)`:i<idx?`0 2px 8px rgba(74,155,127,.30)`:'none',border:i>idx?`1px solid rgba(255,255,255,.07)`:'none',transition:'all .4s ease'}}>{i<idx?'✓':i+1}</div><span style={{fontSize:8,fontWeight:700,color:i===idx?C.gold:i<idx?C.sage:C.muted,transition:'color .3s'}}>{s}</span></div>{i<3&&<div style={{flex:1,height:2,borderRadius:99,margin:'0 5px 18px',background:i<idx?`linear-gradient(90deg,${C.sage},#2D7A5F)`:'rgba(255,255,255,.06)',transition:'background .4s ease'}}/>}</React.Fragment>)}</div></div>;
}
function ProgBar({status}:{status:TxStatus}){
  const w=status==='PENDING'?'8%':status==='ACCEPTED'?'38%':status==='DELIVERED'?'72%':status==='RELEASED'?'100%':'8%';
  return<div style={{height:3,borderRadius:99,background:'rgba(255,255,255,.06)',overflow:'hidden'}}><div style={{height:'100%',borderRadius:99,width:w,background:`linear-gradient(90deg,${C.gold},${C.sage})`,boxShadow:`0 0 10px rgba(245,196,108,.45)`,transition:'width 1s ease'}}/></div>;
}

// ── LANDING ──────────────────────────────────────────────────────────────────
const HOW=[
  {n:'01',who:'Buyer', c:C.gold,  t:'Lock Funds in Vault',   b:'Buyer pays via Pi Browser. Gets a private Vault Key and a Partner Key to share with the seller.'},
  {n:'02',who:'Seller',c:C.sky,   t:'Accept the Deal',       b:'Seller enters Vault Code + Partner Key. Reviews terms and confirms. Funds stay locked.'},
  {n:'03',who:'Seller',c:C.sky,   t:'Deliver & Confirm',     b:'Seller delivers goods or service, then confirms delivery through the platform.'},
  {n:'04',who:'Buyer', c:C.sage,  t:'Release or Dispute',    b:'"Received" + Vault Key → funds released instantly. "Not Received" → vault freezes, dispute opens.'},
  {n:'05',who:'System',c:C.violet,t:'Auto-Resolution',       b:'15 days without action = auto-release. Disputes reviewed by admin within 5 days.'},
];
const FAQS=[
  {q:'Are my funds safe if the website goes down?',       a:'Yes. Funds are locked on the Pi blockchain. No one can move them without your private Vault Key.'},
  {q:'What is the fee?',                                  a:'Only 0.01% — the lowest possible. No hidden fees, no minimum, no maximum amount.'},
  {q:'What if I lose my Vault Key?',                      a:'The key is shown once at creation. Save it immediately. Contact support: Riahig45@gmail.com'},
  {q:'What if the seller never delivers?',                a:'Open a dispute. Submit evidence within 15 days. Admin resolves within 5 days of evidence close.'},
  {q:'Is PTrust Oracle on Pi Mainnet?',                   a:'Yes — PTrust Oracle runs on Pi Mainnet with real Pi payments via Pi Browser.'},
  {q:'Does it verify my identity and balance?',           a:'Yes. KYC is required for deals over 100 π. We verify your Pi identity before every vault creation.'},
];
function FaqItem({q,a}:{q:string;a:string}){
  const[o,setO]=useState(false);
  return<div style={{background:'rgba(255,255,255,.025)',border:`1px solid ${o?C.borderG:C.border}`,borderRadius:16,overflow:'hidden',transition:'border-color .2s'}}><button onClick={()=>setO(!o)} type="button" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:16,background:'none',border:'none',cursor:'pointer',textAlign:'left',gap:12}}><span style={{fontSize:12,fontWeight:700,color:C.text,lineHeight:1.4}}>{q}</span><div style={{width:26,height:26,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:o?`rgba(245,196,108,.14)`:'rgba(255,255,255,.05)',color:o?C.gold:C.muted,transform:o?'rotate(45deg)':'none',transition:'all .22s',fontSize:18}}>+</div></button>{o&&<div style={{padding:'13px 16px 16px',fontSize:11,color:C.muted,lineHeight:1.75,borderTop:`1px solid ${C.border}`}}>{a}</div>}</div>;
}
function Landing({onLogin,loading}:{onLogin:()=>void;loading:boolean}){
  const{price,loading:prLoad,src}=usePiPrice();const[sec,setSec]=useState<string|null>(null);
  return(
    <main style={{minHeight:'100vh',background:`radial-gradient(ellipse 500px 350px at 50% -80px,rgba(245,196,108,.08),transparent),radial-gradient(ellipse 700px 500px at 50% 100%,rgba(74,155,127,.04),transparent),${C.bg}`,color:C.text}}>
      <style>{GCSS}</style>
      <div style={{position:'fixed',inset:0,backgroundImage:`linear-gradient(rgba(245,196,108,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(245,196,108,.018) 1px,transparent 1px)`,backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:430,margin:'0 auto',padding:'0 20px 80px',position:'relative',zIndex:1}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',paddingTop:72,paddingBottom:40,gap:22,animation:'slideUp .6s ease'}}>
          <div style={{position:'relative'}}><VaultDoor size={100} spinning/><div style={{position:'absolute',inset:-20,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,196,108,.12),transparent 70%)',animation:'glow 3s ease infinite',pointerEvents:'none'}}/></div>
          <div>
            <h1 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:68,lineHeight:1,letterSpacing:'-0.03em',margin:0}}>P<span style={{color:C.gold}}>TRUST</span></h1>
            <p style={{fontFamily:"'Fraunces',serif",fontSize:12,fontWeight:600,letterSpacing:'.38em',textTransform:'uppercase',color:C.muted,marginTop:8}}>Oracle · Vault of Trust</p>
          </div>
          <p style={{fontSize:14,lineHeight:1.75,color:C.textDim,maxWidth:295,margin:0}}>The most secure escrow on Pi Network. Lock funds in the vault — release only when both parties confirm.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,width:'100%'}}>
            {[{v:'0.01%',l:'Platform Fee'},{v:'∞',l:'No Limits'},{v:'100%',l:'Secure'}].map(s=>(
              <div key={s.l} style={{background:'rgba(255,255,255,.025)',border:`1px solid ${C.border}`,borderRadius:18,padding:'14px 8px',textAlign:'center',backdropFilter:'blur(8px)'}}>
                <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold}}>{s.v}</div>
                <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.09em',color:C.muted,marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{width:'100%',padding:'14px 16px',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'space-between',background:`linear-gradient(135deg,rgba(245,196,108,.09),rgba(245,196,108,.02))`,border:`1px solid rgba(245,196,108,.20)`,backdropFilter:'blur(16px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}><Seal size={42}/>
              <div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',fontWeight:700,color:C.muted}}>Pi / USD · {src}</div>
                {prLoad?<div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}><Spinner size={14}/><span style={{fontSize:11,color:C.muted}}>Loading…</span></div>:<div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22,color:C.gold,marginTop:3}}>{price?'$'+price.toFixed(4):'Unavailable'}</div>}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:9,fontWeight:800,color:C.sage}}><div style={{width:7,height:7,borderRadius:'50%',background:C.sage,animation:'pulse 2s infinite'}}/>LIVE</div>
          </div>
          <div style={{width:'100%',padding:'13px 16px',borderRadius:20,background:'rgba(155,138,196,.08)',border:'1px solid rgba(155,138,196,.18)',backdropFilter:'blur(8px)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700,color:'rgba(155,138,196,.55)'}}>Pi Consensus Value · GCV</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18,color:'#C4B8F0',marginTop:4}}>1 π = 314,159 GCV</div><div style={{fontSize:9,color:C.muted,marginTop:3}}>Community Consensus · Global Currency Value</div></div>
              <span style={{fontSize:28}}>⚖️</span>
            </div>
          </div>
          <button onClick={onLogin} disabled={loading} type="button" style={{width:'100%',padding:'18px 24px',fontWeight:800,fontSize:15,borderRadius:22,border:'none',background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',boxShadow:`0 12px 48px rgba(245,196,108,.32),inset 0 1px 1px rgba(255,255,255,.30)`,cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1,display:'flex',alignItems:'center',justifyContent:'center',gap:12,transition:'all .2s'}}>
            {loading?<><Spinner color="#1A0E00" size={18}/>Connecting to Pi Network…</>:<><VaultDoor size={28}/>Open Your Vault</>}
          </button>
          <div style={{fontSize:10,color:C.muted,textAlign:'center',lineHeight:1.6}}>🔐 Pi Browser required · KYC verified · Balance checked before every vault</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,flexWrap:'wrap'}}>
            {[{i:'🔒',t:'Blockchain'},{i:'🔑',t:'Dual Key'},{i:'⚖️',t:'Fair Dispute'},{i:'🛡️',t:'KYC Verified'}].map(({i,t})=><div key={t} style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:C.muted}}><span>{i}</span>{t}</div>)}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {[
            {key:'how',icon:'🔄',title:'How the Vault Works',sub:'5 steps that protect every deal',content:<div>{HOW.map((s,i)=><div key={i} style={{display:'flex',gap:14,padding:'14px 0',borderBottom:i<4?`1px solid rgba(245,196,108,.06)`:'none'}}><div style={{width:36,height:36,borderRadius:12,background:`${s.c}12`,border:`1px solid ${s.c}28`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:s.c,flexShrink:0}}>{s.n}</div><div><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}><span style={{fontSize:13,fontWeight:800,color:C.text}}>{s.t}</span><span style={{fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:99,background:`${s.c}12`,color:s.c}}>{s.who}</span></div><p style={{fontSize:11,color:C.muted,lineHeight:1.65,margin:0}}>{s.b}</p></div></div>)}</div>},
            {key:'faq',icon:'❓',title:'Frequently Asked Questions',sub:'Everything you need to know',content:<div style={{display:'flex',flexDirection:'column',gap:8}}>{FAQS.map((f,i)=><FaqItem key={i} q={f.q} a={f.a}/>)}</div>},
          ].map(sc=>(
            <div key={sc.key} style={{background:'rgba(255,255,255,.025)',border:`1px solid ${sec===sc.key?C.borderG:C.border}`,borderRadius:20,overflow:'hidden',backdropFilter:'blur(8px)',transition:'border-color .2s'}}>
              <button onClick={()=>setSec(sec===sc.key?null:sc.key)} type="button" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:18,background:'none',border:'none',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:40,height:40,borderRadius:13,background:`rgba(245,196,108,.08)`,border:`1px solid rgba(245,196,108,.15)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{sc.icon}</div><div style={{textAlign:'left'}}><div style={{fontSize:13,fontWeight:800,color:C.text}}>{sc.title}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{sc.sub}</div></div></div>
                <span style={{fontSize:15,color:C.muted,transform:sec===sc.key?'rotate(180deg)':'none',transition:'transform .22s'}}>▾</span>
              </button>
              {sec===sc.key&&<div style={{padding:'0 18px 22px',borderTop:`1px solid ${C.border}`,animation:'fadeIn .22s ease'}}><div style={{paddingTop:18}}>{sc.content}</div></div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:36,textAlign:'center',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{padding:'12px 16px',borderRadius:14,background:'rgba(245,196,108,.04)',border:`1px solid rgba(245,196,108,.08)`,fontSize:10,color:C.muted,lineHeight:1.6}}>PTrust Oracle is a decentralized escrow service on Pi Network. All transactions are final once released. By using this platform you agree to our Terms of Service.</div>
          <p style={{fontSize:10,color:`${C.muted}55`}}>Support: <a href="mailto:Riahig45@gmail.com" style={{color:`${C.gold}70`}}>Riahig45@gmail.com</a></p>
          <div style={{display:'flex',justifyContent:'center',gap:16}}><a href="/privacy" style={{fontSize:10,color:`${C.muted}45`}}>Privacy Policy</a><span style={{color:`${C.muted}25`}}>·</span><a href="/terms" style={{fontSize:10,color:`${C.muted}45`}}>Terms of Service</a></div>
        </div>
      </div>
    </main>
  );
}

// ── VAULT TAB ─────────────────────────────────────────────────────────────────
function VaultTab({user}:{user:PiUser}){
  const[wallet,setWallet]=useState('');const[amount,setAmount]=useState('');const[desc,setDesc]=useState('');
  const[busy,setBusy]=useState(false);const[err,setErr]=useState<string|null>(null);const[result,setResult]=useState<EscrowResult|null>(null);
  const[showBK,setShowBK]=useState(false);const[showSK,setShowSK]=useState(false);
  const[showKyc,setShowKyc]=useState(false);const[kycOk,setKycOk]=useState(false);
  const[rCode,setRCode]=useState('');const[rKey,setRKey]=useState('');const[rConf,setRConf]=useState('');
  const[rBusy,setRBusy]=useState(false);const[rErr,setRErr]=useState<string|null>(null);const[rOk,setROk]=useState<string|null>(null);
  const[dCode,setDCode]=useState('');const[dReason,setDReason]=useState('');
  const[dBusy,setDBusy]=useState(false);const[dErr,setDErr]=useState<string|null>(null);const[dOk,setDOk]=useState<string|null>(null);
  const[eCode,setECode]=useState('');const[eText,setEText]=useState('');
  const[eBusy,setEBusy]=useState(false);const[eErr,setEErr]=useState<string|null>(null);const[eOk,setEOk]=useState(false);
  const fee=useMemo(()=>{const v=parseFloat(amount);return isNaN(v)||v<=0?0:v*0.0001;},[amount]);
  const total=useMemo(()=>{const v=parseFloat(amount);return isNaN(v)?0:v+fee;},[amount,fee]);

  const doCreate=async()=>{
    setBusy(true);setErr(null);setResult(null);
    try{
      const win=window as any;if(!win.Pi)throw new Error('Please open this app inside Pi Browser');
      let pending:EscrowResult|null=null;
      await new Promise<void>((res,rej)=>{
        win.Pi.createPayment({amount:total,memo:('PTrust Vault: '+(desc||'Escrow')).substring(0,28),metadata:{seller:wallet,buyer:user.username}},{
          onReadyForServerApproval:async(pid:string)=>{try{const r=await api('/api/escrow/create',{paymentId:pid,sellerWallet:wallet,amount:parseFloat(amount),fee,description:desc||'No description',buyerUsername:user.username});pending={transactionNumber:r.transactionNumber,escrowCode:r.escrowCode,buyerKey:r.buyerKey,sellerKey:r.sellerKey};}catch(e:any){rej(e);}},
          onReadyForServerCompletion:async(pid:string,txid:string)=>{try{await api('/api/escrow/finalize',{paymentId:pid,txid});setResult(pending);setAmount('');setWallet('');setDesc('');res();}catch(e:any){rej(e);}},
          onCancel:()=>rej(new Error('Payment cancelled by user')),
          onError:(e:Error)=>rej(e),
        });
      });
    }catch(e:any){setErr(e.message);}finally{setBusy(false);}
  };
  const handleCreate=async(e:React.FormEvent)=>{e.preventDefault();if(!wallet.trim()){setErr('Enter seller wallet address');return;}if(!parseFloat(amount)||parseFloat(amount)<=0){setErr('Enter a valid amount');return;}if(parseFloat(amount)>=100&&!kycOk){setShowKyc(true);return;}doCreate();};
  const handleRelease=async(e:React.FormEvent)=>{e.preventDefault();setRBusy(true);setRErr(null);setROk(null);try{await api('/api/escrow/release',{escrowCode:rCode.toUpperCase(),buyerKey:rKey,confirmText:rConf,buyerUsername:user.username});setROk('Funds released successfully!');setRCode('');setRKey('');setRConf('');}catch(e:any){setRErr(e.message);}finally{setRBusy(false);};};
  const handleDispute=async(e:React.FormEvent)=>{e.preventDefault();setDBusy(true);setDErr(null);setDOk(null);try{const r=await api('/api/escrow/dispute',{escrowCode:dCode.toUpperCase(),buyerUsername:user.username,reason:dReason});setDOk(`Dispute opened. Deadline: ${new Date(r.evidenceDeadline).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`);setDCode('');setDReason('');}catch(e:any){setDErr(e.message);}finally{setDBusy(false);};};
  const handleEvidence=async(e:React.FormEvent)=>{e.preventDefault();setEBusy(true);setEErr(null);setEOk(false);try{await api('/api/escrow/evidence',{escrowCode:eCode.toUpperCase(),username:user.username,content:eText});setEOk(true);setEText('');}catch(e:any){setEErr(e.message);}finally{setEBusy(false);};};

  const shareVault=(code:string,sk:string)=>{
    const win=window as any;
    const text=`PTrust Oracle Vault Deal\n\nVault Code: ${code}\nPartner Key: ${sk}\n\nOpen: https://pts-v1.vercel.app`;
    if(win.Pi?.shareFile){try{win.Pi.shareFile({text});return;}catch{}}
    if(navigator.share){navigator.share({title:'PTrust Oracle',text}).catch(()=>{});return;}
    window.open('https://wa.me/?text='+encodeURIComponent(text));
  };

  return(
    <div style={{display:'flex',flexDirection:'column',gap:16,animation:'fadeIn .3s ease'}}>
      {showKyc&&<div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'rgba(6,5,4,.95)',backdropFilter:'blur(20px)'}}>
        <div style={{maxWidth:370,width:'100%',background:C.card,border:`1.5px solid rgba(245,196,108,.28)`,borderRadius:28,padding:28,display:'flex',flexDirection:'column',gap:20,animation:'scaleIn .22s ease',boxShadow:`0 32px 80px rgba(0,0,0,.85)`}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}><VaultDoor size={50}/><div><div style={{fontWeight:800,fontSize:15,color:C.gold}}>KYC Required</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Deals over 100 π require verified identity</div></div></div>
          <p style={{fontSize:12,lineHeight:1.75,color:C.textDim,margin:0}}>To protect both parties, Pi Network requires KYC completion for large transactions. Both buyer and seller must have completed KYC on Pi Network.</p>
          <label style={{display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer'}}><input type="checkbox" checked={kycOk} onChange={e=>setKycOk(e.target.checked)} style={{marginTop:2,accentColor:C.gold,width:18,height:18}}/><span style={{fontSize:12,color:C.textDim,lineHeight:1.6}}>I confirm both parties have completed KYC verification on Pi Network</span></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <button onClick={()=>setShowKyc(false)} type="button" style={{padding:'13px',borderRadius:15,fontWeight:800,fontSize:12,background:'rgba(255,255,255,.04)',color:C.muted,border:`1px solid rgba(255,255,255,.08)`,cursor:'pointer'}}>Cancel</button>
            <button disabled={!kycOk} onClick={()=>{setShowKyc(false);doCreate();}} type="button" style={{padding:'13px',borderRadius:15,fontWeight:800,fontSize:12,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',border:'none',cursor:kycOk?'pointer':'not-allowed',opacity:kycOk?1:.35}}>Proceed</button>
          </div>
        </div>
      </div>}

      {!result?(
        <Glass glow>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><div style={{width:46,height:46,borderRadius:15,background:'rgba(245,196,108,.10)',border:`1px solid rgba(245,196,108,.20)`,display:'flex',alignItems:'center',justifyContent:'center'}}><VaultDoor size={32}/></div><div><div style={{fontSize:16,fontWeight:800,color:C.text}}>Lock Funds in Vault</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Pi Browser payment · 0.01% fee · No limits</div></div></div>
          <form onSubmit={handleCreate} style={{display:'flex',flexDirection:'column',gap:14}}>
            <Field label="Seller Wallet Address"><input required placeholder="G… (Pi/Stellar wallet address)" value={wallet} onChange={e=>setWallet(e.target.value)} style={{...IS}}/></Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Field label="Amount (π)"><input required type="number" min="0" step="any" placeholder="0.000000" value={amount} onChange={e=>setAmount(e.target.value)} style={{...IS,fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:24,color:C.gold,textAlign:'center',background:'rgba(245,196,108,.05)',border:`1px solid rgba(245,196,108,.16)`}}/></Field>
              <Field label="Vault Fee (0.01%)" hint="auto"><div style={{...IS,fontSize:20,fontWeight:800,color:C.muted,display:'flex',alignItems:'center',justifyContent:'center',userSelect:'none'}}>{fee>0?fee.toFixed(6):'—'}</div></Field>
            </div>
            {amount&&parseFloat(amount)>0&&<div style={{padding:'10px 14px',borderRadius:14,background:'rgba(245,196,108,.05)',border:`1px solid rgba(245,196,108,.10)`,display:'flex',justifyContent:'space-between',fontSize:11}}><span style={{color:C.muted}}>Total charged to your wallet</span><span style={{fontFamily:"'Fraunces',serif",fontWeight:800,color:C.gold}}>{total.toFixed(6)} π</span></div>}
            <Field label="Deal Description" hint="optional"><textarea placeholder="Describe what is being bought or sold — appears in the contract PDF…" value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{...IS,resize:'none',lineHeight:1.65,fontSize:12,color:C.textDim}}/></Field>
            {err&&<ErrBox msg={err}/>}
            <Btn type="submit" disabled={busy||!amount||!wallet}>{busy?<><Spinner color="#1A0E00" size={16}/>Processing Payment…</>:<><VaultDoor size={22}/>Lock Funds in Vault</>}</Btn>
          </form>
        </Glass>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:14,animation:'slideUp .4s ease'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderRadius:18,background:'rgba(74,155,127,.08)',border:`1px solid rgba(74,155,127,.22)`}}><div style={{width:40,height:40,borderRadius:12,background:'rgba(74,155,127,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>🔐</div><div><div style={{fontSize:14,fontWeight:800,color:C.sage}}>Vault Locked Successfully!</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Save your keys now — they are shown only once</div></div></div>
          <Glass><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:C.muted,marginBottom:7}}>Transaction Reference</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:13,color:C.gold,marginBottom:12}}>{result.transactionNumber}</div><button onClick={()=>navigator.clipboard?.writeText(result.transactionNumber)} type="button" style={{fontSize:10,fontWeight:700,padding:'6px 14px',borderRadius:9,background:'rgba(255,255,255,.05)',color:C.muted,border:`1px solid rgba(255,255,255,.09)`,cursor:'pointer'}}>📋 Copy Reference</button></Glass>
          <div style={{background:`linear-gradient(135deg,rgba(245,196,108,.08),rgba(245,196,108,.02))`,border:`2px solid rgba(245,196,108,.28)`,borderRadius:22,padding:18,backdropFilter:'blur(16px)'}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.16em',color:'rgba(245,196,108,.55)',marginBottom:10}}>Vault Code — Share with Seller</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:38,color:C.gold,letterSpacing:'.12em',marginBottom:14,textShadow:`0 0 30px rgba(245,196,108,.35)`}}>{result.escrowCode}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>navigator.clipboard?.writeText(result.escrowCode)} type="button" style={{fontSize:10,fontWeight:700,padding:'7px 14px',borderRadius:10,background:'rgba(255,255,255,.06)',color:C.muted,border:`1px solid rgba(255,255,255,.09)`,cursor:'pointer'}}>📋 Copy Code</button><button onClick={()=>shareVault(result.escrowCode,result.sellerKey)} type="button" style={{fontSize:10,fontWeight:700,padding:'7px 14px',borderRadius:10,background:'rgba(74,155,127,.12)',color:C.sage,border:`1px solid rgba(74,155,127,.25)`,cursor:'pointer'}}>📱 Share with Seller</button></div></div>
          <Glass><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:'rgba(245,196,108,.62)'}}>🔑 Your Vault Key — Keep Secret</div><button onClick={()=>setShowBK(!showBK)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:14}}>{showBK?'🙈':'👁️'}</button></div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:15,color:C.text,marginBottom:8,letterSpacing:'.06em'}}>{showBK?result.buyerKey:'BK-••••••••••••••••'}</div><div style={{fontSize:10,color:'rgba(245,196,108,.45)',marginBottom:12,lineHeight:1.5}}>🚨 Never share this key. Required to release funds or open a dispute.</div><button onClick={()=>navigator.clipboard?.writeText(result.buyerKey)} type="button" style={{fontSize:10,fontWeight:700,padding:'6px 14px',borderRadius:9,background:'rgba(255,255,255,.05)',color:C.muted,border:`1px solid rgba(255,255,255,.09)`,cursor:'pointer'}}>📋 Copy Vault Key</button></Glass>
          <Glass><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.15em',color:'rgba(91,155,213,.62)'}}>🤝 Partner Key — Send to Seller</div><button onClick={()=>setShowSK(!showSK)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:14}}>{showSK?'🙈':'👁️'}</button></div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:15,color:C.text,marginBottom:8,letterSpacing:'.06em'}}>{showSK?result.sellerKey:'SK-••••••••••••••••'}</div><div style={{fontSize:10,color:'rgba(91,155,213,.45)',marginBottom:12,lineHeight:1.5}}>Share this with your seller — required to accept the deal.</div><button onClick={()=>navigator.clipboard?.writeText(result.sellerKey)} type="button" style={{fontSize:10,fontWeight:700,padding:'6px 14px',borderRadius:9,background:'rgba(255,255,255,.05)',color:C.muted,border:`1px solid rgba(255,255,255,.09)`,cursor:'pointer'}}>📋 Copy Partner Key</button></Glass>
          <InfoBox msg="Send the Vault Code AND Partner Key to your seller. Keep your Vault Key private and safe." type="gold"/>
          <button onClick={()=>{setResult(null);setShowBK(false);setShowSK(false);}} type="button" style={{width:'100%',padding:13,fontSize:12,fontWeight:800,color:C.muted,background:'none',border:'none',cursor:'pointer'}}>+ Create Another Vault</button>
        </div>
      )}

      <Glass>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><div style={{width:46,height:46,borderRadius:15,background:'rgba(74,155,127,.10)',border:`1px solid rgba(74,155,127,.20)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>✅</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Confirm Receipt</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Release funds after receiving goods or service</div></div></div>
        <form onSubmit={handleRelease} style={{display:'flex',flexDirection:'column',gap:13}}>
          <Field label="Vault Code"><input required placeholder="PTO-XXXXXX" value={rCode} onChange={e=>setRCode(e.target.value.toUpperCase())} style={{...IS,fontFamily:'monospace',fontWeight:800,fontSize:18,color:C.gold,textAlign:'center',letterSpacing:'.14em'}}/></Field>
          <Field label="Your Vault Key"><input required placeholder="BK-XXXXXXXXXXXXXXXX" value={rKey} onChange={e=>setRKey(e.target.value)} style={{...IS}}/></Field>
          <div style={{background:'rgba(245,196,108,.04)',border:`1px solid rgba(245,196,108,.12)`,borderRadius:15,padding:14}}><div style={{fontSize:10,fontWeight:800,color:'rgba(245,196,108,.70)',marginBottom:9}}>⚠️ This action is irreversible. Type CONFIRM to proceed.</div><input placeholder="CONFIRM" value={rConf} onChange={e=>setRConf(e.target.value)} style={{width:'100%',background:C.bg,border:`1px solid rgba(245,196,108,.22)`,borderRadius:12,padding:'13px 16px',fontSize:15,fontWeight:800,textAlign:'center',letterSpacing:'.35em',color:rConf==='CONFIRM'?C.sage:C.gold,outline:'none'}}/></div>
          {rErr&&<ErrBox msg={rErr}/>}{rOk&&<OkBox msg={rOk}/>}
          <Btn type="submit" variant="sage" disabled={rBusy||!!rOk||rConf!=='CONFIRM'||!rCode||!rKey}>{rBusy?<><Spinner color={C.sage} size={16}/>Releasing Funds…</>:'✅ Received — Release Funds to Seller'}</Btn>
        </form>
      </Glass>

      <Glass>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><div style={{width:46,height:46,borderRadius:15,background:'rgba(196,69,54,.10)',border:`1px solid rgba(196,69,54,.20)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>⚖️</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Not Received — Open Dispute</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Freeze vault and start resolution process</div></div></div>
        <form onSubmit={handleDispute} style={{display:'flex',flexDirection:'column',gap:13}}>
          <Field label="Vault Code"><input required placeholder="PTO-XXXXXX" value={dCode} onChange={e=>setDCode(e.target.value.toUpperCase())} style={{...IS,fontFamily:'monospace',fontWeight:800,fontSize:18,textAlign:'center',letterSpacing:'.14em'}}/></Field>
          <Field label="Describe the Issue"><textarea required placeholder="What went wrong? Provide as much detail as possible…" value={dReason} onChange={e=>setDReason(e.target.value)} rows={4} style={{...IS,resize:'none',lineHeight:1.65,fontSize:12}}/></Field>
          {dErr&&<ErrBox msg={dErr}/>}{dOk&&<OkBox msg={dOk}/>}
          <Btn type="submit" variant="terra" disabled={dBusy||!!dOk}>{dBusy?<><Spinner color={C.terra} size={16}/>Opening Dispute…</>:'⚖️ Freeze Vault & Open Dispute'}</Btn>
        </form>
      </Glass>

      <Glass>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><div style={{width:46,height:46,borderRadius:15,background:'rgba(91,155,213,.10)',border:`1px solid rgba(91,155,213,.20)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📋</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Submit Evidence</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>15-day window · Max 10 items per party</div></div></div>
        <form onSubmit={handleEvidence} style={{display:'flex',flexDirection:'column',gap:13}}>
          <Field label="Vault Code"><input required placeholder="PTO-XXXXXX" value={eCode} onChange={e=>setECode(e.target.value.toUpperCase())} style={{...IS,fontFamily:'monospace',fontWeight:800,fontSize:18,textAlign:'center',letterSpacing:'.14em'}}/></Field>
          <Field label="Evidence" hint="Links, tracking, proof"><textarea required placeholder="URLs, tracking numbers, screenshots description, transaction IDs…" value={eText} onChange={e=>setEText(e.target.value)} rows={4} style={{...IS,resize:'none',lineHeight:1.65,fontSize:12}}/></Field>
          {eErr&&<ErrBox msg={eErr}/>}{eOk&&<OkBox msg="Evidence submitted successfully."/>}
          <Btn type="submit" variant="ghost" disabled={eBusy||!eCode||!eText}>{eBusy?<><Spinner size={16}/>Submitting…</>:'📋 Submit Evidence'}</Btn>
        </form>
      </Glass>
    </div>
  );
}

// ── TRADE TAB ─────────────────────────────────────────────────────────────────
function TradeTab({user}:{user:PiUser}){
  const[code,setCode]=useState('');const[key,setKey]=useState('');const[tx,setTx]=useState<Transaction|null>(null);const[err,setErr]=useState<string|null>(null);const[busy,setBusy]=useState(false);const[rated,setRated]=useState(false);
  const delay=tx&&tx.status==='ACCEPTED'&&(Date.now()-new Date(tx.createdAt).getTime())>3*24*60*60*1000;
  const autoRelease=tx?.autoReleaseDate?Math.max(0,Math.ceil((new Date(tx.autoReleaseDate).getTime()-Date.now())/(1000*60*60*24))):null;
  const lookup=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr(null);setTx(null);try{const r=await fetch('/api/escrow/transaction/'+code.toUpperCase());const d=await r.json();if(!d.success)throw new Error(d.error);setTx(d.transaction);}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const accept=async()=>{if(!tx||!key){setErr('Please enter your Partner Key');return;}setBusy(true);setErr(null);try{await api('/api/escrow/accept',{escrowCode:tx.escrowCode,sellerUsername:user.username,sellerKey:key});setTx({...tx,status:'ACCEPTED',sellerUsername:user.username});setKey('');}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const deliver=async()=>{if(!tx)return;setBusy(true);setErr(null);try{await api('/api/escrow/complete',{escrowCode:tx.escrowCode,sellerUsername:user.username});setTx({...tx,status:'DELIVERED'});}catch(e:any){setErr(e.message);}finally{setBusy(false);};};
  const rate=async(n:number)=>{if(!tx)return;try{await api('/api/escrow/rate',{escrowCode:tx.escrowCode,rating:n,raterUsername:user.username});setRated(true);}catch{}};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16,animation:'fadeIn .3s ease'}}>
      <Glass glow>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}><div style={{width:46,height:46,borderRadius:15,background:'rgba(91,155,213,.10)',border:`1px solid rgba(91,155,213,.20)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📦</div><div><div style={{fontSize:16,fontWeight:800,color:C.text}}>Seller — Trade Portal</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Enter Vault Code to view and accept deal</div></div></div>
        {!tx?(
          <form onSubmit={lookup} style={{display:'flex',flexDirection:'column',gap:14}}>
            <Field label="Vault Code" hint="Given by buyer"><input required placeholder="PTO-XXXXXX" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} style={{...IS,fontFamily:'monospace',fontWeight:900,fontSize:28,textAlign:'center',letterSpacing:'.18em',color:C.gold,background:'rgba(245,196,108,.05)',border:`1px solid rgba(245,196,108,.18)`}}/></Field>
            <Field label="Partner Key" hint="Given by buyer"><input placeholder="SK-XXXXXXXXXXXXXXXX" value={key} onChange={e=>setKey(e.target.value)} style={{...IS}}/></Field>
            {err&&<ErrBox msg={err}/>}
            <Btn type="submit" disabled={busy||!code}>{busy?<><Spinner color="#1A0E00" size={16}/>Looking Up…</>:<>🔍 Find Vault Deal</>}</Btn>
          </form>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <ProgBar status={tx.status}/><DealTracker status={tx.status}/>
            {delay&&<InfoBox msg="⚠️ 3+ days since acceptance without delivery — buyer may open a dispute" type="terra"/>}
            {autoRelease!==null&&tx.status==='DELIVERED'&&<InfoBox msg={`Auto-release in ${autoRelease} day${autoRelease!==1?'s':''} if no action taken`} type="gold"/>}
            <div style={{background:'rgba(255,255,255,.02)',border:`1px solid ${C.border}`,borderRadius:18,padding:16,display:'flex',flexDirection:'column',gap:11}}>
              {[{l:'Reference',v:<span style={{fontFamily:'monospace',fontWeight:800,fontSize:12,color:C.gold}}>{tx.transactionNumber}</span>},{l:'Vault Code',v:<span style={{fontFamily:'monospace',fontWeight:800,color:C.gold}}>{tx.escrowCode}</span>},{l:'Amount',v:<span style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:22}}>{tx.amount} <span style={{color:C.gold}}>π</span></span>},{l:'Fee (0.01%)',v:<span style={{fontSize:12,color:C.muted}}>{tx.fee?.toFixed(6)} π</span>},{l:'Buyer',v:<span style={{fontWeight:800,fontSize:14}}>@{tx.buyerUsername}</span>},{l:'Status',v:<StatusBadge status={tx.status}/>}].map(({l,v})=><div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.14em',color:C.muted}}>{l}</span>{v}</div>)}
              {tx.description&&<div style={{paddingTop:11,borderTop:`1px solid ${C.border}`}}><div style={{fontSize:9,textTransform:'uppercase',fontWeight:800,letterSpacing:'.14em',color:C.muted,marginBottom:7}}>Deal Terms</div><p style={{fontSize:13,lineHeight:1.65,color:C.text,margin:0}}>{tx.description}</p></div>}
            </div>
            {tx.status==='PENDING'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><InfoBox msg="Review all deal terms carefully. Enter your Partner Key to accept." type="sky"/><Field label="Partner Key"><input placeholder="SK-XXXXXXXXXXXXXXXX" value={key} onChange={e=>setKey(e.target.value)} style={{...IS}}/></Field><Btn onClick={accept} disabled={busy||!key}>{busy?<><Spinner color="#1A0E00" size={16}/>…</>:<>🤝 Accept Deal</>}</Btn></div>}
            {tx.status==='ACCEPTED'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><InfoBox msg="Deal accepted. Complete delivery then confirm below." type="sky"/><Btn onClick={deliver} disabled={busy}>{busy?<><Spinner color="#1A0E00" size={16}/>…</>:<>📦 Confirm Delivery Sent</>}</Btn></div>}
            {tx.status==='DELIVERED'&&<InfoBox msg="✅ Delivery confirmed. Waiting for buyer to release funds." type="sage"/>}
            {tx.status==='FROZEN'&&<InfoBox msg="🧊 Vault frozen. Submit your evidence within 15 days." type="sky"/>}
            {tx.status==='UNDER_REVIEW'&&<InfoBox msg="⚖️ Admin reviewing evidence. Decision within 5 days." type="sky"/>}
            {tx.status==='RELEASED'&&<div style={{display:'flex',flexDirection:'column',gap:12}}><OkBox msg={`${tx.amount} π released to your wallet!`}/>{!rated?<Glass><div style={{fontSize:11,fontWeight:800,color:C.muted,marginBottom:12}}>Rate this deal</div><Stars onRate={rate}/></Glass>:<OkBox msg="Thank you for your rating!"/>}</div>}
            {tx.status==='REFUNDED'&&<InfoBox msg="Dispute resolved in favor of the buyer." type="sky"/>}
            {err&&<ErrBox msg={err}/>}
            <button onClick={()=>{setTx(null);setCode('');setKey('');setErr(null);setRated(false);}} type="button" style={{width:'100%',padding:13,fontSize:12,fontWeight:800,color:C.muted,background:'none',border:'none',cursor:'pointer'}}>← Look Up Another Deal</button>
          </div>
        )}
      </Glass>
    </div>
  );
}

// ── CONTRACTS TAB ─────────────────────────────────────────────────────────────
function ContractsTab({user}:{user:PiUser}){
  const[list,setList]=useState<Transaction[]>([]);const[loading,setLoad]=useState(false);const[search,setSearch]=useState('');const[filter,setFilter]=useState<TxStatus|'ALL'>('ALL');
  const load=useCallback(async()=>{setLoad(true);try{const r=await fetch('/api/escrow/transactions?username='+user.username);const d=await r.json();setList(d.transactions||[]);}catch{setList([]);}finally{setLoad(false);};},[user.username]);
  useEffect(()=>{load();},[load]);
  const filtered=useMemo(()=>{let res=list;if(filter!=='ALL')res=res.filter(t=>t.status===filter);if(search.trim()){const q=search.toLowerCase();res=res.filter(t=>t.escrowCode?.toLowerCase().includes(q)||t.transactionNumber?.toLowerCase().includes(q)||t.buyerUsername?.toLowerCase().includes(q)||t.sellerUsername?.toLowerCase().includes(q)||t.description?.toLowerCase().includes(q));}return res;},[list,filter,search]);
  const rateContract=async(escrowCode:string,n:number)=>{try{await api('/api/escrow/rate',{escrowCode,rating:n,raterUsername:user.username});setList(prev=>prev.map(t=>t.escrowCode===escrowCode?{...t,rating:n}:t));}catch{}};
  const generatePDF=(tx:Transaction)=>{
    const w=window.open('','_blank');if(!w)return;
    w.document.write(`<!DOCTYPE html><html><head><title>PTrust Contract ${tx.transactionNumber}</title><style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=Inter:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;background:#fff;color:#1C1A17;padding:48px;max-width:680px;margin:0 auto;}.header{text-align:center;padding-bottom:32px;margin-bottom:36px;border-bottom:3px solid #F5C46C;}.logo{font-family:'Fraunces',serif;font-size:42px;font-weight:900;}.gold{color:#F5C46C;}.sub{font-size:11px;letter-spacing:5px;text-transform:uppercase;color:#8A8378;margin-top:6px;}.badge{display:inline-block;background:#4A9B7F;color:#fff;padding:5px 18px;border-radius:99px;font-size:11px;font-weight:700;margin-top:14px;}.section{margin-bottom:28px;}.stitle{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#8A8378;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #E8E4DC;}.row{display:flex;justify-content:space-between;align-items:flex-start;padding:11px 0;border-bottom:1px solid #F0EDE8;}.row:last-child{border-bottom:none;}.label{color:#8A8378;font-size:12px;}.value{font-weight:600;font-size:13px;text-align:right;max-width:60%;word-break:break-all;}.amt{font-family:'Fraunces',serif;font-size:28px;font-weight:900;color:#F5C46C;}.legal{background:#F8F6F2;border:1px solid #E8E4DC;border-radius:12px;padding:18px;font-size:10px;line-height:1.8;color:#8A8378;margin-top:24px;}.footer{text-align:center;margin-top:36px;font-size:10px;color:#8A8378;line-height:2;}.wm{opacity:.05;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-family:'Fraunces',serif;font-size:80px;font-weight:900;pointer-events:none;}</style></head><body><div class="wm">PTRUST</div><div class="header"><div class="logo">P<span class="gold">TRUST</span></div><div class="sub">Oracle · Vault of Trust · Pi Network</div><div class="badge">✓ OFFICIAL VAULT CONTRACT</div></div><div class="section"><div class="stitle">Transaction Details</div><div class="row"><span class="label">Reference</span><span class="value">${tx.transactionNumber}</span></div><div class="row"><span class="label">Vault Code</span><span class="value">${tx.escrowCode}</span></div><div class="row"><span class="label">Date</span><span class="value">${new Date(tx.createdAt).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span></div><div class="row"><span class="label">Status</span><span class="value" style="color:#4A9B7F;font-weight:700">${tx.status}</span></div></div><div class="section"><div class="stitle">Parties</div><div class="row"><span class="label">Buyer</span><span class="value">@${tx.buyerUsername}</span></div><div class="row"><span class="label">Seller</span><span class="value">@${tx.sellerUsername||'Not accepted yet'}</span></div><div class="row"><span class="label">Seller Wallet</span><span class="value">${tx.sellerWallet}</span></div></div><div class="section"><div class="stitle">Financial Terms</div><div class="row"><span class="label">Amount Locked</span><span class="value"><span class="amt">${tx.amount} π</span></span></div><div class="row"><span class="label">Platform Fee (0.01%)</span><span class="value">${(tx.fee||tx.amount*0.0001).toFixed(8)} π</span></div><div class="row"><span class="label">Total Charged</span><span class="value">${(tx.amount+(tx.fee||tx.amount*0.0001)).toFixed(8)} π</span></div></div>${tx.description?`<div class="section"><div class="stitle">Deal Terms</div><p style="font-size:13px;line-height:1.75;padding:14px;background:#F8F6F2;border-radius:10px">${tx.description}</p></div>`:''}<div class="legal"><strong>Legal Notice:</strong> This contract is generated by PTrust Oracle, a decentralized escrow service on Pi Network. Funds are locked on the Pi blockchain and can only be released by the buyer using their private Vault Key. Transaction reference: ${tx.transactionNumber} | Generated: ${new Date().toISOString()}</div><div class="footer">PTrust Oracle · pts-v1.vercel.app · Riahig45@gmail.com<br>Powered by Pi Network Blockchain · Doc ID: ${tx.transactionNumber}-${Date.now()}</div></body></html>`);
    w.document.close();w.print();
  };
  const FILTERS=[{key:'ALL',label:'All'},{key:'PENDING',label:'Pending'},{key:'ACCEPTED',label:'Active'},{key:'DELIVERED',label:'Delivered'},{key:'RELEASED',label:'Released'},{key:'FROZEN',label:'Frozen'}] as const;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div><div style={{fontSize:18,fontWeight:800,color:C.text}}>My Contracts</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{list.length} total · {list.filter(t=>t.status==='RELEASED').length} completed</div></div><button onClick={load} type="button" style={{display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:800,color:C.gold,background:'none',border:'none',cursor:'pointer'}}><span style={{display:'inline-block',animation:loading?'spin .7s linear infinite':'none',fontSize:16}}>↻</span>Refresh</button></div>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:16,padding:'11px 15px',backdropFilter:'blur(8px)'}}><span style={{fontSize:16,color:C.muted}}>🔍</span><input placeholder="Search by code, username, description…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:'none',border:'none',outline:'none',fontSize:13,color:C.text}}/>{search&&<button onClick={()=>setSearch('')} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:18}}>×</button>}</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{FILTERS.map(f=><button key={f.key} onClick={()=>setFilter(f.key as any)} type="button" style={{padding:'6px 12px',borderRadius:10,fontSize:10,fontWeight:800,cursor:'pointer',background:filter===f.key?`rgba(245,196,108,.14)`:'rgba(255,255,255,.04)',color:filter===f.key?C.gold:C.muted,border:`1px solid ${filter===f.key?'rgba(245,196,108,.28)':'rgba(255,255,255,.07)'}`}}>{f.label}</button>)}</div>
      {loading&&<div style={{display:'flex',justifyContent:'center',padding:'56px 0'}}><Spinner size={28}/></div>}
      {!loading&&filtered.length===0&&<div style={{textAlign:'center',padding:'72px 0',animation:'fadeIn .3s ease'}}><VaultDoor size={64}/><div style={{fontWeight:800,fontSize:15,color:C.text,marginTop:18}}>{search?'No results found':'No contracts yet'}</div><div style={{fontSize:12,color:C.muted,marginTop:7}}>{search?'Try a different search term':'Create your first vault in the Vault tab'}</div></div>}
      {filtered.map(tx=>{
        const delay=tx.status==='ACCEPTED'&&(Date.now()-new Date(tx.createdAt).getTime())>3*24*60*60*1000;
        const role=tx.buyerUsername===user.username?'Buyer':'Seller';
        return<Glass key={tx._id} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}><div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:12,color:C.gold}}>{tx.transactionNumber}</div><div style={{fontFamily:'monospace',fontSize:10,color:C.muted,marginTop:3}}>{tx.escrowCode}</div></div><StatusBadge status={tx.status}/></div>
          {delay&&<InfoBox msg="⚠️ 3+ days since acceptance without delivery" type="terra"/>}
          <ProgBar status={tx.status}/><DealTracker status={tx.status}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div style={{background:'rgba(255,255,255,.02)',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',color:C.muted,marginBottom:4}}>Amount</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18}}>{tx.amount} <span style={{color:C.gold}}>π</span></div></div>
            <div style={{background:'rgba(255,255,255,.02)',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',color:C.muted,marginBottom:4}}>Role</div><div style={{fontSize:12,fontWeight:800,color:role==='Buyer'?C.gold:C.sky}}>{role==='Buyer'?'🔒 Buyer':'📦 Seller'}</div></div>
          </div>
          {tx.description&&<div style={{fontSize:11,lineHeight:1.65,color:C.muted,borderTop:`1px solid ${C.border}`,paddingTop:11}}>{tx.description}</div>}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{fontSize:10,color:`${C.muted}70`}}>🕐 {new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div><button onClick={()=>generatePDF(tx)} type="button" style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,padding:'6px 12px',borderRadius:9,background:'rgba(245,196,108,.08)',color:C.gold,border:`1px solid rgba(245,196,108,.18)`,cursor:'pointer'}}>📄 Contract PDF</button></div>
          {tx.status==='RELEASED'&&!tx.rating&&<div style={{paddingTop:4,borderTop:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.muted,marginBottom:10}}>Rate this deal</div><Stars onRate={n=>rateContract(tx.escrowCode,n)}/></div>}
          {tx.status==='RELEASED'&&tx.rating&&<div style={{display:'flex',alignItems:'center',gap:8,paddingTop:4,borderTop:`1px solid ${C.border}`}}><Stars value={tx.rating}/><span style={{fontSize:10,color:C.muted}}>Rated {tx.rating}/5</span></div>}
        </Glass>;
      })}
    </div>
  );
}

// ── REPUTATION TAB ────────────────────────────────────────────────────────────
function ReputationTab({username}:{username:string}){
  const[list,setList]=useState<Transaction[]>([]);const[loading,setLoad]=useState(true);const[showBreak,setShowBreak]=useState(false);
  useEffect(()=>{(async()=>{try{const r=await fetch('/api/escrow/transactions?username='+username);const d=await r.json();setList(d.transactions||[]);}catch{}finally{setLoad(false);}})();},[username]);
  const stats=useMemo(()=>{const total=list.length,released=list.filter(t=>t.status==='RELEASED').length,asBuyer=list.filter(t=>t.buyerUsername===username).length,asSeller=list.filter(t=>t.sellerUsername===username).length,disputed=list.filter(t=>['FROZEN','UNDER_REVIEW'].includes(t.status)).length;const ratings=list.filter(t=>t.rating).map(t=>t.rating as number);const avg=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:0;const totalPi=list.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+t.amount,0);const badge=getBadge(released);const since=list.length>0?new Date(list[list.length-1].createdAt):new Date();return{total,released,disputed,asBuyer,asSeller,avg,totalPi,badge,since};},[list,username]);
  const trust=useMemo(()=>calcTrust(list),[list]);
  if(loading)return<div style={{display:'flex',justifyContent:'center',padding:'72px 0'}}><Spinner size={28}/></div>;
  const circ=2*Math.PI*42,dash=circ-(trust.score/100)*circ;
  const breakdown=[
    {l:'Base score',v:'+50',c:C.muted},
    {l:'1st deal',v:stats.released>=1?'+5':'0',c:stats.released>=1?C.sage:C.muted},
    {l:'5+ deals',v:stats.released>=5?'+10':'0',c:stats.released>=5?C.sage:C.muted},
    {l:'20+ deals',v:stats.released>=20?'+15':'0',c:stats.released>=20?C.sage:C.muted},
    {l:'50+ deals',v:stats.released>=50?'+20':'0',c:stats.released>=50?C.sage:C.muted},
    {l:'Rating ≥ 4.5',v:stats.avg>=4.5?'+10':'0',c:stats.avg>=4.5?C.sage:C.muted},
    {l:'Rating ≥ 3.5',v:stats.avg>=3.5&&stats.avg<4.5?'+5':'0',c:C.muted},
    {l:'Active disputes',v:stats.disputed>0?`-${stats.disputed*15}`:'0',c:stats.disputed>0?C.terra:C.muted},
  ];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease'}}>
      <div style={{background:`linear-gradient(135deg,rgba(245,196,108,.06),rgba(74,155,127,.04))`,border:`1px solid rgba(245,196,108,.14)`,borderRadius:24,padding:22,backdropFilter:'blur(16px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:22}}>
          <div style={{width:60,height:60,borderRadius:20,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:900,color:'#1A0E00',boxShadow:`0 6px 24px rgba(245,196,108,.32)`,flexShrink:0}}>{username.charAt(0).toUpperCase()}</div>
          <div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:20,color:C.text}}>@{username}</div>{stats.badge&&<div style={{fontSize:11,fontWeight:800,marginTop:6,display:'inline-flex',alignItems:'center',gap:5}}><span>{stats.badge}</span><span style={{color:trust.level.color}}>{trust.level.label}</span></div>}<div style={{fontSize:10,color:C.muted,marginTop:5}}>Member since {stats.since.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:20}}>
          <div style={{position:'relative',width:100,height:100,flexShrink:0}}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
              <defs><linearGradient id="tg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={trust.level.color}/><stop offset="100%" stopColor={trust.level.color} stopOpacity="0.55"/></linearGradient></defs>
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="url(#tg)" strokeWidth="9" strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round" transform="rotate(-90 50 50)" style={{transition:'stroke-dashoffset 1.2s ease'}}/>
            </svg>
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><span style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:26,color:trust.level.color,lineHeight:1}}>{trust.score}</span><span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',color:`${trust.level.color}60`,marginTop:2}}>/100</span></div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:6}}>{trust.level.label}</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:10}}>{trust.score>=91?'Institutional-grade trust — top tier':trust.score>=71?'Elite trader with proven track record':trust.score>=51?'Trusted by the community':trust.score>=31?'Building reputation — keep trading!':'New — complete deals to build trust'}</div>
            <button onClick={()=>setShowBreak(!showBreak)} type="button" style={{fontSize:11,fontWeight:800,color:`rgba(245,196,108,.65)`,background:'none',border:'none',cursor:'pointer',padding:0}}>{showBreak?'Hide':'Show'} breakdown {showBreak?'▲':'▼'}</button>
            {showBreak&&<div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5,animation:'fadeIn .2s ease'}}>{breakdown.map(({l,v,c})=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:11}}><span style={{color:C.muted}}>{l}</span><span style={{fontWeight:800,color:c}}>{v}</span></div>)}<div style={{borderTop:`1px solid ${C.border}`,paddingTop:7,display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:800,marginTop:3}}><span>Total</span><span style={{color:trust.level.color}}>{trust.score}/100</span></div></div>}
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
        {[{l:'Total Deals',v:stats.total,c:C.gold},{l:'Completed',v:stats.released,c:C.sage},{l:'As Buyer',v:stats.asBuyer,c:C.gold},{l:'As Seller',v:stats.asSeller,c:C.sky},{l:'π Transacted',v:stats.totalPi.toFixed(2)+' π',c:C.gold},{l:'Avg Rating',v:stats.avg>0?stats.avg.toFixed(1)+' ★':'—',c:C.gold}].map(({l,v,c})=><Glass key={l} style={{textAlign:'center',padding:16}}><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:26,color:c,marginBottom:5}}>{v}</div><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted}}>{l}</div></Glass>)}
      </div>
      {stats.avg>0&&<Glass><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.muted,marginBottom:12}}>Community Rating</div><div style={{display:'flex',alignItems:'center',gap:14}}><Stars value={Math.round(stats.avg)}/><span style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:26,color:C.gold}}>{stats.avg.toFixed(1)}</span><span style={{fontSize:11,color:C.muted}}>from {list.filter(t=>t.rating).length} reviews</span></div></Glass>}
      <Glass style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}><div style={{fontWeight:800,fontSize:14,color:C.text}}>Recent Activity</div></div>
        {list.length===0?<div style={{textAlign:'center',padding:'36px 20px'}}><VaultDoor size={44}/><div style={{fontSize:13,fontWeight:800,color:C.muted,marginTop:14}}>No activity yet</div></div>:list.slice(0,6).map((tx,i)=><div key={tx._id||i} style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:i<5?`1px solid ${C.border}`:'none'}}><div style={{width:36,height:36,borderRadius:12,background:tx.buyerUsername===username?`rgba(245,196,108,.10)`:`rgba(91,155,213,.10)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{tx.buyerUsername===username?'🔒':'📦'}</div><div style={{flex:1,minWidth:0}}><div style={{fontFamily:'monospace',fontSize:11,fontWeight:800,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.transactionNumber}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div></div><div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:12,fontWeight:800}}>{tx.amount} <span style={{color:C.gold}}>π</span></div><div style={{marginTop:4}}><StatusBadge status={tx.status}/></div></div></div>)}
      </Glass>
    </div>
  );
}

// ── COMMUNITY TAB ─────────────────────────────────────────────────────────────
function CommunityTab({username}:{username:string}){
  const[msgs,setMsgs]=useState<any[]>([]);const[text,setText]=useState('');const[sending,setSending]=useState(false);const[loading,setLoad]=useState(true);
  const endRef=useRef<HTMLDivElement>(null);
  const EMOJIS=['😊','👍','🔒','✅','💰','🤝','🚀','❓','⚡','🛡️','💎','⭐'];
  const load=useCallback(async()=>{try{const r=await fetch('/api/messages');const d=await r.json();if(d.success)setMsgs(d.messages||[]);}catch{}finally{setLoad(false);};},[]);
  useEffect(()=>{load();const iv=setInterval(load,25_000);return()=>clearInterval(iv);},[load]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  const send=async()=>{if(!text.trim()||sending)return;setSending(true);try{await api('/api/messages',{username,text:text.trim()});setText('');await load();}catch{}finally{setSending(false);};};
  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 220px)',minHeight:420,animation:'fadeIn .3s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:38,height:38,borderRadius:12,background:'rgba(74,155,127,.12)',border:`1px solid rgba(74,155,127,.20)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>💬</div><div><div style={{fontSize:15,fontWeight:800,color:C.text}}>Community Vault</div><div style={{fontSize:10,color:C.muted}}>{msgs.length} messages</div></div></div>
        <button onClick={load} type="button" style={{width:34,height:34,borderRadius:11,background:'rgba(255,255,255,.04)',border:`1px solid ${C.border}`,color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>↻</button>
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,paddingBottom:10}}>
        {loading&&<div style={{display:'flex',justifyContent:'center',padding:'40px 0'}}><Spinner size={24}/></div>}
        {!loading&&msgs.length===0&&<div style={{textAlign:'center',padding:'56px 0',animation:'fadeIn .3s ease'}}><VaultDoor size={56}/><div style={{fontWeight:800,fontSize:15,color:C.text,marginTop:16}}>No messages yet</div><div style={{fontSize:12,color:C.muted,marginTop:6}}>Be the first to say hello!</div></div>}
        {msgs.map((m,i)=>{const isMe=m.username===username;return<div key={i} style={{display:'flex',justifyContent:isMe?'flex-end':'flex-start'}}><div style={{maxWidth:'78%',display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>{!isMe&&<div style={{display:'flex',alignItems:'center',gap:5,paddingInline:2}}>{m.badge&&<span style={{fontSize:12}}>{m.badge}</span>}<span style={{fontSize:10,fontWeight:800,color:C.gold}}>@{m.username}</span></div>}<div style={{padding:'11px 15px',fontSize:13,lineHeight:1.5,...(isMe?{background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,color:'#1A0E00',borderRadius:'20px 20px 5px 20px',fontWeight:700,boxShadow:`0 5px 18px rgba(245,196,108,.25)`}:{background:'rgba(255,255,255,.05)',color:C.text,border:`1px solid rgba(255,255,255,.08)`,borderRadius:'20px 20px 20px 5px',backdropFilter:'blur(8px)'})}}>  {m.text}</div><span style={{fontSize:9,color:`${C.muted}55`,paddingInline:3}}>{new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div></div>;})}
        <div ref={endRef}/>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:9,overflowX:'auto',flexShrink:0,paddingBottom:2}}>{EMOJIS.map(e=><button key={e} onClick={()=>setText(p=>(p+e).slice(0,500))} type="button" style={{width:36,height:36,borderRadius:11,flexShrink:0,fontSize:17,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.07)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{e}</button>)}</div>
      <div style={{display:'flex',gap:9,flexShrink:0}}>
        <input placeholder="Message the community…" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} maxLength={500} style={{flex:1,background:'rgba(255,255,255,.04)',border:`1px solid ${C.border}`,borderRadius:18,padding:'13px 18px',fontSize:13,color:C.text,outline:'none',backdropFilter:'blur(8px)'}}/>
        <button onClick={send} disabled={sending||!text.trim()} type="button" style={{width:50,height:50,borderRadius:17,border:'none',flexShrink:0,cursor:sending||!text.trim()?'not-allowed':'pointer',opacity:sending||!text.trim()?.4:1,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:`0 5px 18px rgba(245,196,108,.28)`}}>➤</button>
      </div>
      <div style={{textAlign:'right',marginTop:5,fontSize:9,color:`${C.muted}55`}}>{text.length}/500</div>
    </div>
  );
}

// ── ADMIN TAB ─────────────────────────────────────────────────────────────────
function AdminTab({username}:{username:string}){
  const[txs,setTxs]=useState<Transaction[]>([]);const[stats,setStats]=useState<any>(null);const[loading,setLoad]=useState(false);const[selected,setSel]=useState<Transaction|null>(null);const[reason,setReason]=useState('');const[msg,setMsg]=useState<string|null>(null);const[err,setErr]=useState<string|null>(null);const[filter,setFilter]=useState('ALL');const[search,setSearch]=useState('');
  const load=useCallback(async()=>{setLoad(true);try{const r=await api('/api/admin',{action:'getAll',username});setTxs(r.transactions);setStats(r.stats);}catch(e:any){setErr(e.message);}finally{setLoad(false);};},[username]);
  useEffect(()=>{load();},[load]);
  const doAction=async(action:string,escrowCode:string,extra?:object)=>{setMsg(null);setErr(null);try{const r=await api('/api/admin',{action,username,escrowCode,reason,...extra});setMsg(r.message);setSel(null);setReason('');load();}catch(e:any){setErr(e.message);};};
  const FILTERS=['ALL','PENDING','ACCEPTED','DELIVERED','FROZEN','UNDER_REVIEW','RELEASED','REFUNDED'];
  const filtered=useMemo(()=>{let res=filter==='ALL'?txs:txs.filter(t=>t.status===filter);if(search.trim()){const q=search.toLowerCase();res=res.filter(t=>t.escrowCode?.toLowerCase().includes(q)||t.transactionNumber?.toLowerCase().includes(q)||t.buyerUsername?.toLowerCase().includes(q)||t.sellerUsername?.toLowerCase().includes(q));}return res;},[txs,filter,search]);
  const revenue=txs.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+(t.fee||t.amount*0.0001),0);
  const totalPi=txs.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+t.amount,0);
  const users=new Set([...txs.map(t=>t.buyerUsername),...txs.filter(t=>t.sellerUsername).map(t=>t.sellerUsername!)]).size;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14,animation:'fadeIn .3s ease'}}>
      <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 18px',borderRadius:22,background:`linear-gradient(135deg,rgba(196,69,54,.12),rgba(155,138,196,.06))`,border:`1px solid rgba(196,69,54,.24)`,backdropFilter:'blur(12px)'}}>
        <div style={{width:50,height:50,borderRadius:16,background:`rgba(196,69,54,.20)`,border:`1px solid rgba(196,69,54,.30)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🛡️</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.terra}}>Admin Control Panel</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>Full platform control · @{username}</div></div>
        <button onClick={load} type="button" style={{width:38,height:38,borderRadius:13,background:'rgba(255,255,255,.05)',border:`1px solid rgba(255,255,255,.09)`,color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}><span style={{display:'inline-block',animation:loading?'spin .7s linear infinite':'none'}}>↻</span></button>
      </div>
      {stats&&<Glass>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}><span style={{fontSize:16}}>📊</span><span style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.12em',color:C.gold}}>Platform Overview</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9,marginBottom:12}}>{[{l:'Total Pi',v:totalPi.toFixed(3)+' π',c:C.gold},{l:'Revenue',v:revenue.toFixed(4)+' π',c:C.sage},{l:'Users',v:String(users),c:C.sky}].map(s=><div key={s.l} style={{textAlign:'center',background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:14,padding:'11px 8px'}}><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:15,color:s.c}}>{s.v}</div><div style={{fontSize:8,textTransform:'uppercase',letterSpacing:'.08em',color:C.muted,marginTop:3}}>{s.l}</div></div>)}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>{[{l:'Total',v:stats.total,c:C.text},{l:'Pending',v:stats.pending,c:C.gold},{l:'Frozen',v:stats.frozen,c:C.terra},{l:'Released',v:stats.released,c:C.sage}].map(s=><div key={s.l} style={{background:'rgba(0,0,0,.35)',border:`1px solid rgba(255,255,255,.05)`,borderRadius:12,padding:'9px 5px',textAlign:'center'}}><div style={{fontWeight:800,fontSize:18,color:s.c}}>{s.v}</div><div style={{fontSize:7.5,textTransform:'uppercase',letterSpacing:'.07em',color:C.muted,marginTop:2}}>{s.l}</div></div>)}</div>
      </Glass>}
      {selected&&<div style={{padding:20,borderRadius:22,background:`rgba(196,69,54,.07)`,border:`1px solid rgba(196,69,54,.24)`,display:'flex',flexDirection:'column',gap:14,animation:'scaleIn .22s ease',backdropFilter:'blur(12px)'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}><div><div style={{fontSize:10,textTransform:'uppercase',fontWeight:800,letterSpacing:'.12em',color:C.muted}}>Selected</div><div style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:C.terra,marginTop:4}}>{selected.escrowCode}</div><div style={{fontSize:11,color:C.muted,marginTop:3}}>{selected.amount} π · @{selected.buyerUsername} → @{selected.sellerUsername||'?'}</div></div><button onClick={()=>setSel(null)} type="button" style={{width:34,height:34,borderRadius:11,background:'rgba(255,255,255,.05)',border:`1px solid rgba(255,255,255,.09)`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:18}}>×</button></div>
        <Field label="Admin Note / Reason"><input placeholder="Reason for this action…" value={reason} onChange={e=>setReason(e.target.value)} style={{...IS}}/></Field>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>{[{label:'🧊 Freeze Vault',action:'freeze',extra:{},c:C.sky},{label:'↩️ Refund Buyer',action:'refund',extra:{},c:C.sage},{label:'✅ Release Seller',action:'resolve',extra:{resolveFor:'seller'},c:C.gold},{label:'⚖️ Resolve Buyer',action:'resolve',extra:{resolveFor:'buyer'},c:C.violet}].map(({label,action,extra,c})=><button key={label} onClick={()=>doAction(action,selected.escrowCode,extra)} type="button" style={{padding:'12px 8px',borderRadius:15,fontSize:12,fontWeight:800,cursor:'pointer',background:`${c}12`,border:`1px solid ${c}28`,color:c}}>{label}</button>)}</div>
      </div>}
      {msg&&<OkBox msg={msg}/>}{err&&<ErrBox msg={err}/>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{FILTERS.map(f=><button key={f} onClick={()=>setFilter(f)} type="button" style={{padding:'5px 11px',borderRadius:10,fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'.07em',cursor:'pointer',background:filter===f?`rgba(196,69,54,.18)`:'rgba(255,255,255,.04)',color:filter===f?C.terra:C.muted,border:`1px solid ${filter===f?'rgba(196,69,54,.30)':'rgba(255,255,255,.07)'}`}}>{f}</button>)}</div>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:14,padding:'10px 14px'}}><span style={{fontSize:14,color:C.muted}}>🔍</span><input placeholder="Search transactions…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:'none',border:'none',outline:'none',fontSize:13,color:C.text}}/>{search&&<button onClick={()=>setSearch('')} type="button" style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:17}}>×</button>}</div>
      {loading&&<div style={{display:'flex',justifyContent:'center',padding:'40px 0'}}><Spinner size={24}/></div>}
      {filtered.map(tx=><div key={tx._id} onClick={()=>setSel(selected?.escrowCode===tx.escrowCode?null:tx)} style={{padding:16,borderRadius:20,cursor:'pointer',display:'flex',flexDirection:'column',gap:9,transition:'all .18s',background:selected?.escrowCode===tx.escrowCode?`rgba(196,69,54,.09)`:'rgba(255,255,255,.025)',border:`1px solid ${selected?.escrowCode===tx.escrowCode?'rgba(196,69,54,.35)':C.border}`,backdropFilter:'blur(8px)'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}><div><div style={{fontFamily:'monospace',fontSize:11,fontWeight:800,color:`rgba(196,69,54,.85)`}}>{tx.transactionNumber||tx.escrowCode}</div><div style={{fontSize:10,color:C.muted,marginTop:3}}>@{tx.buyerUsername} → @{tx.sellerUsername||'?'}</div></div><StatusBadge status={tx.status}/></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}><span style={{color:C.muted}}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><span style={{fontFamily:"'Fraunces',serif",fontWeight:800}}>{tx.amount} <span style={{color:C.gold}}>π</span></span></div>
        {tx.description&&<div style={{fontSize:10,color:`${C.muted}70`,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description}</div>}
      </div>)}
      {!loading&&filtered.length===0&&<div style={{textAlign:'center',padding:'56px 0'}}><div style={{fontSize:34,marginBottom:14,opacity:.2}}>🛡️</div><div style={{fontSize:14,fontWeight:800,color:C.text}}>No transactions found</div></div>}
    </div>
  );
}

// ── HOME DASHBOARD ────────────────────────────────────────────────────────────
function HomeDashboard({user,setTab}:{user:PiUser;setTab:(t:any)=>void}){
  const[txs,setTxs]=useState<Transaction[]>([]);const[loading,setLoad]=useState(true);const{price}=usePiPrice();
  useEffect(()=>{(async()=>{try{const r=await fetch('/api/escrow/transactions?username='+user.username);const d=await r.json();setTxs(d.transactions||[]);}catch{}finally{setLoad(false);}})();},[user.username]);
  const stats=useMemo(()=>({active:txs.filter(t=>['PENDING','ACCEPTED','DELIVERED'].includes(t.status)).length,released:txs.filter(t=>t.status==='RELEASED').length,disputed:txs.filter(t=>['FROZEN','UNDER_REVIEW'].includes(t.status)).length,totalPi:txs.filter(t=>t.status==='RELEASED').reduce((s,t)=>s+t.amount,0)}),[txs]);
  const trust=useMemo(()=>calcTrust(txs),[txs]);
  const ICONS=[
    {key:'vault',     label:'Vault',     emoji:'🔐',bg:'linear-gradient(160deg,#2B2419,#0E0C0A)',desc:'Lock & Release'},
    {key:'trade',     label:'Trade',     emoji:'📦',bg:'linear-gradient(160deg,#1A2329,#0E0C0A)',desc:'Accept Deals'},
    {key:'contracts', label:'Contracts', emoji:'📋',bg:'linear-gradient(160deg,#1A2318,#0E0C0A)',desc:'All Deals'},
    {key:'reputation',label:'Reputation',emoji:'⭐',bg:'linear-gradient(160deg,#2B2419,#0E0C0A)',desc:'Trust Score'},
    {key:'community', label:'Community', emoji:'💬',bg:'linear-gradient(160deg,#1A2329,#0E0C0A)',desc:'Live Chat'},
    {key:'admin',     label:'Admin',     emoji:'🛡️',bg:'linear-gradient(160deg,#281815,#0E0C0A)',desc:'Control Panel',admin:true},
  ];
  const isAdmin=user.username==='GhaithriAHI96';
  const icons=ICONS.filter(i=>!i.admin||isAdmin);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:18,animation:'fadeIn .35s ease'}}>
      {/* Welcome + Trust */}
      <div style={{background:`linear-gradient(135deg,rgba(245,196,108,.07),rgba(74,155,127,.04))`,border:`1px solid rgba(245,196,108,.14)`,borderRadius:24,padding:20,backdropFilter:'blur(16px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
          <div style={{width:52,height:52,borderRadius:18,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900,color:'#1A0E00',boxShadow:`0 5px 20px rgba(245,196,108,.30)`,flexShrink:0}}>{user.username.charAt(0).toUpperCase()}</div>
          <div><div style={{fontSize:11,color:C.muted}}>Welcome back</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:20,color:C.text}}>@{user.username}</div><div style={{fontSize:10,color:trust.level.color,marginTop:3,fontWeight:700}}>{trust.level.label}</div></div>
          <div style={{marginLeft:'auto',textAlign:'right'}}><div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'.1em',color:C.muted,fontWeight:700}}>Trust Score</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:32,color:trust.level.color,lineHeight:1,marginTop:3}}>{trust.score}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[{l:'Active',v:stats.active,c:C.gold},{l:'Done',v:stats.released,c:C.sage},{l:'Disputed',v:stats.disputed,c:C.terra},{l:'Earned π',v:stats.totalPi.toFixed(2),c:C.gold}].map(({l,v,c})=><div key={l} style={{background:'rgba(0,0,0,.25)',borderRadius:13,padding:'10px 6px',textAlign:'center'}}><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:17,color:c}}>{v}</div><div style={{fontSize:8,textTransform:'uppercase',letterSpacing:'.07em',color:C.muted,marginTop:2}}>{l}</div></div>)}
        </div>
      </div>
      {/* Pi Price strip */}
      {price&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',borderRadius:16,background:'rgba(255,255,255,.025)',border:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><Seal size={32}/><div><div style={{fontSize:9,color:C.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em'}}>Pi / USD · Live</div><div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18,color:C.gold}}>{'$'+price.toFixed(4)}</div></div></div>
        {stats.totalPi>0&&<div style={{textAlign:'right'}}><div style={{fontSize:9,color:C.muted,fontWeight:700}}>Your completed π value</div><div style={{fontWeight:800,fontSize:15,color:C.sage,marginTop:2}}>{'$'+(stats.totalPi*price).toFixed(2)}</div></div>}
      </div>}
      {/* Tip */}
      <div style={{display:'flex',alignItems:'flex-start',gap:12,padding:'13px 16px',borderRadius:18,background:`rgba(245,196,108,.05)`,border:`1px solid rgba(245,196,108,.10)`}}>
        <span style={{fontSize:20,flexShrink:0}}>💡</span>
        <div><div style={{fontSize:12,fontWeight:800,color:C.text}}>How to use PTrust Oracle</div><div style={{fontSize:11,color:C.muted,marginTop:4,lineHeight:1.6}}><strong style={{color:C.gold}}>Vault</strong> to create and lock funds · <strong style={{color:C.sky}}>Trade</strong> for sellers · <strong style={{color:C.sage}}>Contracts</strong> to track all deals</div></div>
      </div>
      <div style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.2em',color:C.muted}}>Quick Access</div>
      {/* Icon Grid — paddingBottom:100% trick for Pi Browser compatibility */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {icons.map(({key,label,emoji,bg,desc,admin})=>(
          <button key={key} onClick={()=>setTab(key)} type="button" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:9,background:'none',border:'none',cursor:'pointer',padding:0}}>
            <div style={{width:'100%',paddingBottom:'100%',position:'relative',borderRadius:22,background:bg,border:`1px solid ${admin?'rgba(196,69,54,.20)':C.border}`,boxShadow:'0 8px 28px rgba(0,0,0,.55),inset 0 1px 1px rgba(255,255,255,.07)',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6}}>
                <span style={{fontSize:32}}>{emoji}</span>
                <span style={{fontSize:8,fontWeight:700,color:admin?'rgba(196,69,54,.70)':C.muted,textTransform:'uppercase',letterSpacing:'.08em'}}>{desc}</span>
              </div>
            </div>
            <span style={{fontSize:12,fontWeight:800,color:admin?C.terra:C.textDim}}>{label}</span>
          </button>
        ))}
      </div>
      {/* Recent activity */}
      {!loading&&txs.length>0&&<Glass style={{padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:`1px solid ${C.border}`}}><div style={{fontWeight:800,fontSize:13,color:C.text}}>Recent Activity</div><button onClick={()=>setTab('contracts')} type="button" style={{fontSize:11,fontWeight:800,color:C.gold,background:'none',border:'none',cursor:'pointer'}}>View All →</button></div>
        {txs.slice(0,3).map((tx,i)=><div key={tx._id} style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:12,borderBottom:i<2?`1px solid ${C.border}`:'none'}}>
          <div style={{width:36,height:36,borderRadius:12,background:tx.buyerUsername===user.username?`rgba(245,196,108,.10)`:`rgba(91,155,213,.10)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{tx.buyerUsername===user.username?'🔒':'📦'}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:'monospace',fontSize:11,fontWeight:800,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.transactionNumber}</div><div style={{fontSize:10,color:C.muted,marginTop:2}}>{new Date(tx.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div></div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:12,fontWeight:800}}>{tx.amount} <span style={{color:C.gold}}>π</span></div><div style={{marginTop:4}}><StatusBadge status={tx.status}/></div></div>
        </div>)}
      </Glass>}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
type TabKey='home'|'vault'|'trade'|'contracts'|'reputation'|'community'|'admin';
function App({user,onLogout}:{user:PiUser;onLogout:()=>void}){
  const isOnline=useOnline();const[tab,setTab]=useState<TabKey>('home');const isAdmin=user.username==='GhaithriAHI96';
  const META:Record<TabKey,{label:string;icon:string}>={home:{label:'Home',icon:'🏠'},vault:{label:'Vault',icon:'🔐'},trade:{label:'Trade',icon:'📦'},contracts:{label:'Contracts',icon:'📋'},reputation:{label:'Reputation',icon:'⭐'},community:{label:'Community',icon:'💬'},admin:{label:'Admin',icon:'🛡️'}};
  return(
    <main style={{minHeight:'100vh',background:C.bg,color:C.text,paddingBottom:52}}>
      <style>{GCSS}</style>
      <div style={{position:'fixed',top:0,left:0,right:0,height:260,background:`radial-gradient(ellipse at 50% -40%,rgba(245,196,108,.07),transparent 65%)`,pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'fixed',inset:0,backgroundImage:`linear-gradient(rgba(245,196,108,.014) 1px,transparent 1px),linear-gradient(90deg,rgba(245,196,108,.014) 1px,transparent 1px)`,backgroundSize:'32px 32px',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:450,margin:'0 auto',padding:'0 16px',position:'relative',zIndex:1}}>
        {!isOnline&&<div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 15px',borderRadius:14,fontSize:11,fontWeight:800,margin:'16px 0 0',background:'rgba(196,69,54,.10)',color:C.terra,border:`1px solid rgba(196,69,54,.25)`,backdropFilter:'blur(8px)'}}>📡 No internet connection</div>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'22px 0 18px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setTab('home')}>
            <VaultDoor size={44} spinning={tab==='home'}/>
            <div><h1 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:24,lineHeight:1,letterSpacing:'-0.025em',margin:0}}>P<span style={{color:C.gold}}>TRUST</span></h1><p style={{fontSize:9,color:C.muted,margin:'2px 0 0',letterSpacing:'.15em',textTransform:'uppercase'}}>Oracle · Vault of Trust</p></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:10,background:'rgba(74,155,127,.08)',border:`1px solid rgba(74,155,127,.18)`,fontSize:9,fontWeight:800,color:C.sage}}><div style={{width:6,height:6,borderRadius:'50%',background:C.sage,animation:'pulse 2s infinite'}}/>MAINNET</div>
            {tab!=='home'&&<button onClick={()=>setTab('home')} type="button" style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:12,fontSize:10,fontWeight:800,cursor:'pointer',background:'rgba(255,255,255,.04)',border:`1px solid ${C.border}`,color:C.muted}}>🏠</button>}
            <div style={{width:40,height:40,borderRadius:14,background:`linear-gradient(135deg,${C.goldL},${C.goldD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#1A0E00',boxShadow:`0 4px 14px rgba(245,196,108,.28)`,cursor:'pointer'}} onClick={()=>setTab('reputation')}>{user.username.charAt(0).toUpperCase()}</div>
            <button onClick={onLogout} type="button" style={{width:40,height:40,borderRadius:14,background:'rgba(255,255,255,.04)',border:`1px solid rgba(255,255,255,.07)`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted,fontSize:17}}>⎋</button>
          </div>
        </div>
        {tab!=='home'&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,padding:'9px 14px',borderRadius:14,background:'rgba(255,255,255,.025)',border:`1px solid ${C.border}`}}><span style={{fontSize:13}}>{META[tab].icon}</span><span style={{fontSize:13,fontWeight:800,color:C.text}}>{META[tab].label}</span><span style={{fontSize:10,color:C.muted,marginLeft:'auto'}}>@{user.username}</span></div>}
        <div>
          {tab==='home'       &&<HomeDashboard  user={user}    setTab={setTab}/>}
          {tab==='vault'      &&<VaultTab       user={user}/>}
          {tab==='trade'      &&<TradeTab       user={user}/>}
          {tab==='contracts'  &&<ContractsTab   user={user}/>}
          {tab==='reputation' &&<ReputationTab  username={user.username}/>}
          {tab==='community'  &&<CommunityTab   username={user.username}/>}
          {tab==='admin'      &&isAdmin&&<AdminTab username={user.username}/>}
        </div>
      </div>
    </main>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function HomePage(){
  const{user,loading,authenticateUser}=usePiSDK();
  const[expired,setExpired]=useState(false);const[mounted,setMounted]=useState(false);
  const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{setMounted(true);},[]);
  const resetTimer=useCallback(()=>{if(timerRef.current)clearTimeout(timerRef.current);timerRef.current=setTimeout(()=>setExpired(true),30*60*1000);},[]);
  useEffect(()=>{if(!user)return;const ev=['mousemove','keydown','touchstart','click','scroll'];ev.forEach(e=>window.addEventListener(e,resetTimer,{passive:true}));resetTimer();return()=>{ev.forEach(e=>window.removeEventListener(e,resetTimer));if(timerRef.current)clearTimeout(timerRef.current);};},[user,resetTimer]);
  if(!mounted)return null;
  if(loading)return(
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,flexDirection:'column',gap:24}}>
      <style>{GCSS}</style>
      <div style={{position:'relative',animation:'scaleIn .5s ease'}}><VaultDoor size={92} spinning/><div style={{position:'absolute',inset:-20,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,196,108,.12),transparent 70%)',animation:'glow 3s ease infinite'}}/></div>
      <div style={{textAlign:'center'}}><h1 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:48,lineHeight:1,letterSpacing:'-0.03em',margin:'0 0 8px'}}>P<span style={{color:C.gold}}>TRUST</span></h1><p style={{fontFamily:"'Fraunces',serif",fontSize:11,letterSpacing:'.35em',textTransform:'uppercase',color:C.muted,margin:0}}>Oracle · Vault of Trust</p></div>
      <div style={{display:'flex',alignItems:'center',gap:10}}><Spinner size={18}/><span style={{fontSize:12,textTransform:'uppercase',letterSpacing:'.25em',color:C.muted}}>Connecting to Pi Network…</span></div>
    </main>
  );
  if(expired)return(
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,background:C.bg,color:C.text}}>
      <style>{GCSS}</style>
      <div style={{textAlign:'center',maxWidth:340,display:'flex',flexDirection:'column',alignItems:'center',gap:24,animation:'fadeIn .5s ease'}}>
        <VaultDoor size={72}/>
        <div><h2 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:30,margin:'0 0 10px'}}>Vault Locked</h2><p style={{fontSize:13,color:C.muted,lineHeight:1.7,margin:0}}>Your session expired after 30 minutes. Please sign in again to access your vault.</p></div>
        <Btn onClick={()=>{setExpired(false);authenticateUser();}}><span style={{fontSize:20}}>π</span>Sign In to Pi Network</Btn>
        <p style={{fontSize:10,color:`${C.muted}60`}}>Your funds are safe — vault is still locked</p>
      </div>
    </main>
  );
  if(!user)return<Landing onLogin={authenticateUser} loading={loading}/>;
  return<App user={user} onLogout={()=>{try{localStorage.removeItem('ptrust_user');}catch{}sessionStorage.clear();window.location.reload();}}/>;
}
