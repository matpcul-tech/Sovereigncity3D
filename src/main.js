import * as THREE from 'three';
import './style.css';
import { $, clamp, lerp, rnd, ri, fmt, dist2 } from './util.js';
import { W, H, ZONES, zoneAt, BUILDINGS, SKINS, FITS, NPCS, PLOTS, buildNPCData } from './worldData.js';
import { ac, tone, Music, sCash, sBig, sTap, ambientZone, setZoneAmbient, AC } from './audio.js';
import { S, setState, freshState, QUESTS, saveGame, loadGame, dailyProgress, assignDaily, dailySettle, maybeChaos, progressPct, rel } from './state.js';
import { toast, feed, dialogOpen, closeDialog, talkTo, openBoard, openLot, openMarket, openTechHub, openTower, openPlot, genericBuilding } from './dialog.js';
import {
  scene, camera, composer, playerPos, playerGroup, playerParts, npcMeshes, questMarker,
  cars, clouds, goose, particles, goldenHour, setGoldenHour,
  spawnBurst, floatText, updateFloats, drawMinimap, drawTutorial, perfSample, updateSky,
  initThree, initMuteBtn, buildHQSign, setHQBuilt, setHQEmpty, addMurals, buildNPCMeshes,
  paintFace, makeLabelSprite, updateLabelSprite, loadTown, stageBanner, trimParticles, updateProps,
  subscribeTownPlots, unsubscribeTownPlots
} from './graphics.js';
import { subscribeTown, sendPresenceUpdate, updateRemotePlayers } from './presence.js';

/* ---------------- CAMERA / PLAYER ORIENTATION ---------------- */
let playerYaw=0, camYaw=Math.PI, camPitch=0.42;

/* ---------------- INPUT ---------------- */
const keys={};
window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;
  if((e.key==='e'||e.key==='Enter')&&$('interactBtn').style.display==='block') doInteract();});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
