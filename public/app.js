import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>{const v=Math.round((+n||0)*100)/100;return v.toLocaleString('en-US',{maximumFractionDigits:2})};
const N=h=>'<span class="num">'+h+'</span>';
const gid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const KINDS={cash:'كاش معايا',shop:'دكان',bank:'بنك',wallet:'محفظة',work:'شغل',other:'تاني'};
const COLORS=['#0F8A7E','#C77B12','#3F6FD1','#B3402F','#7A4FB5','#2E8B57','#8A6D3B','#C2528B'];
const CATS=['أكل وشرب','مواصلات','بضاعة','إيجار','كهربا ومياه','موبايل وإنترنت','عمالة ومرتبات','صيانة','شخصي','عيلة','صدقة وخير','طارئ','تاني'];
const TYPES={
  exp:{l:'مصروف',long:'مصروف',from:1,dir:-1},
  inc:{l:'دخل',long:'دخل',to:1,dir:1},
  xfer:{l:'تحويل',long:'تحويل بين حساباتي',from:1,to:1,dir:0},
  lend:{l:'سلّفت',long:'سلّفت حد',from:1,person:1,dir:-1,debt:1},
  repay_in:{l:'رجّع لي',long:'حد رجّع لي',to:1,person:1,dir:1,debt:-1},
  borrow:{l:'استلفت',long:'استلفت من حد، أو حد سابلي فلوس أمانة',to:1,person:1,dir:1,debt:-1},
  repay_out:{l:'سدّدت',long:'سدّدت لحد، أو رجّعت أمانة',from:1,person:1,dir:-1,debt:1},
  aloan:{l:'سلفة لحساب',long:'حساب سلّف حساب تاني (مثلًا جيبي سلّف الدكان)',from:1,to:1,dir:0},
  arepay:{l:'سداد لحساب',long:'حساب سدّد لحساب تاني اللي كان واخده منه',from:1,to:1,dir:0},
  adj:{l:'تسوية',long:'تسوية',dir:0}
};
const ENTRY_ORDER=['exp','inc','xfer','lend','repay_in','borrow','repay_out','aloan','arepay'];
const S={accounts:[],tx:[],meta:{seen:[],last:{},kw:{}}};
const ui={tab:'home',fAcc:'all',fKind:'all',q:'',limit:80};
const freshMeta=()=>({seen:[],last:{},kw:{},contacts:[],smsBal:{}});
function defaults(){return [
  {id:'a_cash',name:'جيبي',kind:'cash',color:COLORS[0],open:0},
  {id:'a_shop',name:'الدكان',kind:'shop',color:COLORS[1],open:0},
  {id:'a_bank',name:'البنك',kind:'bank',color:COLORS[2],open:0},
  {id:'a_voda',name:'فودافون كاش',kind:'wallet',color:COLORS[3],open:0},
  {id:'a_amz',name:'أمازون (شغل)',kind:'work',color:COLORS[4],open:0},
  {id:'a_oth',name:'حساب تاني',kind:'other',color:COLORS[5],open:0}];}

/* ---------- حسابات ---------- */
const accById=id=>S.accounts.find(a=>a.id===id);
const accName=id=>{const a=accById(id);return a?a.name:'حساب محذوف'};
const liveAccs=()=>S.accounts.filter(a=>!a.hidden);
function balances(){
  const b={};S.accounts.forEach(a=>b[a.id]=+a.open||0);
  S.tx.forEach(x=>{if(x.to&&x.to in b)b[x.to]+=x.amt;if(x.from&&x.from in b)b[x.from]-=x.amt});
  return b;
}
function people(){
  const p={};
  S.tx.forEach(x=>{
    const T=TYPES[x.type];if(!x.person||!T||!T.debt)return;
    const o=p[x.person]||(p[x.person]={name:x.person,bal:0,last:0});
    o.bal+=T.debt*x.amt;o.last=Math.max(o.last,x.t);
  });
  return Object.values(p).map(o=>{o.bal=Math.round(o.bal*100)/100;return o});
}
function interDebts(){
  const m={};
  S.tx.forEach(x=>{
    if(x.type!=='aloan'&&x.type!=='arepay')return;
    const loan=x.type==='aloan',d=loan?x.to:x.from,c=loan?x.from:x.to,v=loan?x.amt:-x.amt;
    const a=d<c?d:c,b=d<c?c:d,k=a+'|'+b;
    m[k]=(m[k]||0)+(d===a?1:-1)*v;
  });
  const out=[];
  Object.keys(m).forEach(k=>{
    const p=k.split('|'),v=Math.round(m[k]*100)/100;
    if(v>0.004)out.push({debtor:p[0],creditor:p[1],amt:v});
    else if(v<-0.004)out.push({debtor:p[1],creditor:p[0],amt:-v});
  });
  return out;
}
function totals(){
  const b=balances();let cash=0;liveAccs().forEach(a=>cash+=b[a.id]);
  let owedToMe=0,iOwe=0;people().forEach(p=>{if(p.bal>0)owedToMe+=p.bal;else iOwe-=p.bal});
  return {cash,owedToMe,iOwe,net:cash+owedToMe-iOwe,b};
}
const dayKey=t=>{const d=new Date(t);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate()};
const AR_DAYS=['الأحد','الاتنين','التلات','الأربع','الخميس','الجمعة','السبت'];
function dayLabel(t){
  const d=new Date(t),n=new Date();
  const k=dayKey(t),kn=dayKey(n.getTime()),ky=dayKey(n.getTime()-864e5);
  if(k===kn)return 'النهاردة';if(k===ky)return 'امبارح';
  return AR_DAYS[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1);
}
function timeLabel(t){const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function flowText(x){
  const A=accName;
  switch(x.type){
    case 'exp':return A(x.from)+' ← '+(x.cat||'مصروف');
    case 'inc':return (x.cat||'دخل')+' ← '+A(x.to);
    case 'xfer':return A(x.from)+' ← '+A(x.to);
    case 'lend':return A(x.from)+' ← '+x.person+' (سلفة)';
    case 'repay_in':return x.person+' ← '+A(x.to)+' (رجّع لي)';
    case 'borrow':return x.person+' ← '+A(x.to)+' (استلفت)';
    case 'repay_out':return A(x.from)+' ← '+x.person+' (سداد)';
    case 'aloan':return A(x.from)+' ← '+A(x.to)+' (سلفة بين حساباتي)';
    case 'arepay':return A(x.from)+' ← '+A(x.to)+' (سداد بين حساباتي)';
    case 'adj':return x.to?('تسوية ← '+A(x.to)):('تسوية ← '+A(x.from));
  }
  return '';
}
function sign(x){
  if(x.type==='xfer')return 0;
  if(x.type==='adj')return x.to?1:-1;
  return TYPES[x.type].dir;
}

/* ---------- حفظ (Firebase) ---------- */
let uid=null,userEmail='',unsubs=[],loaded=false,remote=new Map(),metaReady=false,txReady=false,db=null,auth=null,shareDone=false;
const G={email:'',pass:'',msg:'',busy:false};
function banner(msg){$('#banner').innerHTML=msg?'<div class="banner">'+esc(msg)+'</div>':''}
const fbOk=()=>firebaseConfig&&firebaseConfig.apiKey&&String(firebaseConfig.apiKey).indexOf('YOUR_')<0;
function gate(html){const g=$('#gate');g.hidden=!html;g.innerHTML=html||''}
function gateSetup(){
  gate('<div class="gcard"><h2>إعداد Firebase</h2><p>التطبيق شغال، ناقص تربطه بقاعدة بياناتك. افتح الملف <b dir="ltr">public/firebase-config.js</b> والصق إعدادات مشروعك من Firebase Console، وبعدها ارفع التغيير على GitHub. الخطوات كاملة في ملف README.</p></div>');
}
function gateAuth(){
  gate('<div class="gcard"><h2>دفتر حساباتي</h2><p>سجّل دخول عشان بياناتك تتحفظ على حسابك وتفتح من أي تليفون.</p>'
    +(G.msg?'<div class="warn" style="margin-bottom:8px">'+esc(G.msg)+'</div>':'')
    +'<div class="field"><label for="gEmail">الإيميل</label><input type="text" id="gEmail" dir="ltr" inputmode="email" autocomplete="username" value="'+esc(G.email)+'" data-in="gEmail"></div>'
    +'<div class="field"><label for="gPass">كلمة السر</label><input type="password" id="gPass" dir="ltr" autocomplete="current-password" value="'+esc(G.pass)+'" data-in="gPass"></div>'
    +'<div class="btns"><button class="btn primary" data-act="gLogin"'+(G.busy?' disabled':'')+'>دخول</button><button class="btn" data-act="gSignup"'+(G.busy?' disabled':'')+'>حساب جديد</button></div>'
    +'<div class="btns" style="margin-top:10px"><button class="btn" data-act="gGoogle"'+(G.busy?' disabled':'')+'>الدخول بحساب جوجل</button></div>'
    +'<div style="text-align:center;margin-top:10px"><button class="link" data-act="gReset">نسيت كلمة السر</button></div></div>');
}
const AUTH_ERR={
  'auth/invalid-email':'الإيميل مش مظبوط',
  'auth/missing-password':'اكتب كلمة السر',
  'auth/invalid-credential':'الإيميل أو كلمة السر غلط',
  'auth/wrong-password':'الإيميل أو كلمة السر غلط',
  'auth/user-not-found':'الإيميل أو كلمة السر غلط',
  'auth/email-already-in-use':'الإيميل ده مسجّل قبل كده، اضغط دخول',
  'auth/weak-password':'كلمة السر لازم تكون 6 حروف على الأقل',
  'auth/network-request-failed':'مفيش نت دلوقتي',
  'auth/too-many-requests':'محاولات كتير، استنى شوية وجرّب تاني',
  'auth/popup-closed-by-user':'',
  'auth/cancelled-popup-request':'',
  'auth/operation-not-allowed':'طريقة الدخول دي مش متفعّلة في Firebase Console'
};
function authFail(e){G.busy=false;const c=e&&e.code;G.msg=(c in AUTH_ERR)?AUTH_ERR[c]:('حصلت مشكلة: '+(c||'غير معروفة'));gateAuth()}

const mk=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const stripU=x=>{const o={};Object.keys(x).forEach(k=>{if(x[k]!==undefined)o[k]=x[k]});return o};
function saveErr(e){banner('مقدرتش أحفظ على السيرفر: '+((e&&e.code)||'مشكلة غير معروفة'))}
function writeMeta(){
  if(!db||!uid)return;
  setDoc(doc(db,'users',uid,'meta','main'),{v:1,data:JSON.stringify({accounts:S.accounts,meta:S.meta}),updated:Date.now()}).catch(saveErr);
}
function syncTx(){
  if(!db||!uid)return;
  const ops=[],cur=new Set();
  S.tx.forEach(x=>{cur.add(x.id);const j=JSON.stringify(x);if(remote.get(x.id)!==j){ops.push({set:stripU(x)});remote.set(x.id,j)}});
  Array.from(remote.keys()).forEach(id=>{if(!cur.has(id)){ops.push({del:id});remote.delete(id)}});
  for(let i=0;i<ops.length;i+=400){
    const b=writeBatch(db);
    ops.slice(i,i+400).forEach(o=>{
      if(o.set)b.set(doc(db,'users',uid,'tx',o.set.id),o.set);else b.delete(doc(db,'users',uid,'tx',o.del));
    });
    b.commit().catch(saveErr);
  }
}
function touch(o){
  o=o||{};if(!loaded)return;
  if(o.meta)writeMeta();
  syncTx();render();
}
function ready(){
  if(!(metaReady&&txReady))return;
  loaded=true;gate('');render();
  if(!shareDone){shareDone=true;handleShare()}
}
function handleShare(){
  try{
    const p=new URLSearchParams(location.search),t=(p.get('text')||'')+(p.get('title')&&!p.get('text')?p.get('title'):'');
    if(t.trim()){ui.tab='sms';ui.sms.text=t;history.replaceState(null,'',location.pathname);runSmsParse()}
  }catch(e){}
}
function unsub(){unsubs.forEach(f=>{try{f()}catch(e){}});unsubs=[];loaded=false;metaReady=false;txReady=false;remote=new Map();S.tx=[];S.accounts=[];S.meta=freshMeta()}
function subscribe(){
  unsub();
  unsubs.push(onSnapshot(doc(db,'users',uid,'meta','main'),snap=>{
    let d=null;
    if(snap.exists()){try{d=JSON.parse(snap.data().data)}catch(e){}}
    if(d&&Array.isArray(d.accounts)&&d.accounts.length){S.accounts=d.accounts;S.meta=Object.assign(freshMeta(),d.meta||{})}
    else{S.accounts=defaults();S.meta=freshMeta();if(!snap.exists()&&!snap.metadata.fromCache)writeMeta()}
    metaReady=true;ready();
  },saveErr));
  unsubs.push(onSnapshot(collection(db,'users',uid,'tx'),snap=>{
    S.tx=snap.docs.map(d=>Object.assign({},d.data(),{id:d.id}));
    remote=new Map(S.tx.map(x=>[x.id,JSON.stringify(x)]));
    txReady=true;ready();
  },saveErr));
}
async function boot(){
  window.addEventListener('online',()=>banner(''));
  window.addEventListener('offline',()=>banner('مفيش نت. اللي تسجّله بيتحفظ على التليفون وبيترفع أول ما النت يرجع.'));
  if(!fbOk()){gateSetup();return}
  const app=initializeApp(firebaseConfig);auth=getAuth(app);
  try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})})}
  catch(e){db=initializeFirestore(app,{})}
  onAuthStateChanged(auth,u=>{
    if(u){uid=u.uid;userEmail=u.email||'';G.pass='';G.busy=false;G.msg='';subscribe()}
    else{uid=null;userEmail='';unsub();$('#view').innerHTML='';gateAuth()}
  });
}

