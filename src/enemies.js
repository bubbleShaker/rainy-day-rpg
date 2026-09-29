import * as THREE from 'three';
import { state } from './state.js';
import { heightAt, resolveCollision, SHRINE, ZONES } from './world.js';
import { makeShadow, makeLabel, glowTexture, lerpAngle, phong } from './models.js';
import { damagePlayer, splash, ringFx } from './combat.js';
import { sfx, thunder } from './audio.js';

let scene = null;
const tmp = new THREE.Vector3();

// ---------- モデル ----------
const GEO = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  small: new THREE.SphereGeometry(1, 8, 6),
  wing: new THREE.BoxGeometry(0.9, 0.05, 0.45),
  leafHat: new THREE.ConeGeometry(0.35, 0.18, 8),
  bolt: new THREE.BoxGeometry(0.06, 0.5, 0.06),
};
const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

function mesh(geo, mat, x, y, z, sx, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

function buildSlime() {
  const g = new THREE.Group();
  const body = mesh(GEO.sphere, phong(0x5fb7e8, { shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.85, emissive: 0x0a2233 }), 0, 0.45, 0, 0.6, 0.48, 0.6);
  g.add(body);
  g.add(mesh(GEO.small, black, -0.18, 0.58, 0.5, 0.06));
  g.add(mesh(GEO.small, black, 0.18, 0.58, 0.5, 0.06));
  g.add(mesh(GEO.small, white, -0.22, 0.72, 0.38, 0.09));
  g.userData.body = body;
  return g;
}

function buildFrog() {
  const g = new THREE.Group();
  const skin = phong(0x4f8a3c, { shininess: 90, specular: 0x88aa88 });
  g.add(mesh(GEO.sphere, skin, 0, 0.4, 0, 0.6, 0.42, 0.66));
  g.add(mesh(GEO.sphere, phong(0xd8e6a0), 0, 0.32, 0.22, 0.45, 0.3, 0.45));
  for (const sx of [-1, 1]) {
    g.add(mesh(GEO.small, white, sx * 0.25, 0.78, 0.28, 0.16));
    g.add(mesh(GEO.small, black, sx * 0.25, 0.8, 0.41, 0.07));
    g.add(mesh(GEO.sphere, skin, sx * 0.48, 0.18, -0.2, 0.22, 0.14, 0.34));
  }
  const hat = new THREE.Mesh(GEO.leafHat, phong(0x6fbf4a, { side: THREE.DoubleSide }));
  hat.position.set(0, 0.95, 0);
  g.add(hat);
  return g;
}

function buildBat() {
  const g = new THREE.Group();
  const cloud = phong(0x4a5262, { emissive: 0x0a0c14 });
  g.add(mesh(GEO.sphere, cloud, 0, 0, 0, 0.45));
  g.add(mesh(GEO.sphere, cloud, -0.35, -0.05, -0.05, 0.32));
  g.add(mesh(GEO.sphere, cloud, 0.35, -0.05, -0.05, 0.32));
  const eye = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  g.add(mesh(GEO.small, eye, -0.14, 0.08, 0.4, 0.07));
  g.add(mesh(GEO.small, eye, 0.14, 0.08, 0.4, 0.07));
  const wm = phong(0x2c3140, { side: THREE.DoubleSide });
  const wings = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.45, 0.05, 0);
    const w = new THREE.Mesh(GEO.wing, wm);
    w.position.x = sx * 0.45;
    pivot.add(w);
    g.add(pivot);
    wings.push(pivot);
  }
  const bolt = new THREE.Mesh(GEO.bolt, new THREE.MeshBasicMaterial({ color: 0xfff27a }));
  bolt.position.set(0, -0.5, 0);
  bolt.rotation.z = 0.4;
  g.add(bolt);
  g.userData.wings = wings;
  return g;
}