let joyVec={x:0,y:0},joyId=null;
const joyEl=$('joy'),knob=$('joyKnob');
function joyHandle(e){
  const t=[...e.touches].find(t=>t.identifier===joyId); if(!t) return;
  const r=joyEl.getBoundingClientRect();
  let dx=t.clientX-(r.left+r.width/2), dy=t.clientY-(r.top+r.height/2);
  const m=Math.hypot(dx,dy),max=r.width/2-10;
  if(m>max){dx=dx/m*max;dy=dy/m*max;}
  joyVec.x=dx/max; joyVec.y=dy/max;
  knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
joyEl.addEventListener('touchstart',e=>{e.preventDefault();joyId=e.changedTouches[0].identifier;joyHandle(e);ac();},{passive:false});
joyEl.addEventListener('touchmove',e=>{e.preventDefault();joyHandle(e);},{passive:false});
joyEl.addEventListener('touchend',e=>{
  if([...e.changedTouches].some(t=>t.identifier===joyId)){
    joyId=null;joyVec={x:0,y:0};knob.style.transform='translate(-50%,-50%)';}
},{passive:false});
// camera orbit: drag on right pad (touch) or mouse drag anywhere on canvas
let camDrag=null;
const camPad=$('camPad');
camPad.addEventListener('touchstart',e=>{ const t=e.changedTouches[0];
  camDrag={id:t.identifier,x:t.clientX,y:t.clientY}; },{passive:true});
camPad.addEventListener('touchmove',e=>{
  if(!camDrag)return;
  const t=[...e.touches].find(t=>t.identifier===camDrag.id); if(!t)return;
  camYaw-=(t.clientX-camDrag.x)*0.0062;
  camPitch=clamp(camPitch+(t.clientY-camDrag.y)*0.0035,0.18,0.9);
  camDrag.x=t.clientX; camDrag.y=t.clientY;
},{passive:true});
camPad.addEventListener('touchend',e=>{
  if(camDrag&&[...e.changedTouches].some(t=>t.identifier===camDrag.id)) camDrag=null;
},{passive:true});
let mouseDrag=null;
$('game').addEventListener('mousedown',e=>{mouseDrag={x:e.clientX,y:e.clientY};});
window.addEventListener('mousemove',e=>{
  if(!mouseDrag)return;
  camYaw-=(e.clientX-mouseDrag.x)*0.0055;
  camPitch=clamp(camPitch+(e.clientY-mouseDrag.y)*0.0032,0.18,0.9);
  mouseDrag={x:e.clientX,y:e.clientY};
});
window.addEventListener('mouseup',()=>mouseDrag=null);

/* ---------------- INTERACTION ---------------- */
let nearTarget=null;
function findNear(){
  let best=null,bd=42;
  for(const n of NPCS){
    const d=dist2(playerPos.x,playerPos.z,n.x,n.z);
    if(d<bd){bd=d;best={type:'npc',o:n};}
  }
  let bbd=60;
  for(const p of PLOTS){
    const cx=clamp(playerPos.x,p.x,p.x+p.w), cz=clamp(playerPos.z,p.z,p.z+p.d);
    const d=dist2(playerPos.x,playerPos.z,cx,cz);
    if(d<bbd&&(!best||d<bd)){bbd=d;best={type:'plot',o:p};}
  }
  for(const b of BUILDINGS){
    const zo=ZONES.find(z=>z.id===b.z);
    if(S.stage<zo.unlock) continue;
    const cx=clamp(playerPos.x,b.x,b.x+b.w), cz=clamp(playerPos.z,b.y,b.y+b.d);
    const d=dist2(playerPos.x,playerPos.z,cx,cz);
    if(d<bbd&&(!best||d<bd)){bbd=d;best={type:'bld',o:b};}
  }
  return best;
}
function doInteract(){
  if(!nearTarget||dialogOpen) return;
  ac();
  if(nearTarget.type==='npc') talkTo(nearTarget.o);
  else if(nearTarget.type==='plot') openPlot(nearTarget.o);
  else {
    const b=nearTarget.o;
    if(b.id==='board') openBoard();
    else if(b.id==='lot') openLot();
    else if(b.id==='market') openMarket();
    else if(b.id==='techhub') openTechHub();
    else if(b.id==='tower') openTower();
    else genericBuilding(b);
  }
}
$('interactBtn').onclick=doInteract;
$('dialog').addEventListener('click',e=>{ if(e.target.id==='dialog') closeDialog(); });
$('phone').addEventListener('click',e=>{ if(e.target.id==='phone') $('phone').style.display='none'; });

/* ---------------- COLLISION ---------------- */
function collide(nx,nz){
  for(const b of BUILDINGS){
    if(b.id==='lot'&&!S.hq) continue; // walk over empty lot
    if(nx>b.x-6&&nx<b.x+b.w+6&&nz>b.y-6&&nz<b.y+b.d+6) return true;
  }
  return false;
}

/* ---------------- MAIN LOOP ---------------- */
let last=performance.now(),minAcc=0;
const lockNotice={};
function loop(now){
  const DT=Math.min((now-last)/1000,0.05); last=now;
  const uiOpen=dialogOpen||$('phone').style.display==='flex'||$('bigModal').style.display==='flex';
  if(S&&Trailer.active){Trailer.update(DT,now);}
  if(S&&!uiOpen&&!Trailer.active){
    // camera-relative movement
    let mx=joyVec.x,my=joyVec.y;
    if(keys['w']||keys['arrowup'])my-=1; if(keys['s']||keys['arrowdown'])my+=1;
    if(keys['a']||keys['arrowleft'])mx-=1; if(keys['d']||keys['arrowright'])mx+=1;
    let mlen=Math.hypot(mx,my); if(mlen>1){mx/=mlen;my/=mlen;}
    const fx=Math.sin(camYaw),fz=Math.cos(camYaw);       // camera forward on ground
    const rx=Math.sin(camYaw+Math.PI/2),rz=Math.cos(camYaw+Math.PI/2);
    const vx=(fx*-my+rx*mx),vz=(fz*-my+rz*mx);
    // skateboard: unlocked at Stage 2. Full joystick push or Shift = ride.
    const pushHard=Math.hypot(joyVec.x,joyVec.y)>0.88||keys['shift'];
    window._skating=!!(S.stage>=2&&pushHard&&Math.hypot(vx,vz)>0.05);
    const skating=S.stage>=2&&pushHard&&Math.hypot(vx,vz)>0.05;
    const spd=skating?145:(keys['shift']?100:72);
    const moving=Math.hypot(vx,vz)>0.05;
    if(moving){
      const _pz=zoneAt(playerPos.x,playerPos.z); if(_pz&&_pz.id!==ambientZone&&AC)setZoneAmbient(_pz.id);
      // skate trail — tiny puffs
      if(skating&&Math.random()<0.45){
        const m=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,1.2),
          new THREE.MeshBasicMaterial({color:0xE8C064,transparent:true}));
        m.position.set(playerPos.x+rnd(-2,2),2,playerPos.z+rnd(-2,2));
        scene.add(m); particles.push({m,vx:rnd(-8,8),vy:rnd(6,18),vz:rnd(-8,8),life:rnd(.3,.6)});
        trimParticles();
      }
      let nx=clamp(playerPos.x+vx*spd*DT,12,W-12);
      let nz=clamp(playerPos.z+vz*spd*DT,12,H-12);
      const zo=zoneAt(nx,nz);
      if(zo&&S.stage<zo.unlock){
        if(!lockNotice[zo.id]||now-lockNotice[zo.id]>4000){
          lockNotice[zo.id]=now;
          toast(zo.name+' unlocks at Stage '+zo.unlock+'.','bad');
        }
      } else if(!collide(nx,nz)){
        playerPos.x=nx; playerPos.z=nz;
      } else if(!collide(nx,playerPos.z)){ playerPos.x=nx; }
      else if(!collide(playerPos.x,nz)){ playerPos.z=nz; }
      playerYaw=Math.atan2(vx,vz);
      S.px=playerPos.x; S.py=playerPos.z;
      if(S.daily&&!S.daily.done&&S.daily.type==='zone'){
        const cz=zoneAt(playerPos.x,playerPos.z);
        if(cz&&cz.id===S.daily.zone) dailyProgress('zone');
      }
    }
    // animate player
    const t=now/1000;
    let playerY=skating?2.2:0;
    if(!moving&&!skating) playerY+=Math.sin(t*2.1)*0.34;
    playerGroup.group.position.set(playerPos.x,playerY,playerPos.z);
    playerGroup.group.rotation.y=playerYaw;
    playerGroup.group.rotation.x=skating?0.06:0;
    playerParts.board.visible=skating;
    playerParts.chain.visible=S.stage>=3;
    if(skating){
      // skate stance: legs planted wide, slight crouch, arms out
      playerGroup.lLeg.rotation.x=0.25; playerGroup.rLeg.rotation.x=-0.25;
      playerGroup.lArm.rotation.x=0; playerGroup.rArm.rotation.x=0;
      playerGroup.lArm.rotation.z=0.5; playerGroup.rArm.rotation.z=-0.5;
      playerGroup.group.rotation.z=Math.sin(t*2.2)*0.04; // carve sway
    } else {
      playerGroup.lArm.rotation.z=0; playerGroup.rArm.rotation.z=0;
      playerGroup.group.rotation.z=0;
      const swing=moving?Math.sin(t*(keys['shift']?13:9))*0.6:0;
      playerGroup.lLeg.rotation.x=swing; playerGroup.rLeg.rotation.x=-swing;
      playerGroup.lArm.rotation.x=-swing*0.8; playerGroup.rArm.rotation.x=swing*0.8;
    }
    // Founders Commons: broadcast position to the town channel (no-op if solo)
    sendPresenceUpdate(now,playerPos.x,playerPos.z,playerYaw,window._skating,moving);
    // time
    minAcc+=DT;
    while(minAcc>=0.1){
      minAcc-=0.1; S.min++;
      if(S.min>=60){ S.min=0; S.hour++;
        if(S.hour===8) assignDaily();
        if(S.hour===9) dailySettle();
        if(S.hour>=9&&S.hour<=21) maybeChaos();
        if(S.hour>=24){ S.hour=0; S.day++; }
        updateHUDChips();
      }
    }
    // NPC wander + animate
    for(const n of NPCS){
      const pm=npcMeshes[n.id]; if(!pm) continue;
      const d=dist2(n.x,n.z,n.tx,n.tz);
      let nmoving=false;
      if(n.wander||n.key){
        if(d<3){ n.wait-=DT;
          if(n.wait<=0){ n.wait=rnd(2,6);
            const r=n.key?45:140;
            n.tx=clamp(n.hx+rnd(-r,r),12,W-12);
            n.tz=clamp(n.hz+rnd(-r,r),12,H-12);
          }
        } else {
          const sx=(n.tx-n.x)/d*n.spd*DT,sz=(n.tz-n.z)/d*n.spd*DT;
          if(!collide(n.x+sx,n.z+sz)){ n.x+=sx;n.z+=sz;nmoving=true;
            pm.group.rotation.y=Math.atan2(sx,sz); }
          else { n.tx=n.hx; n.tz=n.hz; }
        }
      }
      const npcY=nmoving?0:Math.sin(t*2.0+n.hx*0.07+n.hz*0.05)*0.3;
      pm.group.position.set(n.x,npcY,n.z);
      // key NPCs idle-face player when close
      if(n.key&&!nmoving){
        const dpx=playerPos.x-n.x,dpz=playerPos.z-n.z;
        const dd=Math.hypot(dpx,dpz);
        if(dd<160) pm.group.rotation.y=Math.atan2(dpx,dpz);
      }
      const sw=nmoving?Math.sin(t*8+n.hx)*0.5:0;
      pm.lLeg.rotation.x=sw; pm.rLeg.rotation.x=-sw;
      if(pm.ring){
        const r=rel(n.id);
        pm.ring.material.color.setHex(r>=2?0x5FA86B:(r<0?0xD4513B:0xE8C064));
      }
    }
    // remote founders sharing this Town Code (ghosts: interpolated, no collision)
    updateRemotePlayers(now);
    // cars
    cars.forEach(c=>{
      c.p+=c.spd*DT; if(c.p>1)c.p-=1; if(c.p<0)c.p+=1;
      if(c.horiz){ c.g.position.set(c.p*W,0,c.lane); c.g.rotation.y=c.spd>0?Math.PI/2:-Math.PI/2; }
      else { const rx=c.lane>1200?1600:800; c.g.position.set(rx+(c.lane%2?16:-16),0,c.p*H); c.g.rotation.y=c.spd>0?0:Math.PI; }
    });
    // clouds drift
    clouds.forEach(cl=>{
      cl.position.x+=cl.userData.spd*DT;
      if(cl.position.x>W+200) cl.position.x=-200;
    });
    // flags, fountain, birds
    updateProps(DT);
    // the goose
    if(goose){
      if(goose.dash>0) goose.dash-=DT;
      const gspd=goose.dash>0?150:goose.spd;
      const gd=dist2(goose.x,goose.z,goose.tx,goose.tz);
      if(gd<5){ goose.wait-=DT;
        if(goose.wait<=0){ goose.wait=rnd(1,3);
          // roams the Main Street market block, wider when dashing
          const r=goose.dash>0?340:160;
          goose.tx=clamp(1050+rnd(-r,r),850,1550);
          goose.tz=clamp(1030+rnd(-r,r),850,1550);
        }
      } else {
        const sx=(goose.tx-goose.x)/gd*gspd*DT, sz=(goose.tz-goose.z)/gd*gspd*DT;
        if(!collide(goose.x+sx,goose.z+sz)){ goose.x+=sx; goose.z+=sz;
          goose.g.rotation.y=Math.atan2(sx,sz)-Math.PI/2; }
        else { goose.tx=1050; goose.tz=1030; }
      }
      goose.g.position.set(goose.x,Math.abs(Math.sin(now/110))*(goose.dash>0?3:1.2),goose.z);
      // honk at the player
      if(dist2(goose.x,goose.z,playerPos.x,playerPos.z)<40&&now-goose.honked>6000){
        goose.honked=now;
        tone(310,.13,'sawtooth',.10); tone(255,.18,'sawtooth',.09,.14);
        toast('HONK.');
      }
    }
    // quest marker
    const q=QUESTS[S.quest];
    if(q&&q.target){
      const tg=q.target();
      if(tg){ questMarker.visible=true;
        questMarker.position.set(tg.x,46+Math.sin(now/240)*5,tg.z);
        questMarker.rotation.y=now/600; }
      else questMarker.visible=false;
    } else questMarker.visible=false;
    // tower growth
    const tw=BUILDINGS.find(b=>b.id==='tower');
    const targetH=S.won?520:60+clamp((progressPct()-50)/49,0,1)*300;
    const curH=tw.mesh.scale.y*tw.h3;
    if(Math.abs(curH-targetH)>1){
      const nh=lerp(curH,targetH,DT*0.8);
      tw.mesh.scale.y=nh/tw.h3; tw.mesh.position.y=nh/2;
      tw.roof.position.y=nh+2; tw.labelSprite.position.y=nh+22;
    }
    // interact prompt
    nearTarget=findNear();
    const ib=$('interactBtn');
    if(nearTarget){
      ib.style.display='block';
      ib.textContent=nearTarget.type==='npc'
        ? 'Talk · '+nearTarget.o.name.split(' ')[0]
        : (nearTarget.type==='plot'
          ? (nearTarget.o.data?'Visit · '+nearTarget.o.data.name:'Claim Plot')
          : 'Enter · '+nearTarget.o.label);
    } else ib.style.display='none';
  }
  perfSample(DT);
  updateFloats(DT);
  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.life-=DT;
    if(p.life<=0){ scene.remove(p.m); particles.splice(i,1); continue; }
    p.m.position.x+=p.vx*DT; p.m.position.y+=p.vy*DT; p.m.position.z+=p.vz*DT;
    p.vy-=160*DT; p.m.material.opacity=clamp(p.life,0,1);
  }
  if(goldenHour>0&&goldenHour<1.2) setGoldenHour(goldenHour+DT*0.2);
  // camera
  if(S){
    const skating=window._skating||false;
    const targetFOV=skating?72:62;
    camera.fov=lerp(camera.fov,targetFOV,0.06);
    camera.updateProjectionMatrix();
    const cd=skating?130:110,ch=38+camPitch*70;
    const cx=playerPos.x+Math.sin(camYaw)*cd*Math.cos(camPitch);
    const cz=playerPos.z+Math.cos(camYaw)*cd*Math.cos(camPitch);
    camera.position.lerp(new THREE.Vector3(cx,ch,cz),0.14);
    camera.lookAt(playerPos.x,16,playerPos.z);
    updateSky();
    // hide lock sprites once unlocked
    ZONES.forEach(zo=>{ if(zo.lockSprite) zo.lockSprite.visible=S.stage<zo.unlock; });
    composer.render();
  drawMinimap();
  drawTutorial();
  }
  requestAnimationFrame(loop);
}

