/* FAT Confluence engine add-on: AI SECOND OPINION + AI SCOREBOARD.
   Load with <script src="ai.js"></script> after upgrade.js. It never changes how scores or signals are made.
   For every new live signal at your alert level it asks an LLM (Groq, OpenAI-compatible) for TAKE or SKIP,
   using the engine's own saved history as evidence, then later grades the AI against the real outcome. */
(()=>{
'use strict';
const g=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const s=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const $=id=>document.getElementById(id);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const P=Object.assign({key:'',model:'llama-3.3-70b-versatile',on:true,tg:false},g('fat_ai',{}));
const saveP=()=>s('fat_ai',P);
let LOG=g('fat_ai_log',{});
const saveL=()=>{const ks=Object.keys(LOG);if(ks.length>400){ks.sort((a,b)=>LOG[a].t-LOG[b].t).slice(0,ks.length-400).forEach(k=>delete LOG[k]);}s('fat_ai_log',LOG);};
const MAXP=[25,25,20,15,15];
const f2=v=>(v>=0?'+':'')+v.toFixed(2)+'R';
let busy=false,msg='';

function stat(v){const n=v.length;if(!n)return{n:0,m:0,lo:0,hi:0};let a=0,q=0;for(const x of v){a+=x;q+=x*x;}const m=a/n,sd=Math.sqrt(Math.max(0,q/n-m*m)),se=n>1?sd/Math.sqrt(n-1):0;return{n,m,lo:m-1.96*se,hi:m+1.96*se};}
function histStats(sy,tf,score){
  const out=[];
  try{for(let i=0;i<localStorage.length;i++){const n=localStorage.key(i);if(n&&n.indexOf('cse_lset_')===0&&+n.split('_').pop()===tf){const raw=g(n,[]);if(Array.isArray(raw))for(const r of raw){if(Array.isArray(r)&&r.length===10&&r[0]===sy){let num=0,den=0;for(let k=0;k<5;k++){num+=r[3+k];den+=MAXP[k];}out.push({sc:100*num/den,r:r[8]});}}}}}catch(e){}
  const band=out.filter(x=>Math.abs(x.sc-score)<=10),R=(l,k)=>l.map(x=>x.r>=k?k:-1);
  const ex=l=>({n:l.length,hit1:l.length?Math.round(100*l.filter(x=>x.r>=1).length/l.length):null,hit2:l.length?Math.round(100*l.filter(x=>x.r>=2).length/l.length):null,exp2:l.length?+stat(R(l,2)).m.toFixed(2):null});
  return{symbolAll:ex(out),similarScore:ex(band)};
}
function pending(){
  const cfg=g('cse_set',{}),thr=cfg.thr||70,now=Date.now()/1000,out=[];
  try{for(let i=0;i<localStorage.length;i++){const nm=localStorage.key(i);if(!nm||nm.indexOf('cse_arch_')!==0)continue;
    const rest=nm.slice(9),tf=+rest.split('_').pop(),sy=rest.slice(0,rest.lastIndexOf('_')),a=g(nm,{});
    for(const x of Object.values(a)){if(!x||x.src!=='live')continue;const id=sy+'|'+tf+'|'+x.t+'|'+x.d;
      if(LOG[id]){if(!LOG[id].done&&(x.res==='sl'||x.res==='tp3')){LOG[id].done=1;LOG[id].r2=x.reached>=2?2:(x.be?0:-1);LOG[id].r1=x.reached>=1?1:(x.be?0:-1);}continue;}
      if((x.score||0)<thr||now-x.t>3*tf+60||x.res!=='open')continue;out.push({id,sy,tf,x});}}}catch(e){}
  return out;
}
function candles(sy,tf){
  const eps=['wss://ws.derivws.com/websockets/v3?app_id=1089','wss://ws.binaryws.com/websockets/v3?app_id=1089'];
  const one=u=>new Promise(res=>{let ws,done=false;const fin=v=>{if(done)return;done=true;try{ws.close();}catch(e){}res(v);};
    try{ws=new WebSocket(u);}catch(e){return res(null);}
    const to=setTimeout(()=>fin(null),6000);
    ws.onopen=()=>{try{ws.send(JSON.stringify({ticks_history:sy,adjust_start_time:1,count:30,end:'latest',granularity:tf,style:'candles'}));}catch(e){fin(null);}};
    ws.onmessage=ev=>{try{const d=JSON.parse(ev.data);clearTimeout(to);fin(Array.isArray(d.candles)?d.candles.map(c=>[+c.open,+c.high,+c.low,+c.close]):null);}catch(e){fin(null);}};
    ws.onerror=()=>fin(null);});
  return one(eps[0]).then(r=>r||one(eps[1]));
}
async function ask(p){
  const {sy,tf,x}=p,h=histStats(sy,tf,x.score),cd=await candles(sy,tf);
  const ctx={instrument:sy,timeframeSeconds:tf,side:x.d===1?'BUY':'SELL',score:x.score,componentsOutOf:{zone:[x.parts&&x.parts[0],25],structure:[x.parts&&x.parts[1],25],candle:[x.parts&&x.parts[2],20],momentum:[x.parts&&x.parts[3],15],regime:[x.parts&&x.parts[4],15]},pattern:x.pat,zoneType:x.kind,priorZoneTouches:x.touches,htfBias:x.hb,tfTrend:x.tr,riskToStopPriceUnits:x.risk,historyForThisInstrument:h,recentCandlesOHLC_oldestFirst_lastIsCurrentForming:cd||'unavailable'};
  const sys='You are a strict risk filter for a rules-based trading engine. Judge ONLY from the data given. Rules: (1) if historyForThisInstrument has fewer than 30 similar trades or non-positive expectancy, answer SKIP. (2) Derived/synthetic indices (R_*, 1HZ*) are random number generated, so be skeptical. (3) Penalise counter-trend setups (side against htfBias) and weak components. (4) Use recentCandlesOHLC to check whether price already ran far from the zone, is exhausted, or is chopping, but never override rule 1 with a chart read. (5) Never invent statistics. Reply with JSON only: {"verdict":"TAKE"|"SKIP","confidence":0-100,"reason":"one short sentence citing the numbers"}.';
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+P.key},body:JSON.stringify({model:P.model,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:sys},{role:'user',content:JSON.stringify(ctx)}]})});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json(),o=JSON.parse(j.choices[0].message.content);
  return{verdict:o.verdict==='TAKE'?'TAKE':'SKIP',conf:Math.max(0,Math.min(100,+o.confidence||0)),reason:String(o.reason||'').slice(0,220)};
}
async function work(){
  const list=pending();saveL();
  if(!P.on||!P.key||busy||!list.length)return;
  busy=true;const p=list[0];
  try{
    const o=await ask(p);
    LOG[p.id]={sy:p.sy,tf:p.tf,t:p.x.t,d:p.x.d,score:p.x.score,verdict:o.verdict,conf:o.conf,reason:o.reason,at:Date.now(),done:0};saveL();msg='';
    const cfg=g('cse_set',{});
    if(P.tg&&cfg.tok&&cfg.chat)fetch('https://api.telegram.org/bot'+encodeURIComponent(cfg.tok)+'/sendMessage?chat_id='+encodeURIComponent(cfg.chat)+'&text='+encodeURIComponent('AI '+o.verdict+' ('+o.conf+'%) '+p.sy+' '+(p.x.d===1?'BUY':'SELL')+' score '+p.x.score+'\n'+o.reason)).catch(()=>{});
  }catch(e){msg='AI CALL FAILED: '+esc(e.message)+'. CHECK THE KEY AND MODEL.';LOG[p.id]={sy:p.sy,tf:p.tf,t:p.x.t,d:p.x.d,score:p.x.score,verdict:'ERR',conf:0,reason:'',at:Date.now(),done:1};}
  busy=false;
}
function build(){
  const main=document.querySelector('main.grid');if(!main||$('aiP'))return;
  const st=document.createElement('style');
  st.textContent='#aiP{grid-column:1/-1}#aiP .up-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:6px}#aiP .up-g input{width:100%;background:#08111b;border:1px solid var(--bd);color:var(--ink);padding:5px 8px;font-family:var(--m);font-size:12px;text-transform:none}#aiP .up-g label{display:block;font-size:10px;color:var(--dim);letter-spacing:.1em;margin:6px 0 3px}#aiP .up-b{display:inline-block;padding:2px 8px;border:1px solid var(--bd);font-size:10.5px;letter-spacing:.1em}';
  document.head.appendChild(st);
  const sec=document.createElement('section');sec.className='p';sec.id='aiP';
  sec.innerHTML='<div class="ph">AI SECOND OPINION AND SCOREBOARD <span class="r" id="aiR"></span></div>'
  +'<div class="up-g"><div><label for="aiKey">GROQ API KEY</label><input id="aiKey" type="password" autocomplete="off" placeholder="gsk_..."><label for="aiModel">MODEL</label><input id="aiModel" type="text" autocomplete="off"><div class="stabs" style="margin-top:8px"><button id="aiOn" type="button"></button><button id="aiTg" type="button"></button></div><div class="lab" id="aiMsg" style="text-transform:none;letter-spacing:.02em"></div></div>'
  +'<div><div class="lab">AI GRADED AGAINST REAL OUTCOMES, AT 2R</div><div class="big dm" id="aiBig" style="font-size:26px">--</div><div class="lab" id="aiSub" style="text-transform:none;letter-spacing:.02em"></div><div style="margin-top:6px"><span class="up-b" id="aiV">-</span></div></div></div>'
  +'<div class="lab" style="margin-top:10px">LATEST AI VERDICTS</div><div class="tw" id="aiList" style="max-height:240px;margin:6px 0"></div>'
  +'<div class="lab" style="margin-top:6px;text-transform:none;letter-spacing:.02em;line-height:1.5">The AI only reviews new live signals at your alert level, using this engine\'s own saved history as evidence. Its verdicts are stored and graded once the trade resolves. It earns trust only when signals it said TAKE beat the ones it said SKIP with at least 30 of each, and the gap holds at a 95 percent bar. Until then, treat it as a commentary, not a filter. The key stays in this browser and is sent only to Groq. Sound and Telegram work only while this page is open.</div>';
  main.appendChild(sec);
  $('aiKey').value=P.key;$('aiModel').value=P.model;
  $('aiKey').onchange=e=>{P.key=e.target.value.trim();saveP();};
  $('aiModel').onchange=e=>{P.model=e.target.value.trim()||'llama-3.3-70b-versatile';saveP();};
  $('aiOn').onclick=()=>{P.on=!P.on;saveP();draw();};
  $('aiTg').onclick=()=>{P.tg=!P.tg;saveP();draw();};
}
function draw(){
  build();if(!$('aiP'))return;
  $('aiOn').textContent=P.on?'AI REVIEW ON':'AI REVIEW OFF';$('aiOn').classList.toggle('on',P.on);
  $('aiTg').textContent=P.tg?'SEND VERDICT TO TELEGRAM: ON':'SEND VERDICT TO TELEGRAM: OFF';$('aiTg').classList.toggle('on',P.tg);
  $('aiMsg').textContent=P.key?msg:'ENTER A GROQ KEY TO START. NO KEY, NO AI CALLS.';
  const all=Object.values(LOG).filter(x=>x.verdict!=='ERR'),done=all.filter(x=>x.done&&x.r2!==undefined);
  const T=stat(done.filter(x=>x.verdict==='TAKE').map(x=>x.r2)),K=stat(done.filter(x=>x.verdict==='SKIP').map(x=>x.r2));
  $('aiR').textContent=all.length+' REVIEWED / '+done.length+' RESOLVED';
  const big=$('aiBig'),v=$('aiV');let vt='NOT ENOUGH DATA: NEEDS 30 TAKE AND 30 SKIP',vc='var(--amb)';
  if(T.n&&K.n){const d=T.m-K.m;big.textContent=f2(d);big.className='big '+(d>=0?'pos':'neg');
    if(T.n>=30&&K.n>=30){const se=Math.sqrt(((T.hi-T.lo)/3.92)**2+((K.hi-K.lo)/3.92)**2);if(d-1.96*se>0){vt='AI ADDS VALUE';vc='var(--pos)';}else if(d+1.96*se<0){vt='AI HURTS: IGNORE IT';vc='var(--neg)';}else{vt='NOT PROVEN';vc='var(--dim)';}}}
  else{big.textContent='--';big.className='big dm';}
  $('aiSub').textContent='TAKE: '+(T.n?f2(T.m)+' OVER '+T.n:'-')+' / SKIP: '+(K.n?f2(K.m)+' OVER '+K.n:'-')+' / BIG NUMBER IS TAKE MINUS SKIP';
  v.textContent=vt;v.style.color=vc;v.style.borderColor=vc;
  const rows=Object.values(LOG).sort((a,b)=>b.at-a.at).slice(0,15);
  $('aiList').innerHTML=rows.length?'<table><thead><tr><th>TIME</th><th>SYMBOL</th><th>SIDE</th><th class="n">SCORE</th><th>AI</th><th class="n">CONF</th><th>RESULT</th><th>WHY</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+new Date(x.at).toLocaleTimeString('en-GB',{timeZone:'Asia/Muscat',hour12:false})+'</td><td>'+esc(x.sy)+'</td><td class="'+(x.d===1?'pos':'neg')+'">'+(x.d===1?'BUY':'SELL')+'</td><td class="n">'+x.score+'</td><td style="color:'+(x.verdict==='TAKE'?'var(--pos)':x.verdict==='SKIP'?'var(--amb)':'var(--neg)')+'">'+x.verdict+'</td><td class="n">'+x.conf+'</td><td>'+(x.done&&x.r2!==undefined?f2(x.r2)+' AT 2R':'OPEN')+'</td><td style="white-space:normal;text-transform:none;min-width:220px">'+esc(x.reason)+'</td></tr>').join('')+'</tbody></table>':'<div class="dm" style="padding:8px">NO AI VERDICTS YET. THEY APPEAR WHEN A LIVE SIGNAL FIRES AT YOUR ALERT LEVEL.</div>';
}
const go=()=>{try{draw();work();}catch(e){}};
window.addEventListener('load',()=>{setTimeout(go,2000);setInterval(go,5000);});
})();