/* ---------- أدوات الواجهة ---------- */
const ACT={},INP={};
let toastT=null,undoFn=null;
function toast(msg,undo){
  undoFn=undo||null;
  $('#toast').innerHTML='<div><span>'+esc(msg)+'</span>'+(undo?'<button data-act="undo">تراجع</button>':'')+'</div>';
  clearTimeout(toastT);toastT=setTimeout(()=>{$('#toast').innerHTML='';undoFn=null},7000);
}
function openSheet(html){
  $('#sheetRoot').innerHTML='<div class="backdrop" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>'+html+'</div></div>';
}
function closeSheet(){$('#sheetRoot').innerHTML=''}
const btn=(act,label,cls,attrs)=>'<button class="btn '+(cls||'')+'" data-act="'+act+'" '+(attrs||'')+'>'+label+'</button>';

/* ---------- الرئيسية ---------- */
function txRow(x){
  const s=sign(x),T=TYPES[x.type];
  const cls=s===0?'flat':(T.debt?'debt':(s>0?'in':'out'));
  const sg=s>0?'+':(s<0?'−':'');
  const t1=x.note||x.person||x.cat||T.l;
  return '<button class="row" data-act="openTx" data-id="'+esc(x.id)+'"><div class="mid"><div class="t1">'+esc(t1)
    +(x.once?'<span class="pill once">طارئ</span>':'')+(x.src==='sms'?'<span class="pill">رسالة</span>':'')
    +'</div><div class="t2">'+esc(flowText(x))+' · '+timeLabel(x.t)+'</div></div><div class="amt '+cls+'">'+sg+N(fmt(x.amt))+'</div></button>';
}
function monthStats(){
  const now=new Date(),k=mk(now.getTime());
  const cats={};let exp=0,inc=0,once=0;
  S.tx.forEach(x=>{
    if(mk(x.t)!==k)return;
    if(x.type==='exp'){
      exp+=x.amt;if(x.once)once+=x.amt;
      const c=x.cat||'تاني';const o=cats[c]||(cats[c]={c:c,reg:0,once:0});
      if(x.once)o.once+=x.amt;else o.reg+=x.amt;
    }else if(x.type==='inc')inc+=x.amt;
  });
  return {cats:Object.values(cats).sort((a,b)=>(b.reg+b.once)-(a.reg+a.once)),exp:exp,inc:inc,once:once};
}
function vHome(){
  const T=totals(),b=T.b,M=monthStats();
  const first=!S.tx.length&&liveAccs().every(a=>!(+a.open));
  let h='<section class="hero"><div class="lbl">الفلوس اللي معاك دلوقتي</div><div class="big">'+N(fmt(T.cash))+'<small>ج.م</small></div>'
    +'<div class="sub"><div><b>'+N(fmt(T.owedToMe))+'</b><span>ليك عند الناس</span></div><div><b>'+N(fmt(T.iOwe))+'</b><span>عليك للناس</span></div></div>'
    +'<div class="lbl" style="margin-top:10px">الصافي بعد الديون: <b>'+N(fmt(T.net))+'</b> ج.م</div></section>';
  h+='<div class="qa"><button class="btn" data-act="quick" data-type="exp">مصروف</button><button class="btn" data-act="quick" data-type="inc">دخل</button><button class="btn" data-act="quick" data-type="lend">سلّفت حد</button><button class="btn primary" data-act="vcOpen">تحويل فودافون كاش</button></div>';
  if(first)h+='<div class="card" style="margin-bottom:12px"><b>ابدأ من هنا</b><p style="margin:6px 0 0;color:var(--muted);font-size:14px">اضغط على كل حساب تحت واكتب الرصيد اللي فيه فعلًا دلوقتي. بعد كده أي فلوس تدخل أو تطلع، اضغط على الزرار + وسجّلها في ثواني.</p></div>';
  h+='<div class="accs">';
  liveAccs().forEach(a=>{
    const v=b[a.id];
    h+='<button class="acc" data-act="openAcc" data-id="'+esc(a.id)+'"><span class="nm"><span class="dot" style="background:'+esc(a.color)+'"></span><span>'+esc(a.name)+'</span></span><span class="bal'+(v<0?' neg':'')+'">'+N(fmt(v))+'</span></button>';
  });
  h+='<button class="acc add" data-act="newAcc">+ حساب جديد</button></div>';
  const ID=interDebts();
  if(ID.length){
    h+='<div class="sec"><h2>ديون بين حساباتك</h2></div><div class="list">'+ID.map(d=>
      '<button class="row" data-act="icRepay" data-d="'+esc(d.debtor)+'" data-c="'+esc(d.creditor)+'" data-amt="'+d.amt+'"><div class="mid"><div class="t1">'+esc(accName(d.debtor))+' واخد من '+esc(accName(d.creditor))+'</div><div class="t2">الفلوس دي جوّه حساباتك ومش بتغيّر إجمالي فلوسك. اضغط عشان تسجّل سداد.</div></div><div class="amt debt">'+N(fmt(d.amt))+'</div></button>').join('')+'</div>';
  }
  h+='<div class="sec"><h2>الشهر ده</h2></div><div class="card">';
  if(!M.exp&&!M.inc)h+='<div class="empty" style="padding:10px">لسه مفيش حركات الشهر ده.</div>';
  else{
    h+='<div class="kv"><span>صرفت</span><b>'+N(fmt(M.exp))+' ج.م</b></div>'
      +'<div class="kv"><span>منهم طارئ أو مرة واحدة</span><b>'+N(fmt(M.once))+' ج.م</b></div>'
      +'<div class="kv"><span>دخل</span><b>'+N(fmt(M.inc))+' ج.م</b></div>';
    const mx=Math.max.apply(null,M.cats.map(c=>c.reg+c.once).concat([1]));
    M.cats.slice(0,6).forEach(c=>{
      h+='<div class="cat"><span>'+esc(c.c)+'</span><div class="track"><i style="width:'+(c.reg/mx*100)+'%;background:var(--accent)"></i><i style="width:'+(c.once/mx*100)+'%;background:var(--debt)"></i></div><b>'+N(fmt(c.reg+c.once))+'</b></div>';
    });
    if(M.cats.length)h+='<div class="legend"><span><i style="background:var(--accent)"></i>عادي</span><span><i style="background:var(--debt)"></i>طارئ / مرة واحدة</span></div>';
  }
  h+='</div>';
  const rec=S.tx.slice().sort((x,y)=>y.t-x.t).slice(0,6);
  h+='<div class="sec"><h2>آخر الحركات</h2><button class="link" data-act="tab" data-tab="log">الكل</button></div>';
  h+=rec.length?'<div class="list">'+rec.map(txRow).join('')+'</div>':'<div class="empty">اضغط + وسجّل أول حركة.</div>';
  return h;
}

/* ---------- السجل ---------- */
function filteredTx(){
  let a=S.tx.slice().sort((x,y)=>y.t-x.t);
  if(ui.fAcc!=='all')a=a.filter(x=>x.from===ui.fAcc||x.to===ui.fAcc);
  const k=ui.fKind;
  if(k==='exp')a=a.filter(x=>x.type==='exp');
  else if(k==='inc')a=a.filter(x=>x.type==='inc');
  else if(k==='debt')a=a.filter(x=>TYPES[x.type].debt);
  else if(k==='once')a=a.filter(x=>x.once);
  else if(k==='sms')a=a.filter(x=>x.src==='sms');
  const q=ui.q.trim();
  if(q)a=a.filter(x=>((x.note||'')+' '+(x.person||'')+' '+(x.cat||'')).indexOf(q)>=0);
  return a;
}
function logList(){
  const a=filteredTx();
  if(!a.length)return '<div class="empty">مفيش حركات بالشكل ده.</div>';
  let h='',last=null;
  a.slice(0,ui.limit).forEach(x=>{
    const k=dayKey(x.t);
    if(k!==last){if(last!==null)h+='</div>';h+='<div class="day">'+esc(dayLabel(x.t))+'</div><div class="list">';last=k}
    h+=txRow(x);
  });
  h+='</div>';
  if(a.length>ui.limit)h+='<div class="btns">'+btn('more','عرض أكتر')+'</div>';
  return h;
}
function vLog(){
  const kinds=[['all','الكل'],['exp','مصروفات'],['inc','دخل'],['debt','ديون'],['once','طارئ'],['sms','من الرسائل']];
  let h='<div class="sec"><h2>السجل</h2></div><div class="scroll-x" style="margin-bottom:8px">'
    +'<button class="chip sm'+(ui.fAcc==='all'?' on':'')+'" data-act="fAcc" data-id="all">كل الحسابات</button>'
    +liveAccs().map(a=>'<button class="chip sm'+(ui.fAcc===a.id?' on':'')+'" data-act="fAcc" data-id="'+esc(a.id)+'">'+esc(a.name)+'</button>').join('')+'</div>';
  h+='<div class="scroll-x" style="margin-bottom:10px">'+kinds.map(k=>'<button class="chip sm'+(ui.fKind===k[0]?' on':'')+'" data-act="fKind" data-id="'+k[0]+'">'+k[1]+'</button>').join('')+'</div>';
  h+='<input type="search" id="logQ" placeholder="دوّر في الملاحظات والأسماء" value="'+esc(ui.q)+'" data-in="q">';
  h+='<div id="logList">'+logList()+'</div>';
  return h;
}

