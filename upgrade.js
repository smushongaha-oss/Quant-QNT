/* FAT Confluence engine upgrade: CONFIDENCE, WALK-FORWARD, RISK, BACKUP.
   Load with <script src="upgrade.js"></script> just before </body>. It reads the engine's own saved data and
   never changes how scores or signals are made. */
(()=>{
'use strict';
const g=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
const s=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const $=id=>document.getElementById(id);
const P=Object.assign({bal:1000,risk:1,stop:'',cap:3,tgt:2,key:'',bk:0,bkN:0},g('fat_up',{}));
const save=()=>s('fat_up',P);
const NEU=[1,1,1,1,1];
const f2=v=>(v>=0?'+':'')+v.toFixed(2)+'R';

function keys(){const a=[];try{for(let i=0;i<localStorage.length;i++){const n=localStorage.key(i);if(n&&n.indexOf('cse_lset_')===0)a.push(n.slice(9));}}catch(e){}return a.sort();}
function rowsOf(key){const raw=g('cse_lset_'+key,[]);return Array.isArray(raw)?raw.filter(r=>Array.isArray(r)&&r.length===10).map(r=>({sy:r[0],t:r[1],d:r[2],p:r.slice(3,8),r:r[8],rk:r[9]})).sort((a,b)=>a.t-b.t):[];}
function weights(key,cfg){const k=(g('cse_learn',{keys:{}}).keys||{})[key];return cfg.learn!==false&&k&&Array.isArray(k.w)&&k.w.length===5?k.w:NEU;}
function pick(rs,w,thr,tf){const last={},o=[];for(const x of rs){if(Math.round(wScore(x.p,w))<thr)continue;const k=x.sy+'|'+x.d;if(last[k]!==undefined&&x.t-last[k]<8*tf)continue;last[k]=x.t;o.push(x);}return o;}
const rOf=(x,k,spr)=>(x.r>=k?k:-1)-(x.rk>0?((spr&&spr[x.sy])||0)/x.rk:0);
function stat(v){const n=v.length;if(!n)return{n:0,m:0,se:0,lo:0,hi:0};let a=0,q=0;for(const x of v){a+=x;q+=x*x;}const m=a/n,sd=Math.sqrt(Math.max(0,q/(n)-m*m)),se=n>1?sd/Math.sqrt(n-1):0;return{n,m,se,lo:m-1.96*se,hi:m+1.96*se};}

function build(){
  const main=document.querySelector('main.grid');if(!main||$('upP'))return;
  const st=document.createElement('style');
  st.textContent='.p-up{grid-column:span 12}.up-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:6px}.up-g input{width:100%;background:#08111b;border:1px solid var(--bd);color:var(--ink);padding:5px 8px;font-family:var(--m);font-size:12px;text-transform:none}.up-g label{display:block;font-size:10px;color:var(--dim);letter-spacing:.1em;margin:6px 0 3px}.up-b{display:inline-block;padding:2px 8px;border:1px solid var(--bd);font-size:10.5px;letter-spacing:.1em}#upEq{height:150px}';
  document.head.appendChild(st);
  const sec=document.createElement('section');sec.className='p p-up';sec.id='upP';
  sec.innerHTML='<div class="ph">EDGE CHECK, RISK AND BACKUP <span class="r" id="upKeyR"></span></div>'
  +'<div class="stabs"><select id="upKey" aria-label="Dataset"></select><select id="upTgt" aria-label="Target"><option value="1">AT 1R</option><option value="2">AT 2R</option><option value="3">AT 3R</option></select></div>'
  +'<div class="up-g">'
  +'<div><div class="lab">CONFIDENCE</div><div class="big dm" id="upBig" style="font-size:30px">--</div><div class="lab" id="upCI"></div><div style="margin-top:6px"><span class="up-b" id="upV">-</span></div><div class="lab" id="upBE" style="margin-top:6px;text-transform:none;letter-spacing:.02em"></div></div>'
  +'<div><div class="lab">WALK-FORWARD, 4 CHRONOLOGICAL WINDOWS</div><div class="lad" id="upWF" style="margin-top:6px"></div><div class="lab" id="upWFv" style="margin-top:6px;text-transform:none;letter-spacing:.02em"></div></div>'
  +'<div><div class="lab">EQUITY IN R <span id="upDD"></span></div><canvas id="upEq"></canvas></div>'
  +'<div><div class="lab">RISK DESK</div><label for="upBal">ACCOUNT BALANCE</label><input id="upBal" type="number" min="0" step="any"><label for="upRisk">RISK PER TRADE, PERCENT</label><input id="upRisk" type="number" min="0" step="any"><label for="upStop">STOP DISTANCE, PRICE UNITS (FROM THE PLAN BAR)</label><input id="upStop" type="number" min="0" step="any"><label for="upCap">DAILY LOSS CAP, IN R</label><input id="upCap" type="number" min="0" step="any"><div class="fb" style="grid-template-columns:1fr 1fr"><div class="fx o"><span class="lab">RISK AMOUNT</span><b id="upAmt">-</b></div><div class="fx o"><span class="lab">SIZE PER 1.00 PRICE MOVE</span><b id="upSz">-</b></div></div><div style="margin-top:6px"><span class="up-b" id="upDay">-</span></div></div>'
  +'<div><div class="lab">BACKUP</div><div class="lab" id="upBk" style="margin:6px 0;text-transform:none;letter-spacing:.02em"></div><div class="stabs"><button id="upBkNow" type="button">BACKUP NOW</button><button id="upPers" type="button">PROTECT STORAGE</button></div><div class="lab" id="upBkM" style="text-transform:none;letter-spacing:.02em"></div></div>'
  +'</div><div class="lab" style="margin-top:8px;text-transform:none;letter-spacing:.02em">Built from the engine\'s saved resolved candidates, at your alert level and trading cost, with learned weights if learning is on. Interval is 95 percent. Picking the best level or band from many looks inflates results, so treat a pass as a lead, not proof.</div>';
  main.appendChild(sec);
  $('upTgt').value=String(P.tgt);$('upBal').value=P.bal;$('upRisk').value=P.risk;$('upStop').value=P.stop;$('upCap').value=P.cap;
  $('upKey').onchange=e=>{P.key=e.target.value;save();draw();};
  $('upTgt').onchange=e=>{P.tgt=+e.target.value;save();draw();};
  [['upBal','bal'],['upRisk','risk'],['upStop','stop'],['upCap','cap']].forEach(([id,k])=>{$(id).oninput=e=>{P[k]=e.target.value===''?'':+e.target.value;save();draw();};});
  $('upBkNow').onclick=()=>{const b=$('lrExp');if(b)b.click();P.bk=Date.now();P.bkN=total();save();draw();};
  $('upPers').onclick=()=>{try{navigator.storage.persist().then(ok=>{$('upBkM').textContent=ok?'STORAGE PROTECTED: THE BROWSER WILL NOT CLEAR THIS DATA UNDER SPACE PRESSURE.':'THE BROWSER DECLINED. TRY ADDING THE PAGE TO YOUR HOME SCREEN, AND KEEP BACKING UP.';});}catch(e){$('upBkM').textContent='NOT SUPPORTED HERE. KEEP BACKING UP.';}};
}
function total(){return keys().reduce((a,k)=>a+rowsOf(k).length,0);}
function defKey(cfg){const sy=cfg.sym||'';const gp=/^(R_|1HZ|BOOM|CRASH|JD|RDBULL|RDBEAR|stpRNG|WLD|DEX)/i.test(sy)?'SYNTH':/^frx/.test(sy)?'FOREX':/^cry/i.test(sy)?'CRYPTO':'';return gp+'_'+(cfg.tf||60);}
function todayR(cfg,k){
  const off=4*3600,now=Date.now()/1000,start=Math.floor((now+off)/86400)*86400-off;let tot=0,n=0;
  try{for(let i=0;i<localStorage.length;i++){const nm=localStorage.key(i);if(!nm||nm.indexOf('cse_arch_')!==0)continue;const a=g(nm,{});for(const x of Object.values(a)){if(!x||x.t<start||!(x.res==='sl'||x.res==='tp3'))continue;if((x.score||0)<(cfg.thr||70))continue;tot+=(x.reached>=k?k:-1);n++;}}}catch(e){}
  return{tot,n};
}
function draw(){
  build();if(!$('upP'))return;
  const cfg=g('cse_set',{}),ks=keys(),sel=$('upKey');
  const html=ks.length?ks.map(k=>'<option value="'+k+'">'+k.replace('SYNTH','DERIVED').replace('_',' / TF ')+' ('+rowsOf(k).length+')</option>').join(''):'<option>NO DATA YET</option>';
  if(sel._h!==html){sel.innerHTML=html;sel._h=html;}
  if(!ks.includes(P.key))P.key=ks.includes(defKey(cfg))?defKey(cfg):(ks[0]||'');
  sel.value=P.key;
  const key=P.key,tf=+(key.split('_')[1])||60,k=P.tgt,rs=key?rowsOf(key):[],thr=cfg.thr||70,spr=cfg.spr||{};
  $('upKeyR').textContent=key?('ALERT AT '+thr+' / '+rs.length+' CANDIDATES'):'';
  const pk=pick(rs,weights(key,cfg),thr,tf),v=pk.map(x=>rOf(x,k,spr)),S=stat(v);
  const big=$('upBig');
  if(S.n){big.textContent=f2(S.m);big.className='big '+(S.m>=0?'pos':'neg');}else{big.textContent='--';big.className='big dm';}
  $('upCI').textContent=S.n?'95% RANGE '+f2(S.lo)+' TO '+f2(S.hi)+' / N '+S.n:'WAITING FOR RESOLVED TRADES';
  const vb=$('upV');let vt='NOISE: UNDER 30 TRADES',vc='var(--amb)';
  if(S.n>=30){if(S.lo>0){vt='EDGE LIKELY';vc='var(--pos)';}else if(S.hi<0){vt='NEGATIVE EDGE';vc='var(--neg)';}else{vt='NOT SIGNIFICANT';vc='var(--dim)';}}
  vb.textContent=vt;vb.style.color=vc;vb.style.borderColor=vc;
  const wins=pk.filter(x=>x.r>=k).length,ac=pk.length?pk.reduce((a,x)=>a+(x.rk>0?((spr[x.sy]||0)/x.rk):0),0)/pk.length:0;
  $('upBE').textContent=pk.length?('WIN RATE '+Math.round(100*wins/pk.length)+'% AGAINST A BREAK-EVEN OF '+Math.round(100*(1+ac)/(k+1))+'% AT '+k+'R'+(ac>0?', COST '+ac.toFixed(2)+'R PER TRADE':'')+'.'):'';
  // walk-forward
  const W=4,sz=Math.floor(v.length/W),wf=[];
  if(sz>=8)for(let i=0;i<W;i++)wf.push(stat(v.slice(i*sz,i===W-1?v.length:(i+1)*sz)));
  $('upWF').innerHTML=wf.length?wf.map((x,i)=>'<div class="lr" style="grid-template-columns:44px 1fr 90px"><span>W'+(i+1)+'</span><div class="bar"><i class="'+(x.m>=0?'s':'')+'" style="width:'+Math.min(100,Math.abs(x.m)/1.5*100)+'%;'+(x.m<0?'background:var(--neg)':'')+'"></i></div><span>'+f2(x.m)+' N'+x.n+'</span></div>').join(''):'<div class="dm">NEEDS ABOUT 32 TRADES AT YOUR LEVEL</div>';
  const pos=wf.filter(x=>x.m>0).length;
  $('upWFv').textContent=wf.length?(pos>=3?'STABLE: '+pos+' OF 4 WINDOWS PROFITABLE.':pos===2?'MIXED: 2 OF 4 WINDOWS PROFITABLE.':'UNSTABLE: ONLY '+pos+' OF 4 WINDOWS PROFITABLE.')+' A real edge should not live in one stretch only.':'';
  // equity
  const cv=$('upEq'),dpr=Math.min(window.devicePixelRatio||1,2),w=cv.clientWidth,h=cv.clientHeight;
  if(w&&h){
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
    const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    let eq=0,pk2=0,dd=0,ls=0,ml=0;const cu=[0];
    for(const x of v){eq+=x;cu.push(eq);if(eq>pk2)pk2=eq;if(pk2-eq>dd)dd=pk2-eq;if(x<0){ls++;if(ls>ml)ml=ls;}else ls=0;}
    $('upDD').textContent=v.length?'/ MAX DRAWDOWN '+dd.toFixed(1)+'R / LONGEST LOSING RUN '+ml:'';
    if(cu.length>2){
      const mn=Math.min(...cu,0),mx=Math.max(...cu,0.5),X=i=>i/(cu.length-1)*(w-4)+2,Y=y=>h-6-(y-mn)/(mx-mn||1)*(h-12);
      c.strokeStyle='rgba(255,255,255,.25)';c.beginPath();c.moveTo(0,Y(0));c.lineTo(w,Y(0));c.stroke();
      c.strokeStyle=eq>=0?'#2fe38a':'#ff4d5e';c.lineWidth=1.5;c.beginPath();cu.forEach((y,i)=>{if(i===0)c.moveTo(X(i),Y(y));else c.lineTo(X(i),Y(y));});c.stroke();
    }
  }
  // risk desk
  const amt=(+P.bal||0)*(+P.risk||0)/100;
  $('upAmt').textContent=amt?amt.toFixed(2):'-';
  $('upSz').textContent=amt&&+P.stop>0?(amt/+P.stop).toPrecision(4):'-';
  const td=todayR(cfg,k),db=$('upDay'),cap=+P.cap||0;
  let dt='TODAY: '+f2(td.tot)+' OVER '+td.n+' LIVE TRADES',dc='var(--dim)';
  if(cap>0&&td.tot<=-cap){dt+=' / CAP HIT, STOP TRADING TODAY';dc='var(--neg)';}else if(cap>0&&td.tot<=-cap*0.66){dt+=' / NEAR YOUR CAP';dc='var(--amb)';}
  db.textContent=dt;db.style.color=dc;db.style.borderColor=dc;
  // backup
  const tot=total(),age=P.bk?Math.round((Date.now()-P.bk)/3600000):null,fresh=tot-(P.bkN||0);
  const late=age===null||age>24||fresh>150;
  $('upBk').innerHTML=(age===null?'NO BACKUP YET. ':'LAST BACKUP '+(age<1?'UNDER AN HOUR':age+' HOURS')+' AGO. ')+tot+' CANDIDATES SAVED, '+Math.max(0,fresh)+' NEW SINCE THE LAST BACKUP.'+(late&&tot>0?' <b style="color:var(--amb)">BACK UP NOW.</b>':'');
}
const go=()=>{try{draw();}catch(e){}};
window.addEventListener('load',()=>{setTimeout(go,1500);setInterval(go,5000);});
})();