export function updateHUDChips(){
  if(!S)return;
  const stages=['','Ideator','Hustler','Builder','Scaler','Sovereign'];
  $('stageChip').textContent='Stage '+S.stage+' · '+stages[S.stage]+(S.streak>0?' · 🔥'+S.streak:'');
  const h12=S.hour%12===0?12:S.hour%12, ap=S.hour<12?'AM':'PM';
  $('clockTime').textContent='Day '+S.day+' · '+h12+':'+String(S.min).padStart(2,'0')+' '+ap;
  $('clockCash').textContent=fmt(S.cash)+(S.debt>0?' (-'+fmt(S.debt)+')':'');
  const q=QUESTS[S.quest];
  $('questBar').innerHTML=(q?q.hint:'')+(q&&q.prog?' <b>'+q.prog()+'</b>':'');
}
setInterval(()=>{ if(S&&$('hud').style.display==='block')updateHUDChips(); },500);

/* ---------------- TITLE / CREATOR / BOOT ---------------- */
(function(){
  const c=$('skylineCv'),x=c.getContext('2d');
  const bars=[]; for(let i=0;i<16;i++)bars.push({x:i*27+6,h:rnd(20,90),t:rnd(0,6)});
  function draw(){
    x.clearRect(0,0,420,110);
    bars.forEach((b,i)=>{
      b.t+=0.013; const h=b.h+Math.sin(b.t)*4;
      x.fillStyle=i===11?'#E8C064':'#3A342A';
      x.fillRect(b.x,110-h,20,h);
      x.fillStyle=i===11?'#F2A33C':'rgba(245,239,227,0.12)';
      for(let w=0;w<Math.floor(h/14);w++)x.fillRect(b.x+5,110-h+6+w*13,10,6);
    });
    requestAnimationFrame(draw);
  } draw();
})();

