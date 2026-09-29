import { state } from './state.js';

const KEY = 'rainy-day-rpg-save-v1';

export function save() {
  const p = state.player;
  if (!p) return;
  const data = {
    level: p.level, exp: p.exp, maxHp: p.maxHp, atk: p.atk,
    // ボス戦の途中で保存した場合は、祠に向かう段階からやり直す
    quest: state.quest === 3 ? 2 : state.quest,
    shards: state.shards,
    items: state.items,
    playTime: state.playTime,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 保存できない環境では何もしない */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d) return false;
    const p = state.player;
    p.level = d.level; p.exp = d.exp; p.maxHp = d.maxHp; p.atk = d.atk; p.hp = p.maxHp;
    state.quest = d.quest;
    state.shards = d.shards;
    state.items = d.items;
    state.playTime = d.playTime || 0;
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
