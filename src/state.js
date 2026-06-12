import { clamp, fmt, rnd, ri, $ } from './util.js';
import { ZONES, BUILDINGS, INDUSTRIES, zoneAt, npcById } from './worldData.js';
import { sCash, sBig, sBad, sWin, Music } from './audio.js';
import { toast, feed, learn, showDialog, showInsightCard, openPhoneTo } from './dialog.js';
import { spawnBurst, floatText, updateLabelSprite, stageBanner, gooseDash, setHQEmpty, playerPos, setGoldenHour, recordFame, townTalentBonus } from './graphics.js';
import { updateHUDChips } from './main.js';

/* ---------------- STATE ---------------- */
export const SAVE_KEY='sovereign-city-save-v2';
export let S=null;
export function setState(newS){ S=newS; }
export function freshState(){
  return {
    founder:{name:'Founder',skin:2,fit:0,voice:'Warm'},
    px:560,py:1180,
    day:1,hour:8,min:0,
    cash:5000,debt:0,stage:1,
    stats:{hustle:10,charisma:10,strategy:10,reputation:5,sovereignty:0},
    biz:null,customers:0,
    hq:false,hqLevel:0,
    employees:[],manager:false,automated:false,communityInvested:false,
    equity:[{who:'You',pct:100,c:'#E8C064'}],
    investors:{park:false,chase:false,sovereignFund:false},
    parkFailed:false,chaseFailed:false,
    quest:0,
    lastRevenue:0,lastExpenses:0,lastProfit:0,
    profitStreak:0,sovereignDays:0,
    event:null,eventDays:0,
    comebackUsed:false,bankrupt:false,won:false,legacy:false,
    npcMem:{},npcRel:{},pitched:{},
    feed:[],learned:[],chikasha:0,
    insights:[],insightSeen:{},
    streak:0,daily:null,townPlot:null,talent:null,muted:false,townCode:null
  };
}

export function IND(){ return INDUSTRIES.find(i=>i.id===(S.biz&&S.biz.industry))||INDUSTRIES[INDUSTRIES.length-1]; }

/* ---------------- QUESTS ---------------- */
export const QUESTS=[
 {hint:'Find <b>Marcus Webb</b> outside the Corner Store',target:()=>npcPos('marcus')},
 {hint:'Pick a problem at the <b>Community Board</b>',target:()=>bldPos('board')},
 {hint:'Pitch neighbors face to face. Land <b>5 customers</b>',target:null,prog:()=>S.customers+'/5'},
 {hint:'Buy the <b>Empty Lot</b> for your first HQ ($1,500)',target:()=>bldPos('lot')},
 {hint:'Run a street demo at <b>City Market</b>. Reach <b>15 customers</b>',target:()=>bldPos('market'),prog:()=>S.customers+'/15'},
 {hint:'Hire your first employee at your <b>HQ</b>',target:()=>bldPos('lot')},
 {hint:'Visit <b>Dr. Redhawk</b> in the Sovereign District',target:()=>npcPos('redhawk')},
 {hint:'Pitch <b>David Park</b> at the Co-Working Space (need $250+/day revenue)',target:()=>npcPos('park')},
 {hint:'Buy <b>Automation</b> at the Tech Hub ($5,000)',target:()=>bldPos('techhub')},
 {hint:'Pitch <b>Victoria Chase</b> on Capital Row',target:()=>npcPos('chase')},
 {hint:'Hire a <b>General Manager</b> at your HQ ($8,000)',target:()=>bldPos('lot')},
 {hint:'<b>Sovereignty:</b> 7 straight profitable days, hands off',target:()=>bldPos('tower'),prog:()=>S.sovereignDays+'/7'},
 {hint:'Visit <b>your tower</b> in The Skyline',target:()=>bldPos('tower')},
 {hint:'Legacy Mode. The city is yours. Keep building.',target:null}
];
export function bldPos(id){ const b=BUILDINGS.find(b=>b.id===id); return {x:b.x+b.w/2,z:b.y+b.d+30}; }
export function npcPos(id){ const n=npcById(id); return n?{x:n.x,z:n.z}:null; }

