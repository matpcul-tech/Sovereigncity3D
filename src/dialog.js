import { $, clamp, fmt, rnd, ri } from './util.js';
import { sCash, sBig, sBad, sTap, tone, ac } from './audio.js';
import { S, IND, sweetSpot, rel, bumpRel, remember, lastMem, DAILY_TYPES, dailyProgress, checkProgression, progressPct, saveGame, comebackScene, victoryScene, insight } from './state.js';
import { W, H, ZONES, INDUSTRIES, BUILDINGS, npcById, TALENTS } from './worldData.js';
import { spawnBurst, floatText, playerPos, setHQBuilt, buildHQSign, addMurals, fameCache, townTalentBonus, claimPlot, unsubscribeTownPlots } from './graphics.js';

/* ---------------- TOASTS / FEED / LEARN ---------------- */
export function toast(msg,kind){
  const d=document.createElement('div');d.className='toast'+(kind?' '+kind:'');d.innerHTML=msg;
  $('toasts').appendChild(d); setTimeout(()=>d.remove(),4200);
}
export function feed(msg){
  S.feed.unshift({d:S.day,m:msg}); if(S.feed.length>40)S.feed.pop();
  $('phoneDot').style.display='block';
}
export function learn(term,def){
  if(S.learned.some(l=>l.t===term))return;
  S.learned.push({t:term,d:def});
  toast('<b style="color:var(--turq)">New term: '+term+'</b> &middot; check Learn tab','good');
}

/* ---------------- FOUNDER INSIGHTS CARD ---------------- */
export function showInsightCard(entry,cta){
  const d=document.createElement('div');
  d.className='insightCard';
  d.style.borderLeftColor=entry.color;
  d.innerHTML='<div class="cat">'+entry.icon+' '+entry.label+'</div>'+
    '<h4>'+entry.title+'</h4><p>'+entry.body+'</p>'+
    '<div class="row"><button class="ack">Got it</button>'+
    (cta?'<button class="cta">'+cta.label+'</button>':'')+'</div>';
  $('insightCards').appendChild(d);
  let dismissed=false;
  function dismiss(){
    if(dismissed)return; dismissed=true;
    d.style.animation='cardUp .25s ease forwards';
    setTimeout(()=>d.remove(),260);
  }
  d.querySelector('.ack').onclick=()=>{sTap();dismiss();};
  if(cta) d.querySelector('.cta').onclick=()=>{sTap();dismiss();cta.fn();};
  setTimeout(dismiss,9000);
}

/* ---------------- DIALOG ENGINE ---------------- */
export let dialogOpen=false;
export function showDialog(name,role,color,text,opts){
  dialogOpen=true;
  $('dialog').style.display='flex';
  $('dPortrait').style.background=color||'#F2A33C';
  $('dPortrait').textContent=name.split(' ').map(w=>w[0]).join('').slice(0,2);
  $('dName').textContent=name; $('dRole').textContent=role||'';
  $('dText').innerHTML=text;
  const box=$('dOpts'); box.innerHTML='';
  (opts||[{label:'Close'}]).forEach(o=>{
    const b=document.createElement('button');
    b.className='dOpt'+(o.locked?' locked':'');
    b.innerHTML=o.label+(o.sub?'<small>'+o.sub+'</small>':'');
    b.onclick=()=>{ sTap(); if(o.locked){toast(o.lockMsg||'Not yet.','bad');return;}
      if(o.stay){ o.fn&&o.fn(); } else { closeDialog(); o.fn&&o.fn(); } };
    box.appendChild(b);
  });
}
export function closeDialog(){ dialogOpen=false; $('dialog').style.display='none'; }

/* =========================================================
   CONVERSATIONS (full business sim)
   ========================================================= */
function greet(npc){
  const m=lastMem(npc.id), r=rel(npc.id);
  let g=r>=2?'Good to see you again':'Hey there';
  g+=S.founder.voice==='Sharp'?', '+S.founder.name+'.':'.';
  return m? g+' Last time, '+m+' I remember.' : g;
}
export function talkTo(npc){
  if(npc.id==='marcus') return talkMarcus();
  if(npc.id==='redhawk') return talkRedhawk();
  if(npc.id==='rivera') return talkRivera();
  if(npc.id==='park') return talkPark();
  if(npc.id==='chase') return talkChase();
  if(npc.id==='rival') return talkRival();
  return talkCustomer(npc);
}

function talkMarcus(){
  dailyProgress('mentor');
  const c='#F2A33C';
  if(S.quest===0){
    showDialog('Marcus Webb','Retired Entrepreneur',c,
     'So you’re the kid with $5,000 and a dream. I failed three businesses before one worked. You know what I learned? '+
     '<b>Nobody buys an idea. They buy a solution to their problem.</b> Go read the Community Board. Pick a real problem this neighborhood actually has.',
     [{label:'Where’s the board?',sub:'Center of The Grind, by the lamppost',fn:()=>{
        S.quest=1; remember('marcus','I sent you to the Community Board.');bumpRel('marcus',1);saveGame();}},
      {label:'I already know what I want to build',fn:()=>{
        S.quest=1; remember('marcus','you tried to skip the homework.');
        toast('Marcus: "That’s how my first one died. Board. Now."');saveGame();}}]);
    return;
  }
  if(S.bankrupt&&!S.comebackUsed){ return comebackScene(); }
  const tips=[
   'Pricing tip: your sweet spot moves with your reputation. Charge what the trust can carry, not a dollar more.',
   'Watch your burn rate. Cash going out faster than it comes in is a countdown clock, not a detail.',
   'Customers who feel ignored leave quiet. That’s churn, the silent killer. Talk to your people.',
   'Investors don’t fund ideas. They fund traction. Numbers first, story second.',
   'A business that needs you every hour isn’t an asset, it’s a job. Build systems.'];
  showDialog('Marcus Webb','Retired Entrepreneur',c,
    greet(npcById('marcus'))+' '+tips[ri(0,tips.length-1)],
    [{label:'Yakoke, Marcus.',fn:()=>{bumpRel('marcus',1);}},
     {label:'How are the books looking? (advice)',sub:'Marcus reviews your numbers',fn:marcusReview}]);
}
function marcusReview(){
  let msg;
  if(!S.biz) msg='You don’t have a business yet. Board first.';
  else if(S.lastProfit<0) msg='You lost '+fmt(-S.lastProfit)+' yesterday. Expenses are eating you. Cut something or raise revenue, fast.';
  else if(S.biz.price>sweetSpot()*1.25) msg='Your price is over what your reputation carries. You’ll bleed customers. Bring it toward '+fmt(sweetSpot())+'.';
  else if(S.biz.price<sweetSpot()*0.6) msg='You’re underpricing. The neighborhood respects you more than that. Push toward '+fmt(sweetSpot())+'.';
  else msg='Solid. Revenue '+fmt(S.lastRevenue)+', expenses '+fmt(S.lastExpenses)+'. Profit is the real number, and yours was '+fmt(S.lastProfit)+'. Keep stacking.';
  showDialog('Marcus Webb','Retired Entrepreneur','#F2A33C',msg,[{label:'Got it.'}]);
}

