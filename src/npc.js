import * as THREE from 'three';
import { makePerson, makeCat, makeShadow, makeLabel, lerpAngle } from './models.js';
import { heightAt, world, SHRINE } from './world.js';
import { state, shardCount } from './state.js';
import * as ui from './ui.js';
import { sfx } from './audio.js';
import { save } from './save.js';

const ZONE_HINT = ['西の「しずくの森」', '東の「カエル沼」', '南の「港の岬」'];
const missing = () => ZONE_HINT.filter((z, i) => !state.shards[i]);

let kidIdx = 0;
let fisherIdx = 0;

const DEFS = [
  {
    id: 'elder', name: '長老ミズホ', x: -5, z: -6,
    look: { coat: 0x6d5a8c, hair: 0xe8e8e8, umbrella: 0x4f78b8, boots: 0x3a2c22 },
    talk() {
      if (state.quest === 0) {
        return {
          lines: [
            'おお、旅のお方。ようこそ、港町アマヤドへ。',
            'この町では……もう百日も、雨が止まんのじゃ。',
            '北の丘の祠に住む「雨の精霊」さまが、ずっと泣いておられる。',
            '精霊さまの涙を止めるには「晴れのかけら」が3つ要る、と言い伝えにある。',
            'かけらは 西の「しずくの森」、東の「カエル沼」、南の「港の岬」……それぞれの大きな魔物が持っておるそうじゃ。',
            'どうか頼む、傘の旅人よ。これは町のみんなからの気持ちじゃ。',
            { name: '', text: '（あたたかいココアを 1つ もらった）' },
          ],
          after() {
            state.quest = shardCount() === 3 ? 2 : 1;
            state.items.cocoa++;
            sfx('pickup');
            ui.banner('クエスト開始！');
            ui.message('まずは西の「しずくの森」へ行ってみよう');
            save();
          },
        };
      }
      if (state.quest === 1) {
        const m = missing();
        return {
          lines: [
            `晴れのかけらは あと ${m.length} つじゃ。`,
            `${m[0]}に向かうとよかろう。`,
            'つらくなったら、広場の傘屋でひと休みするのじゃぞ。',
          ],
        };
      }
      if (state.quest === 2 || state.quest === 3) {
        return { lines: ['おお……3つのかけらが光っておる！', '北の丘の祠へ向かうのじゃ。結界はもう消えておるはずじゃ。'] };
      }
      return { lines: ['見よ、この青空を！ 百日ぶりの晴れ間じゃ。', 'そなたは町の英雄じゃよ。本当にありがとう。'] };
    },
  },
  {
    id: 'shop', name: '傘屋のシズク', x: 7, z: -7,
    look: { coat: 0xe07a9a, hair: 0x6b3b2a, umbrella: 0xf2a0c0, boots: 0x5a2a3a },
    talk() {
      const lines = state.quest >= 4
        ? ['晴れたら晴れたで、日傘が売れるのよね～。', 'はい、お祝いのココア！']
        : ['いらっしゃい！ まあ、ずぶ濡れじゃない。', 'ほら、あたたかいココアをどうぞ。元気が出るわよ。'];
      return {
        lines,
        after() {
          const p = state.player;
          p.hp = p.maxHp;
          ui.popText(p.pos, 'HP全回復', 'heal');
          sfx('heal');
          if (state.items.cocoa < 3) {
            state.items.cocoa++;
            ui.message('ココアを 1つ もらった（最大3つまで）');
          }
          save();
        },
      };
    },
  },
  {
    id: 'kid', name: 'ハル', x: -9, z: 7, scale: 0.75,
    look: { coat: 0x5bb0e8, hair: 0x2a1a10, umbrella: 0x7fd36b, boots: 0xe0c040 },
    talk() {
      const all = [
        ['ねえねえ、「スピン」で傘をくるくる回すと、まわりの敵をまとめて吹き飛ばせるんだよ！'],
        ['敵の体がチカチカ光ったら、攻撃してくる合図だよ。「回避」でよけちゃえ！'],
        ['「攻撃」を3回つづけると、3回目がすっごく強いんだ！'],
        ['雨の日はカエルさんが元気なんだって。沼のカエルは跳びかかってくるから気をつけて！'],
        ['水たまりをバシャバシャするの、たのしいよね！'],
      ];
      const lines = state.quest >= 4 ? ['晴れたー！ 水たまりに空がうつってるよ！'] : all[kidIdx++ % all.length];
      return { lines };
    },
  },
  {
    id: 'fisher', name: '釣り人ゲン', x: 5, z: 36,
    look: { coat: 0x3f6b5a, hair: 0x555555, umbrella: 0x2f3f5f, boots: 0x222222 },
    talk() {
      const all = [
        ['岬には「雷雲コウモリ」がうようよしておる。', 'あいつらは素早いぞ。レベル5くらいになってから行くといい。'],
        ['沼のカエルどもは、跳ぶ前にぐっと身をかがめる。そこが狙い目じゃ。'],
        ['……こんな雨じゃ、魚も傘がほしかろうな。'],
      ];
      const lines = state.quest >= 4 ? ['晴れた海はいいのう。今日は大漁の予感じゃ！'] : all[fisherIdx++ % all.length];
      return { lines };
    },
  },
  {
    id: 'cat', name: 'ねこ', x: 12, z: 9, cat: true,
    talk() {
      return { lines: [state.quest >= 4 ? 'にゃ～ん♪（ひなたぼっこ日和だにゃ）' : 'にゃあ。（雨はきらいにゃ……）'] };
    },
  },
  {
    id: 'spirit', name: '雨の精霊', x: SHRINE.x + 2, z: SHRINE.z - 4, scale: 0.8,
    visible: () => state.quest >= 4,
    look: { coat: 0x9fdcff, hair: 0xd8f4ff, umbrella: 0xd9434b, boots: 0x7fb8e0, skin: 0xe8f4ff },
    talk() {
      return { lines: ['晴れた空って、こんなにきれいだったんだね。', 'この傘、ずっと大事にするね。……また遊びに来てね！'] };
    },
  },
];

