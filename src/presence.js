import { lerp, clamp } from './util.js';
import { S } from './state.js';
import { SKINS, FITS } from './worldData.js';
import { getSupabase } from './supabase.js';
import { tone } from './audio.js';
import { toast } from './dialog.js';
import { scene, makePerson, makeLabelSprite, spawnBurst, remoteDots } from './graphics.js';

/* =========================================================
   FOUNDERS COMMONS — LIVE PRESENCE
   One Supabase Realtime channel per Town Code. Broadcasts
   carry {founderName,x,z,yaw,skating,skin,fit} at 10Hz while
   moving (3s heartbeat while idle). Presence tracks join/leave.
   Remote players are ghosts: no collision, no interaction menu.
   No-ops entirely in solo/offline play (no townCode or no
   Supabase configured).
   ========================================================= */
const REMOTE_CAP = 24;
const BROADCAST_MS = 100;   // 10Hz while moving
const HEARTBEAT_MS = 3000;  // heartbeat while idle
const LERP_MS = 120;        // smoothing window for remote motion
const GHOST_COLOR = '#9FD8FF';

export const remotePlayers = {}; // presence key -> avatar rig + interpolation state

let channel = null, subscribed = false, syncedOnce = false;
let myKey = null, lastSend = 0;

export function subscribeTown() {
  unsubscribeTown();
  const sb = getSupabase();
  if (!sb || !S || !S.townCode) return;
  myKey = 'p_' + Math.random().toString(36).slice(2, 10);
  syncedOnce = false; lastSend = 0;
  channel = sb.channel('town:' + S.townCode, { config: { presence: { key: myKey } } });
  channel.on('broadcast', { event: 'move' }, ({ payload }) => handleMove(payload));
  channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    if (key === myKey || !syncedOnce) return; // skip the initial roster sync
    const meta = (newPresences && newPresences[newPresences.length - 1]) || {};
    toast('<b>' + (meta.founderName || 'A founder') + '</b> stepped into the Grind');
    tone(660, .16, 'sine', .07); tone(880, .22, 'sine', .05, .09);
  });
  channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    if (key === myKey) return;
    const meta = leftPresences && leftPresences[0];
    removeRemote(key, meta && meta.founderName);
  });
  channel.on('presence', { event: 'sync' }, () => { syncedOnce = true; });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      channel.track({ founderName: S.founder.name });
    }
  });
}

export function unsubscribeTown() {
  const sb = getSupabase();
  if (channel && sb) { try { sb.removeChannel(channel); } catch (e) {} }
  channel = null; subscribed = false; syncedOnce = false; myKey = null; lastSend = 0;
  Object.keys(remotePlayers).forEach(k => removeRemote(k));
  remoteDots.length = 0;
}

export function sendPresenceUpdate(now, x, z, yaw, skating, moving) {
  if (!channel || !subscribed) return;
  const interval = moving ? BROADCAST_MS : HEARTBEAT_MS;
  if (now - lastSend < interval) return;
  lastSend = now;
  channel.send({
    type: 'broadcast', event: 'move',
    payload: { key: myKey, founderName: S.founder.name, x, z, yaw, skating: !!skating, skin: S.founder.skin, fit: S.founder.fit }
  });
}

function lerpAngle(a, b, t) {
  const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
function interpState(rp, now) {
  const t = clamp((now - rp.updateStart) / LERP_MS, 0, 1);
  return { x: lerp(rp.from.x, rp.to.x, t), z: lerp(rp.from.z, rp.to.z, t), yaw: lerpAngle(rp.from.yaw, rp.to.yaw, t) };
}
function createRemote(founderName, skin, fit) {
  const p = makePerson(SKINS[skin] || SKINS[0], FITS[fit] || FITS[0]);
  scene.add(p.group);
  const tag = makeLabelSprite(founderName || 'Founder', GHOST_COLOR);
  tag.scale.set(86, 16, 1); tag.position.y = 30;
  p.group.add(tag);
  return p;
}
function handleMove(payload) {
  const { key, founderName, x, z, yaw, skating, skin, fit } = payload || {};
  if (!key || key === myKey || typeof x !== 'number' || typeof z !== 'number') return;
  let rp = remotePlayers[key];
  const now = performance.now();
  if (!rp) {
    const active = Object.values(remotePlayers).filter(r => !r.overflow).length;
    if (active >= REMOTE_CAP) { remotePlayers[key] = { overflow: true, x, z }; return; }
    rp = createRemote(founderName, skin, fit);
    rp.founderName = founderName;
    rp.from = { x, z, yaw: yaw || 0 }; rp.to = { x, z, yaw: yaw || 0, skating: !!skating }; rp.updateStart = now;
    rp.group.position.set(x, 0, z); rp.group.rotation.y = yaw || 0;
    remotePlayers[key] = rp;
    return;
  }
  if (rp.overflow) { rp.x = x; rp.z = z; return; }
  rp.from = interpState(rp, now);
  rp.to = { x, z, yaw: yaw || 0, skating: !!skating };
  rp.updateStart = now;
  rp.founderName = founderName;
}
function removeRemote(key, fallbackName) {
  const rp = remotePlayers[key];
  if (!rp) return;
  if (!rp.overflow) {
    spawnBurst(rp.group.position.x, 14, rp.group.position.z, 0x9FD8FF);
    scene.remove(rp.group);
    toast('<b>' + (rp.founderName || fallbackName || 'A founder') + '</b> left the city.');
  }
  delete remotePlayers[key];
}

export function updateRemotePlayers(now) {
  remoteDots.length = 0;
  for (const key in remotePlayers) {
    const rp = remotePlayers[key];
    if (rp.overflow) { remoteDots.push({ x: rp.x, z: rp.z }); continue; }
    const cur = interpState(rp, now);
    rp.group.position.set(cur.x, rp.to.skating ? 2.2 : 0, cur.z);
    rp.group.rotation.y = cur.yaw;
    rp.group.rotation.x = rp.to.skating ? 0.06 : 0;
    rp.board.visible = rp.to.skating;
    const moved = Math.hypot(rp.to.x - rp.from.x, rp.to.z - rp.from.z) > 0.4;
    const t = now / 1000;
    if (rp.to.skating) {
      rp.lLeg.rotation.x = 0.25; rp.rLeg.rotation.x = -0.25;
      rp.lArm.rotation.x = 0; rp.rArm.rotation.x = 0;
      rp.lArm.rotation.z = 0.5; rp.rArm.rotation.z = -0.5;
      rp.group.rotation.z = Math.sin(t * 2.2) * 0.04;
    } else {
      rp.lArm.rotation.z = 0; rp.rArm.rotation.z = 0;
      rp.group.rotation.z = 0;
      const swing = moved ? Math.sin(t * 9) * 0.6 : 0;
      rp.lLeg.rotation.x = swing; rp.rLeg.rotation.x = -swing;
      rp.lArm.rotation.x = -swing * 0.8; rp.rArm.rotation.x = swing * 0.8;
    }
  }
}