export function openBoard(){
  if(S.biz){
    showDialog('Community Board','The Grind','#8a6a38',
      'New opportunities post here weekly. Your venture <b>'+S.biz.name+'</b> ('+IND().name+') is already on the wall.',
      [{label:'Back to the grind.'}]);
    return;
  }
  showDialog('Community Board','Found ANYTHING','#8a6a38',
    'This city runs on every kind of talent. Music, art, film, tech, AI, food, fashion, infrastructure. Pick your lane. Whatever you choose becomes a real business in this city.',
    INDUSTRIES.map(ind=>({label:ind.name,sub:ind.perk,fn:()=>pickConcept(ind)})));
}
function pickConcept(ind){
  const opts=ind.starters.map(s=>({label:s,sub:'A proven starting concept',fn:()=>foundBusiness(ind,s)}));
  opts.push({label:'✨ Bring my own idea',sub:'Name your business yourself. It goes on the building.',stay:true,fn:()=>nameBusiness(ind)});
  opts.push({label:'← Different lane',fn:openBoard});
  showDialog(ind.name,'Choose your concept','#'+ind.col.toString(16).padStart(6,'0'),
    'Perk for this lane: <b>'+ind.perk+'</b>. Start with a proven concept, or bring your own.',opts);
}
function nameBusiness(ind){
  $('dText').innerHTML='What’s it called? This name goes on your HQ, your tower, and the Hall of Fame.'+
   '<input type="text" id="bizNameInput" maxlength="24" placeholder="Your business name" '+
   'style="margin-top:12px;width:100%;background:#221E18;border:2px solid #3A342A;border-radius:9px;padding:12px 14px;color:#F5EFE3;font-size:16px;font-family:inherit">';
  const box=$('dOpts'); box.innerHTML='';
  const b=document.createElement('button'); b.className='dOpt';
  b.innerHTML='Found it';
  b.onclick=()=>{ const v=($('bizNameInput').value||'').trim();
    if(!v){ toast('It needs a name.','bad'); return; }
    closeDialog(); foundBusiness(ind,v.slice(0,24)); };
  box.appendChild(b);
  setTimeout(()=>{ const i=$('bizNameInput'); if(i)i.focus(); },80);
}
function foundBusiness(ind,name){
  S.biz={id:ind.id,industry:ind.id,name:name,base:ind.base,price:ind.base};
  S.quest=2; S.stats.strategy+=4;
  learn('Value Proposition','The specific problem you solve and why it’s worth paying for.');
  feed('You founded '+name+' ('+ind.name+'). The city barely notices. Yet.');
  toast('<b>'+name+'</b> is born. Lane: '+ind.name+'. Now go get customers, face to face.','gold'); sBig();
  saveGame();
}

function talkCustomer(npc){
  if(!S.biz){
    showDialog(npc.name,'Neighbor','#8FA98B',
      greet(npc)+' You look like you’re up to something. Come back when you’ve got something to offer.',[{label:'Soon.'}]);
    return;
  }
  if(S.pitched[npc.id]===S.day){
    showDialog(npc.name,'Neighbor','#8FA98B','You already came by today. Persistence is good, pestering isn’t.',[{label:'Fair.'}]);
    return;
  }
  showDialog(npc.name,'Potential Customer','#8FA98B',
    greet(npc)+' ... '+IND().line+' Alright, pitch me. Why you?',
    [{label:'Lead with their problem',sub:'"You shouldn’t have to deal with that. Here’s exactly how I fix it."',fn:()=>pitchResult(npc,0.75)},
     {label:'Lead with the price',sub:'"Cheapest in the city, guaranteed."',fn:()=>pitchResult(npc,0.45)},
     {label:'Lead with yourself',sub:'"I’m the hardest worker in this zip code."',fn:()=>pitchResult(npc,0.55)}]);
}
function pitchResult(npc,base){
  S.pitched[npc.id]=S.day;
  dailyProgress('pitch');
  const odds=clamp(base+S.stats.hustle*0.006+S.stats.reputation*0.004+rel(npc.id)*0.08,0.1,0.95);
  if(Math.random()<odds){
    S.customers++; S.stats.hustle=clamp(S.stats.hustle+2,0,100);
    S.stats.reputation=clamp(S.stats.reputation+1,0,100);
    bumpRel(npc.id,2); remember(npc.id,'I signed up as your customer.');
    sCash(); spawnBurst(playerPos.x,14,playerPos.z,0xE8C064);
    toast('<b>'+npc.name+'</b> is in! Customer #'+S.customers,'good');
    if(S.customers===1) learn('Customer Discovery','Talking to real people to find out what they’ll actually pay for.');
    checkProgression();
  } else {
    S.stats.hustle=clamp(S.stats.hustle+1,0,100);
    bumpRel(npc.id,-1); remember(npc.id,'you pitched me and I passed.');
    sBad(); floatText(playerPos.x,28,playerPos.z,'NO DEAL','#D4513B');
    toast(npc.name+' passed. Rejection is data. Adjust and keep moving.','bad');
    learn('Rejection Handling','Every no teaches you something a yes never could.');
  }
  saveGame();
}