/* ---------------- NPC RELATIONSHIPS / MEMORY ---------------- */
export function rel(id){ return S.npcRel[id]||0; }
export function bumpRel(id,d){ S.npcRel[id]=clamp((S.npcRel[id]||0)+d,-2,3); }
export function remember(id,txt){
  if(!S.npcMem[id]) S.npcMem[id]=[];
  S.npcMem[id].push(txt); if(S.npcMem[id].length>5) S.npcMem[id].shift();
}
export function lastMem(id){ const m=S.npcMem[id]; return m&&m.length?m[m.length-1]:null; }

export function sweetSpot(){ return Math.round((S.biz?S.biz.base:25)+S.stats.reputation*0.5); }

/* =========================================================
   FOUNDER INSIGHTS
   ========================================================= */
export const INSIGHT_META={
  loss_day:           {icon:'📉',label:'Cash Flow',  color:'var(--danger)'},
  churn_price:        {icon:'💸',label:'Churn',      color:'var(--danger)'},
  churn_neglect:      {icon:'🧑‍🤝‍🧑',label:'Churn',      color:'var(--danger)'},
  churn_manual:       {icon:'⚙️',label:'Churn',      color:'var(--danger)'},
  runway_critical:    {icon:'⏳',label:'Runway',     color:'var(--danger)'},
  first_profit:       {icon:'✅',label:'Milestone',  color:'var(--green)'},
  moat_active:        {icon:'🛡️',label:'Moat',       color:'var(--turq)'},
  automation_on:      {icon:'🤖',label:'Systems',    color:'var(--turq)'},
  equity_sold:        {icon:'🤝',label:'Cap Table',  color:'var(--gold)'},
  sovereign_progress: {icon:'👑',label:'Sovereignty',color:'var(--gold)'}
};
export function insight(key,title,body,opts){
  opts=opts||{};
  const meta=INSIGHT_META[key]||{icon:'💡',label:'Insight',color:'var(--gold)'};
  const entry={key,title,body,day:S.day,icon:meta.icon,color:meta.color,label:meta.label};
  S.insights.unshift(entry);
  if(S.insights.length>30)S.insights.length=30;
  const cta=opts.cta?{label:opts.cta.label,fn:()=>openPhoneTo(opts.cta.tab)}:null;
  if(!S.insightSeen[key]){
    S.insightSeen[key]=true;
    showInsightCard(entry,cta);
  } else {
    toast('<b>'+entry.icon+' '+title+'</b><br>'+body);
  }
  saveGame();
}

/* =========================================================
   DAILY HUSTLE STREAK
   ========================================================= */
export const DAILY_TYPES=[
 {type:'pitch',need:2,txt:()=>'Pitch 2 people face to face today'},
 {type:'profit',need:1,txt:()=>'End the day in profit'},
 {type:'zone',need:1,txt:d=>'Set foot in '+ZONES.find(z=>z.id===d.zone).name+' today'},
 {type:'mentor',need:1,txt:()=>'Check in with a mentor today'}
];
export function assignDaily(){
  if(S.daily&&!S.daily.done&&S.streak>0){
    S.streak=0;
    toast('Hustle streak broken. Back to day one. The grind forgives, it doesn’t forget.','bad');
  }
  const pool=S.biz?DAILY_TYPES:DAILY_TYPES.filter(d=>d.type==='zone'||d.type==='mentor');
  const pick=pool[ri(0,pool.length-1)];
  S.daily={type:pick.type,need:pick.need,prog:0,done:false,day:S.day};
  if(pick.type==='zone'){
    const unlocked=ZONES.filter(z=>S.stage>=z.unlock&&z.id!==(zoneAt(playerPos.x,playerPos.z)||{}).id);
    S.daily.zone=unlocked[ri(0,unlocked.length-1)].id;
  }
  toast('<b>Hustle of the Day:</b> '+pick.txt(S.daily)+(S.streak>0?' &middot; 🔥'+S.streak:''),'gold');
}
export function dailyProgress(type,n){
  if(!S.daily||S.daily.done||S.daily.type!==type)return;
  S.daily.prog+=(n||1);
  if(S.daily.prog>=S.daily.need){
    S.daily.done=true; S.streak++;
    const reward=50+25*Math.min(S.streak,8);
    S.cash+=reward; sCash();
    spawnBurst(playerPos.x,18,playerPos.z,0xE8C064);
    floatText(playerPos.x,36,playerPos.z,'+'+fmt(reward),'#E8C064');
    toast('<b>Hustle complete!</b> 🔥 Streak '+S.streak+' &middot; +'+fmt(reward),'gold');
    feed('Daily hustle done. Streak: '+S.streak+'. Bonus '+fmt(reward)+'.');
    saveGame();
  }
}

