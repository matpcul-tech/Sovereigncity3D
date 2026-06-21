import { rnd, ri } from './util.js';

/* ---------------- WORLD DATA ---------------- */
export const W = 2400, H = 1600, ZW = 800, ZH = 800;
export const ZONES = [
 {id:1,name:'The Grind',x:0,y:800,ground:0x5C3D28,buildingColor:0xD4703A,accent:'#F2A33C',unlock:1,bh:[55,95]},
 {id:2,name:'Main Street',x:800,y:800,ground:0x2E3D50,buildingColor:0x4A78A0,accent:'#7FB2D9',unlock:1,bh:[90,150]},
 {id:3,name:'Innovation Row',x:1600,y:0,ground:0x1E3038,buildingColor:0x2AADA6,accent:'#52C7D9',unlock:3,bh:[150,230]},
 {id:4,name:'Sovereign District',x:0,y:0,ground:0x4A3020,buildingColor:0xC07838,accent:'#3FB8AF',unlock:1,bh:[60,110]},
 {id:5,name:'Capital Row',x:800,y:0,ground:0x222630,buildingColor:0x485060,accent:'#C9CFD9',unlock:4,bh:[260,400]},
 {id:6,name:'The Skyline',x:1600,y:800,ground:0x2A2418,buildingColor:0xD4A020,accent:'#E8C064',unlock:3,bh:[80,120]}
];
export function zoneAt(x,z){ return ZONES.find(zo=>x>=zo.x&&x<zo.x+ZW&&z>=zo.y&&z<zo.y+ZH); }

export const BUILDINGS=[
 {id:'corner',z:1,x:120,y:980,w:170,d:120,c:0x6a563a,label:'Corner Store'},
 {id:'community',z:1,x:420,y:940,w:220,d:140,c:0x7a6442,label:'Community Center'},
 {id:'bank1',z:1,x:140,y:1300,w:180,d:120,c:0x5d574a,label:'Local Bank'},
 {id:'lot',z:1,x:460,y:1280,w:220,d:160,c:0x453e33,label:'Empty Lot',lot:true},
 {id:'board',z:1,x:330,y:1140,w:60,d:40,c:0x8a6a38,label:'Community Board',small:true},
 {id:'market',z:2,x:920,y:960,w:260,d:150,c:0x55687a,label:'City Market'},
 {id:'adagency',z:2,x:1300,y:940,w:170,d:120,c:0x60707e,label:'Ad Agency'},
 {id:'lawoffice',z:2,x:940,y:1280,w:170,d:120,c:0x6a7886,label:'Law Office'},
 {id:'cowork',z:2,x:1260,y:1260,w:210,d:140,c:0x53616c,label:'Co-Working Space'},
 {id:'techhub',z:3,x:1720,y:130,w:230,d:150,c:0x3d5e6c,label:'Tech Hub'},
 {id:'ailab',z:3,x:2080,y:110,w:180,d:130,c:0x356676,label:'AI Lab'},
 {id:'incubator',z:3,x:1760,y:460,w:200,d:140,c:0x446876,label:'Startup Incubator'},
 {id:'patent',z:3,x:2100,y:440,w:160,d:120,c:0x3d5e66,label:'Patent Office'},
 {id:'council',z:4,x:140,y:130,w:230,d:150,c:0x9a6a44,label:'Sovereign Council Hall'},
 {id:'cmarket',z:4,x:470,y:120,w:200,d:130,c:0xaa7a4e,label:'Cultural Market'},
 {id:'language',z:4,x:130,y:440,w:190,d:130,c:0x8a6244,label:'Language Center'},
 {id:'clinic',z:4,x:430,y:430,w:200,d:140,c:0x9a7050,label:'Tribal Health Clinic'},
 {id:'vc',z:5,x:920,y:120,w:190,d:170,c:0x49505e,label:'VC Partners'},
 {id:'natbank',z:5,x:1230,y:110,w:200,d:180,c:0x505868,label:'National Bank HQ'},
 {id:'exchange',z:5,x:960,y:460,w:220,d:150,c:0x454d5a,label:'Stock Exchange'},
 {id:'media',z:5,x:1290,y:450,w:180,d:140,c:0x4c5462,label:'Media Conglomerate'},
 {id:'tower',z:6,x:1880,y:1000,w:240,d:240,c:0x6a5826,label:'Construction Site',tower:true},
 {id:'fame',z:6,x:1720,y:1360,w:200,d:120,c:0x7a6834,label:'Hall of Fame'}
];