export function openLot(){
  if(!S.hq){
    if(S.quest<3){
      showDialog('Empty Lot','For Sale &middot; $1,500','#9A917F',
        'Cracked concrete, good bones, your name could be on this. Land your first 5 customers, then come claim it.',[{label:'I’ll be back.'}]);
      return;
    }
    showDialog('Empty Lot','For Sale &middot; $1,500','#9A917F',
      'This lot becomes your headquarters. Rent is $50/day after purchase. Every empire starts on a cracked slab.',
      [{label:'Buy the lot ($1,500)',locked:S.cash<1500,lockMsg:'Not enough cash.',fn:()=>{
        S.cash-=1500; S.hq=true; S.hqLevel=1;
        setHQBuilt(); buildHQSign(); S.quest=4; sBig();
        // Step player out front of lot so save position isn't inside the new building
        const lotB=BUILDINGS.find(b=>b.id==='lot');
        if(lotB){ playerPos.x=lotB.x+lotB.w/2; playerPos.z=lotB.y-80; S.px=playerPos.x; S.py=playerPos.z; }
        spawnBurst(playerPos.x,30,playerPos.z,0xF2A33C);
        feed('You bought the lot. '+S.biz.name+' has a home now.');
        learn('Overhead','Fixed costs like rent that you pay whether you sell or not.');
        toast('<b>HQ secured.</b> Rent: $50/day. Now scale to 15 customers.','gold');
        checkProgression(); saveGame();}},
       {label:'Not yet.'}]);
    return;
  }
  const opts=[];
  if(S.quest===5&&S.employees.length===0)
    opts.push({label:'Interview candidates',sub:'Your first hire. Choose carefully.',fn:hireScene});
  if(S.quest===10&&!S.manager)
    opts.push({label:'Hire General Manager ($8,000)',sub:'Runs the business without you',
      locked:S.cash<8000,lockMsg:'Need $8,000.',fn:hireManager});
  if(S.employees.length>0&&!S.manager&&S.quest>5&&S.quest<10)
    opts.push({label:'Check on the team',fn:()=>{
      showDialog(S.biz.name+' HQ','Your team','#F2A33C',
        S.employees.map(e=>e.name+' ('+e.trait+')').join(', ')+
        (S.automated?' The automated systems hum in the back room.':' Everything still runs by hand.'),
        [{label:'Back to work.'}]);}});
  opts.push({label:'Step outside.',fn:()=>{
    const lot=BUILDINGS.find(b=>b.id==='lot');
    if(lot){ playerPos.x=lot.x+lot.w/2; playerPos.z=lot.y-80; S.px=playerPos.x; S.py=playerPos.z; }
  }});
  showDialog(S.biz.name+' HQ','Level '+S.hqLevel,'#F2A33C',
    'Your building. Your name on the sign. '+S.customers+' customers and counting.',opts);
}
function hireScene(){
  const cands=[
    {name:'Tasha M.',trait:'Hustler',sub:'High energy, asks for $120/day, talks more than she listens',good:true},
    {name:'Glen P.',trait:'Cheapest',sub:'Will work for $90/day, shrugged twice in the interview',good:false},
    {name:'Rosa D.',trait:'Detail-Driven',sub:'$120/day, asked YOU three smart questions about the customers',good:true}];
  showDialog('Hiring Day','Your first employee','#F2A33C',
    'Three candidates came in. The wrong hire poisons culture. The right one multiplies everything.',
    cands.map(c=>({label:c.name+' &middot; '+c.trait,sub:c.sub,fn:()=>{
      S.employees.push({name:c.name,trait:c.trait,good:c.good});
      S.quest=6; learn('Payroll','Your team gets paid every day, sale or no sale. Miss it and they walk.');
      if(c.good){ S.stats.strategy+=3; toast('<b>'+c.name+' joined.</b> Good instinct. Output multiplied.','good'); sBig(); }
      else { toast(c.name+' joined... that shrug was a warning. Productivity will lag.','bad'); sBad(); }
      feed('First hire: '+c.name+'. Payroll starts tomorrow.');
      checkProgression(); saveGame();}})));
}
function hireManager(){
  S.cash-=8000; S.manager=true; S.quest=11; S.sovereignDays=0;
  sBig(); learn('Sovereignty','Your business runs without you. That is the goal.');
  feed('General Manager hired. The machine can run without your hands on it.');
  toast('<b>GM hired.</b> Now prove it: 7 straight profitable days, hands off.','gold');
  showDialog('Your GM','General Manager','#3FB8AF',
    '"I’ve got the floor. Go be a founder, not an operator. Check your phone, watch the profit, and let the system breathe."',
    [{label:'It’s yours. Run it.'}]);
  saveGame();
}