function buildStorm() {
  const g = new THREE.Group();
  const cloud = phong(0x2e3440, { emissive: 0x10141f, shininess: 10 });
  const puffs = [[0, 0, 0, 1.3], [-1.1, -0.2, 0, 0.95], [1.1, -0.2, 0, 0.95], [0, 0.7, -0.3, 0.9], [-0.6, 0.5, 0.4, 0.7], [0.6, 0.5, 0.4, 0.7], [0, -0.5, 0.2, 0.9]];
  for (const [x, y, z, s] of puffs) g.add(mesh(GEO.sphere, cloud, x, y, z, s));
  const eye = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  g.add(mesh(GEO.small, eye, -0.38, 0.2, 1.18, 0.16, 0.1, 0.1));
  g.add(mesh(GEO.small, eye, 0.38, 0.2, 1.18, 0.16, 0.1, 0.1));
  const tearMat = new THREE.MeshBasicMaterial({ color: 0x7fc8ff });
  const tears = [];
  for (let i = 0; i < 6; i++) {
    const t = mesh(GEO.small, tearMat, (i % 2 ? 0.38 : -0.38), 0, 1.15, 0.07, 0.1, 0.07);
    t.userData.off = i / 6;
    g.add(t);
    tears.push(t);
  }
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff27a });
  const bolts = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(GEO.bolt, boltMat);
    b.scale.set(2, 2, 2);
    g.add(b);
    bolts.push(b);
  }
  g.userData.tears = tears;
  g.userData.bolts = bolts;
  return g;
}

// ---------- 種類ごとのパラメータ ----------
const TYPES = {
  slime: {
    name: 'しずくスライム', hp: 30, atk: 7, speed: 2.3, exp: 8, radius: 0.6, range: 1.5, aggro: 10,
    windup: 0.6, lunge: 8, lungeTime: 0.2, barY: 1.3, build: buildSlime,
    anim(e, t, moving) {
      const k = 1 + Math.sin(t * (moving ? 10 : 5)) * 0.1;
      e.model.scale.set(e.scale / Math.sqrt(k), e.scale * k, e.scale / Math.sqrt(k));
      return 0;
    },
  },
  frog: {
    name: '水たまりガエル', hp: 50, atk: 10, speed: 3.0, exp: 13, radius: 0.7, range: 2.4, aggro: 11,
    windup: 0.5, lunge: 11, lungeTime: 0.28, barY: 1.4, build: buildFrog,
    anim(e, t, moving) {
      if (e.st === 'lunge') return Math.sin((e.stT / e.T.lungeTime) * Math.PI) * 1.2 * e.scale;
      return moving ? Math.abs(Math.sin(t * 7)) * 0.45 * e.scale : 0;
    },
  },
  bat: {
    name: '雷雲コウモリ', hp: 44, atk: 13, speed: 4.0, exp: 17, radius: 0.6, range: 2.2, aggro: 13,
    windup: 0.45, lunge: 12, lungeTime: 0.25, barY: 1.1, fly: 1.5, build: buildBat,
    anim(e, t) {
      const f = Math.sin(t * 16) * 0.7;
      e.model.userData.wings[0].rotation.z = f;
      e.model.userData.wings[1].rotation.z = -f;
      return 1.5 * e.scale + Math.sin(t * 2.3) * 0.25 - (e.st === 'lunge' ? 0.8 : 0);
    },
  },
  storm: {
    name: '嵐の精', hp: 900, atk: 17, speed: 2.6, exp: 0, radius: 1.6, range: 3.0, aggro: 40,
    windup: 0.75, lunge: 10, lungeTime: 0.3, barY: 2.2, fly: 2.2, build: buildStorm,
    anim(e, t) {
      const ud = e.model.userData;
      for (const tr of ud.tears) {
        const k = (t * 0.9 + tr.userData.off) % 1;
        tr.position.y = 0.1 - k * 2.2;
        tr.visible = k < 0.9;
      }
      ud.bolts.forEach((b, i) => {
        b.visible = Math.random() < 0.3;
        const a = t * 2 + i * 1.6;
        b.position.set(Math.cos(a) * 1.8, Math.sin(t * 3 + i) * 0.8, Math.sin(a) * 1.8);
        b.rotation.z = Math.random() * 2;
      });
      e.model.rotation.z = Math.sin(t * 1.3) * 0.08;
      return 2.2 + Math.sin(t * 1.7) * 0.3;
    },
  },
};