const creatorState={name:'',skin:2,fit:0,voice:'Warm'};
function buildCreator(){
  const sk=$('cSkin');sk.innerHTML='';
  SKINS.forEach((s,i)=>{const d=document.createElement('div');d.className='sw'+(i===creatorState.skin?' sel':'');
    d.style.background=s;d.onclick=()=>{creatorState.skin=i;buildCreator();drawPreview();sTap();};sk.appendChild(d);});
  const ft=$('cFit');ft.innerHTML='';
  FITS.forEach((f,i)=>{const d=document.createElement('div');d.className='sw'+(i===creatorState.fit?' sel':'');
    d.style.background=f;d.onclick=()=>{creatorState.fit=i;buildCreator();drawPreview();sTap();};ft.appendChild(d);});
  const vc=$('cVoice');vc.innerHTML='';
  ['Sharp','Smooth','Warm','Commanding'].forEach(v=>{const b=document.createElement('button');
    b.className='pill'+(v===creatorState.voice?' sel':'');b.textContent=v;
    b.onclick=()=>{creatorState.voice=v;buildCreator();sTap();};vc.appendChild(b);});
}
function drawPreview(){
  const c=$('preview'),x=c.getContext('2d');
  x.clearRect(0,0,96,120);
  const skin=SKINS[creatorState.skin], fit=FITS[creatorState.fit];
  // shadow
  x.fillStyle='rgba(0,0,0,0.3)';x.beginPath();x.ellipse(48,112,24,6,0,0,Math.PI*2);x.fill();
  // legs (pants)
  x.fillStyle='#2e3440';x.fillRect(34,78,12,28);x.fillRect(50,78,12,28);
  // arms (skin)
  x.fillStyle=skin;x.fillRect(18,46,12,30);x.fillRect(66,46,12,30);
  // torso (shirt)
  x.fillStyle=fit;x.fillRect(32,44,32,34);
  // head (skin block)
  x.fillStyle=skin;x.fillRect(33,10,30,30);
  // face
  x.fillStyle='#1a1a1a';
  x.beginPath();x.ellipse(42,23,2.6,3.6,0,0,Math.PI*2);x.fill();
  x.beginPath();x.ellipse(54,23,2.6,3.6,0,0,Math.PI*2);x.fill();
  x.strokeStyle='#1a1a1a';x.lineWidth=2.4;x.lineCap='round';
  x.beginPath();x.arc(48,28,6.5,Math.PI*0.15,Math.PI*0.85);x.stroke();
}