export function openMarket(){
  if(!S.biz){ showDialog('City Market','Main Street','#7FB2D9','Stalls, noise, money changing hands. Get a business first.',[{label:'OK'}]); return; }
  if(S.quest<4){ showDialog('City Market','Main Street','#7FB2D9','The market’s where you scale, but you need an HQ to fulfill demand first.',[{label:'Right.'}]); return; }
  showDialog('City Market','Street Demo &middot; $100 table fee','#7FB2D9',
    'Set up a table, demo '+S.biz.name+' to the crowd. High traffic, real stakes. How do you run it?',
    [(S.biz.industry==='music'?{label:'🎸 Busk for the crowd',sub:'Free. Play live, earn cash and fans on the spot.',fn:busk}:null),
     {label:'Free samples / free first service',sub:'Costs extra $80, converts best',
      locked:S.cash<180,lockMsg:'Need $180.',fn:()=>demoResult(180,0.8)},
     {label:'Straight pitch from the table',sub:'$100, decent odds',
      locked:S.cash<100,lockMsg:'Need $100.',fn:()=>demoResult(100,0.55)},
     {label:'Post on Sovereign Social instead',sub:'Free. Could go viral. Could flop publicly.',fn:socialPost},
     {label:'Not today.'}].filter(Boolean));
}
function busk(){
  const fans=ri(1,4), cash=ri(20,90)+S.stats.charisma;
  S.customers+=fans; S.cash+=cash; S.stats.charisma+=1;
  [392,494,587,659].forEach((f,i)=>tone(f,.35,'triangle',.09,i*.12));
  spawnBurst(playerPos.x,18,playerPos.z,0x7A6FB2);
  floatText(playerPos.x,30,playerPos.z,'+'+fmt(cash),'#7A6FB2');
  toast('<b>The set went off.</b> +'+fmt(cash)+' in the case, +'+fans+' fans.','gold');
  feed('Street set at City Market. The crowd stayed for the whole thing.');
  checkProgression(); saveGame();
}
function demoResult(cost,base){
  S.cash-=cost;
  const got=Math.random()<clamp(base+S.stats.charisma*0.004,0,0.95)?ri(3,6):ri(0,2);
  if(got>0){
    S.customers+=got; S.stats.charisma+=2; S.stats.reputation+=2;
    sCash(); toast('<b>+'+got+' customers</b> from the demo. The block is talking.','good');
  } else { sBad(); toast('Demo flopped. Wrong crowd, wrong hour. Data, not defeat.','bad'); }
  checkProgression(); saveGame();
}
function socialPost(){
  const r=Math.random();
  const viralLine=['arts','acting','fashion','music'].includes(S.biz.industry)?0.42:0.3;
  if(r<viralLine){ const got=ri(5,9); S.customers+=got; S.stats.reputation+=5;
    sBig(); spawnBurst(playerPos.x,20,playerPos.z,0x3FB8AF);
    feed('Your post went VIRAL on Sovereign Social. +'+got+' customers overnight.');
    toast('<b>VIRAL.</b> +'+got+' customers. A news crew drove past your block.','gold');
  } else if(r<0.7){ const got=ri(1,3); S.customers+=got;
    toast('+'+got+' customers from the post. Steady beats flashy.','good'); sCash();
  } else { S.stats.reputation=Math.max(0,S.stats.reputation-2);
    sBad(); feed('Your post flopped. A few neighbors clowned it in the comments.');
    toast('Post flopped publicly. Reputation dinged. It happens to everyone.','bad'); }
  checkProgression(); saveGame();
}

function talkRedhawk(){
  dailyProgress('mentor');
  const c='#3FB8AF';
  if(!S.biz||S.quest<6){
    showDialog('Dr. Ayana Redhawk','Chickasaw Elder & Businesswoman',c,
      '<i>Chokma.</i> I’ve heard of you. Come back when your business has roots, and we’ll talk about what makes them deep.',
      [{label:'Chokma. I’ll return.',fn:()=>{S.chikasha++;}}]);
    return;
  }
  if(!S.communityInvested){
    showDialog('Dr. Ayana Redhawk','Chickasaw Elder & Businesswoman',c,
      '<i>Chokma, '+S.founder.name+'.</i> A business that takes from a community is a visitor. A business that invests in one becomes part of it, and the community protects what is part of it. '+
      'Invest $2,000 here, into the youth programs and the market, and watch what loyalty does to your numbers.',
      [{label:'Invest $2,000 in the community',sub:'+'+(S.biz.industry==='infra'?'35':'25')+'% to ALL revenue, permanently. The moat money can’t buy.',
        locked:S.cash<2000,lockMsg:'Return when you have $2,000.',fn:()=>{
          S.cash-=2000; S.communityInvested=true; S.stats.reputation+=8; S.stats.sovereignty+=10;
          if(S.quest===6)S.quest=7;
          bumpRel('redhawk',3); remember('redhawk','you invested in this community.');
          learn('Competitive Moat','The thing that makes your business hard to copy. Community loyalty is one money can’t buy.');
          sBig(); spawnBurst(playerPos.x,25,playerPos.z,0x3FB8AF);
          addMurals();
          feed('You invested in the Sovereign District. New murals went up within a week.');
          toast('<b>+25% revenue bonus, permanent.</b> Zone 4 visibly improves. <i>Yakoke.</i>','gold');
          insight('moat_active','You built a moat money can\'t buy',
            'Your $2,000 investment in the Sovereign District gives '+S.biz.name+' a permanent +'+(S.biz.industry==='infra'?'35':'25')+'% revenue bonus. A competitor can copy your menu or your app. They can\'t copy a community\'s loyalty.');
          checkProgression(); saveGame();}},
       {label:'Tell me about this district first',stay:true,fn:()=>{
          $('dText').innerHTML='This district was built on the idea that sovereignty isn’t given, it’s built. Our bank, our clinic, our language center. <i>Yakoke</i> means thank you. <i>Halito</i> means hello. <i>Chokma</i> means good. Now you carry three words of Chikashshanompa’ with you.';
          S.chikasha=3;}},
       {label:'Not yet.',fn:()=>{remember('redhawk','you hesitated on the community investment.');}}]);
    return;
  }
  showDialog('Dr. Ayana Redhawk','Chickasaw Elder & Businesswoman',c,
    greet(npcById('redhawk'))+' The murals went up because of you. '+
    (S.investors.sovereignFund?'The Sovereign Fund watches your tower rise with pride.':'When you’re ready for capital that doesn’t take your soul with your equity, the Sovereign Fund is here.'),
    S.investors.sovereignFund||S.stage<3?[{label:'Yakoke, Dr. Redhawk.'}]:
    [{label:'Tell me about the Sovereign Fund',sub:'$8,000 for 5% equity. Community-rooted businesses only.',fn:sovereignFund},
     {label:'Yakoke, Dr. Redhawk.'}]);
}
function sovereignFund(){
  showDialog('The Sovereign Fund','Collective Investment Group','#3FB8AF',
    'We invest in businesses rooted in community. $8,000 for 5%. No board seat taken, one condition given: you mentor a young founder when your time comes.',
    [{label:'Accept the Sovereign Fund ($8,000 for 5%)',fn:()=>{
      S.cash+=8000; S.investors.sovereignFund=true; takeEquity('Sovereign Fund',5,'#3FB8AF');
      sBig(); feed('The Sovereign Fund invested $8,000. Terms a VC would never offer.');
      toast('<b>+$8,000.</b> Sovereign Fund holds 5%. Sovereignty-first terms.','gold'); saveGame();}},
     {label:'Let me think on it.'}]);
}