// ---------- HPバー ----------
const barBgMat = new THREE.SpriteMaterial({ color: 0x111111, depthTest: false, transparent: true, opacity: 0.7, fog: false });

// ---------- 敵 ----------
class Enemy {
  constructor(type, x, z, opts = {}) {
    const T = TYPES[type];
    this.T = T;
    this.type = type;
    this.leader = !!opts.leader;
    this.boss = !!opts.boss;
    this.minion = !!opts.minion;
    this.shard = opts.shard ?? -1;
    this.scale = this.leader ? 1.7 : 1;
    this.name = opts.name || T.name;
    this.maxHp = Math.round(T.hp * (this.leader ? 5 : 1));
    this.hp = this.maxHp;
    this.atk = Math.round(T.atk * (this.leader ? 1.35 : 1));
    this.exp = Math.round(T.exp * (this.leader ? 5 : 1));
    this.speed = T.speed * (this.leader ? 0.9 : 1);
    this.radius = T.radius * this.scale;
    this.range = T.range * (this.leader ? 1.3 : 1);
    this.barY = T.barY * this.scale + (T.fly ? T.fly * this.scale : 0);
    this.canRespawn = !this.leader && !this.boss && !this.minion;
    this.home = new THREE.Vector3(x, 0, z);
    this.root = new THREE.Group();
    this.model = T.build();
    this.model.scale.setScalar(this.scale);
    this.root.add(this.model);
    this.pos = this.root.position;
    this.shadow = makeShadow(this.radius * 1.1);
    this.knock = new THREE.Vector3();
    this.lungeDir = new THREE.Vector3();
    this.mats = [];
    this.model.traverse((o) => { if (o.material && o.material.emissive) this.mats.push({ m: o.material, base: o.material.emissive.getHex() }); });

    if (!this.boss) {
      this.bar = new THREE.Group();
      this.bar.position.y = this.barY + 0.3;
      const bg = new THREE.Sprite(barBgMat);
      bg.scale.set(1.1 * Math.sqrt(this.scale), 0.13, 1);
      this.fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: this.leader ? 0xffa24d : 0xff5a5a, depthTest: false, fog: false }));
      this.fg.scale.copy(bg.scale);
      this.barW = bg.scale.x;
      bg.renderOrder = 10; this.fg.renderOrder = 11;
      this.bar.add(bg, this.fg);
      this.root.add(this.bar);
      if (this.leader) {
        const label = makeLabel(this.name, '#ffd08a');
        label.position.y = this.barY + 0.75;
        this.root.add(label);
      }
    }
    scene.add(this.root, this.shadow);
    this.revive(true);
  }

  revive(first = false) {
    this.dead = false;
    this.hp = this.maxHp;
    this.st = 'idle';
    this.stT = 0;
    this.t = Math.random() * 10;
    this.hitT = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.wander = null;
    this.wanderT = Math.random() * 3;
    this.root.visible = true;
    this.shadow.visible = true;
    this.model.scale.setScalar(this.scale);
    if (!first) splash(tmp.set(this.home.x, heightAt(this.home.x, this.home.z) + 0.5, this.home.z), 0x8fd0ff, 10, 3);
    this.pos.set(this.home.x, heightAt(this.home.x, this.home.z), this.home.z);
    this.knock.set(0, 0, 0);
  }

  kill() {
    this.dead = true;
    this.hp = 0;
    this.deadT = 0;
    this.respawnT = 28 + Math.random() * 10;
  }

  aggro() {
    if (this.st === 'idle' || this.st === 'return') this.setState('chase');
  }

  setState(s) { this.st = s; this.stT = 0; }

  remove() {
    scene.remove(this.root, this.shadow);
  }

  update(dt, player, others) {
    if (this.dead) {
      this.deadT += dt;
      const k = Math.max(0, 1 - this.deadT / 0.4);
      this.model.scale.setScalar(this.scale * k + 0.001);
      if (this.deadT > 0.4) { this.root.visible = false; this.shadow.visible = false; }
      if (this.canRespawn) {
        this.respawnT -= dt;
        if (this.respawnT <= 0 && Math.hypot(player.pos.x - this.home.x, player.pos.z - this.home.z) > 22) this.revive();
      }
      return;
    }
    const T = this.T;
    this.t += dt;
    this.stT += dt;
    this.hitT -= dt;

    if (this.knock.lengthSq() > 0.01) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.pow(0.004, dt));
    }

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const fromHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    let moving = false;
    const face = (ax, az, k = 10) => { this.facing = lerpAngle(this.facing, Math.atan2(ax, az), 1 - Math.exp(-dt * k)); };
    const moveTo = (ax, az, sp) => {
      const l = Math.hypot(ax, az);
      if (l < 0.01) return;
      this.pos.x += (ax / l) * sp * dt;
      this.pos.z += (az / l) * sp * dt;
      face(ax, az);
      moving = true;
    };

    switch (this.st) {
      case 'idle': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 6;
          this.wander = Math.random() < 0.4 ? null : { x: this.home.x + Math.sin(a) * r, z: this.home.z + Math.cos(a) * r };
        }
        if (this.wander) {
          const wx = this.wander.x - this.pos.x;
          const wz = this.wander.z - this.pos.z;
          if (Math.hypot(wx, wz) > 0.5) moveTo(wx, wz, this.speed * 0.35); else this.wander = null;
        }
        if (d < T.aggro * (this.leader ? 1.1 : 1) && player.hp > 0) this.setState('chase');
        break;
      }
      case 'chase': {
        if (!this.boss && (fromHome > 26 || d > T.aggro * 2.2)) { this.setState('return'); break; }
        if (d > this.range) moveTo(dx, dz, this.speed);
        else { face(dx, dz, 14); this.setState('windup'); }
        break;
      }
      case 'windup': {
        face(dx, dz, 6);
        if (this.stT >= T.windup) {
          this.lungeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
          this.hitDone = false;
          this.setState('lunge');
        }
        break;
      }
      case 'lunge': {
        this.pos.x += this.lungeDir.x * T.lunge * dt;
        this.pos.z += this.lungeDir.z * T.lunge * dt;
        if (!this.hitDone && d < this.radius + 0.6) {
          this.hitDone = true;
          damagePlayer(this.atk);
        }
        if (this.stT >= T.lungeTime) this.setState('recover');
        break;
      }
      case 'recover': {
        if (this.stT > (this.boss ? 0.5 : 0.75)) this.setState('chase');
        break;
      }
      case 'return': {
        moveTo(this.home.x - this.pos.x, this.home.z - this.pos.z, this.speed * 1.4);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
        if (fromHome < 1.5) { this.hp = this.maxHp; this.setState('idle'); }
        break;
      }
      default: break;
    }

    // 敵どうしの押し合い
    for (const o of others) {
      if (o === this || o.dead) continue;
      const ox = this.pos.x - o.pos.x;
      const oz = this.pos.z - o.pos.z;
      const min = this.radius + o.radius;
      const od = Math.hypot(ox, oz);
      if (od < min && od > 0.001) {
        const push = (min - od) * 0.5;
        this.pos.x += (ox / od) * push;
        this.pos.z += (oz / od) * push;
      }
    }
    resolveCollision(this.pos, this.radius * 0.8);
    if (this.boss) {
      const hx = this.pos.x - this.home.x;
      const hz = this.pos.z - this.home.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 10) { this.pos.x = this.home.x + hx / hd * 10; this.pos.z = this.home.z + hz / hd * 10; }
    }

    const ground = heightAt(this.pos.x, this.pos.z);
    const yOff = T.anim(this, this.t, moving);
    this.pos.y = ground;
    this.model.position.y = yOff;
    this.root.rotation.y = 0;
    this.model.rotation.y = this.facing;
    this.shadow.position.set(this.pos.x, ground + 0.04, this.pos.z);

    // 攻撃予兆・被弾時の発光
    let em = null;
    if (this.hitT > 0) em = 0x777777;
    else if (this.st === 'windup') em = Math.floor(this.stT * 12) % 2 ? 0x884400 : 0x442200;
    for (const { m, base } of this.mats) m.emissive.setHex(em ?? base);
    if (this.st === 'windup') {
      const s = this.scale * (1 + Math.min(1, this.stT / T.windup) * 0.15);
      if (this.type !== 'slime') this.model.scale.setScalar(s);
    } else if (this.type !== 'slime') {
      this.model.scale.setScalar(this.scale);
    }

    if (this.bar) {
      const r = Math.max(0.001, this.hp / this.maxHp);
      this.bar.visible = this.leader || r < 0.999;
      this.fg.scale.x = this.barW * r;
      this.fg.center.set(0.5 / r, 0.5);
    }
  }
}