export const INDUSTRIES=[
 {id:'music',name:'Music & Sound',base:18,col:0x7A6FB2,
  line:'You make music? My playlist has been the same 12 songs since last year, honestly.',
  perk:'Busk at City Market for cash and fans',
  starters:['Beat Lab Studio','Block Party Records']},
 {id:'arts',name:'Arts & Design',base:30,col:0xC96F4A,
  line:'An artist? The whole block has blank walls and blank merch. Show me something.',
  perk:'Higher viral chance on Sovereign Social',
  starters:['Mural & Co Design','Print Shop Studio']},
 {id:'acting',name:'Acting & Film',base:26,col:0xB6657F,
  line:'You make videos? My cousin swears she should be famous. Convince me you’re different.',
  perk:'Higher viral chance, media loves you',
  starters:['Block Films','Open Stage Collective']},
 {id:'agency',name:'Agency & Talent',base:45,col:0x9AA4B5,
  line:'An agency? Everybody talented around here, nobody got representation. Talk.',
  perk:'Partnership intros bring double customers',
  starters:['Sovereign Talent Agency','Hometown Marketing Co']},
 {id:'tech',name:'Tech & Apps',base:35,col:0x52C7D9,
  line:'An app? If it actually solves something around here, I’m listening.',
  perk:'Automation costs $3,500 instead of $5,000',
  starters:['Neighborhood App Co','FixIt Software']},
 {id:'ai',name:'AI Studio',base:50,col:0x3FB8AF,
  line:'AI? Everybody talks about it, nobody around here builds it. Until you, maybe.',
  perk:'Cheapest automation in the city: $3,000',
  starters:['Sovereign AI Lab','SmartTools Studio']},
 {id:'infra',name:'Infrastructure & Energy',base:60,col:0xE8C064,
  line:'Power and infrastructure? Now THAT is the long game. Most kids don’t even see it.',
  perk:'Community investment pays 35% instead of 25%',
  starters:['Sovereign Power Co','Node One Infrastructure']},
 {id:'food',name:'Food & Drink',base:20,col:0xF2A33C,
  line:'Food? Okay now you have my attention. What are we talking about?',
  perk:'City Festival pays 4x instead of 3x',
  starters:['Corner Kitchen','Hot Plate Delivery']},
 {id:'fashion',name:'Fashion & Merch',base:28,col:0xD9D2C0,
  line:'You make fits? The drip around here has been mid for months. Prove it.',
  perk:'Higher viral chance on drops',
  starters:['Sovereign Threads','Block Apparel']},
 {id:'sports',name:'Sports & Fitness',base:24,col:0x5FA86B,
  line:'Training? Coach Rivera always says the block needs more of that. What’s your program?',
  perk:'Coach Rivera intros bring double customers',
  starters:['Grind Athletics','Court Kings Training']},
 {id:'education',name:'Education & Tutoring',base:28,col:0x5E7C99,
  line:'Tutoring? My kid’s been struggling since fall, honestly.',
  perk:'School partnerships bring double customers',
  starters:['Neighborhood Tutoring Co','Homework Heroes']},
 {id:'services',name:'Local Services',base:24,col:0x8FA98B,
  line:'You fix things? Half this block needs SOMETHING fixed. What do you do?',
  perk:'Loyal customers, lower churn',
  starters:['Lawn & Lot Care Crew','Mobile Phone Repair']}
];