export function createNPCs(scene) {
  state.npcs = DEFS.map((def) => {
    const root = new THREE.Group();
    let model;
    let tail = null;
    if (def.cat) {
      const c = makeCat();
      model = c.group;
      tail = c.tail;
    } else {
      model = makePerson({ ...def.look, scale: def.scale || 1 }).group;
    }
    root.add(model);
    const label = makeLabel(def.name, def.id === 'spirit' ? '#bfe9ff' : '#ffffff');
    label.position.y = def.cat ? 1.1 : 2.6 * (def.scale || 1) + 0.2;
    root.add(label);
    root.position.set(def.x, heightAt(def.x, def.z), def.z);
    root.rotation.y = Math.atan2(-def.x, -def.z);
    const shadow = makeShadow(def.cat ? 0.4 : 0.5);
    shadow.position.set(def.x, root.position.y + 0.04, def.z);
    scene.add(root, shadow);
    if (!def.visible) world.colliders.push({ x: def.x, z: def.z, r: def.cat ? 0.4 : 0.5 });
    return { def, root, model, tail, shadow, pos: root.position, phase: Math.random() * 6 };
  });
}

export function updateNPCs(dt, playerPos) {
  for (const n of state.npcs) {
    const vis = n.def.visible ? n.def.visible() : true;
    n.root.visible = vis;
    n.shadow.visible = vis;
    if (!vis) continue;
    n.phase += dt;
    n.model.position.y = Math.abs(Math.sin(n.phase * 1.5)) * 0.03;
    if (n.tail) n.tail.rotation.z = Math.sin(n.phase * 3) * 0.5;
    const dx = playerPos.x - n.pos.x;
    const dz = playerPos.z - n.pos.z;
    if (dx * dx + dz * dz < 36) n.root.rotation.y = lerpAngle(n.root.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 5));
  }
}

export function nearestNPC(pos) {
  let best = null;
  let bd = 3.0;
  for (const n of state.npcs) {
    if (!n.root.visible) continue;
    const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function npcById(id) {
  return state.npcs.find((n) => n.def.id === id);
}

export async function talkTo(npc) {
  const p = state.player;
  p.facing = Math.atan2(npc.pos.x - p.pos.x, npc.pos.z - p.pos.z);
  p.root.rotation.y = p.facing;
  npc.root.rotation.y = Math.atan2(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z);
  sfx('talk');
  const r = npc.def.talk();
  await ui.dialog(npc.def.name, r.lines);
  r.after?.();
}