// ---------- ボス ----------
const teleGeo = new THREE.CircleGeometry(2.6, 28);
teleGeo.rotateX(-Math.PI / 2);
const boltGeo = new THREE.CylinderGeometry(0.3, 0.3, 30, 6);
boltGeo.translate(0, 15, 0);

class Boss extends Enemy {
  constructor(x, z) {
    super('storm', x, z, { boss: true });
    this.castT = 3;
    this.strikes = [];
    this.summoned = 0;
  }

  update(dt, player, others) {
    super.update(dt, player, others);
    if (this.dead) { this.clearStrikes(); return; }
    this.castT -= dt;
    const enraged = this.hp < this.maxHp / 2;
    if (this.castT <= 0) {
      this.castT = enraged ? 3.2 : 4.6;
      const targets = [[player.pos.x, player.pos.z]];
      if (enraged) {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          targets.push([player.pos.x + Math.sin(a) * 4, player.pos.z + Math.cos(a) * 4]);
        }
      }
      for (const [x, z] of targets) this.addStrike(x, z);
      sfx('barrier');
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      if (s.t < 1.1) {
        s.tele.material.opacity = 0.25 + Math.abs(Math.sin(s.t * 12)) * 0.25;
        s.tele.scale.setScalar(0.4 + Math.min(1, s.t / 0.5) * 0.6);
      } else if (!s.fired) {
        s.fired = true;
        s.tele.visible = false;
        s.bolt.visible = true;
        state.weather?.flash(0.55, false);
        thunder(0, 0.9);
        tmp.set(s.x, heightAt(s.x, s.z) + 0.2, s.z);
        splash(tmp, 0xfff27a, 14, 6, 0.1, 6);
        ringFx(tmp, 2.8, 0xfff27a, 0.35);
        if (Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 2.6) damagePlayer(this.atk * 1.2);
      } else {
        s.bolt.material.opacity = Math.max(0, 1 - (s.t - 1.1) / 0.25);
        if (s.t > 1.35) { scene.remove(s.tele, s.bolt); this.strikes.splice(i, 1); }
      }
    }
    const ratio = this.hp / this.maxHp;
    if ((this.summoned === 0 && ratio < 0.66) || (this.summoned === 1 && ratio < 0.33)) {
      this.summoned++;
      for (const sx of [-3, 3]) {
        const e = addEnemy('slime', this.pos.x + sx, this.pos.z + 3, { minion: true });
        e.setState('chase');
      }
    }
  }

  addStrike(x, z) {
    const y = heightAt(x, z);
    const tele = new THREE.Mesh(teleGeo, new THREE.MeshBasicMaterial({ color: 0xff4a6a, transparent: true, opacity: 0.3, depthWrite: false }));
    tele.position.set(x, y + 0.08, z);
    const bolt = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 1, fog: false }));
    bolt.position.set(x, y, z);
    bolt.visible = false;
    scene.add(tele, bolt);
    this.strikes.push({ x, z, t: 0, tele, bolt, fired: false });
  }

  clearStrikes() {
    for (const s of this.strikes) scene.remove(s.tele, s.bolt);
    this.strikes.length = 0;
  }

  remove() {
    this.clearStrikes();
    super.remove();
  }
}