/* =========================================================
   CHAOS EVENTS (the city has jokes)
   ========================================================= */
export const CHAOS=[
 {t:'The market goose stole a whole sandwich and outran two security guards. The crowd that gathered? Foot traffic.',
  fx:()=>{ if(S.biz&&S.customers>0){S.customers++;toast('+1 customer from goose-related foot traffic.','good');} gooseDash(); }},
 {t:'A customer paid entirely in quarters. Counting it took an hour. It was somehow exactly right.'},
 {t:'Rival Founder posted cringe on Sovereign Social. Your reputation rose by doing absolutely nothing.',
  fx:()=>{S.stats.reputation=clamp(S.stats.reputation+2,0,100);}},
 {t:'A kid set up a lemonade stand right outside your block. Respect the hustle. You bought two cups.',
  fx:()=>{S.cash=Math.max(0,S.cash-2);S.stats.hustle=clamp(S.stats.hustle+1,0,100);}},
 {t:'The pigeons outside the Stock Exchange appear to have unionized. Negotiations ongoing.'},
 {t:'BigCorp’s delivery drone dropped a package in the wrong city. Their reviews are having a day.'},
 {t:'Marcus beat three teenagers at park chess. Simultaneously. While giving business advice.'},
 {t:'Someone’s car alarm has been going off to the exact rhythm of the Zone 1 lo-fi. The block decided to keep it.'},
 {t:'A tourist asked the goose for directions. The goose was, reportedly, helpful.',fx:()=>gooseDash()},
 {t:'Your autocorrect changed "synergy" to "sausage" in an email. The recipient said it was the most honest pitch they’d read.',
  fx:()=>{if(S.biz){S.stats.charisma=clamp(S.stats.charisma+2,0,100);}}},
 {t:'Coach Rivera’s youth team won. The whole Grind heard about it before the final whistle.'},
 {t:'Capital Row executive seen eating a gas station burrito in a parked luxury car. Humanity confirmed.'}
];
export function maybeChaos(){
  if(Math.random()>0.07)return;
  const e=CHAOS[ri(0,CHAOS.length-1)];
  feed(e.t);
  toast(e.t.length>90?e.t.slice(0,90)+'…':e.t);
  if(e.fx)e.fx();
}

/* =========================================================
   ECONOMY
   ========================================================= */
