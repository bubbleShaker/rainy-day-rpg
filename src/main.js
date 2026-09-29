import * as THREE from 'three';
import { state, shardCount, resetProgress } from './state.js';
import { buildWorld, updateWorld, setBarrier, heightAt, SHRINE, BARRIER_R } from './world.js';
import { Weather } from './rain.js';
import { FollowCamera } from './camera.js';
import { initInput, consume, clearActions, takeCam, input } from './input.js';
import { Player } from './player.js';
import {
  initEnemies, spawnWorldEnemies, spawnBoss, updateEnemies, clearEnemies, removeEnemy,
  calmEnemies, spawnPickup, updatePickups, clearPickups, pickupList,
} from './enemies.js';
import { createNPCs, updateNPCs, nearestNPC, talkTo, npcById } from './npc.js';
import { initFx, updateFx, splash, ringFx } from './combat.js';
import * as ui from './ui.js';
import { initAudio, sfx, setSunny, toggleMute } from './audio.js';
import { save, load, hasSave, clearSave } from './save.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
state.lowSpec = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !state.lowSpec, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, state.lowSpec ? 1.5 : 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const follow = new FollowCamera(camera);

// Web フォントが読み込まれてから名前ラベルを作る
await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);

buildWorld(scene);
const weather = new Weather(scene, state.lowSpec);
state.weather = weather;
initFx(scene);
initEnemies(scene);
const player = new Player(scene);
state.player = player;
createNPCs(scene);
initInput(canvas);
ui.initUI();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 58;
  follow.baseDist = w < h ? 12 : 10;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let bossSpawned = false;
let time = 0;
const focus = new THREE.Vector3();

// ---------- イベント ----------
state.onPlayerDeath = () => {
  state.mode = 'dead';
  clearActions();
  ui.setBoss(null);
  setTimeout(() => ui.show('dead', true), 900);
};

state.onEnemyKilled = (e) => {
  if (e.boss) { ending(); return; }
  if (e.leader) {
    ui.message(`${e.name}を たおした！`);
    spawnPickup('shard', e.pos, e.shard);
    ui.banner('晴れのかけらが 落ちている！');
  } else if (!e.minion && Math.random() < 0.12) {
    spawnPickup('cocoa', e.pos);
  }
};

state.onPickup = (kind, data, pos) => {
  if (kind === 'cocoa') {
    state.items.cocoa++;
    sfx('pickup');
    ui.message('ココアを ひろった！');
    return;
  }
  state.shards[data] = true;
  sfx('shard');
  ringFx(player.pos, 3.5, 0xffe38a, 0.8);
  splash(pos.clone().setY(pos.y + 1), 0xffe38a, 20, 5, 0.1, 5);
  ui.banner(`晴れのかけらを 手に入れた！（${shardCount()}/3）`);
  if (shardCount() === 3) {
    setBarrier(false);
    if (state.quest === 1) state.quest = 2;
    weather.flash(0.9);
    ui.message('どこか遠くで、結界が消える音がした…… 北の丘の祠へ向かおう！');
  } else {
    ui.message('残りのかけらを探そう');
  }
  save();
};

// ---------- 画面遷移 ----------
function refreshTitle() {
  ui.show('continueBtn', hasSave());
}

function begin(cont) {
  initAudio();
  resetProgress();
  player.resetStats();
  if (cont) load(); else clearSave();
  clearEnemies();
  clearPickups();
  spawnWorldEnemies();
  bossSpawned = false;
  setBarrier(shardCount() < 3, true);
  const sunny = state.quest >= 4;
  weather.setInstant(sunny ? 0 : 1);
  setSunny(sunny);
  player.respawn();
  follow.yaw = 0;
  follow.pitch = 0.55;
  follow.autoYaw = follow.autoPitch = null;
  follow.snap(player.pos);
  ui.show('title', false);
  ui.show('ending', false);
  ui.show('hud', true);
  clearActions();
  state.mode = 'play';
  if (!cont) {
    runDialog('', [
      '雨がふりつづく 港町アマヤド。',
      '空が晴れなくなって、もう百日がたつという……。',
      '広場にいる 長老ミズホに 話を聞いてみよう。',
    ]);
  } else {
    ui.message('つづきから はじめた');
  }
}

async function runDialog(name, lines) {
  state.mode = 'dialog';
  clearActions();
  await ui.dialog(name, lines);
  clearActions();
  if (state.mode === 'dialog') state.mode = 'play';
}

async function startTalk(npc) {
  state.mode = 'dialog';
  ui.setTalk(false);
  clearActions();
  await talkTo(npc);
  clearActions();
  if (state.mode === 'dialog') state.mode = 'play';
}