// ---------- 管理 ----------
export function initEnemies(sc) { scene = sc; }

export function addEnemy(type, x, z, opts) {
  const e = new Enemy(type, x, z, opts);
  state.enemies.push(e);
  return e;
}

export function removeEnemy(e) {
  e.remove();
  const i = state.enemies.indexOf(e);
  if (i >= 0) state.enemies.splice(i, 1);
}

export function clearEnemies() {
  for (const e of state.enemies) e.remove();
  state.enemies.length = 0;
}

function scatter(type, cx, cz, n, r) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const rr = 5 + Math.random() * (r - 5);
    addEnemy(type, cx + Math.sin(a) * rr, cz + Math.cos(a) * rr);
  }
}

export function spawnWorldEnemies() {
  for (const [x, z] of [[-42, 3], [-47, -4], [42, -3], [46, 5], [3, -40], [-3, 44]]) addEnemy('slime', x, z);
  scatter('slime', ZONES[0].x, ZONES[0].z, 8, 18);
  scatter('frog', ZONES[1].x, ZONES[1].z, 7, 16);
  scatter('bat', ZONES[2].x, ZONES[2].z, 7, 13);
  if (!state.shards[0]) addEnemy('slime', -74, -10, { leader: true, shard: 0, name: '大しずくスライム' });
  if (!state.shards[1]) addEnemy('frog', 74, 4, { leader: true, shard: 1, name: 'ガマ親分' });
  if (!state.shards[2]) addEnemy('bat', 8, 72, { leader: true, shard: 2, name: '雷雲コウモリ王' });
}