/* ---------------- TOWN CODE JOIN FLOW ---------------- */
// Founders Commons: an optional 6-character code shared with friends.
// Leave blank for solo play on a local save — no email, no password.
function normalizeTownCode(v){
  const code=(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  return code||null;
}
const townCodeInput=$('townCodeInput');
townCodeInput.addEventListener('input',()=>{
  townCodeInput.value=normalizeTownCode(townCodeInput.value)||'';
});

function applyFounderLook(){
  playerParts.skinMat.color.set(SKINS[S.founder.skin]);
  playerParts.fitMat.color.set(FITS[S.founder.fit]);
  paintFace(playerParts.faceTex,SKINS[S.founder.skin]);
  // overhead username tag
  if(playerParts.nameTag){ playerParts.group.remove(playerParts.nameTag); }
  const tag=makeLabelSprite(S.founder.name,'#E8C064');
  tag.scale.set(86,16,1); tag.position.y=30;
  playerParts.group.add(tag);
  playerParts.nameTag=tag;
}
function startWorld(){
  S.streak=S.streak||0;
  if(S.daily===undefined)S.daily=null;
  if(S.townPlot===undefined)S.townPlot=null;
  if(S.muted===undefined)S.muted=false;
  if(S.biz&&!S.biz.industry)S.biz.industry='services';
  buildNPCData(); buildNPCMeshes();
  applyFounderLook();
  playerPos.x=S.px; playerPos.z=S.py;
  // Safety: if saved position is inside a building, push player out front
  for(const b of BUILDINGS){
    if(b.id==='lot'&&!S.hq) continue;
    if(playerPos.x>b.x-6&&playerPos.x<b.x+b.w+6&&
       playerPos.z>b.y-6&&playerPos.z<b.y+b.d+6){
      playerPos.x=clamp(playerPos.x,b.x,b.x+b.w);
      playerPos.z=b.y-80;
      S.px=playerPos.x; S.py=playerPos.z; break;
    }
  }
  camYaw=Math.PI; // look north into the city
  if(S.hq){ setHQBuilt(); buildHQSign(); } else setHQEmpty();
  if(S.communityInvested) addMurals();
  const hq=BUILDINGS.find(b=>b.id==='lot');
  if(S.bankrupt&&S.hq){ hq.label='FOR LEASE'; updateLabelSprite(hq.labelSprite,'FOR LEASE','#D4513B'); }
  if(S.won){ const tw=BUILDINGS.find(b=>b.id==='tower');
    tw.label=S.biz.name+' Tower'; updateLabelSprite(tw.labelSprite,tw.label,'#E8C064'); }
  if(S.event){ const eb=$('eventBanner'); eb.textContent=String(S.event).toUpperCase(); eb.style.display='block'; }
  if(!document.getElementById('muteBtn'))initMuteBtn();
  Music.setEnabled(!S.muted);
  loadTown().then(() => subscribeTownPlots());
  subscribeTown();
  if(!startWorld.townPoll){
    startWorld.townPoll=setInterval(()=>{ if(S) loadTown(); },60000);
  }
  $('title').style.display='none'; $('creator').style.display='none';
  $('hud').style.display='block';
  if(!('ontouchstart' in window)) $('hintKeys').style.display='block';
  updateHUDChips();
}
$('newGameBtn').onclick=()=>{ ac(); sTap();
  $('title').style.display='none'; $('creator').style.display='flex';
  buildCreator(); drawPreview();
};
$('startBtn').onclick=()=>{
  ac(); Music.init(); Music.setZone(1);
  creatorState.name=($('cName').value||'Founder').trim().slice(0,16)||'Founder';
  setState(freshState());
  S.founder={name:creatorState.name,skin:creatorState.skin,fit:creatorState.fit,voice:creatorState.voice};
  S.townCode=normalizeTownCode(townCodeInput.value);
  startWorld();
  sBig();
  toast('<b>Halito, '+S.founder.name+'.</b> Welcome to The Grind. Find Marcus Webb.','gold');
  feed('Day 1. A founder steps into Sovereign City with $5,000 and a dream.');
  saveGame();
};
$('continueBtn').onclick=async()=>{
  ac(); Music.init(); sTap();
  const loaded=await loadGame();
  if(!loaded){ toast('No save found.','bad'); return; }
  setState(loaded);
  const code=normalizeTownCode(townCodeInput.value);
  if(code) S.townCode=code;
  startWorld();
  toast('Welcome back, '+S.founder.name+'. Day '+S.day+'.','gold');
};

/* =========================================================
   SOVEREIGN CITY — CINEMATIC TRAILER ENGINE
   Run Trailer.start() from the browser console.
   Record with OBS Studio (desktop, 1080p 60fps).
   ========================================================= */
const Trailer={
  active:false, clock:0, wasWon:false, wasMuted:false,
  orbitAngle:0,

  start(){
    if(!S){ toast('Start a game first, then run Trailer.start()','bad'); return; }
    this.active=true; this.clock=0; this.orbitAngle=0;
    this.wasWon=S.won; this.wasMuted=S.muted;
    // disable user input
    joyVec={x:0,y:0};
    Object.keys(keys).forEach(k=>keys[k]=false);
    // position founder at Zone 1 lot for act 1
    playerPos.x=560; playerPos.z=1330;
    playerYaw=Math.PI;
    window._skating=false;
    // night, moody
    S.hour=23; S.min=0;
    S.muted=false; Music.init(); Music.setZone(1); Music.setEnabled(true);
    closeDialog();
    if(document.getElementById('phone')) document.getElementById('phone').style.display='none';
    toast('🎬 CINEMATIC MODE — 30 seconds','gold');
  },

  end(){
    this.active=false;
    window._skating=false;
    S.won=this.wasWon; S.muted=this.wasMuted;
    Music.setEnabled(!S.muted);
    // restore hour to midday so sky looks normal
    S.hour=12; S.min=0; setGoldenHour(0);
    // reset player to grind spawn
    playerPos.x=560; playerPos.z=1200;
    playerYaw=Math.PI;
    toast('🎬 Trailer complete. Check your recording.','good');
  },

  update(DT,now){
    if(!this.active)return;
    this.clock+=DT;
    const c=this.clock;

    /* ---- ACT 1: THE CRACKED SLAB (0–5s) ----
       Night, moody. Slow orbit around the founder. */
    if(c<5){
      S.hour=23; S.min=0;
      window._skating=false;
      playerPos.x=560; playerPos.z=1330;
      this.orbitAngle+=DT*0.30;
      const r=85;
      camera.position.set(
        playerPos.x+Math.sin(this.orbitAngle)*r,
        20+Math.sin(now*0.4)*3,
        playerPos.z+Math.cos(this.orbitAngle)*r
      );
      camera.lookAt(playerPos.x,14,playerPos.z);
      camera.fov=58; camera.updateProjectionMatrix();
    }

    /* ---- TRANSITION: PRE-DAWN (5–6.5s) ---- */
    else if(c<6.5){
      S.hour=6; S.min=30;
      playerPos.x=560; playerPos.z=1330;
      camera.fov=58; camera.updateProjectionMatrix();
    }

    /* ---- ACT 2: DAWN HUSTLE (6.5–13s) ----
       Golden dawn. Founder walks toward Marcus.
       First customer burst at 10s. */
    else if(c<13){
      S.hour=7; S.min=0;
      window._skating=false;
      // walk north
      playerPos.z-=28*DT;
      playerYaw=Math.PI;
      // low-angle side profile push-in
      camera.position.set(playerPos.x-60,14,playerPos.z+18);
      camera.lookAt(playerPos.x,14,playerPos.z);
      camera.fov=55; camera.updateProjectionMatrix();
      // first customer burst at exactly 10s
      if(c>=10&&c<10.06){
        spawnBurst(playerPos.x,14,playerPos.z,0xE8C064);
        floatText(playerPos.x,32,playerPos.z,'+1 CUSTOMER','#5FA86B');
        sCash();
      }
      if(c>=11&&c<11.06){
        spawnBurst(playerPos.x+20,14,playerPos.z,0x5FA86B);
        floatText(playerPos.x,38,playerPos.z-20,'+1 CUSTOMER','#5FA86B');
        sCash();
      }
    }

    /* ---- ACT 3: SKATEBOARD VELOCITY (13–21s) ----
       Music shifts to Innovation Row.
       Founder skates fast south down Main Street.
       Camera tight behind the wheels. */
    else if(c<21){
      if(Music.zone!==3){Music.setZone(3);}
      S.stage=Math.max(S.stage||1,3);
      window._skating=true;
      S.hour=10; S.min=0;
      playerPos.z-=130*DT;
      // keep in-bounds
      if(playerPos.z<820)playerPos.z=820;
      playerYaw=Math.PI;
      // FIXED follow cam: behind = south of northward-moving player = higher Z
      // player faces PI (north), behind = opposite = south = +Z
      const cd=110;
      camera.position.set(
        playerPos.x+4,                    // slight right offset for character
        28+Math.sin(now*2.2)*1.8,         // rhythmic carve sway
        playerPos.z+cd                    // behind the player (south)
      );
      camera.lookAt(playerPos.x,16,playerPos.z);
      camera.fov=72; camera.updateProjectionMatrix();
      // skate dust
      if(Math.random()<0.55)particles.push(()=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4),
          new THREE.MeshBasicMaterial({color:0xF2A33C,transparent:true}));
        m.position.set(playerPos.x+rnd(-3,3),2,playerPos.z+rnd(-3,3));
        scene.add(m);
        particles.push({m,vx:rnd(-10,10),vy:rnd(8,22),vz:rnd(-10,10),life:rnd(.3,.7)});
      });
      // milestone float at 17s
      if(c>=17&&c<17.06){
        stageBanner('STAGE 3','Builder · Innovation Row open');
        spawnBurst(playerPos.x,20,playerPos.z,0xF2A33C);
      }
    }

    /* ---- ACT 4: THE TOWER RISE (21–28s) ----
       Teleport to Skyline. Golden hour.
       Helicopter crane shot rising on the tower. */
    else if(c<28){
      playerPos.x=2000; playerPos.z=1120;
      window._skating=false;
      S.won=true; setGoldenHour(1.1);
      if(Music.zone!==6)Music.setZone(6);
      const elapsed=c-21;
      const hOff=50+elapsed*44;          // crane rises 0→280px over 7s
      camera.position.set(
        playerPos.x+180,
        hOff,
        playerPos.z+200
      );
      camera.lookAt(playerPos.x,hOff*0.30,playerPos.z);
      camera.fov=58; camera.updateProjectionMatrix();
      // fireworks
      if(Math.random()<0.18)
        spawnBurst(
          playerPos.x+rnd(-100,100),
          hOff*rnd(0.3,0.7),
          playerPos.z+rnd(-100,100),
          [0xE8C064,0xF2A33C,0x3FB8AF][ri(0,2)]
        );
    }

    /* ---- ACT 5: TITLE CARD (28–30s) ---- */
    else if(c<30){
      // hold the crane shot
      camera.position.set(2180,300,1320);
      camera.lookAt(2000,180,1120);
      if(c>=29&&c<29.06)
        stageBanner('SOVEREIGN CITY','Build What You Own');
    }

    else{ this.end(); }
  }
};
window.Trailer=Trailer;

