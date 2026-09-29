import * as THREE from 'three';
import { state, shardCount } from './state.js';
import { SHRINE, ZONES, HILL, MARSH, SEA_Z, WORLD_R } from './world.js';

const $ = (id) => document.getElementById(id);
const E = {};
const pops = [];
const v3 = new THREE.Vector3();
let flashV = 0;
let hurtV = 0;
let dlg = null;
let boss = null;
let talkShown = false;
let objective = null;
let mmBg = null;
let mmCtx = null;
let frame = 0;
let bannerTimer = 0;
const S = 1.1; // ミニマップの縮尺（px / m）

export function initUI() {
  for (const id of ['hpText', 'hpFill', 'expFill', 'lv', 'questText', 'shards', 'messages', 'banner', 'pops',
    'flash', 'hurt', 'dialog', 'dlgName', 'dlgText', 'bossbar', 'bossName', 'bossFill', 'talkBtn',
    'skillCd', 'cocoaCount', 'minimap']) {
    E[id] = $(id);
  }
  E.shardEls = [...E.shards.children];
  E.dialog.addEventListener('pointerdown', (e) => { e.stopPropagation(); advanceDialog(); });
  mmCtx = E.minimap.getContext('2d');
  buildMinimapBg();
}

function setText(el, s) {
  if (el._v !== s) { el._v = s; el.textContent = s; }
}
function setW(el, frac) {
  const s = `${(Math.max(0, Math.min(1, frac)) * 100).toFixed(1)}%`;
  if (el._w !== s) { el._w = s; el.style.width = s; }
}

export function show(id, on = true) { $(id).classList.toggle('hidden', !on); }

export function message(text) {
  const d = document.createElement('div');
  d.className = 'msg';
  d.textContent = text;
  E.messages.appendChild(d);
  while (E.messages.children.length > 4) E.messages.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 3800);
  setTimeout(() => d.remove(), 4500);
}

export function banner(text) {
  E.banner.textContent = text;
  E.banner.classList.remove('show');
  void E.banner.offsetWidth;
  E.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => E.banner.classList.remove('show'), 2400);
}

export function popText(pos, text, cls = '') {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  E.pops.appendChild(el);
  pops.push({ el, pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.6, pos.y + 1.9, pos.z), t: 0 });
}

export function flash(v) { flashV = Math.max(flashV, v); }
export function hurt() { hurtV = 0.7; }

// ---------- 会話ウィンドウ ----------
export function dialog(name, lines) {
  return new Promise((res) => {
    dlg = { name, lines, i: -1, res, shown: 0, full: '' };
    E.dialog.classList.remove('hidden');
    document.body.classList.add('in-dialog');
    nextLine();
  });
}

function nextLine() {
  dlg.i++;
  if (dlg.i >= dlg.lines.length) {
    const r = dlg.res;
    dlg = null;
    E.dialog.classList.add('hidden');
    document.body.classList.remove('in-dialog');
    r();
    return;
  }
  const l = dlg.lines[dlg.i];
  const name = typeof l === 'string' ? dlg.name : l.name;
  dlg.full = typeof l === 'string' ? l : l.text;
  dlg.shown = 0;
  E.dlgName.textContent = name || '';
  E.dlgName.style.display = name ? '' : 'none';
  E.dlgText.textContent = '';
}

export function advanceDialog() {
  if (!dlg) return;
  if (dlg.shown < dlg.full.length) {
    dlg.shown = dlg.full.length;
    E.dlgText.textContent = dlg.full;
  } else {
    nextLine();
  }
}

export const isDialogOpen = () => !!dlg;

// ---------- HUD ----------
export function setTalk(on) {
  if (on === talkShown) return;
  talkShown = on;
  E.talkBtn.classList.toggle('hidden', !on);
}

export function setBoss(e) {
  if (e === boss) return;
  boss = e;
  E.bossbar.classList.toggle('hidden', !e);
  if (e) E.bossName.textContent = e.name;
}

export function setObjective(v) { objective = v; }

function questText() {
  switch (state.quest) {
    case 0: return '広場の長老ミズホに話を聞こう';
    case 1: {
      const left = ZONES.filter((z, i) => !state.shards[i]).map((z) => z.name).join('・');
      return `晴れのかけらを集めよう（${shardCount()}/3）\n${left}`;
    }
    case 2: return '北の丘の祠へ向かおう';
    case 3: return '嵐の精を鎮めよう！';
    default: return '雨あがりの町を散歩しよう';
  }
}