function talkRivera(){
  dailyProgress('mentor');
  const opts=[{label:'Appreciate you, Coach.',fn:()=>bumpRel('rivera',1)}];
  if(S.stage>=3&&S.biz) opts.unshift({label:'Connect me to a school partner',sub:'+6 customers, +reputation, once per stage',fn:()=>{
     if(S.npcMem['rivera_school']===S.stage){toast('Coach already made this stage’s intro.','bad');return;}
     const got=['sports','education','agency'].includes(S.biz.industry)?12:6;
     S.npcMem['rivera_school']=S.stage; S.customers+=got; S.stats.reputation+=4;
     sCash(); toast('<b>School partnership.</b> +'+got+' customers via Coach Rivera.','good');
     feed('Coach Rivera connected you to a school program. Institutional money is different money.');
     checkProgression(); saveGame();}});
  showDialog('Coach Rivera','Community Center Director','#5FA86B',
    greet(npcById('rivera'))+(S.biz?
    ' The kids ask about you, you know. The founder from the block. '+(S.stage>=3?'Schools have been calling me about '+S.biz.name+'.':'Keep grinding. When you’re bigger, I can connect you to the schools.'):
    ' This center is where this neighborhood’s future hangs out every afternoon. Build something they can look up to.'),opts);
}

function talkRival(){
  const hostile=rel('rival')<0;
  showDialog('Rival Founder','Competing Founder','#B6657F',
    greet(npcById('rival'))+(S.biz?
    (hostile?' We both know only one of us owns this market.':' Same city, same hunger. Question is whether we eat alone or together.'):
    ' I started six months before you. The grind doesn’t care who came first, only who stays.'),
    S.biz&&S.stage>=3?[
     {label:'Propose a partnership',sub:'Joint venture: both gain customers, rivalry ends',fn:()=>{
        if(Math.random()<0.4+S.stats.charisma*0.005){
          bumpRel('rival',3); S.customers+=5; remember('rival','we became partners.');
          sBig(); toast('<b>Partnership formed.</b> +5 customers. A rival became an ally.','gold');
          learn('Blue Ocean','Skip the fight. Find or create the market nobody is contesting.');
        } else { bumpRel('rival',-2); remember('rival','you tried to partner and I laughed.');
          sBad(); toast('They laughed it off. The rivalry just got personal.','bad'); }
        saveGame();}},
     {label:'Talk trash',sub:'Feels good. Costs reputation.',fn:()=>{
        bumpRel('rival',-2); S.stats.reputation=Math.max(0,S.stats.reputation-3);
        remember('rival','you talked trash on the street.');
        toast('Word travels. Reputation -3. Was it worth it?','bad'); saveGame();}},
     {label:'Walk away.'}]:[{label:'We’ll see.'}]);
}

const PARK_QS=[
 {q:'"Walk me in. How many paying customers, real number?"',
  a:[{t:'State the exact number and the trend',good:true},
     {t:'"A lot. Honestly the market is huge."',good:false},
     {t:'Pivot to the vision before answering',good:false}]},
 {q:'"What’s your churn look like? Who leaves and why?"',
  a:[{t:'"Some leave when price outruns trust. I track it and adjust."',good:true},
     {t:'"Nobody leaves. They love us."',good:false},
     {t:'"Churn? We’re focused on growth, not losses."',good:false}]},
 {q:'"Why does this survive when a big player copies you?"',
  a:[{t:'"They can copy the service. They can’t copy community roots."',good:true},
     {t:'"We’ll just out-spend them."',good:false},
     {t:'"They won’t notice us."',good:false}]}];
function talkPark(){
  const c='#5E7C99';
  if(S.investors.park){
    showDialog('David Park','Angel Investor',c,greet(npcById('park'))+' My $10K is working hard in your hands. Keep the updates coming.',[{label:'Always.'}]);
    return;
  }
  if(S.quest<7||!S.biz){
    showDialog('David Park','Angel Investor',c,'I write $5K to $15K checks for founders with real customer numbers. Come back with traction, not a story.',[{label:'Noted.'}]);
    return;
  }
  if(S.lastRevenue<250){
    showDialog('David Park','Angel Investor',c,
      greet(npcById('park'))+' I looked at your run rate. '+fmt(S.lastRevenue)+'/day isn’t there yet. I need $250+/day. '+
      (S.parkFailed?'You bounced back before. Do it again.':'Data-focused isn’t cold, it’s respect for your time and mine.'),
      [{label:'I’ll be back with the numbers.'}]);
    return;
  }
  runPitch('David Park','Angel Investor',c,PARK_QS,(score)=>{
    if(score>=2){
      const amt=score===3?15000:10000;
      S.cash+=amt; S.investors.park=true; takeEquity('David Park',15,'#5E7C99');
      S.quest=8; S.stage=Math.max(S.stage,4); sBig();
      learn('Equity Dilution','You sold 15%. You own less, but of something bigger.');
      learn('Cap Table','The list of everyone who owns a piece of your company. Check your phone.');
      feed('David Park wired '+fmt(amt)+' for 15%. A construction crane appeared by your HQ within a day.');
      toast('<b>FUNDED: '+fmt(amt)+'</b> for 15% equity. Capital unlocked.','gold');
      spawnBurst(playerPos.x,25,playerPos.z,0xE8C064);
      S.hqLevel=2; setHQBuilt();
      checkProgression(); saveGame();
    } else {
      S.parkFailed=true; remember('park','your pitch fell apart under questions.');
      sBad(); feed('Park passed. "Come back with stronger answers." He’ll remember.');
      showDialog('David Park','Angel Investor',c,
        '"Not yet. You stumbled where it matters. I remember every pitch, the failures and the comebacks. Tighten your numbers and return."',
        [{label:'I’ll be back.'}]);
      saveGame();
    }
  });
}