export function spawnBoss() {
  const b = new Boss(SHRINE.x, SHRINE.z - 3);
  b.setState('chase');
  state.enemies.push(b);
  return b;
}

export function calmEnemies() {
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.pos.set(e.home.x, heightAt(e.home.x, e.home.z), e.home.z);
    e.hp = e.maxHp;
    e.setState('idle');
  }
}

export function updateEnemies(dt, player) {
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) list[i].update(dt, player, list);
}

// ---------- 拾えるもの ----------
const pickups = [];
const shardGeo = new THREE.OctahedronGeometry(0.42);
const mugGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.3, 12);
const beamGeo = new THREE.CylinderGeometry(0.25, 0.25, 30, 8, 1, true);
beamGeo.translate(0, 15, 0);

export function spawnPickup(kind, pos, data) {
  const g = new THREE.Group();
  const y = heightAt(pos.x, pos.z);
  g.position.set(pos.x, y, pos.z);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: kind === 'shard' ? 0xffe38a : 0xffb070,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.setScalar(kind === 'shard' ? 2.4 : 1.2);
  const item = kind === 'shard'
    ? new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }))
    : new THREE.Mesh(mugGeo, phong(0xf4f0e8, { emissive: 0x332211 }));
  item.position.y = 1;
  glow.position.y = 1;
  g.add(item, glow);
  if (kind === 'shard') {
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffe38a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    g.add(beam);
  }
  scene.add(g);
  pickups.push({ kind, data, g, item, t: 0 });
}

export function clearPickups() {
  for (const p of pickups) scene.remove(p.g);
  pickups.length = 0;
}

export function pickupList() { return pickups; }

export function updatePickups(dt, player) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt;
    p.item.rotation.y += dt * 2.5;
    p.item.position.y = 1 + Math.sin(p.t * 3) * 0.15;
    if (p.kind === 'cocoa' && p.t > 40) { scene.remove(p.g); pickups.splice(i, 1); continue; }
    if (p.t > 0.5 && Math.hypot(player.pos.x - p.g.position.x, player.pos.z - p.g.position.z) < 1.4) {
      scene.remove(p.g);
      pickups.splice(i, 1);
      state.onPickup?.(p.kind, p.data, p.g.position);
    }
  }
}