function buildMinimapBg() {
  const c = document.createElement('canvas');
  c.width = c.height = 220;
  const x = c.getContext('2d');
  const m = (v) => 110 + v * S;
  x.fillStyle = '#1d3346';
  x.fillRect(0, 0, 220, 220);
  x.fillStyle = '#3c5a3c';
  x.beginPath(); x.arc(110, 110, (WORLD_R + 4) * S, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1d3346';
  x.fillRect(0, m(SEA_Z + 2), 220, 220);
  x.fillStyle = '#2f4a3f';
  x.beginPath(); x.arc(m(MARSH.x), m(MARSH.z), 20 * S, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#5c7c50';
  x.beginPath(); x.arc(m(HILL.x), m(HILL.z), HILL.top * S + 6, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#8a8c90';
  x.lineWidth = 4;
  x.beginPath();
  x.moveTo(m(0), m(-68)); x.lineTo(m(0), m(76));
  x.moveTo(m(-76), m(0)); x.lineTo(m(76), m(0));
  x.stroke();
  x.fillStyle = '#7a7d84';
  x.beginPath(); x.arc(110, 110, 15 * S, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#dfe8f0';
  x.font = 'bold 13px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const z of ZONES) x.fillText(z.short, m(z.x), m(z.z) - 12);
  x.fillText('祠', m(SHRINE.x), m(SHRINE.z) - 14);
  x.fillText('町', 110, 110 - 22);
  mmBg = c;
}

function drawMinimap() {
  const x = mmCtx;
  const m = (v) => 110 + v * S;
  x.drawImage(mmBg, 0, 0);
  for (const n of state.npcs) {
    if (!n.root.visible) continue;
    x.fillStyle = '#7dffa0';
    x.fillRect(m(n.pos.x) - 2.5, m(n.pos.z) - 2.5, 5, 5);
  }
  for (const e of state.enemies) {
    if (e.dead) continue;
    x.fillStyle = e.boss ? '#c77dff' : e.leader ? '#ffa24d' : '#ff5e5e';
    const r = e.boss ? 6 : e.leader ? 4.5 : 2.5;
    x.beginPath(); x.arc(m(e.pos.x), m(e.pos.z), r, 0, Math.PI * 2); x.fill();
  }
  if (objective) {
    const pulse = 5 + Math.sin(performance.now() / 200) * 2;
    x.strokeStyle = '#ffd34d';
    x.lineWidth = 3;
    x.beginPath(); x.arc(m(objective.x), m(objective.z), pulse + 3, 0, Math.PI * 2); x.stroke();
  }
  const p = state.player;
  x.save();
  x.translate(m(p.pos.x), m(p.pos.z));
  x.rotate(-p.facing);
  x.fillStyle = '#ffffff';
  x.strokeStyle = '#1a2433';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 9); x.lineTo(6, -6); x.lineTo(-6, -6); x.closePath();
  x.stroke(); x.fill();
  x.restore();
}

export function update(dt, camera) {
  // ダメージ数字
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.t += dt;
    p.pos.y += dt * 1.3;
    if (p.t > 0.9) { p.el.remove(); pops.splice(i, 1); continue; }
    v3.copy(p.pos).project(camera);
    if (v3.z > 1) { p.el.style.opacity = 0; continue; }
    const sx = (v3.x + 1) / 2 * innerWidth;
    const sy = (1 - v3.y) / 2 * innerHeight;
    p.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - p.t) * 2})`;
    p.el.style.opacity = Math.min(1, (0.9 - p.t) * 3);
  }

  if (flashV > 0 || E.flash._on) {
    E.flash.style.opacity = flashV.toFixed(3);
    E.flash._on = flashV > 0;
    flashV = Math.max(0, flashV - dt * 2.5);
  }
  if (hurtV > 0 || E.hurt._on) {
    E.hurt.style.opacity = hurtV.toFixed(3);
    E.hurt._on = hurtV > 0;
    hurtV = Math.max(0, hurtV - dt * 1.8);
  }

  if (dlg && dlg.shown < dlg.full.length) {
    dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 40);
    E.dlgText.textContent = dlg.full.slice(0, Math.floor(dlg.shown));
  }

  const p = state.player;
  if (!p) return;
  setText(E.lv, `Lv ${p.level}`);
  setText(E.hpText, `HP ${Math.ceil(p.hp)}/${p.maxHp}`);
  setW(E.hpFill, p.hp / p.maxHp);
  setW(E.expFill, p.exp / p.nextExp);
  setText(E.cocoaCount, String(state.items.cocoa));
  setText(E.questText, questText());
  const cd = `${(p.skillCd / p.skillMax * 100).toFixed(0)}%`;
  if (E.skillCd._h !== cd) { E.skillCd._h = cd; E.skillCd.style.height = cd; }
  E.shardEls.forEach((el, i) => {
    if (el._on !== state.shards[i]) { el._on = state.shards[i]; el.classList.toggle('on', state.shards[i]); }
  });
  if (boss) setW(E.bossFill, boss.hp / boss.maxHp);
  if (++frame % 3 === 0) drawMinimap();
}