const CHASE_QS=[
 {q:'"Your unit economics. Cost to acquire a customer versus what they’re worth. Go."',
  a:[{t:'"Acquisition runs under $30 street-level, each customer is worth multiples of that a year."',good:true},
     {t:'"We don’t really track that yet."',good:false},
     {t:'"Customers find us, so acquisition is basically free."',good:false}]},
 {q:'"You’ve raised before. How much of the company do you still control?"',
  a:[{t:'Quote your cap table from memory, to the percent',good:true},
     {t:'"Most of it, I think."',good:false},
     {t:'"Does it matter? I run the company."',good:false}]},
 {q:'"Why scale this city-wide instead of staying a neighborhood story?"',
  a:[{t:'"The model is proven where trust is hardest to earn. Every district is easier from here."',good:true},
     {t:'"Because bigger is better."',good:false},
     {t:'"My investors expect it."',good:false}]},
 {q:'"Last one. When the recession hits, and it will, what survives?"',
  a:[{t:'"Community-rooted revenue. Loyalty doesn’t churn with the market index."',good:true},
     {t:'"We’ll cut everything and hibernate."',good:false},
     {t:'"Recessions are opportunities!" (say nothing else)',good:false}]}];
function talkChase(){
  const c='#9AA4B5';
  if(S.investors.chase){
    showDialog('Victoria Chase','VC Partner',c,greet(npcById('chase'))+' The board, which is to say me, is pleased. Your tower is the talk of Capital Row.',[{label:'It’s just the beginning.'}]);
    return;
  }
  if(S.stage<4){
    showDialog('Victoria Chase','VC Partner',c,'I write $25K to $100K checks at Stage 4 and beyond. You’re not there. This isn’t cruelty, it’s a calendar.',[{label:'See you at Stage 4.'}]);
    return;
  }
  if(!S.automated){
    showDialog('Victoria Chase','VC Partner',c,
      greet(npcById('chase'))+' I don’t fund founders who ARE the operations. Automate at the Tech Hub, then we talk real numbers.',
      [{label:'Innovation Row. On it.'}]);
    return;
  }
  runPitch('Victoria Chase','VC Partner, Capital Row',c,CHASE_QS,(score)=>{
    if(score>=3){
      const amt=score===4?100000:50000;
      S.cash+=amt; S.investors.chase=true; takeEquity('Victoria Chase',20,'#9AA4B5');
      S.quest=10; sBig();
      learn('Valuation','What your whole company is worth, implied by what investors pay for their slice.');
      feed('Victoria Chase wired '+fmt(amt)+' for 20%. Cold until you prove traction. Warm now.');
      toast('<b>FUNDED: '+fmt(amt)+'</b> for 20%. Capital Row knows your name.','gold');
      spawnBurst(playerPos.x,25,playerPos.z,0xE8C064);
      checkProgression(); saveGame();
    } else {
      S.chaseFailed=true; remember('chase','your first pitch to me missed.');
      sBad(); feed('Chase passed. The door isn’t closed, but it didn’t open either.');
      showDialog('Victoria Chase','VC Partner',c,'"Close, not closed. Sharpen the answers you fumbled and come back. I respect a second pitch more than a first one."',[{label:'Count on it.'}]);
      saveGame();
    }
  });
}

function runPitch(name,role,color,qs,done){
  let i=0,score=0;
  function ask(){
    if(i>=qs.length){ done(score); return; }
    const q=qs[i];
    const shuffled=q.a.map((a,idx)=>({...a,idx})).sort(()=>Math.random()-0.5);
    showDialog(name,role+' &middot; Question '+(i+1)+'/'+qs.length,color,q.q,
      shuffled.map(a=>({label:a.t,fn:()=>{
        if(a.good){score++; S.stats.charisma+=1; tone(660,.1,'triangle',.08);}
        else tone(220,.15,'sawtooth',.05);
        i++; setTimeout(ask,80);}})));
  }
  showDialog(name,role,color,
    '"Sit down. I have '+(qs.length===3?'three':'four')+' questions. Your answers decide the check size, or whether there is one."',
    [{label:'Begin the pitch.',fn:ask}]);
}
function takeEquity(who,pct,c){
  const you=S.equity.find(e=>e.who==='You');
  you.pct-=pct; S.equity.push({who,pct,c});
  insight('equity_sold','You sold equity — permanently',
    'You sold '+pct+'% of '+(S.biz?S.biz.name:'your company')+' to '+who+'. That stake is permanent unless you buy it back later. You now own '+you.pct+'%.',
    {cta:{label:'Open Cap Table',tab:'cap'}});
}