export function dailySettle(){
  if(!S.biz) return;
  const ss=sweetSpot();
  const churnLine=S.biz.industry==='services'?1.45:1.3;
  if(S.biz.price>ss*churnLine&&S.customers>0){
    const lost=Math.max(1,Math.round(S.customers*0.08));
    S.customers-=lost; feed(lost+' customers churned. Your price outran your reputation.');
    learn('Churn','Customers who leave. The silent business killer.');
    insight('churn_price','Your price outran your reputation',
      'You charged '+fmt(S.biz.price)+', but your reputation only supports prices up to about '+fmt(ss)+' &mdash; your sweet spot. '+lost+' customer'+(lost===1?'':'s')+' left because of the gap. Bring the price back toward '+fmt(ss)+' to stop the bleed.',
      {cta:{label:'Open Pricing',tab:'biz'}});
  }
  if(S.customers>20&&S.employees.length===0){
    const lost=Math.max(1,Math.round(S.customers*0.06));
    S.customers-=lost; feed(lost+' customers left over slow service. One founder can’t serve a crowd alone.');
    insight('churn_neglect','You need hands on deck',
      lost+' customer'+(lost===1?'':'s')+' left because '+S.biz.name+' has grown past what one founder can serve alone, and you have zero employees. Hiring removes this ceiling &mdash; staff can serve the crowd you can\'t reach by yourself.');
  }
  if(S.customers>45&&!S.automated){
    const lost=Math.max(1,Math.round(S.customers*0.05));
    S.customers-=lost; feed('Manual systems buckled. '+lost+' customers walked.');
    insight('churn_manual','Manual systems have a ceiling',
      'Manual systems buckled under the load. '+lost+' customer'+(lost===1?'':'s')+' walked because '+S.biz.name+' isn\'t automated at this scale. Automation at the Tech Hub removes this ceiling for good.');
  }
  if(S.customers>0&&Math.random()<S.stats.reputation*0.008){
    const got=ri(1,3); S.customers+=got;
    feed('+'+got+' customers by referral. Reputation compounds.');
  }
  let demand=1-clamp((S.biz.price-ss)/ss,-0.25,0.6)*0.8;
  demand=clamp(demand,0.3,1.25);
  let mult=1;
  if(S.event==='festival')mult*=(S.biz.industry==='food'?4:3);
  if(S.event==='boom')mult*=1.4;
  if(S.event==='recession')mult*=0.55;
  if(S.communityInvested)mult*=(S.biz.industry==='infra'?1.35:1.25);
  if(S.townPlot!=null)mult*=1+townTalentBonus;
  if(S.employees.length>0)mult*=S.employees.some(e=>!e.good)?1.15:1.35;
  if(S.automated)mult*=1.3;
  if(S.manager)mult*=1.15;
  const revenue=Math.round(S.customers*S.biz.price*0.16*demand*mult);
  let exp=20;
  if(S.hq)exp+=50;
  exp+=S.employees.length*120;
  if(S.manager)exp+=250;
  if(S.automated)exp=Math.round(exp*0.6+60);
  if(S.event==='heatwave')exp=Math.round(exp*1.25);
  let profit=revenue-exp;
  if(profit>0&&S.debt>0){
    const pay=Math.min(S.debt,profit);
    S.debt-=pay; profit-=pay;
    feed('Paid '+fmt(pay)+' toward debt. Remaining: '+fmt(S.debt)+'.');
  }
  S.cash+=profit;
  S.lastRevenue=revenue; S.lastExpenses=exp; S.lastProfit=profit;
  if(profit>0){ S.profitStreak++; if(revenue>0){sCash();floatText(S.px,30,S.py,'+'+fmt(profit),'#5FA86B');} dailyProgress('profit'); } else { if(profit<0)floatText(S.px,28,S.py,fmt(profit),'#D4513B'); S.profitStreak=0; }
  feed('Day '+S.day+' books: revenue '+fmt(revenue)+', expenses '+fmt(exp)+', profit '+fmt(profit)+'.');
  if(profit<0){
    insight('loss_day','Today was a loss day',
      'Revenue: '+fmt(revenue)+'. Expenses: '+fmt(exp)+'. You came up '+fmt(-profit)+' short. Two ways to close that gap: raise revenue (more customers or a better price) or cut overhead (or automate to lower costs for good).',
      {cta:{label:'Open Business',tab:'biz'}});
    if(exp>0&&S.cash<exp*3){
      const daysLeft=Math.max(0,Math.floor(S.cash/exp));
      insight('runway_critical','Your runway is critically short',
        'At your current burn rate of '+fmt(exp)+'/day, your '+fmt(S.cash)+' in cash covers about '+daysLeft+' more day'+(daysLeft===1?'':'s')+'. Fix the loss now, before the cash runs out.',
        {cta:{label:'Open Business',tab:'biz'}});
    }
  } else if(profit>0&&!S.insightSeen.first_profit){
    insight('first_profit','Profit is the real scoreboard',
      'Today '+S.biz.name+' brought in '+fmt(revenue)+' in revenue and kept '+fmt(profit)+' after '+fmt(exp)+' in expenses. Revenue is vanity. Profit is what\'s left, and it\'s the number that actually builds your business. Today, yours is positive.');
  }
  if(S.day===2)learn('Revenue vs Profit','Revenue is everything coming in. Profit is what’s left after expenses. Profit is the real number.');
  if(profit<0&&S.cash<exp*5)learn('Runway','How many days your cash lasts at your current burn rate. Yours is getting short.');
  if(S.manager&&S.automated&&S.quest>=11&&!S.won){
    if(profit>0){ S.sovereignDays++;
      S.stats.sovereignty=clamp(S.stats.sovereignty+4,0,100);
      toast('Sovereign day '+S.sovereignDays+'/7. Profit without your hands: '+fmt(profit),'good');
      if(S.sovereignDays>=7) achieveSovereignty();
    } else { S.sovereignDays=0; toast('Loss day. Sovereign streak reset. Adjust price or costs.','bad'); }
  }
  if(S.cash<0&&!S.won){
    S.debt+= -S.cash; S.cash=0;
    if(S.debt>500) goBankrupt();
  }
  if(S.eventDays>0){ S.eventDays--; if(S.eventDays===0){ S.event=null; $('eventBanner').style.display='none'; } }
  else if(Math.random()<0.22) rollEvent();
  saveGame();
}
export function rollEvent(){
  const r=Math.random();
  let e,label,days;
  if(S.day%12===0){ e='festival';label='CITY FESTIVAL &middot; 3x customers, 2 days';days=2; }
  else if(r<0.3){ e='recession';label='RECESSION SEASON &middot; spending tight';days=3;
    learn('Market Timing','The same business performs differently in a boom vs a recession. Resilience is built before the storm.'); }
  else if(r<0.55){ e='boom';label='MARKET BOOM &middot; demand up';days=3; }
  else if(r<0.75){ e='rain';label='RAIN &middot; foot traffic down, delivery demand up';days=1; }
  else { e='heatwave';label='HEAT WAVE &middot; energy costs up';days=2; }
  S.event=e;S.eventDays=days;
  const eb=$('eventBanner');eb.innerHTML=label;eb.style.display='block';
  feed('Market event: '+label.split('&middot;')[0].trim());
  if(S.lastRevenue>400&&Math.random()<0.5){
    feed('BigCorp launched a competing '+(S.biz?S.biz.name.toLowerCase():'product')+' line. They noticed you.');
    toast('BigCorp is moving into your market. Differentiate or be drowned out.','bad');
  }
}