/* ---------- الناس ---------- */
function vPeople(){
  const P=peopleAll().sort((a,b)=>Math.abs(b.bal)-Math.abs(a.bal)||b.last-a.last);
  const mine=P.filter(p=>p.bal>0),owe=P.filter(p=>p.bal<0),done=P.filter(p=>p.bal===0);
  const row=(p)=>{
    const cls=p.bal>0?'debt':(p.bal<0?'out':'flat');
    const txt=p.bal>0?'عليه':(p.bal<0?'عليك له':'متصفّي');
    return '<button class="row" data-act="openPerson" data-p="'+esc(encodeURIComponent(p.name))+'"><div class="mid"><div class="t1">'+esc(p.name)+'</div><div class="t2">'+(p.last?'آخر حركة '+esc(dayLabel(p.last)):'مفيش حركات لسه')+'</div></div><div class="amt '+cls+'">'+(p.bal?N(fmt(Math.abs(p.bal)))+' <span style="font-weight:400;font-size:12px">'+txt+'</span>':txt)+'</div></button>';
  };
  let h='<div class="sec"><h2>الناس والديون</h2></div><div class="btns" style="margin-top:0">'
    +btn('newDebt','سلّفت حد','','data-type="lend"')+btn('newDebt','استلفت من حد','','data-type="borrow"')+btn('addPerson','+ إضافة شخص','primary')+'</div>';
  if(!P.length)h+='<div class="empty">لسه مفيش حد. أول ما تسجّل سلفة هتظهر هنا.</div>';
  if(mine.length)h+='<div class="sec"><h2>ليك عندهم</h2></div><div class="list">'+mine.map(row).join('')+'</div>';
  if(owe.length)h+='<div class="sec"><h2>عليك ليهم</h2></div><div class="list">'+owe.map(row).join('')+'</div>';
  if(done.length)h+='<div class="sec"><h2>متصفّي</h2></div><div class="list">'+done.map(row).join('')+'</div>';
  return h;
}

/* ---------- المزيد ---------- */
function vMore(){
  const b=balances();
  let h='<div class="sec"><h2>حساباتي</h2></div><div class="list">';
  S.accounts.forEach(a=>{
    h+='<button class="row" data-act="openAcc" data-id="'+esc(a.id)+'"><span class="dot" style="background:'+esc(a.color)+'"></span><div class="mid"><div class="t1">'+esc(a.name)+(a.hidden?'<span class="pill">مخفي</span>':'')+'</div><div class="t2">'+esc(KINDS[a.kind]||'')+'</div></div><div class="amt flat">'+N(fmt(b[a.id]))+'</div></button>';
  });
  h+='</div><div class="btns">'+btn('newAcc','+ حساب جديد')+'</div>';
  h+='<div class="sec"><h2>حسابك</h2></div><div class="card"><div class="kv"><span>داخل بـ</span><b class="num">'+esc(userEmail||'')+'</b></div><p style="margin:8px 0 0;color:var(--muted);font-size:14px">بياناتك محفوظة في قاعدة بيانات Firebase على حسابك، وبتتزامن بين كل أجهزتك وبتشتغل من غير نت.</p><div class="btns" style="margin-top:8px">'+btn('signOut','تسجيل خروج')+'</div></div>';
  h+='<div class="sec"><h2>الأرقام المحفوظة</h2></div>';
  const cs=S.meta.contacts||[];
  h+=cs.length?'<div class="list">'+cs.map((c,i)=>'<div class="row"><div class="mid"><div class="t1">'+esc(c.n)+'</div><div class="t2 num">'+esc(c.p)+'</div></div><button class="link" data-act="delContact" data-i="'+i+'">مسح</button></div>').join('')+'</div>':'<div class="empty" style="padding:10px">الأرقام اللي تحوّل لها بتتحفظ هنا.</div>';
  h+='<div class="sec"><h2>نسخة احتياطية</h2></div><div class="card"><p style="margin:0 0 6px;color:var(--muted);font-size:14px">حمّل نسخة من بياناتك كملف، أو استرجع نسخة قديمة.</p><div class="btns" style="margin-top:8px">'+btn('exportData','حفظ نسخة','primary')+btn('importOpen','استرجاع نسخة')+'</div></div>';
  h+='<div class="sec"><h2>عن الدفتر</h2></div><div class="card" style="font-size:14px;color:var(--muted)">'
    +'لو حساب سلّف حساب تاني (جيبي سلّف الدكان مثلًا) سجّلها "سلفة لحساب" وهتظهر في الرئيسية تحت "ديون بين حساباتك". ولو حد سابلك فلوس أمانة سجّلها "استلفت" باسمه، وهتتخصم من "الصافي" لأنها مش بتاعتك. الرصيد بيتحسب من الحركات اللي بتسجّلها. لو نسيت تسجّل حاجة، افتح الحساب واكتب الرصيد الفعلي والدفتر هيسجّل الفرق لوحده كحركة "غير مسجّل" وتعرف حجم اللخبطة.</div>';
  return h;
}