export function openTechHub(){
  if(S.stage<3){
    showDialog('Tech Hub','Innovation Row','#52C7D9','Glass walls, pitch meetings, drone deliveries. Unlocks at Stage 3. You’re close.',[{label:'Soon.'}]);
    return;
  }
  if(S.automated){
    showDialog('Tech Hub','Innovation Row','#52C7D9','Your systems are live: routing, scheduling, payments, all automated. The scrappy startup became a scalable operation here.',[{label:'It still feels new.'}]);
    return;
  }
  const aPrice=S.biz&&S.biz.industry==='ai'?3000:(S.biz&&S.biz.industry==='tech'?3500:5000);
  showDialog('Tech Hub','Innovation Row','#52C7D9',
    'Automation package for '+(S.biz?S.biz.name:'your business')+': '+fmt(aPrice)+' up front. Cuts daily ops costs 40% and removes the customer-cap your hands put on the business.'+
    (aPrice<5000?' <b>Your lane gets the builder discount.</b>':''),
    [{label:'Buy Automation ('+fmt(aPrice)+')',locked:S.cash<aPrice,lockMsg:'Need '+fmt(aPrice)+'.',fn:()=>{
       S.cash-=aPrice; S.automated=true; if(S.quest===8)S.quest=9;
       S.stats.strategy+=6; S.stats.sovereignty+=10; sBig();
       learn('Systems','Manual is cheaper today. Automated is cheaper forever.');
       feed('Automation live. The business no longer needs your hands for every dollar.');
       toast('<b>Automated.</b> Ops costs down 40%. Scale ceiling removed.','gold');
       insight('automation_on','You spent now to spend less forever',
         'Automation cost '+fmt(aPrice)+' up front, but it cuts '+S.biz.name+'\'s daily operating costs by 40% and removes the customer ceiling your hands created. The bill is one-time. The savings compound every day after.');
       checkProgression(); saveGame();}},
     {label:'Not yet.'}]);
}

export function genericBuilding(b){
  const zo=ZONES.find(z=>z.id===b.z);
  const flavor={
    bank1:'The teller nods. Your balance: '+fmt(S.cash)+'. '+(S.debt>0?'Outstanding debt: '+fmt(S.debt)+'.':'No debts. Keep it that way.'),
    community:'Kids at homework tables, a pickup game out back. Coach Rivera’s office is by the door.',
    adagency:'"Billboards start at $500." Maybe when the revenue justifies it.',
    lawoffice:'"Incorporate early, litigate never," the sign reads. Wisdom, $400/hour.',
    cowork:'Laptops, cold brew, three pitches happening at once. David Park holds court near the window.',
    council:'The Sovereign Council Hall. Carved cedar doors. The center of a different kind of power.',
    cmarket:'Traditional craftwork next to startup merch. The Cultural Market hums.',
    language:'Chikashshanompa’ lessons through the window: <i>Halito. Chokma. Yakoke.</i>',
    clinic:'The Tribal Health Clinic. Community care, community owned.',
    natbank:'Marble and silence. Your community bank back home moves faster.',
    exchange:'The Market Index ticker: '+marketLabel()+'.',
    media:'News crews load vans. '+(S.stats.reputation>40?'A producer recognizes you.':'Nobody looks at you twice. Yet.'),
    ailab:'Researchers argue about agent architectures over coffee.',
    incubator:'A cohort of founders mid-bootcamp. You remember Day 1.',
    patent:'"Protect what you build." Forms in triplicate.',
    fame:'The Hall of Fame, shared by every founder of this demo. '+(fameCache.length?
      'On the wall: '+fameCache.slice(0,8).map(f=>f.name+' ('+f.biz+', Day '+f.day+')').join(' · ')+'.':
      'Blank plaques wait for the first Sovereign founders.')+(S.won?' Your name is up there. Permanently.':'')
  };
  showDialog(b.label,zo.name,zo.accent,flavor[b.id]||'The door is open, the day is short.',[{label:'Move on.'}]);
}
function marketLabel(){
  if(S.event==='boom')return 'BOOM &middot; demand surging';
  if(S.event==='recession')return 'RECESSION &middot; spending tight';
  if(S.event==='festival')return 'CITY FESTIVAL &middot; 3x foot traffic';
  return 'STEADY';
}

export function openTower(){
  if(!S.won){
    showDialog('Construction Site','The Skyline','#E8C064',
      'Scaffolding and a sign: <b>FUTURE HOME OF '+(S.biz?S.biz.name.toUpperCase():'SOMEONE')+'</b>. This zone didn’t exist when you started. It builds itself as you approach sovereignty. '+S.sovereignDays+'/7 sovereign days.',
      [{label:'It’s rising.'}]);
    return;
  }
  if(S.quest===12){ S.quest=13; victoryScene(); return; }
  showDialog(S.biz.name+' Tower','The Skyline','#E8C064',
    'Your name on the top floor. Employees wave from the windows. Citizens look up. The city changed because of you.',
    [{label:'Build what you own.'}]);
}

/* =========================================================
   FOUNDERS COMMONS - plot dialog
   ========================================================= */
export function openPlot(p){
  if(p.data){
    showDialog(p.data.name+'’s Place','Founders Commons · '+p.data.talent,'#E8C064',
      '<b>'+p.data.biz+'</b>, founded by '+p.data.name+', bringing '+p.data.talent+' talent to the town. '+
      'Distinct talents in town: '+Math.round(townTalentBonus*100)+'% revenue bonus for every member.',
      [{label:'Respect.'}]);
    return;
  }
  if(!S.biz||S.stage<3){
    showDialog('Open Plot','Founders Commons','#9A917F',
      'Founders Commons: a town built by every player of this demo, together. Reach Stage 3 with a business to claim a plot.',
      [{label:'I’ll be back.'}]);
    return;
  }
  if(S.townPlot!=null){
    showDialog('Open Plot','Founders Commons','#9A917F',
      'You’ve already got a plot in the Commons. Leave some land for the next founder.',[{label:'Fair.'}]);
    return;
  }
  showDialog('Claim This Plot','Founders Commons · shared with all founders','#E8C064',
    'Your building rises here with your name on it, visible to <b>every other founder playing this demo</b>. '+
    'What talent do you bring to the town? Each distinct talent in the Commons adds +1% revenue for every member.',
    TALENTS.map(t=>({label:t,fn:()=>claimPlot(p,t)})).concat([{label:'Not yet.'}]));
}