/* ---------------- NPCS ---------------- */
export const SKINS=['#F3D5B5','#E0AC7E','#C68B59','#9C6644','#7F4F24','#5C3A21'];
export const FITS=['#E8461A','#1AB8AE','#E83020','#1A6AB8','#5AAE2A','#C82870','#E8C030','#5840C8'];
export const FIRST=['Jaylen','Maya','Tommy','Rosa','Darius','Kim','Eli','Tasha','Ray','Lena','Hector','Nia','Owen','Pearl','Sam','Ida','Cole','Mona','Trey','Faye','Bo','June','Zeke','Ada','Gus','Vera'];
export const NPCS=[];
export function npcById(id){ return NPCS.find(n=>n.id===id); }
export function addNPC(o){
  o.x=o.hx; o.z=o.hz; o.tx=o.x; o.tz=o.z; o.wait=rnd(1,4); o.spd=o.spd||10;
  NPCS.push(o); return o;
}
export function buildNPCData(){
  NPCS.length=0;
  addNPC({id:'marcus',name:'Marcus Webb',role:'Retired Entrepreneur',key:true,skin:4,fit:'#8B7355',hx:255,hz:1160,pc:'#F2A33C'});
  addNPC({id:'redhawk',name:'Dr. Ayana Redhawk',role:'Chickasaw Elder & Businesswoman',key:true,skin:3,fit:'#3FB8AF',hx:300,hz:330,pc:'#3FB8AF'});
  addNPC({id:'rivera',name:'Coach Rivera',role:'Community Center Director',key:true,skin:2,fit:'#5FA86B',hx:530,hz:1120,pc:'#5FA86B'});
  addNPC({id:'park',name:'David Park',role:'Angel Investor',key:true,skin:1,fit:'#5E7C99',hx:1365,hz:1440,pc:'#5E7C99'});
  addNPC({id:'chase',name:'Victoria Chase',role:'VC Partner',key:true,skin:0,fit:'#C9CFD9',hx:1015,hz:330,pc:'#9AA4B5'});
  addNPC({id:'rival',name:'Rival Founder',role:'Competing Founder',key:true,skin:2,fit:'#B6657F',hx:1100,hz:1160,pc:'#B6657F'});
  let f=0;
  const inBld=(x,z)=>BUILDINGS.some(b=>x>b.x-10&&x<b.x+b.w+10&&z>b.y-10&&z<b.y+b.d+10);
  ZONES.forEach(zo=>{
    const n=zo.id===1?8:(zo.id===2?7:(zo.id===4?6:(zo.id===6?2:4)));
    for(let i=0;i<n;i++){
      let hx,hz,tries=0;
      do{ hx=zo.x+rnd(90,ZW-90); hz=zo.y+rnd(90,ZH-90); tries++; }
      while(inBld(hx,hz)&&tries<12);
      addNPC({id:'c_'+zo.id+'_'+i,
        name:FIRST[f++%FIRST.length]+' '+String.fromCharCode(65+ri(0,25))+'.',
        role:'Neighbor',cust:true,skin:ri(0,5),fit:FITS[ri(0,7)],
        hx,hz,wander:true});
    }
  });
}

/* =========================================================
   FOUNDERS COMMONS - shared co-op town (Zone 6)
   ========================================================= */
export const TALENTS=['Builder','Artist','Musician','Coder','Organizer','Healer','Storyteller'];
export const PLOTS=[
 {x:1660,z:860},{x:1820,z:860},{x:1980,z:860},{x:2140,z:860},
 {x:1660,z:1060},{x:1660,z:1230},{x:2210,z:1060},{x:2210,z:1230}
].map((p,i)=>({idx:i,x:p.x,z:p.z,w:120,d:120,data:null,mesh:null,pad:null,sp:null}));
