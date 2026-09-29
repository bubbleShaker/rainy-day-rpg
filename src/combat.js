import * as THREE from 'three';
import { state } from './state.js';
import * as ui from './ui.js';
import { sfx } from './audio.js';
import { save } from './save.js';

// ---------- エフェクト（しぶき・リング） ----------
let scene = null;
const parts = [];
const rings = [];
const partGeo = new THREE.SphereGeometry(1, 6, 4);
const partMats = new Map();
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
ringGeo.rotateX(-Math.PI / 2);

function partMat(color) {
  if (!partMats.has(color)) partMats.set(color, new THREE.MeshBasicMaterial({ color }));
  return partMats.get(color);
}

export function initFx(sc) { scene = sc; }

export function splash(pos, color = 0x9fd3ff, n = 8, speed = 4, size = 0.08, up = 4) {
  for (let i = 0; i < n; i++) {
    let p = parts.find((q) => !q.alive);
    if (!p) {
      if (parts.length >= 180) return;
      p = { mesh: new THREE.Mesh(partGeo, partMat(color)), vel: new THREE.Vector3(), alive: false, t: 0, life: 0, size: 0 };
      scene.add(p.mesh);
      parts.push(p);
    }
    p.mesh.material = partMat(color);
    p.alive = true;
    p.t = 0;
    p.life = 0.35 + Math.random() * 0.3;
    p.size = size * (0.6 + Math.random() * 0.8);
    p.mesh.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    p.vel.set(Math.cos(a) * s, up * (0.5 + Math.random() * 0.8), Math.sin(a) * s);
    p.mesh.visible = true;
  }
}

export function ringFx(pos, radius, color = 0xbfe6ff, dur = 0.45) {
  let r = rings.find((q) => !q.alive);
  if (!r) {
    r = {
      mesh: new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })),
      alive: false, t: 0, dur: 0, radius: 0,
    };
    scene.add(r.mesh);
    rings.push(r);
  }
  r.alive = true;
  r.t = 0;
  r.dur = dur;
  r.radius = radius;
  r.mesh.material.color.setHex(color);
  r.mesh.position.set(pos.x, pos.y + 0.15, pos.z);
  r.mesh.visible = true;
}

export function updateFx(dt) {
  for (const p of parts) {
    if (!p.alive) continue;
    p.t += dt;
    if (p.t >= p.life) { p.alive = false; p.mesh.visible = false; continue; }
    p.vel.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(p.size * (1 - p.t / p.life) + 0.001);
  }
  for (const r of rings) {
    if (!r.alive) continue;
    r.t += dt;
    const k = r.t / r.dur;
    if (k >= 1) { r.alive = false; r.mesh.visible = false; continue; }
    const s = r.radius * (0.2 + 0.8 * Math.sqrt(k));
    r.mesh.scale.set(s, 1, s);
    r.mesh.material.opacity = 0.75 * (1 - k);
  }
}

// ---------- ダメージ処理 ----------
const tmp = new THREE.Vector3();

export function nearestEnemy(pos, maxD) {
  let best = null;
  let bd = maxD;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) - e.radius;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function damageEnemy(e, base, dirX, dirZ, knock = 4) {
  if (e.dead) return;
  const crit = Math.random() < 0.1;
  const amount = Math.max(1, Math.round(base * (0.85 + Math.random() * 0.3) * (crit ? 1.6 : 1)));
  e.hp -= amount;
  e.hitT = 0.15;
  const kk = e.boss ? 0 : e.leader ? knock * 0.35 : knock;
  e.knock.set(dirX * kk, 0, dirZ * kk);
  e.aggro();
  tmp.set(e.pos.x, e.pos.y + e.barY * 0.5, e.pos.z);
  ui.popText(tmp, String(amount), crit ? 'crit' : '');
  splash(tmp, 0xbfe6ff, 6, 4, 0.08);
  sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.kill();
  tmp.set(e.pos.x, e.pos.y + 0.5, e.pos.z);
  splash(tmp, 0x8fd0ff, 18, 6, 0.12, 6);
  sfx('enemyDie');
  if (e.exp > 0) gainExp(e.exp);
  state.onEnemyKilled?.(e);
}

export function gainExp(n) {
  const p = state.player;
  p.exp += n;
  ui.popText(p.pos, `+${n} EXP`, 'exp');
  let up = false;
  while (p.exp >= p.nextExp) {
    p.exp -= p.nextExp;
    p.level++;
    p.maxHp += 15;
    p.atk += 3;
    up = true;
  }
  if (up) {
    p.hp = p.maxHp;
    ui.banner(`レベルアップ！ Lv ${p.level}`);
    ui.message(`HPと攻撃力が上がった！（攻撃 ${p.atk}）`);
    sfx('levelup');
    ringFx(p.pos, 3, 0xffe38a, 0.7);
    save();
  }
}

export function damagePlayer(amount) {
  const p = state.player;
  if (state.mode !== 'play' || p.invuln > 0 || p.hp <= 0) return false;
  const dmg = Math.max(1, Math.round(amount * (0.9 + Math.random() * 0.2)));
  p.hp -= dmg;
  p.invuln = 0.7;
  p.hurtT = 0.25;
  p.blinkT = 0.7;
  ui.popText(p.pos, String(dmg), 'hurt');
  ui.hurt();
  sfx('hurt');
  try { navigator.vibrate?.(40); } catch { /* noop */ }
  if (p.hp <= 0) {
    p.hp = 0;
    state.onPlayerDeath?.();
  }
  return true;
}

export function hitArc(origin, facing, range, cosArc, dmg, knock) {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  let n = 0;
  for (const e of [...state.enemies]) {
    if (e.dead) continue;
    const dx = e.pos.x - origin.x;
    const dz = e.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) continue;
    if (d > e.radius + 0.3 && (dx * fx + dz * fz) / d < cosArc) continue;
    damageEnemy(e, dmg, d ? dx / d : fx, d ? dz / d : fz, knock);
    n++;
  }
  return n;
}

export function hitRadius(origin, range, dmg, knock) {
  let n = 0;
  for (const e of [...state.enemies]) {
    if (e.dead) continue;
    const dx = e.pos.x - origin.x;
    const dz = e.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) continue;
    damageEnemy(e, dmg, d ? dx / d : 1, d ? dz / d : 0, knock);
    n++;
  }
  return n;
}