/* =========================================================
   PHONE UI
   ========================================================= */
let pTab='biz';
document.querySelectorAll('.pTab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.pTab').forEach(x=>x.classList.remove('sel'));
  t.classList.add('sel'); pTab=t.dataset.tab; renderPhone(); sTap();
});
$('phoneBtn').onclick=()=>{ $('phone').style.display='flex'; $('phoneDot').style.display='none'; renderPhone(); sTap(); ac(); };
$('pClose').onclick=()=>{ $('phone').style.display='none'; sTap(); };
$('exitBtn').onclick=async()=>{
  sTap();
  if(!confirm('Save and return to the title screen?'))return;
  await saveGame();
  unsubscribeTownPlots();
  location.reload();
};
export function openPhoneTo(tabName){
  pTab=tabName;
  document.querySelectorAll('.pTab').forEach(x=>x.classList.toggle('sel',x.dataset.tab===tabName));
  $('phone').style.display='flex'; $('phoneDot').style.display='none';
  renderPhone();
}
export function renderPhone(){
  const c=$('pContent'); c.innerHTML='';
  if(pTab==='biz'){
    if(!S.biz){ c.innerHTML='<div class="feedItem">No business yet. The Community Board in The Grind has four real problems waiting for a founder.</div>'; return; }
    const burn=S.lastExpenses, runway=burn>0?Math.floor(S.cash/burn):999;
    c.innerHTML=
     stat('Cash',fmt(S.cash),'gold')+
     stat('Customers',S.customers,'')+
     stat('Revenue / day',fmt(S.lastRevenue),'green')+
     stat('Expenses / day',fmt(S.lastExpenses),'red')+
     stat('Profit / day',fmt(S.lastProfit),S.lastProfit>=0?'green':'red')+
     stat('Runway',runway>365?'Stable':runway+' days',runway<8?'red':'')+
     '<div class="priceRow"><span style="font-size:12px;color:#9A917F;font-weight:600">PRICE</span>'+
     '<input type="range" min="'+Math.round(S.biz.base*0.5)+'" max="'+Math.round(S.biz.base*2.2)+'" value="'+S.biz.price+'" id="priceSlider">'+
     '<span class="pv" id="priceVal">'+fmt(S.biz.price)+'</span></div>'+
     '<div class="feedItem" style="font-size:11.5px;color:#9A917F">Sweet spot moves with reputation. Current trust carries about '+fmt(sweetSpot())+'. Too high churns customers, too low destroys margin.</div>'+
     (S.daily?'<div class="feedItem" style="border-left:3px solid var(--gold)"><b>Hustle of the Day:</b> '+
       DAILY_TYPES.find(d=>d.type===S.daily.type).txt(S.daily)+' · '+
       (S.daily.done?'DONE 🔥'+S.streak:S.daily.prog+'/'+S.daily.need)+'</div>':'')+
     bar('Sovereign Progress',S.won?100:Math.round(progressPct()))+
     (S.manager?bar('Sovereign Days (hands-off profit)',S.sovereignDays/7*100,S.sovereignDays+'/7'):'');
    const sl=$('priceSlider');
    sl.oninput=()=>{ S.biz.price=+sl.value; $('priceVal').textContent=fmt(S.biz.price); };
    sl.onchange=()=>{ saveGame(); learn('Pricing Power','You set the price. The market answers tomorrow morning.'); };
  }
  if(pTab==='feed'){
    c.innerHTML=S.feed.length?S.feed.map(f=>'<div class="feedItem"><div class="t">DAY '+f.d+'</div>'+f.m+'</div>').join(''):'<div class="feedItem">Quiet so far. Make some noise.</div>';
  }
  if(pTab==='cap'){
    c.innerHTML='<div class="feedItem" style="border-left:3px solid var(--gold)"><b>Cap Table</b> &middot; who owns '+(S.biz?S.biz.name:'the company')+'</div>'+
     S.equity.map(e=>'<div class="capRow"><span style="min-width:110px">'+e.who+'</span>'+
       '<div class="cb" style="flex:'+e.pct+';background:'+e.c+'"></div><span>'+e.pct+'%</span></div>').join('')+
     '<div class="feedItem" style="font-size:11.5px;color:#9A917F">Equity is ownership. Guard it carefully. Every round, you own less, but of something bigger.</div>';
  }
  if(pTab==='insight'){
    c.innerHTML=S.insights.length?
      S.insights.map(e=>'<div class="insightEntry" style="border-left-color:'+e.color+'"><div class="t">DAY '+e.day+' &middot; '+e.icon+' '+e.label+'</div><b>'+e.title+'</b>'+e.body+'</div>').join(''):
      '<div class="feedItem">Founder Insights explain the "why" behind what happens in your business: churn, profit, automation, equity. They\'ll show up here the moment they happen.</div>';
  }
  if(pTab==='learn'){
    c.innerHTML=S.learned.length?
      S.learned.map(l=>'<div class="glossEntry"><b>'+l.t+'</b><br>'+l.d+'</div>').join(''):
      '<div class="feedItem">Every lesson in this city comes from an action and its consequence. Terms you earn show up here.</div>';
    if(S.chikasha>=3) c.innerHTML+='<div class="glossEntry" style="border-left-color:var(--terra)"><b>Chikashshanompa’</b><br><i>Halito</i> = hello &middot; <i>Chokma</i> = good &middot; <i>Yakoke</i> = thank you. Gifted by Dr. Redhawk.</div>';
  }
}
function stat(l,v,cls){return '<div class="stat"><span class="l">'+l+'</span><span class="v '+cls+'">'+v+'</span></div>';}
function bar(l,pct,suffix){return '<div class="barWrap"><div class="l"><span>'+l+'</span><span>'+(suffix||Math.round(pct)+'%')+'</span></div><div class="bar"><i style="width:'+clamp(pct,0,100)+'%"></i></div></div>';}