async function startBoss() {
  bossSpawned = true;
  state.quest = 3;
  const boss = spawnBoss();
  sfx('boss');
  weather.flash(1, true, 0);
  state.mode = 'dialog';
  clearActions();
  await ui.dialog('嵐の精', [
    '……だれ？ わたしの雨を、止めにきたの……？',
    'かえって。かえってよ！ わたしの傘は、もう どこにもないんだから……！',
  ]);
  clearActions();
  state.mode = 'play';
  ui.setBoss(boss);
}

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function ending() {
  state.mode = 'cutscene';
  clearActions();
  ui.setBoss(null);
  for (const e of [...state.enemies]) {
    if (!e.minion && !e.boss) continue;
    splash(e.pos.clone().setY(e.pos.y + 2), 0x9fe8ff, 30, 8, 0.14, 6);
    ringFx(e.pos, 6, 0x9fe8ff, 1);
    removeEnemy(e);
  }
  await wait(1.2);
  // 雨の精霊と向き合い、町と海が見える位置へ
  player.pos.set(SHRINE.x, heightAt(SHRINE.x, SHRINE.z + 8), SHRINE.z + 8);
  player.facing = Math.PI;
  follow.snap(player.pos);
  state.quest = 4;
  save();
  await ui.dialog('雨の精霊', [
    '……あれ？ わたし、どうして……。',
    'ずっと、たいせつな傘をさがしてたの。見つからなくて、かなしくて……。',
    'そうしたら、涙が止まらなくなっちゃった。',
    { name: '', text: '（あなたは そっと、自分の赤い傘を 差し出した）' },
    '……いいの？ ありがとう。とっても、あたたかい。',
    'もう、泣かなくてだいじょうぶ。――ほら、空を見て！',
  ]);
  weather.clearUp();
  setSunny(true);
  sfx('clear');
  state.mode = 'cinematic';
  document.body.classList.add('cinematic');
  player.facing = 0;
  follow.autoYaw = Math.PI;
  follow.autoPitch = 0.22;
  await wait(9);
  const t = Math.floor(state.playTime);
  $('endStats').textContent = `Lv ${player.level} ／ プレイ時間 ${Math.floor(t / 60)}分${t % 60}秒`;
  ui.show('hud', false);
  ui.show('ending', true);
  document.body.classList.remove('cinematic');
  state.mode = 'ending';
}

$('startBtn').addEventListener('click', () => begin(false));
$('continueBtn').addEventListener('click', () => begin(true));
$('reviveBtn').addEventListener('click', () => {
  ui.show('dead', false);
  if (state.quest === 3) {
    for (const e of [...state.enemies]) if (e.minion || e.boss) removeEnemy(e);
    state.quest = 2;
    bossSpawned = false;
  }
  calmEnemies();
  player.respawn();
  follow.snap(player.pos);
  follow.yaw = 0;
  clearActions();
  state.mode = 'play';
  save();
});
$('walkBtn').addEventListener('click', () => {
  ui.show('ending', false);
  ui.show('hud', true);
  follow.autoYaw = follow.autoPitch = null;
  clearActions();
  state.mode = 'play';
});
$('titleBtn').addEventListener('click', () => {
  ui.show('ending', false);
  ui.show('title', true);
  follow.autoYaw = follow.autoPitch = null;
  state.mode = 'title';
  refreshTitle();
});
$('muteBtn').addEventListener('click', (e) => {
  e.currentTarget.classList.toggle('off', toggleMute());
});
canvas.addEventListener('pointerdown', () => { if (ui.isDialogOpen()) ui.advanceDialog(); });

// ---------- 進行チェック ----------
function objective() {
  if (state.quest === 0) return npcById('elder').pos;
  if (state.quest === 1) {
    const shard = pickupList().find((p) => p.kind === 'shard');
    if (shard) return shard.g.position;
    let best = null;
    let bd = Infinity;
    for (const e of state.enemies) {
      if (!e.leader || e.dead) continue;
      const d = e.pos.distanceTo(player.pos);
      if (d < bd) { bd = d; best = e.pos; }
    }
    return best;
  }
  if (state.quest === 2 || state.quest === 3) return SHRINE;
  return null;
}

function checkTriggers() {
  if (!bossSpawned && shardCount() === 3 && state.quest >= 1 && state.quest <= 2
    && Math.hypot(player.pos.x - SHRINE.x, player.pos.z - SHRINE.z) < BARRIER_R - 2) {
    startBoss();
    return;
  }
  // 強敵と戦っているときだけ HP バーを出す
  let target = null;
  for (const e of state.enemies) {
    if (e.dead || !(e.leader || e.boss)) continue;
    if (e.st !== 'idle' && e.st !== 'return' && e.pos.distanceTo(player.pos) < 24) { target = e; break; }
  }
  ui.setBoss(target);
}

// ---------- メインループ ----------
const clock = new THREE.Clock();
let hintHidden = false;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  const camDelta = takeCam();

  if (state.mode === 'play') {
    state.playTime += dt;
    player.update(dt, follow.yaw);
    updateEnemies(dt, player);
    updatePickups(dt, player);
    checkTriggers();
    const near = state.mode === 'play' ? nearestNPC(player.pos) : null;
    ui.setTalk(!!near);
    if (consume('talk') && near) startTalk(near);
    ui.setObjective(objective());
    if (!hintHidden && input.moved) { hintHidden = true; $('joyHint').classList.add('gone'); }
  } else {
    ui.setTalk(false);
    if (ui.isDialogOpen() && (consume('talk') || consume('dodge'))) ui.advanceDialog();
    clearActions();
    if (state.mode === 'cinematic' || state.mode === 'cutscene' || state.mode === 'dialog') {
      player.animate(dt, false);
    }
  }

  updateNPCs(dt, player.pos);
  updateWorld(dt, time);
  updateFx(dt);

  if (state.mode === 'title' || state.mode === 'loading') {
    const a = time * 0.05;
    camera.position.set(Math.sin(a) * 32, 13, Math.cos(a) * 32);
    camera.lookAt(0, 3, 0);
    focus.set(camera.position.x * 0.6, 0, camera.position.z * 0.6);
  } else {
    follow.update(dt, player.pos, state.mode === 'play' ? camDelta : { x: 0, y: 0 });
    focus.copy(player.pos);
  }
  weather.update(dt, focus);
  ui.update(dt, camera);
  renderer.render(scene, camera);
}

// 動作確認用フック（URL に #debug を付けたときだけ有効）
if (location.hash === '#debug') window.__game = { state, player, follow, weather, begin, spawnBoss, startBoss };

state.mode = 'title';
refreshTitle();
$('loading').remove();
loop();