export function checkProgression(){
  if(S.quest===2&&S.customers>=5){
    S.quest=3; S.stage=Math.max(S.stage,2);
    stageBanner('STAGE 2','Hustler · The city acknowledges you');
    toast('<b>Stage 2: Hustler.</b> The city acknowledges you. An empty lot just hit the market.','gold'); sBig();
    feed('You hit 5 customers. First media mention in the neighborhood paper.');
  }
  if(S.quest===4&&S.customers>=15){
    S.quest=5; S.stage=Math.max(S.stage,3);
    stageBanner('STAGE 3','Builder · Innovation Row open');
    toast('<b>Stage 3: Builder.</b> Innovation Row unlocked. Time to hire.','gold'); sBig();
    feed('15 customers. Competitors started watching you. Innovation Row gates opened.');
  }
  updateHUDChips();
}
export function achieveSovereignty(){
  S.won=true; S.stage=5; S.quest=12;
  S.stats.sovereignty=100;
  stageBanner('SOVEREIGN','Build What You Own');
  Music.setZone(6);
  const tb=BUILDINGS.find(b=>b.id==='tower');
  tb.label=S.biz.name+' Tower';
  if(tb.labelSprite) updateLabelSprite(tb.labelSprite,tb.label,'#E8C064');
  sWin(); setGoldenHour(0.01);
  for(let i=0;i<12;i++) setTimeout(()=>spawnBurst(rnd(1750,2250),rnd(60,300),rnd(900,1300),[0xE8C064,0xF2A33C,0x3FB8AF][ri(0,2)]),i*250);
  recordFame();
  feed('SOVEREIGN STATUS ACHIEVED. Your tower rises in The Skyline. Fireworks over the city.');
  toast('<b>SOVEREIGN STATUS.</b> Go see your tower in The Skyline.','gold');
  insight('sovereign_progress','It still works when you step away',
    'Day '+S.day+'. '+S.biz.name+' is running '+S.customers+' customers and '+fmt(S.lastProfit)+'/day in profit &mdash; without your hands on it. That\'s Sovereignty. The win was never about wealth. It\'s that the business still works when you step away.');
  saveGame();
}
export function victoryScene(){
  const you=S.equity.find(e=>e.who==='You');
  $('bmCard').innerHTML=
   '<div style="font-size:44px">&#127942;</div>'+
   '<h2 class="gold">SOVEREIGN</h2>'+
   '<p>Day '+S.day+'. '+S.biz.name+' runs without you. '+S.customers+' customers. '+
   fmt(S.lastProfit)+'/day profit, hands off. You still own '+you.pct+'%.</p>'+
   '<p style="color:var(--turq)">The win condition was never wealth. It was sovereignty. <i>Yakoke</i> for building it the right way.</p>'+
   '<p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#9A917F">Your name is on the Hall of Fame</p>'+
   '<button class="btn ghost" onclick="downloadCertificate()">Download Certificate</button>'+
   '<button class="btn" onclick="enterLegacy()">Enter Legacy Mode</button>';
  $('bigModal').style.display='flex';
  sWin();
}
window.enterLegacy=function(){
  $('bigModal').style.display='none';
  S.legacy=true; S.quest=13;
  toast('Legacy Mode: passive income flows daily. Mentor the city. Keep building.','gold');
  saveGame();
};
window.downloadCertificate=function(){
  const you=S.equity.find(e=>e.who==='You');
  const cv=document.createElement('canvas');
  cv.width=1200; cv.height=850;
  const x=cv.getContext('2d');
  x.fillStyle='#14120F'; x.fillRect(0,0,1200,850);
  x.strokeStyle='#E8C064'; x.lineWidth=6; x.strokeRect(28,28,1144,794);
  x.strokeStyle='#3FB8AF'; x.lineWidth=2; x.strokeRect(48,48,1104,754);
  x.textAlign='center';
  x.fillStyle='#9A917F'; x.font='700 18px Archivo, sans-serif';
  x.fillText('SOVEREIGN CITY', 600, 112);
  x.fillStyle='#E8C064'; x.font='900 52px Archivo, sans-serif';
  x.fillText('CERTIFICATE OF SOVEREIGNTY', 600, 178);
  x.fillStyle='#3FB8AF'; x.font='600 17px Inter, sans-serif';
  x.fillText('Awarded for building a business that runs without you', 600, 214);
  x.fillStyle='#CFC6B4'; x.font='400 20px Inter, sans-serif';
  x.fillText('This certifies that', 600, 300);
  x.fillStyle='#F2A33C'; x.font='900 50px Archivo, sans-serif';
  x.fillText(S.founder.name, 600, 365);
  x.fillStyle='#CFC6B4'; x.font='400 20px Inter, sans-serif';
  x.fillText('achieved Sovereign status founding', 600, 410);
  x.fillStyle='#F5EFE3'; x.font='900 42px Archivo, sans-serif';
  x.fillText(S.biz.name, 600, 460);
  x.fillStyle='#9A917F'; x.font='700 16px Inter, sans-serif';
  x.fillText(IND().name.toUpperCase(), 600, 490);
  const stats=[
    {l:'DAY ACHIEVED',v:String(S.day)},
    {l:'CUSTOMERS',v:String(S.customers)},
    {l:'DAILY PROFIT',v:fmt(S.lastProfit)},
    {l:'FOUNDER EQUITY',v:you.pct+'%'}
  ];
  const colW=1104/4;
  x.strokeStyle='#3A342A'; x.lineWidth=1;
  x.beginPath(); x.moveTo(48,560); x.lineTo(1152,560); x.stroke();
  x.beginPath(); x.moveTo(48,668); x.lineTo(1152,668); x.stroke();
  stats.forEach((s,i)=>{
    const cx=48+colW*i+colW/2;
    if(i>0){ x.beginPath(); x.moveTo(48+colW*i,560); x.lineTo(48+colW*i,668); x.stroke(); }
    x.fillStyle='#E8C064'; x.font='900 44px Archivo, sans-serif';
    x.fillText(s.v, cx, 625);
    x.fillStyle='#9A917F'; x.font='700 13px Inter, sans-serif';
    x.fillText(s.l, cx, 650);
  });
  x.fillStyle='#7E7565'; x.font='600 15px Inter, sans-serif';
  x.fillText('Sovereign Shield Technologies LLC  ·  Ada, Oklahoma', 600, 760);
  x.fillStyle='#4A4438'; x.font='400 12px Inter, sans-serif';
  x.fillText(new Date().toLocaleDateString(), 600, 786);
  const a=document.createElement('a');
  a.download=(S.biz.name||'Sovereign').replace(/[^a-z0-9]+/gi,'_')+'_Certificate.png';
  a.href=cv.toDataURL('image/png');
  a.click();
};