(async function boot(){
  // visible loading state so a slow CDN never looks frozen
  const ld=document.createElement('div');
  ld.id='bootLoad';
  ld.style.cssText='position:fixed;inset:0;z-index:60;background:#14120F;display:flex;'+
    'flex-direction:column;align-items:center;justify-content:center;gap:14px;'+
    'font-family:Archivo,Inter,sans-serif;color:#E8C064';
  ld.innerHTML='<div style="font-weight:900;font-size:26px;letter-spacing:.06em">SOVEREIGN CITY</div>'+
    '<div style="width:160px;height:6px;background:#2a261e;border-radius:99px;overflow:hidden">'+
    '<div id="bootBar" style="width:20%;height:100%;background:#E8C064;border-radius:99px;transition:width .4s"></div></div>'+
    '<div style="font-size:11px;letter-spacing:.24em;color:#9A917F">BUILDING THE CITY</div>';
  document.body.appendChild(ld);
  const bar=()=>document.getElementById('bootBar');
  await new Promise(r=>setTimeout(r,30)); if(bar())bar().style.width='45%';
  initThree();
  if(bar())bar().style.width='85%';
  await new Promise(r=>setTimeout(r,60));
  const s=await loadGame();
  if(s){
    $('continueBtn').style.display='inline-block';
    if(s.townCode) townCodeInput.value=s.townCode;
  }
  if(document.getElementById('bootBar'))document.getElementById('bootBar').style.width='100%';
  setTimeout(()=>{const l=document.getElementById('bootLoad');if(l)l.remove();},260);
  requestAnimationFrame(loop);
})();

/* ---------------- PWA: OFFLINE SUPPORT ---------------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js').catch(()=>{});
  });
}