/* ---------- العرض ---------- */
function render(){
  if(!loaded)return;
  $('#today').textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
  document.querySelectorAll('.nav .tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===ui.tab));
  const views={home:vHome,log:vLog,people:vPeople,sms:vSms,more:vMore};
  const y=window.scrollY;
  $('#view').innerHTML=views[ui.tab]();
  window.scrollTo(0,y);
}

/* ---------- تسجيل حركة ---------- */
const INC_CATS=['مبيعات','شغل أمازون','مرتب','هدية','تاني'];
const FROM_L={exp:'طلعت من أنهي حساب؟',xfer:'من',lend:'السلفة طلعت من',repay_out:'السداد طلع من',aloan:'اللي سلّف',arepay:'اللي سدّد'};
const TO_L={inc:'دخلت في أنهي حساب؟',xfer:'إلى',repay_in:'الفلوس دخلت في',borrow:'الفلوس دخلت في',aloan:'اللي استلف',arepay:'اللي اتسدّد له'};
function normDigits(s){
  return String(s||'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g,'.').replace(/[٬،]/g,',');
}
const toLocalInput=t=>{const d=new Date(t),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
let E=null;
function entryAccs(){
  const ids=liveAccs().map(a=>a.id);
  [E&&E.from,E&&E.to].forEach(i=>{if(i&&ids.indexOf(i)<0&&accById(i))ids.push(i)});
  return ids.map(accById);
}
function fixAccs(){
  const T=TYPES[E.type],L=S.meta.last||{},ids=entryAccs().map(a=>a.id);
  if(T.from&&ids.indexOf(E.from)<0)E.from=ids.indexOf(L[E.type+'_from'])>=0?L[E.type+'_from']:ids[0];
  if(T.to&&ids.indexOf(E.to)<0)E.to=ids.indexOf(L[E.type+'_to'])>=0?L[E.type+'_to']:(T.from?ids.filter(i=>i!==E.from)[0]:ids[0]);
  if(T.from&&T.to&&E.from===E.to)E.to=ids.filter(i=>i!==E.from)[0]||E.to;
}
function newEntry(type,pre){
  pre=pre||{};
  E={type:type||(S.meta.last&&S.meta.last.type)||'exp',amt:pre.amt!=null?String(pre.amt):'',from:pre.from||null,to:pre.to||null,
     person:pre.person||'',cat:pre.cat||'',once:!!pre.once,note:pre.note||'',t:pre.t||Date.now(),editId:pre.editId||null};
  if(!TYPES[E.type]||E.type==='adj')E.type='exp';
  fixAccs();
  openSheet('<h3>'+(E.editId?'تعديل حركة':'سجّل حركة')+'</h3>'
    +'<input type="text" inputmode="decimal" autocomplete="off" id="eAmt" class="amount-in" placeholder="0" value="'+esc(E.amt)+'" data-in="eAmt" aria-label="المبلغ بالجنيه">'
    +'<div id="eDyn"></div>'
    +'<div class="field"><label for="eNote">ملاحظة (اختياري)</label><input type="text" id="eNote" placeholder="مثلًا: بنزين، فاتورة النور، بضاعة من أحمد" value="'+esc(E.note)+'" data-in="eNote" autocomplete="off"></div>'
    +'<div id="eSug"></div>'
    +'<div class="field"><label for="eDate">الوقت</label><input type="datetime-local" id="eDate" value="'+toLocalInput(E.t)+'" data-in="eDate"></div>'
    +'<div class="btns">'+btn('eSave','حفظ','primary')+(E.editId?'':btn('eSaveMore','حفظ وسجّل تاني'))+'</div>');
  entryDyn();entrySug();
  if(!E.editId)setTimeout(()=>{const a=$('#eAmt');if(a)a.focus()},60);
}
function accChips(kind,sel){
  return '<div class="chips">'+entryAccs().map(a=>'<button class="chip'+(sel===a.id?' on':'')+'" data-act="'+kind+'" data-id="'+esc(a.id)+'">'+esc(a.name)+'</button>').join('')+'</div>';
}
function personInfo(){
  const nm=E.person.trim();if(!nm)return null;
  const p=people().find(q=>q.name===nm);return p||{name:nm,bal:0,last:0};
}
const TGROUPS=[['فلوسي',['exp','inc','xfer']],['الناس',['lend','repay_in','borrow','repay_out']],['بين حساباتي',['aloan','arepay']]];
const TCHIP={exp:'مصروف',inc:'دخل',xfer:'تحويل بين حساباتي',lend:'سلّفت حد',repay_in:'حد رجّع لي',borrow:'استلفت من حد',repay_out:'سدّدت لحد',aloan:'حساب سلّف حساب',arepay:'حساب سدّد حساب'};
const hasPicker=()=>!!(navigator.contacts&&navigator.contacts.select);
function entryDyn(){
  const T=TYPES[E.type];
  let h=TGROUPS.map(g=>'<div class="lbl2" style="margin-top:12px">'+g[0]+'</div><div class="chips" style="margin-top:6px">'
    +g[1].map(t=>'<button class="chip sm'+(E.type===t?' on':'')+'" data-act="eType" data-type="'+t+'">'+TCHIP[t]+'</button>').join('')+'</div>').join('');
  h+='<div style="font-size:12.5px;color:var(--muted);margin-top:8px">'+esc(T.long)+'</div>';
  if(T.from)h+='<div class="field"><span class="lbl2">'+esc(FROM_L[E.type]||'من')+'</span>'+accChips('eFrom',E.from)+'</div>';
  if(T.to)h+='<div class="field"><span class="lbl2">'+esc(TO_L[E.type]||'إلى')+'</span>'+accChips('eTo',E.to)+'</div>';
  if(T.person){
    const P=peopleAll().sort((a,b)=>b.last-a.last||a.name.localeCompare(b.name,'ar'));
    h+='<div class="field"><span class="lbl2">مين الشخص؟</span>'
      +(P.length?'<div class="chips">'+P.map(p=>'<button class="chip'+(p.name===E.person?' on':'')+'" data-act="ePersonPick" data-p="'+esc(encodeURIComponent(p.name))+'">'+esc(p.name)+'</button>').join('')+'</div>':'<div style="font-size:13px;color:var(--muted)">لسه مفيش ناس. اكتب اسم أو اختار من جهات الاتصال.</div>')
      +(hasPicker()?'<div class="btns" style="margin-top:8px">'+btn('pickContact','اختار من جهات الاتصال','','data-ctx="entry"')+'</div>':'')
      +'<label for="ePerson" class="lbl2" style="margin-top:8px">أو اكتب اسم جديد</label><input type="text" id="ePerson" value="'+esc(E.person)+'" data-in="ePerson" placeholder="اسم الشخص" autocomplete="off">'
      +'<div id="ePInfo">'+personInfoHtml()+'</div></div>';
  }
  if(E.type==='exp'){
    h+='<div class="field"><span class="lbl2">راح في إيه؟</span><div class="chips">'
      +CATS.map(c=>'<button class="chip sm'+(E.cat===c?' on':'')+'" data-act="eCat" data-c="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div></div>'
      +'<div class="chips"><button class="chip'+(E.once?' on':'')+'" data-act="eOnce">مصروف طارئ أو مرة واحدة</button></div>';
  }
  if(E.type==='inc'){
    h+='<div class="field"><span class="lbl2">من إيه؟</span><div class="chips">'
      +INC_CATS.map(c=>'<button class="chip sm'+(E.cat===c?' on':'')+'" data-act="eCat" data-c="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div></div>';
  }
  $('#eDyn').innerHTML=h;
}
function personInfoHtml(){
  const p=personInfo();if(!p||!p.last)return '';
  if(p.bal>0){
    return '<div class="warn" style="margin-top:6px">ليك عنده '+N(fmt(p.bal))+' ج.م'+(E.type==='repay_in'?' <button class="link" data-act="eAll" data-v="'+p.bal+'">اكتب المبلغ كله</button>':'')+'</div>';
  }
  if(p.bal<0){
    return '<div class="warn" style="margin-top:6px">عليك له '+N(fmt(-p.bal))+' ج.م'+(E.type==='repay_out'?' <button class="link" data-act="eAll" data-v="'+(-p.bal)+'">اكتب المبلغ كله</button>':'')+'</div>';
  }
  return '<div class="ok" style="margin-top:6px">حسابكم متصفّي</div>';
}
function inferCat(note){
  const kw=S.meta.kw||{};const w=normDigits(note).split(/[\s,.،\-_/]+/).filter(x=>x.length>=3);
  for(let i=0;i<w.length;i++)if(kw[w[i]])return kw[w[i]];
  return '';
}
function learn(x){
  if(x.type!=='exp'||!x.cat||!x.note)return;
  const kw=S.meta.kw=S.meta.kw||{};
  normDigits(x.note).split(/[\s,.،\-_/]+/).filter(w=>w.length>=3&&!/^\d+$/.test(w)).forEach(w=>{kw[w]=x.cat});
  const ks=Object.keys(kw);if(ks.length>300)ks.slice(0,ks.length-300).forEach(k=>delete kw[k]);
}
function entrySug(){
  const box=$('#eSug');if(!box)return;
  if(E.type==='exp'&&!E.cat&&E.note){const c=inferCat(E.note);if(c){E.cat=c;entryDyn()}}
  const q=E.note.trim(),seen={},out=[];
  S.tx.slice().sort((a,b)=>b.t-a.t).forEach(x=>{
    if(x.type!==E.type||!x.note||seen[x.note]||out.length>=5)return;
    if(q&&x.note.indexOf(q)!==0)return;
    seen[x.note]=1;out.push(x);
  });
  box.innerHTML=out.length?'<div class="lbl2">زي اللي قبل كده</div><div class="scroll-x" style="margin-top:6px">'
    +out.map(x=>'<button class="chip sm" data-act="eSug" data-id="'+esc(x.id)+'">'+esc(x.note)+' · '+fmt(x.amt)+'</button>').join('')+'</div>':'';
}
function saveEntry(again){
  const amt=parseFloat(String(E.amt).replace(/,/g,''));
  if(!(amt>0)){toast('اكتب المبلغ الأول');const a=$('#eAmt');if(a)a.focus();return}
  const T=TYPES[E.type];
  if(T.person&&!E.person.trim()){toast('اكتب اسم الشخص');return}
  if(T.from&&T.to&&E.from===E.to){toast('اختار حسابين مختلفين');return}
  const x={id:E.editId||gid(),t:E.t,type:E.type,amt:Math.round(amt*100)/100,
    from:T.from?E.from:null,to:T.to?E.to:null,person:T.person?E.person.trim():null,
    cat:(E.type==='exp'||E.type==='inc')?(E.cat||null):null,once:E.type==='exp'?!!E.once:false,note:E.note.trim()||null};
  let oldT=null;
  if(E.editId){const i=S.tx.findIndex(y=>y.id===E.editId);if(i>=0){oldT=S.tx[i].t;if(S.tx[i].src)x.src=S.tx[i].src;S.tx[i]=x}else S.tx.push(x)}
  else S.tx.push(x);
  const L=S.meta.last=S.meta.last||{};L.type=E.type;
  if(T.from)L[E.type+'_from']=E.from;if(T.to)L[E.type+'_to']=E.to;
  learn(x);
  if(x.person){const cs=S.meta.contacts=S.meta.contacts||[];if(!cs.some(k=>k.n===x.person))cs.push({n:x.person,p:''})}
  const wasEdit=!!E.editId,months=[x.t];if(oldT!=null)months.push(oldT);
  const nextType=E.type;
  touch({meta:true,months:months});
  const msg='اتسجّل '+fmt(x.amt)+' ج.م: '+flowText(x);
  if(wasEdit)toast(msg);
  else toast(msg,()=>{S.tx=S.tx.filter(y=>y.id!==x.id);touch({months:[x.t]});toast('اتمسحت الحركة')});
  if(again)newEntry(nextType);else closeSheet();
}

/* ---------- تفاصيل حركة ---------- */
function openTxSheet(id){
  const x=S.tx.find(y=>y.id===id);if(!x)return;
  const T=TYPES[x.type],d=new Date(x.t);
  const kv=(k,v)=>v?'<div class="kv"><span>'+k+'</span><span>'+v+'</span></div>':'';
  openSheet('<h3>'+esc(T.long)+'</h3>'
    +'<div style="font-size:30px;font-weight:700;margin-block:4px 8px">'+N(fmt(x.amt))+' <small style="font-size:15px;font-weight:500">ج.م</small></div>'
    +kv('المسار',esc(flowText(x)))+kv('الشخص',esc(x.person||''))+kv('التصنيف',esc(x.cat||'')+(x.once?' (طارئ)':''))
    +kv('الملاحظة',esc(x.note||''))+kv('الوقت',esc(dayLabel(x.t))+' '+timeLabel(x.t)+' · '+d.getFullYear())
    +kv('المصدر',x.src==='sms'?'رسالة':'اتسجّلت بإيدك')
    +'<div class="btns">'+(x.type==='adj'?'':btn('editTx','تعديل','primary','data-id="'+esc(x.id)+'"'))+btn('delTx','مسح','danger','data-id="'+esc(x.id)+'"')+'</div>');
}

/* ---------- حساب ---------- */
let AE=null;
const hasTx=id=>S.tx.some(x=>x.from===id||x.to===id);
const parseNum=s=>{const v=parseFloat(normDigits(s).replace(/,/g,''));return isFinite(v)?v:NaN};
function accSheet(){
  const isNew=!AE.id,cur=isNew?0:(balances()[AE.id]||0);
  let h='<h3>'+(isNew?'حساب جديد':esc(AE.name||'حساب'))+'</h3>'
    +'<div class="field"><label for="aName">اسم الحساب</label><input type="text" id="aName" value="'+esc(AE.name)+'" data-in="aName" placeholder="مثلًا: الدكان" autocomplete="off"></div>'
    +'<div class="field"><span class="lbl2">النوع</span><div class="chips">'
    +Object.keys(KINDS).map(k=>'<button class="chip sm'+(AE.kind===k?' on':'')+'" data-act="aKind" data-k="'+k+'">'+KINDS[k]+'</button>').join('')+'</div></div>'
    +'<div class="field"><span class="lbl2">اللون</span><div class="chips">'
    +COLORS.map(c=>'<button class="chip sm'+(AE.color===c?' on':'')+'" data-act="aColor" data-c="'+c+'" aria-label="لون" style="background:'+c+';width:34px;height:34px;padding:0;border:3px solid '+(AE.color===c?'var(--fg)':'transparent')+'"></button>').join('')+'</div></div>';
  if(isNew){
    h+='<div class="field"><label for="aOpen">الرصيد اللي فيه دلوقتي</label><input type="text" inputmode="decimal" id="aOpen" value="'+esc(AE.open||'')+'" data-in="aOpen" placeholder="0"></div>'
      +'<div class="btns">'+btn('aSave','أضف الحساب','primary')+'</div>';
  }else{
    h+='<div class="kv" style="margin-top:8px"><span>الرصيد في الدفتر</span><b>'+N(fmt(cur))+' ج.م</b></div>'
      +'<div class="field"><label for="aActual">الرصيد الفعلي دلوقتي (اللي في الدرج أو التطبيق أو الكشف)</label><input type="text" inputmode="decimal" id="aActual" value="'+esc(AE.actual)+'" data-in="aActual" placeholder="'+esc(fmt(cur))+'"><div id="aDiff"></div></div>'
      +'<div class="btns">'+btn('reconcile','ظبّط الرصيد','primary')+btn('aSave','حفظ الاسم واللون')+'</div>'
      +'<div class="btns">'+btn('aLog','حركات الحساب')+btn('aHide',AE.hidden?'إظهار الحساب':'إخفاء الحساب')+'</div>';
  }
  openSheet(h);
  if(!isNew)diffHtml();
}
function diffHtml(){
  const box=$('#aDiff');if(!box||!AE)return;
  const v=parseNum(AE.actual);if(AE.actual===''||isNaN(v)){box.innerHTML='';return}
  const d=Math.round((v-(balances()[AE.id]||0))*100)/100;
  box.innerHTML=Math.abs(d)<0.005?'<div class="ok">الرصيد مظبوط.</div>'
    :'<div class="warn">'+(d>0?'فيه فلوس دخلت ومش مسجّلة: ':'فيه فلوس طلعت ومش مسجّلة: ')+N(fmt(Math.abs(d)))+' ج.م</div>';
}
function openAcc(id){
  const a=id?accById(id):null;
  AE=a?{id:a.id,name:a.name,kind:a.kind,color:a.color,open:a.open||0,hidden:!!a.hidden,actual:''}
      :{id:null,name:'',kind:'cash',color:COLORS[S.accounts.length%COLORS.length],open:'',hidden:false,actual:''};
  accSheet();
}

/* ---------- شخص ---------- */
function openPerson(name){
  const p=people().find(q=>q.name===name);if(!p)return;
  const list=S.tx.filter(x=>x.person===name).sort((a,b)=>b.t-a.t);
  const e=encodeURIComponent(name);
  let h='<h3>'+esc(name)+'</h3><div style="font-size:26px;font-weight:700;margin-block:2px 8px" class="'+(p.bal>0?'amt debt':(p.bal<0?'amt out':''))+'">'
    +(p.bal>0?N(fmt(p.bal))+' <small style="font-size:14px;font-weight:500">ج.م عليه ليك</small>':p.bal<0?N(fmt(-p.bal))+' <small style="font-size:14px;font-weight:500">ج.م عليك له</small>':'<small style="font-size:16px">حسابكم متصفّي</small>')+'</div><div class="btns" style="margin-top:6px">';
  if(p.bal>0)h+=btn('personAct','رجّع لي','primary','data-type="repay_in" data-amt="'+p.bal+'" data-p="'+esc(e)+'"')+btn('personAct','سلّفته كمان','','data-type="lend" data-p="'+esc(e)+'"');
  else if(p.bal<0)h+=btn('personAct','سدّدت له','primary','data-type="repay_out" data-amt="'+(-p.bal)+'" data-p="'+esc(e)+'"')+btn('personAct','استلفت منه كمان','','data-type="borrow" data-p="'+esc(e)+'"');
  else h+=btn('personAct','سلّفته','primary','data-type="lend" data-p="'+esc(e)+'"')+btn('personAct','استلفت منه','','data-type="borrow" data-p="'+esc(e)+'"');
  h+=btn('personVc','تحويل فودافون كاش له','','data-p="'+esc(e)+'"')+btn('waOpen','رسالة واتساب بالتفاصيل','','data-p="'+esc(e)+'"')+'</div><div class="sec"><h2>الحركات</h2></div><div class="list">'+list.map(txRow).join('')+'</div>';
  openSheet(h);
}

/* ---------- الأوامر ---------- */
Object.assign(ACT,{
  tab(el){ui.tab=el.dataset.tab;closeSheet();render();window.scrollTo(0,0)},
  newTx(){newEntry()},
  newDebt(el){newEntry(el.dataset.type)},
  icRepay(el){newEntry('arepay',{from:el.dataset.d,to:el.dataset.c,amt:el.dataset.amt})},
  backdrop(el,ev){if(ev.target===el)closeSheet()},
  undo(){if(undoFn){const f=undoFn;undoFn=null;$('#toast').innerHTML='';f()}},
  fAcc(el){ui.fAcc=el.dataset.id;ui.limit=80;render()},
  fKind(el){ui.fKind=el.dataset.id;ui.limit=80;render()},
  more(){ui.limit+=80;render()},
  openTx(el){openTxSheet(el.dataset.id)},
  editTx(el){
    const x=S.tx.find(y=>y.id===el.dataset.id);if(!x)return;
    newEntry(x.type,{amt:x.amt,from:x.from,to:x.to,person:x.person,cat:x.cat,once:x.once,note:x.note,t:x.t,editId:x.id});
  },
  delTx(el){
    if(!el.dataset.armed){el.dataset.armed='1';el.textContent='اضغط تاني للتأكيد';setTimeout(()=>{if(el.isConnected){delete el.dataset.armed;el.textContent='مسح'}},4000);return}
    const x=S.tx.find(y=>y.id===el.dataset.id);if(!x)return;
    S.tx=S.tx.filter(y=>y.id!==x.id);closeSheet();touch({months:[x.t]});
    toast('اتمسحت الحركة',()=>{S.tx.push(x);touch({months:[x.t]})});
  },
  openAcc(el){openAcc(el.dataset.id)},
  newAcc(){openAcc(null)},
  aKind(el){AE.kind=el.dataset.k;accSheet()},
  aColor(el){AE.color=el.dataset.c;accSheet()},
  aSave(){
    const name=(AE.name||'').trim();if(!name){toast('اكتب اسم الحساب');return}
    if(!AE.id){
      const o=parseNum(AE.open);
      S.accounts.push({id:'a_'+gid(),name:name,kind:AE.kind,color:AE.color,open:isNaN(o)?0:o});
    }else{
      const a=accById(AE.id);if(a){a.name=name;a.kind=AE.kind;a.color=AE.color}
    }
    closeSheet();touch({meta:true});toast('اتحفظ الحساب');
  },
  reconcile(){
    const a=accById(AE.id),actual=parseNum(AE.actual);
    if(isNaN(actual)){toast('اكتب الرصيد الفعلي');return}
    const cur=balances()[a.id]||0,d=Math.round((actual-cur)*100)/100;
    if(Math.abs(d)<0.005){toast('الرصيد مظبوط');closeSheet();return}
    if(!hasTx(a.id)){a.open=(+a.open||0)+d;closeSheet();touch({meta:true});toast('اتضبط رصيد '+a.name+' على '+fmt(actual)+' ج.م');return}
    const x={id:gid(),t:Date.now(),type:'adj',amt:Math.abs(d),from:d<0?a.id:null,to:d>0?a.id:null,person:null,cat:'غير مسجّل',once:false,note:'تسوية: الرصيد الفعلي '+fmt(actual)};
    S.tx.push(x);closeSheet();touch({months:[x.t]});
    toast((d>0?'اتسجّل فرق دخل غير مسجّل ':'اتسجّل فرق مصروف غير مسجّل ')+fmt(Math.abs(d))+' ج.م',()=>{S.tx=S.tx.filter(y=>y.id!==x.id);touch({months:[x.t]})});
  },
  aHide(){const a=accById(AE.id);if(!a)return;a.hidden=!a.hidden;closeSheet();touch({meta:true})},
  aLog(){ui.fAcc=AE.id;ui.fKind='all';ui.tab='log';closeSheet();render();window.scrollTo(0,0)},
  openPerson(el){openPerson(decodeURIComponent(el.dataset.p))},
  personAct(el){newEntry(el.dataset.type,{person:decodeURIComponent(el.dataset.p),amt:el.dataset.amt||''})},
  eType(el){E.type=el.dataset.type;fixAccs();entryDyn();entrySug()},
  eFrom(el){E.from=el.dataset.id;if(TYPES[E.type].to&&E.to===E.from)fixAccs();entryDyn()},
  eTo(el){E.to=el.dataset.id;if(TYPES[E.type].from&&E.to===E.from){E.from=entryAccs().map(a=>a.id).filter(i=>i!==E.to)[0]}entryDyn()},
  eCat(el){E.cat=E.cat===el.dataset.c?'':el.dataset.c;entryDyn()},
  eOnce(){E.once=!E.once;entryDyn()},
  ePersonPick(el){E.person=decodeURIComponent(el.dataset.p);entryDyn()},
  eAll(el){E.amt=String(el.dataset.v);const a=$('#eAmt');if(a)a.value=E.amt},
  eSug(el){
    const x=S.tx.find(y=>y.id===el.dataset.id);if(!x)return;
    E.note=x.note||'';E.amt=String(x.amt);E.cat=x.cat||'';E.once=!!x.once;
    if(x.from)E.from=x.from;if(x.to)E.to=x.to;fixAccs();
    $('#eAmt').value=E.amt;$('#eNote').value=E.note;entryDyn();entrySug();
  },
  eSave(){saveEntry(false)},
  eSaveMore(){saveEntry(true)}
});
Object.assign(INP,{
  q(el){ui.q=el.value;ui.limit=80;const b=$('#logList');if(b)b.innerHTML=logList()},
  eAmt(el){const v=normDigits(el.value).replace(/[^\d.,]/g,'');if(v!==el.value)el.value=v;E.amt=v},
  eNote(el){E.note=el.value;entrySug()},
  ePerson(el){E.person=el.value;const b=$('#ePInfo');if(b)b.innerHTML=personInfoHtml()},
  eDate(el){const t=new Date(el.value).getTime();if(isFinite(t))E.t=t},
  aName(el){AE.name=el.value},
  aOpen(el){AE.open=el.value},
  aActual(el){AE.actual=el.value;diffHtml()}
});

/* ---------- الرسائل ---------- */
ui.sms={text:'',items:null,report:null,skipped:0};
const CUR='(?:EGP|LE|L\\.E\\.?|جنيه|جنية|ج\\.م|ج\\s?م)';
const NUMR='(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const OUT_RE=/خصم|سحب|حولت|تحويل|دفع|شراء|مشتريات|سداد|purchase|debit|withdraw|paid|payment|sent/i;
const IN_RE=/استلام|استلمت|ايداع|إيداع|اضاف|إضاف|اضافة|إضافة|credit|received|deposit|refund|استرداد|وصلك/i;
function findAmounts(m){
  const re=new RegExp('(?:'+CUR+'\\s*:?\\s*'+NUMR+')|(?:'+NUMR+'\\s*'+CUR+')','gi');
  const out=[];let r;
  while((r=re.exec(m))){
    const v=parseFloat((r[1]||r[2]).replace(/,/g,''));
    const pre=m.slice(Math.max(0,r.index-35),r.index);
    out.push({v:v,bal:/رصيد|balance|متاح|available|الباقي/i.test(pre)});
  }
  return out;
}
function splitMsgs(t){
  let blocks=t.split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);
  if(blocks.length===1){
    const lines=blocks[0].split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(lines.length>1&&lines.every(l=>findAmounts(normDigits(l)).length>0))blocks=lines;
  }
  return blocks;
}
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)+s.length}
function guessAcc(m){
  const L=liveAccs();
  for(let i=0;i<L.length;i++)if(L[i].name.length>=3&&m.indexOf(L[i].name)>=0)return L[i].id;
  if(/فودافون|vodafone|vf\s?cash|اتصالات كاش|etisalat cash|orange cash|اورنج كاش|wallet|محفظة/i.test(m)){const w=L.find(a=>a.kind==='wallet');if(w)return w.id}
  if(/بنك|bank|cib|nbe|الأهلي|الاهلي|qnb|hsbc|banque|بطاقة|card|visa|mastercard|meeza|ميزة|instapay|انستا/i.test(m)){const b=L.find(a=>a.kind==='bank');if(b)return b.id}
  return L[0]?L[0].id:null;
}
function parseMsg(raw){
  const m=normDigits(raw).replace(/\s+/g,' ').trim();
  const am=findAmounts(m);let amt=null,bal=null;
  const a=am.filter(x=>!x.bal)[0],b=am.filter(x=>x.bal)[0];
  if(a)amt=a.v;if(b)bal=b.v;
  if(amt==null){const r=m.match(new RegExp('(?:مبلغ|بمبلغ|amount)\\s*:?\\s*'+NUMR,'i'));if(r)amt=parseFloat(r[1].replace(/,/g,''))}
  if(bal==null){const r=m.match(new RegExp('(?:رصيد\\S*|balance)[^\\d]{0,30}'+NUMR,'i'));if(r)bal=parseFloat(r[1].replace(/,/g,''))}
  if(!(amt>0))return null;
  const hasTo=/(?:الى|إلى|الي|to)\s*(?:رقم|محفظة|wallet)?\s*:?\s*01\d{9}/i.test(m);
  const hasFrom=/(?:من|from)\s*(?:رقم|محفظة|wallet)?\s*:?\s*01\d{9}/i.test(m);
  const transfer=/تحويل|transfer|ارسال|إرسال|sent/i.test(m);
  let dir=null;
  if(transfer&&hasTo)dir='out';
  else if(hasFrom&&(transfer||/استلام|استلمت|received/i.test(m)))dir='in';
  else{
    const o=OUT_RE.test(m),i=IN_RE.test(m);
    if(o&&!i)dir='out';else if(i&&!o)dir='in';else if(o&&i)dir=m.search(OUT_RE)<m.search(IN_RE)?'out':'in';
  }
  let who=null;const pm=m.match(/(?:^|\D)(01[0125]\d{8})(?!\d)/);
  if(pm)who=pm[1];
  else{const r=m.match(/(?:\bat\b|عند|لدى)\s+([^.,،:\d]{3,28}?)(?=\s+(?:بتاريخ|on|في|بمبلغ|رصيد|Ref)|[.,،]|$)/i);if(r)who=r[1].trim()}
  let t=Date.now();
  const dm=m.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(dm){
    let y=+dm[3];if(y<100)y+=2000;
    const d=new Date(y,+dm[2]-1,+dm[1],+(dm[4]||12),+(dm[5]||0));
    if(+dm[2]>=1&&+dm[2]<=12&&isFinite(d.getTime())&&d.getTime()<=Date.now()+864e5)t=d.getTime();
  }
  return {amt:amt,bal:bal,dir:dir,who:who,t:t,m:m};
}
function runSmsParse(){
  const blocks=splitMsgs(ui.sms.text||''),items=[];let skipped=0;
  blocks.forEach(raw=>{
    const p=parseMsg(raw);if(!p){skipped++;return}
    const h=hashStr(p.m),dup=(S.meta.seen||[]).indexOf(h)>=0;
    const acc=guessAcc(p.m),others=liveAccs().map(a=>a.id).filter(i=>i!==acc);
    items.push({h:h,raw:raw,amt:p.amt,bal:p.bal,dir:p.dir,t:p.t,type:p.dir==='in'?'inc':'exp',acc:acc,acc2:others[0]||acc,person:'',
      note:(p.dir==='in'?'وارد':(p.dir==='out'?'صادر':'رسالة'))+(p.who?' · '+p.who:''),dup:dup,on:!dup});
  });
  ui.sms.items=items;ui.sms.skipped=skipped;ui.sms.report=null;render();
}
function smsItemHtml(it,i){
  const T=TYPES[it.type],accs=liveAccs();
  const sel=(id,val,act)=>'<select data-in="'+act+'" data-i="'+i+'" id="'+act+i+'">'+accs.map(a=>'<option value="'+esc(a.id)+'"'+(a.id===val?' selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select>';
  const dirTxt=it.dir==='in'?'داخل':(it.dir==='out'?'خارج':'مش متأكد من الاتجاه');
  let h='<div class="sms"><label class="chk"><input type="checkbox" data-in="smsOn" data-i="'+i+'"'+(it.on?' checked':'')+'><span>'+N(fmt(it.amt))+' ج.م · '+dirTxt+'</span></label>'
    +(it.dup?'<div class="warn">الرسالة دي اتضافت قبل كده، فمش متعلّمة.</div>':'')
    +(it.dir==null?'<div class="warn">اختار النوع الصح بنفسك.</div>':'')
    +'<div class="src">'+esc(it.raw)+'</div><div class="grid">'
    +'<div class="field" style="margin-block:4px"><label for="smsType'+i+'">النوع</label><select data-in="smsType" data-i="'+i+'" id="smsType'+i+'">'
    +ENTRY_ORDER.map(t=>'<option value="'+t+'"'+(it.type===t?' selected':'')+'>'+esc(TYPES[t].long)+'</option>').join('')+'</select></div>'
    +'<div class="field" style="margin-block:4px"><label for="smsAcc'+i+'">'+(T.from&&T.to?'من':'الحساب')+'</label>'+sel('smsAcc'+i,it.acc,'smsAcc')+'</div></div>';
  if(T.from&&T.to)h+='<div class="field" style="margin-block:4px"><label for="smsAcc2'+i+'">إلى</label>'+sel('smsAcc2'+i,it.acc2,'smsAcc2')+'</div>';
  if(T.person)h+='<div class="field" style="margin-block:4px"><label for="smsPerson'+i+'">الاسم</label><input type="text" id="smsPerson'+i+'" data-in="smsPerson" data-i="'+i+'" value="'+esc(it.person)+'"></div>';
  h+='<div class="field" style="margin-block:4px"><label for="smsNote'+i+'">ملاحظة</label><input type="text" id="smsNote'+i+'" data-in="smsNote" data-i="'+i+'" value="'+esc(it.note)+'"></div>';
  if(it.bal!=null)h+='<div class="lbl2">الرصيد المكتوب في الرسالة: '+N(fmt(it.bal))+' ج.م</div>';
  return h+'</div>';
}
function vSms(){
  const s=ui.sms;
  let h='<div class="sec"><h2>رسائل البنك وفودافون كاش</h2></div>'
    +'<div class="card" style="font-size:14px;color:var(--muted);margin-bottom:10px">التطبيق ما بيقراش رسايل التليفون لوحده. انسخ الرسائل من تطبيق الرسائل واضغط لصق من النسخ، أو لو تطبيق الرسائل عندك فيه مشاركة اختار منه دفتر حساباتي (سطر فاضي بين كل رسالة)، وأنا أقسمها وأقترح كل حركة تتسجّل في أنهي حساب. إنت اللي بتراجع وتأكّد قبل ما تتضاف.</div>';
  if(s.report)h+='<div class="card" style="margin-bottom:10px;border-color:var(--accent)"><b>'+esc(s.report.title)+'</b>'+s.report.lines.map(l=>'<div class="warn" style="margin-top:6px">'+l+'</div>').join('')+'</div>';
  h+='<textarea id="smsText" data-in="smsText" placeholder="الصق الرسائل هنا">'+esc(s.text)+'</textarea><div class="btns">'+btn('smsParse','حلّل الرسائل','primary')+btn('smsPaste','لصق من النسخ')+'</div>';
  if(s.items){
    if(!s.items.length)h+='<div class="empty">ملقيتش مبلغ في أي رسالة. اتأكد إنك لزقت نص الرسالة كامل.</div>';
    else h+='<div class="sec"><h2>راجع قبل ما تضيف</h2></div>'+s.items.map(smsItemHtml).join('')
      +'<div class="btns">'+btn('smsAdd','أضف المعلّم عليه','primary')+'</div>';
    if(s.skipped)h+='<div class="empty" style="padding:8px">'+s.skipped+' رسالة معرفتش أطلّع منها مبلغ فاتخطيتها.</div>';
  }
  h+=reconHtml();
  return h;
}
function addSmsItems(){
  const its=ui.sms.items.filter(it=>it.on);
  if(!its.length){toast('مفيش حاجة معلّم عليها');return}
  for(let i=0;i<its.length;i++){
    const it=its[i],T=TYPES[it.type];
    if(T.person&&!it.person.trim()){toast('اكتب اسم الشخص في الرسالة اللي نوعها '+T.l);return}
    if(T.from&&T.to&&it.acc===it.acc2){toast('اختار حسابين مختلفين في التحويل');return}
  }
  const months=[],lastBal={};
  its.forEach(it=>{
    const T=TYPES[it.type];
    const x={id:gid(),t:it.t,type:it.type,amt:it.amt,from:T.from?it.acc:null,to:T.to?(T.from?it.acc2:it.acc):null,
      person:T.person?it.person.trim():null,cat:(it.type==='exp'||it.type==='inc')?(inferCat(it.note)||null):null,once:false,note:it.note||null,src:'sms'};
    S.tx.push(x);months.push(x.t);
    S.meta.seen=(S.meta.seen||[]).concat(it.h).slice(-600);
    if(it.bal!=null){const sb=S.meta.smsBal=S.meta.smsBal||{};if(!sb[it.acc]||sb[it.acc].t<=it.t)sb[it.acc]={v:it.bal,t:it.t}}
    if(it.bal!=null&&(!lastBal[it.acc]||lastBal[it.acc].t<=it.t))lastBal[it.acc]={t:it.t,v:it.bal};
  });
  touch({meta:true,months:months});
  const b=balances(),lines=[];
  Object.keys(lastBal).forEach(id=>{
    const d=Math.round((lastBal[id].v-b[id])*100)/100;
    if(Math.abs(d)>=0.5)lines.push('رصيد '+esc(accName(id))+' في آخر رسالة '+N(fmt(lastBal[id].v))+' وفي الدفتر '+N(fmt(b[id]))+' (فرق '+N(fmt(Math.abs(d)))+'). <button class="link" data-act="openAcc" data-id="'+esc(id)+'">افتح الحساب وظبّطه</button>');
  });
  ui.sms={text:'',items:null,report:{title:'اتضافت '+its.length+' حركة',lines:lines},skipped:0};
  render();
}
Object.assign(ACT,{
  smsParse(){runSmsParse()},
  smsAdd(){addSmsItems()},
  exportData(){exportData()},
  importOpen(){
    openSheet('<h3>استرجاع نسخة</h3><div style="font-size:14px;color:var(--muted)">الصق محتوى ملف النسخة الاحتياطية. ده هيستبدل كل بيانات الدفتر الحالية.</div>'
      +'<div class="field"><textarea id="impText" data-in="impText" placeholder="{ ... }"></textarea></div><div class="btns">'+btn('importDo','استرجع','danger')+'</div>');
  },
  importDo(el){
    const raw=($('#impText')||{}).value||'';let d=null;
    try{d=JSON.parse(raw)}catch(e){}
    if(!d||!Array.isArray(d.accounts)||!Array.isArray(d.tx)||!d.accounts.length){toast('النص ده مش نسخة صالحة');return}
    if(!el.dataset.armed){el.dataset.armed='1';el.textContent='اضغط تاني للتأكيد';return}
    const months=S.tx.map(x=>x.t).concat(d.tx.map(x=>x.t));
    S.accounts=d.accounts;S.tx=d.tx.filter(x=>x&&x.amt>0&&isFinite(x.t));S.meta=Object.assign(freshMeta(),d.meta||{});
    closeSheet();touch({meta:true,months:months});toast('اتسترجعت النسخة: '+S.tx.length+' حركة');
  }
});
Object.assign(INP,{
  smsText(el){ui.sms.text=el.value},
  smsOn(el){ui.sms.items[+el.dataset.i].on=el.checked},
  smsType(el){const it=ui.sms.items[+el.dataset.i];it.type=el.value;render()},
  smsAcc(el){ui.sms.items[+el.dataset.i].acc=el.value},
  smsAcc2(el){ui.sms.items[+el.dataset.i].acc2=el.value},
  smsPerson(el){ui.sms.items[+el.dataset.i].person=el.value},
  smsNote(el){ui.sms.items[+el.dataset.i].note=el.value},
  impText(){}
});

/* ---------- نسخة احتياطية ---------- */
async function exportData(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  const data=JSON.stringify({v:1,exported:d.toISOString(),accounts:S.accounts,meta:S.meta,tx:S.tx});
  const name='daftar-hesabaty-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.json';
  try{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=name;
    document.body.appendChild(a);a.click();a.remove();toast('اتحمّلت النسخة');return;
  }catch(e){}
  openSheet('<h3>النسخة الاحتياطية</h3><div style="font-size:14px;color:var(--muted)">انسخ النص ده واحفظه في مكان أمان.</div>'
    +'<div class="field"><textarea id="expText" readonly>'+esc(data)+'</textarea></div><div class="btns">'+btn('copyExp','نسخ','primary')+'</div>');
}
ACT.copyExp=function(){
  const ta=$('#expText');if(!ta)return;
  const sel=()=>{ta.focus();ta.select()};
  try{navigator.clipboard.writeText(ta.value).then(()=>toast('اتنسخت'),sel)}catch(e){sel()}
};

/* ---------- تشغيل ---------- */
const app=$('#app');
app.addEventListener('click',ev=>{const el=ev.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f)f(el,ev)});
['input','change'].forEach(n=>app.addEventListener(n,ev=>{const el=ev.target,k=el.dataset&&el.dataset.in;if(k&&INP[k])INP[k](el,ev)}));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeSheet()});


/* ---------- تحويل فودافون كاش ---------- */
function normPhone(s){
  let v=normDigits(s).replace(/[\s\-().]/g,'');
  if(v.indexOf('+20')===0)v='0'+v.slice(3);else if(v.indexOf('0020')===0)v='0'+v.slice(4);else if(/^20\d{10}$/.test(v))v='0'+v.slice(2);
  return v;
}
const okPhone=v=>/^01[0125]\d{8}$/.test(v);
const contacts=()=>S.meta.contacts||(S.meta.contacts=[]);
const VPURP=[['exp','دفعة أو مصروف'],['lend','سلفة له'],['repay_out','سداد دين عليّا']];
let VT=null;
function vcDefaultFrom(){
  const ids=liveAccs().map(a=>a.id),l=(S.meta.last||{}).vcFrom;
  if(l&&ids.indexOf(l)>=0)return l;
  const w=liveAccs().find(a=>a.kind==='wallet');return w?w.id:ids[0];
}
function vcOpen(){
  VT={num:'',name:'',amt:'',fee:'',purpose:'exp',from:vcDefaultFrom()};
  openSheet('<h3>تحويل فودافون كاش</h3>'
    +(hasPicker()?'<div class="btns" style="margin-top:0">'+btn('pickContact','اختار من جهات الاتصال','primary','data-ctx="vc"')+'</div>':'')
    +'<div id="vContacts"></div>'
    +'<div class="field"><label for="vNum">رقم المستلم</label><input type="text" id="vNum" dir="ltr" inputmode="tel" autocomplete="off" placeholder="01XXXXXXXXX" data-in="vNum"></div>'
    +'<div class="field"><label for="vName">الاسم (اكتبه عشان الرقم يتحفظ)</label><input type="text" id="vName" autocomplete="off" data-in="vName"></div>'
    +'<div class="field"><label for="vAmt">المبلغ بالجنيه</label><input type="text" id="vAmt" class="amount-in" inputmode="decimal" autocomplete="off" placeholder="0" data-in="vAmt"></div>'
    +'<div id="vDyn"></div><div id="vNote"></div>'
    +'<div class="field"><label for="vFee">رسوم التحويل (اختياري، لو عايز تسجّلها)</label><input type="text" id="vFee" inputmode="decimal" autocomplete="off" placeholder="0" data-in="vFee"></div>'
    +'<div id="vErr"></div>'
    +'<div class="btns">'+btn('vGen','جهّز الكود','primary')+'</div>');
  vcDyn();
}
function vcDyn(){
  const c=$('#vContacts');
  if(c)c.innerHTML=contacts().length?'<div class="lbl2">الأرقام المحفوظة</div><div class="scroll-x" style="margin-top:6px;margin-bottom:4px">'
    +contacts().map((x,i)=>'<button class="chip sm'+(normPhone(VT.num)===x.p?' on':'')+'" data-act="vPick" data-i="'+i+'">'+esc(x.n)+'</button>').join('')+'</div>':'';
  const d=$('#vDyn');
  if(d)d.innerHTML='<div class="field"><span class="lbl2">ده تحويل إيه؟</span><div class="chips">'
    +VPURP.map(p=>'<button class="chip sm'+(VT.purpose===p[0]?' on':'')+'" data-act="vPurp" data-v="'+p[0]+'">'+p[1]+'</button>').join('')+'</div></div>'
    +'<div class="field"><span class="lbl2">هيتخصم من</span><div class="chips">'
    +liveAccs().map(a=>'<button class="chip sm'+(VT.from===a.id?' on':'')+'" data-act="vFrom" data-id="'+esc(a.id)+'">'+esc(a.name)+'</button>').join('')+'</div></div>';
}
function vcCode(){return '*9*7*'+normPhone(VT.num)+'*'+(Math.round(parseNum(VT.amt)*100)/100)+'#'}
function vcGen(){
  const num=normPhone(VT.num),amt=parseNum(VT.amt),e=$('#vErr');
  const err=m=>{e.innerHTML='<div class="warn" style="margin-top:6px">'+esc(m)+'</div>'};
  if(!okPhone(num))return err('الرقم لازم يكون رقم موبايل مصري من 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015');
  if(!(amt>0))return err('اكتب المبلغ');
  if(amt!==Math.round(amt*100)/100)return err('المبلغ فيه كسور كتير');
  if(VT.purpose!=='exp'&&!VT.name.trim())return err('اكتب اسم الشخص عشان السلفة أو السداد تتسجّل باسمه');
  const code=vcCode(),pn=VT.name.trim();
  openSheet('<h3>راجع قبل ما تتصل</h3>'
    +'<div class="card" style="margin-block:8px"><div class="kv"><span>المستلم</span><b>'+esc(pn||'من غير اسم')+'</b></div>'
    +'<div class="kv"><span>الرقم</span><b class="num">'+esc(num)+'</b></div>'
    +'<div class="kv"><span>المبلغ</span><b>'+N(fmt(amt))+' ج.م</b></div>'
    +'<div class="kv"><span>هيتخصم من</span><b>'+esc(accName(VT.from))+'</b></div></div>'
    +'<div class="lbl2">الكود</div><div class="card" dir="ltr" style="margin-top:6px;text-align:center;font-size:20px;font-weight:700;unicode-bidi:isolate" id="vCode"><bdi dir="ltr">'+esc(code)+'</bdi></div>'
    +'<div class="btns"><a class="btn primary" style="text-align:center;text-decoration:none" href="tel:'+esc(code.replace(/#/g,'%23'))+'">افتح الاتصال بالكود</a>'+btn('vCopy','نسخ الكود')+'</div>'
    +'<p style="font-size:13px;color:var(--muted);margin:10px 0 0">اتأكد من الرقم والمبلغ قبل ما تضغط اتصال، لأن التحويل مش بيترجّع. فودافون هتطلب منك الرقم السري بتاعك، والتطبيق مش بيشوفه. لو لوحة الاتصال فتحت من غير علامة #، انسخ الكود والصقه بنفسك.</p>'
    +'<div class="btns" style="margin-top:14px">'+btn('vDone','وصلتني رسالة التأكيد، سجّل التحويل','primary')+btn('vBack','رجوع')+'</div>');
}
function vcDone(){
  const num=normPhone(VT.num),amt=Math.round(parseNum(VT.amt)*100)/100,fee=parseNum(VT.fee),pn=VT.name.trim(),now=Date.now();
  const txs=[],base={id:gid(),t:now,amt:amt,from:VT.from,to:null,person:null,cat:null,once:false,note:(pn?pn+' · ':'')+num};
  if(VT.purpose==='exp'){base.type='exp';base.cat='تحويل فودافون كاش'}
  else{base.type=VT.purpose;base.person=pn}
  txs.push(base);
  if(fee>0)txs.push({id:gid(),t:now,type:'exp',amt:Math.round(fee*100)/100,from:VT.from,to:null,person:null,cat:'رسوم',once:false,note:'رسوم تحويل فودافون كاش'});
  S.tx=S.tx.concat(txs);
  if(pn){const c=contacts();const i=c.findIndex(x=>x.p===num||x.n===pn);if(i>=0){c[i].n=pn;c[i].p=num}else c.push({n:pn,p:num})}
  (S.meta.last=S.meta.last||{}).vcFrom=VT.from;
  const ids=txs.map(x=>x.id);
  const purpose=VT.purpose;
  touch({meta:true});
  toast('اتسجّل تحويل '+fmt(amt)+' ج.م'+(pn?' إلى '+pn:''),()=>{S.tx=S.tx.filter(y=>ids.indexOf(y.id)<0);touch({})});
  if(purpose!=='exp'&&pn)waSheet(pn,num,'اتسجّل التحويل وحسابه اتحدّث. تبعت له رسالة بالتفاصيل؟');else closeSheet();
}
Object.assign(ACT,{
  vcOpen(){vcOpen()},
  vPick(el){
    const c=contacts()[+el.dataset.i];if(!c)return;
    VT.num=c.p;VT.name=c.n;$('#vNum').value=c.p;$('#vName').value=c.n;vcDyn();vcNote();
  },
  vPurp(el){VT.purpose=el.dataset.v;vcDyn();vcNote()},
  vFrom(el){VT.from=el.dataset.id;vcDyn()},
  vGen(){vcGen()},
  vBack(){
    const v=VT;vcOpen();VT=v;
    $('#vNum').value=v.num;$('#vName').value=v.name;$('#vAmt').value=v.amt;$('#vFee').value=v.fee;vcDyn();
  },
  vCopy(){
    const t=($('#vCode')||{}).textContent||'';
    try{navigator.clipboard.writeText(t).then(()=>toast('اتنسخ الكود'),()=>toast('انسخه بإيدك'))}catch(e){toast('انسخه بإيدك')}
  },
  vDone(){vcDone()},
  delContact(el){
    if(!el.dataset.armed){el.dataset.armed='1';el.textContent='تأكيد المسح';setTimeout(()=>{if(el.isConnected){delete el.dataset.armed;el.textContent='مسح'}},4000);return}
    contacts().splice(+el.dataset.i,1);touch({meta:true});toast('اتمسح الرقم');
  },
  recDiff(el){
    const id=el.dataset.id,sb=(S.meta.smsBal||{})[id];if(!sb)return;
    const d=Math.round((sb.v-balanceAt(id,sb.t))*100)/100;if(Math.abs(d)<0.005)return;
    const x={id:gid(),t:sb.t,type:'adj',amt:Math.abs(d),from:d<0?id:null,to:d>0?id:null,person:null,cat:'غير مسجّل',once:false,note:'فرق عن رصيد الرسالة'};
    S.tx.push(x);touch({});
    toast('اتسجّل فرق '+fmt(Math.abs(d))+' ج.م',()=>{S.tx=S.tx.filter(y=>y.id!==x.id);touch({})});
  }
});
Object.assign(INP,{
  vNum(el){VT.num=el.value;const b=$('#vContacts');if(b&&contacts().length)vcDyn()},
  vName(el){VT.name=el.value;vcNote()},
  vAmt(el){const v=normDigits(el.value).replace(/[^\d.,]/g,'');if(v!==el.value)el.value=v;VT.amt=v;vcNote()},
  vFee(el){const v=normDigits(el.value).replace(/[^\d.,]/g,'');if(v!==el.value)el.value=v;VT.fee=v}
});

/* ---------- مطابقة الرصيد مع الرسائل ---------- */
function balanceAt(id,t){
  const a=accById(id);let v=a?(+a.open||0):0;
  S.tx.forEach(x=>{if(x.t>t)return;if(x.to===id)v+=x.amt;if(x.from===id)v-=x.amt});
  return v;
}
function reconHtml(){
  const sb=S.meta.smsBal||{},ids=Object.keys(sb).filter(id=>accById(id)&&!accById(id).hidden);
  let h='<div class="sec"><h2>مطابقة الرصيد مع الرسائل</h2></div>';
  if(!ids.length)return h+'<div class="empty" style="padding:10px">لما تضيف رسايل فيها رصيد، هقارن رصيد كل رسالة بالدفتر وقت وصولها وأقولك فين الفرق.</div>';
  h+='<div class="list">';
  ids.forEach(id=>{
    const r=sb[id],bk=balanceAt(id,r.t),d=Math.round((r.v-bk)*100)/100,ok=Math.abs(d)<0.5;
    h+='<div class="row" style="flex-wrap:wrap"><div class="mid"><div class="t1">'+esc(accName(id))+'</div><div class="t2">رسالة '+esc(dayLabel(r.t))+' '+timeLabel(r.t)+': '+N(fmt(r.v))+' · الدفتر وقتها: '+N(fmt(bk))+'</div></div>'
      +(ok?'<div class="amt in">مظبوط</div>':'<div class="amt debt">فرق '+N(fmt(Math.abs(d)))+'</div>')
      +(ok?'':'<div style="flex-basis:100%;font-size:12.5px;color:var(--muted)">'+(d>0?'دخل حسابك فلوس ما اتسجّلتش':'خرج من حسابك فلوس ما اتسجّلتش')+' <button class="link" data-act="recDiff" data-id="'+esc(id)+'">سجّل الفرق</button></div>')+'</div>';
  });
  return h+'</div>';
}

/* ---------- الناس ورسائل واتساب ---------- */
const contactFor=n=>(S.meta.contacts||[]).find(c=>c.n===n)||null;
function peopleAll(){
  const P=people(),h={};P.forEach(p=>h[p.name]=1);
  (S.meta.contacts||[]).forEach(c=>{if(!h[c.n]){h[c.n]=1;P.push({name:c.n,bal:0,last:0})}});
  return P;
}
const balTxt=b=>b>0.004?'عليه لك '+fmt(b)+' ج.م':(b<-0.004?'عليك له '+fmt(-b)+' ج.م':'متصفّي');
function vcNote(){
  const b=$('#vNote');if(!b||!VT)return;
  const nm=VT.name.trim(),p=nm&&people().find(q=>q.name===nm),amt=parseNum(VT.amt);
  if(!p||VT.purpose==='exp'){b.innerHTML='';return}
  const after=isNaN(amt)?p.bal:Math.round((p.bal+(VT.purpose==='lend'?amt:-amt))*100)/100;
  b.innerHTML='<div class="warn" style="margin-top:6px">قبل التحويل: '+esc(balTxt(p.bal))+(isNaN(amt)?'':'، وبعده: '+esc(balTxt(after)))+'</div>';
}
const dm=t=>{const d=new Date(t);return d.getDate()+'/'+(d.getMonth()+1)};
function debtMsg(name){
  const p=people().find(q=>q.name===name)||{bal:0};
  const all=S.tx.filter(x=>x.person===name&&TYPES[x.type]&&TYPES[x.type].debt).sort((a,b)=>a.t-b.t);
  const MAX=8,rows=all.slice(-MAX),older=all.slice(0,Math.max(0,all.length-MAX));
  let prior=0;older.forEach(x=>prior+=TYPES[x.type].debt*x.amt);prior=Math.round(prior*100)/100;
  const W={lend:'سلّفتك',repay_in:'سدّدت لي',borrow:'سلّفتني',repay_out:'سدّدتلك'};
  const L=['أهلًا يا '+name+'،','بعتلك تفاصيل حسابنا لحد النهاردة عشان نفضل مظبوطين:',''];
  if(older.length&&Math.abs(prior)>0.004)L.push('• الرصيد اللي قبل كده: '+(prior>0?'عليك '+fmt(prior):'ليك عندي '+fmt(-prior))+' جنيه');
  rows.forEach(x=>L.push('• '+dm(x.t)+': '+W[x.type]+' '+fmt(x.amt)+' جنيه'));
  if(!rows.length)L.push('• لسه مفيش حركات بينا');
  L.push('');
  L.push(p.bal>0.004?'الباقي عليك: '+fmt(p.bal)+' جنيه.':(p.bal<-0.004?'الباقي ليك عندي: '+fmt(-p.bal)+' جنيه.':'حسابنا متصفّي والحمد لله، مفيش بينا حاجة.'));
  L.push('لو فيه أي فرق قولّي.');
  return L.join('\n');
}
let WA=null;
function waSheet(name,num,intro){
  const c=contactFor(name);
  WA={name:name,num:num||(c&&c.p)||'',msg:debtMsg(name)};
  openSheet('<h3>رسالة واتساب لـ '+esc(name)+'</h3>'
    +(intro?'<div class="ok" style="margin-bottom:6px">'+esc(intro)+'</div>':'')
    +'<div class="field"><label for="waNum">رقم واتساب</label><input type="text" id="waNum" dir="ltr" inputmode="tel" autocomplete="off" placeholder="01XXXXXXXXX" value="'+esc(WA.num)+'" data-in="waNum"></div>'
    +'<div class="field"><label for="waMsg">الرسالة (تقدر تعدّل فيها)</label><textarea id="waMsg" style="min-height:250px" data-in="waMsg">'+esc(WA.msg)+'</textarea></div>'
    +'<div id="waErr"></div><div class="btns">'+btn('waSend','افتح واتساب','primary')+btn('waCopy','نسخ الرسالة')+'</div>'
    +'<p style="font-size:13px;color:var(--muted);margin:10px 0 0">هيفتح واتساب والرسالة جاهزة، وإنت اللي بتضغط إرسال. التطبيق مش بيبعت لوحده.</p>');
}
function addPersonSheet(){
  openSheet('<h3>إضافة شخص</h3>'
    +(hasPicker()?'<div class="btns" style="margin-top:0">'+btn('pickContact','اختار من جهات الاتصال','primary','data-ctx="ap"')+'</div>':'')
    +'<div class="field"><label for="apName">الاسم</label><input type="text" id="apName" autocomplete="off" data-in="apName"></div>'
    +'<div class="field"><label for="apNum">رقم الموبايل (فودافون كاش وواتساب)</label><input type="text" id="apNum" dir="ltr" inputmode="tel" autocomplete="off" placeholder="01XXXXXXXXX" data-in="apNum"></div>'
    +'<div id="apErr"></div><div class="btns">'+btn('apSave','حفظ','primary')+'</div>');
  AP={name:'',num:''};
}
let AP=null;
Object.assign(ACT,{
  addPerson(){addPersonSheet()},
  apSave(){
    const n=AP.name.trim(),v=normPhone(AP.num),e=$('#apErr');
    const err=m=>{e.innerHTML='<div class="warn" style="margin-top:6px">'+esc(m)+'</div>'};
    if(!n)return err('اكتب الاسم');
    if(AP.num.trim()&&!okPhone(v))return err('الرقم لازم يكون رقم موبايل مصري من 11 رقم');
    const c=contacts(),i=c.findIndex(x=>x.n===n);
    if(i>=0)c[i].p=v||c[i].p;else c.push({n:n,p:v});
    closeSheet();touch({meta:true});toast('اتحفظ '+n);
  },
  waOpen(el){waSheet(decodeURIComponent(el.dataset.p))},
  waSend(){
    const v=normPhone(WA.num),e=$('#waErr');
    if(!okPhone(v)){e.innerHTML='<div class="warn" style="margin-top:6px">اكتب رقم موبايل مصري صحيح من 11 رقم</div>';return}
    if(!(WA.msg||'').trim()){e.innerHTML='<div class="warn" style="margin-top:6px">الرسالة فاضية</div>';return}
    const c=contacts(),i=c.findIndex(x=>x.n===WA.name);
    if(i>=0){if(c[i].p!==v){c[i].p=v;touch({meta:true})}}else{c.push({n:WA.name,p:v});touch({meta:true})}
    const a=document.createElement('a');
    a.href='https://wa.me/2'+v+'?text='+encodeURIComponent(WA.msg);a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
  },
  waCopy(){
    try{navigator.clipboard.writeText(WA.msg).then(()=>toast('اتنسخت الرسالة'),()=>toast('انسخها بإيدك'))}catch(e){toast('انسخها بإيدك')}
  }
});
Object.assign(INP,{
  waNum(el){WA.num=el.value},
  waMsg(el){WA.msg=el.value},
  apName(el){AP.name=el.value},
  apNum(el){AP.num=el.value}
});

async function pickPhoneContact(){
  if(!hasPicker()){toast('المتصفح ده مش بيدعم جهات الاتصال. اكتب الاسم والرقم');return null}
  try{
    const r=await navigator.contacts.select(['name','tel'],{multiple:false});
    if(!r||!r.length)return null;
    const k=r[0],name=((k.name&&k.name[0])||'').trim(),tels=(k.tel||[]).map(normPhone).filter(okPhone);
    if(!tels.length)toast('مفيش رقم موبايل مصري صالح للجهة دي');
    return {name:name,num:tels[0]||''};
  }catch(e){return null}
}
Object.assign(ACT,{
  async pickContact(el){
    const r=await pickPhoneContact();if(!r)return;
    const ctx=el.dataset.ctx;
    if(ctx==='ap'&&AP){AP.name=r.name||AP.name;AP.num=r.num||AP.num;$('#apName').value=AP.name;$('#apNum').value=AP.num}
    else if(ctx==='vc'&&VT){VT.name=r.name||VT.name;VT.num=r.num||VT.num;$('#vName').value=VT.name;$('#vNum').value=VT.num;vcDyn();vcNote()}
    else if(ctx==='entry'&&E){
      if(!r.name){toast('الجهة دي من غير اسم');return}
      E.person=r.name;const cs=contacts(),i=cs.findIndex(k=>k.n===r.name);
      if(i>=0){if(r.num)cs[i].p=r.num}else cs.push({n:r.name,p:r.num});
      touch({meta:true});entryDyn();
    }
  },
  quick(el){newEntry(el.dataset.type)},
  personVc(el){
    const name=decodeURIComponent(el.dataset.p),p=people().find(q=>q.name===name)||{bal:0},c=contactFor(name);
    closeSheet();vcOpen();
    VT.name=name;VT.num=(c&&c.p)||'';VT.purpose=p.bal<-0.004?'repay_out':'lend';
    $('#vName').value=VT.name;$('#vNum').value=VT.num;vcDyn();vcNote();
  }
});

/* ---------- الدخول والخروج ---------- */
async function doAuth(fn){
  if(G.busy)return;
  G.busy=true;G.msg='';gateAuth();
  try{await fn()}catch(e){authFail(e)}
}
Object.assign(ACT,{
  gLogin(){doAuth(()=>signInWithEmailAndPassword(auth,G.email.trim(),G.pass))},
  gSignup(){doAuth(()=>createUserWithEmailAndPassword(auth,G.email.trim(),G.pass))},
  async gGoogle(){
    const p=new GoogleAuthProvider();
    doAuth(async()=>{
      try{await signInWithPopup(auth,p)}
      catch(e){if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment'))await signInWithRedirect(auth,p);else throw e}
    });
  },
  async gReset(){
    if(!G.email.trim()){G.msg='اكتب الإيميل الأول وبعدين اضغط نسيت كلمة السر';gateAuth();return}
    try{await sendPasswordResetEmail(auth,G.email.trim());G.msg='بعتنا لك رابط تغيير كلمة السر على الإيميل'}catch(e){G.msg=(e&&e.code in AUTH_ERR)?AUTH_ERR[e.code]:'مقدرتش أبعت الرابط'}
    gateAuth();
  },
  signOut(){signOut(auth)},
  smsPaste(){
    try{navigator.clipboard.readText().then(t=>{if(t){ui.sms.text=(ui.sms.text?ui.sms.text+'\n\n':'')+t;render()}else toast('مفيش حاجة منسوخة')},()=>toast('اضغط مطوّلًا في المربع واختار لصق'))}
    catch(e){toast('اضغط مطوّلًا في المربع واختار لصق')}
  }
});
Object.assign(INP,{gEmail(el){G.email=el.value},gPass(el){G.pass=el.value}});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!$('#gate').hidden&&ev.target.id&&ev.target.id.indexOf('g')===0)ACT.gLogin()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
boot();
})();