export function goBankrupt(){
  S.bankrupt=true;
  const hq=BUILDINGS.find(b=>b.id==='lot');
  if(S.hq){ hq.label='FOR LEASE'; if(hq.labelSprite) updateLabelSprite(hq.labelSprite,'FOR LEASE','#D4513B'); }
  sBad();
  $('bmCard').innerHTML=
   '<div style="font-size:44px">&#127783;&#65039;</div>'+
   '<h2 style="color:var(--danger)">BANKRUPT</h2>'+
   '<p>Cash hit zero with '+fmt(S.debt)+' in debt. Rain started. The lights dimmed around your building, and a For Lease sign planted itself out front.</p>'+
   '<p style="color:var(--gold)">Rule 4 of this city: <b>failure is a chapter, not an ending.</b></p>'+
   '<button class="btn" onclick="seekComeback()">'+(S.comebackUsed?'Start Over':'Find Marcus')+'</button>';
  $('bigModal').style.display='flex';
  feed('BANKRUPTCY. Competitors celebrated visibly. The block went quiet.');
}
window.seekComeback=function(){
  $('bigModal').style.display='none';
  if(S.comebackUsed){
    const keep=S.learned, who=S.founder;
    setState(freshState()); S.learned=keep; S.founder=who;
    playerPos.x=S.px; playerPos.z=S.py;
    const lotB=BUILDINGS.find(b=>b.id==='lot');
    lotB.label='Empty Lot';
    if(lotB.labelSprite) updateLabelSprite(lotB.labelSprite,'Empty Lot','#F5EFE3');
    setHQEmpty();
    toast('A new chapter in The Grind. The lessons came with you.','good');
    updateHUDChips(); saveGame(); return;
  }
  playerPos.x=560; playerPos.z=1180; S.px=560; S.py=1180;
  toast('Marcus is waiting outside the Corner Store.','gold');
};
export function comebackScene(){
  showDialog('Marcus Webb','Retired Entrepreneur','#F2A33C',
    'Three times, kid. THREE times I went down before it worked. The city forgets a failure faster than you think. Here’s $1,500 of my own money. Debt’s cleared. One condition: you don’t quit.',
    [{label:'Take the comeback loan ($1,500)',fn:()=>{
      S.cash+=1500; S.debt=0; S.bankrupt=false; S.comebackUsed=true;
      const hq=BUILDINGS.find(b=>b.id==='lot');
      if(S.hq){ hq.label=S.biz.name+' HQ'; if(hq.labelSprite) updateLabelSprite(hq.labelSprite,hq.label,'#F2A33C'); }
      bumpRel('marcus',3); remember('marcus','I funded your comeback.');
      sBig(); feed('Marcus funded your comeback. The For Lease sign came down.');
      toast('<b>Back in business.</b> Bankruptcy is a chapter, not an ending.','gold');
      learn('Resilience','Recovery is a founder skill. The comeback is part of the story.');
      saveGame();}}]);
}

export function progressPct(){
  let p=0;
  if(S.biz)p+=8; p+=clamp(S.customers,0,30)*0.8; if(S.hq)p+=8;
  if(S.employees.length)p+=8; if(S.communityInvested)p+=8;
  if(S.investors.park)p+=10; if(S.automated)p+=10; if(S.investors.chase)p+=10;
  if(S.manager)p+=6; p+=S.sovereignDays*1.5;
  return clamp(p,0,99);
}

/* ---------------- SAVE / LOAD ---------------- */
let memSave=null;
export async function saveGame(){
  if(!S)return;
  const data=JSON.stringify(S);
  memSave=data;
  try{ localStorage.setItem(SAVE_KEY,data); }catch(e){}
  try{ if(window.storage) await window.storage.set(SAVE_KEY,data); }catch(e){}
}
export async function loadGame(){
  try{
    if(window.storage){
      const r=await window.storage.get(SAVE_KEY);
      if(r&&r.value) return JSON.parse(r.value);
    }
  }catch(e){}
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return memSave?JSON.parse(memSave):null;
}
