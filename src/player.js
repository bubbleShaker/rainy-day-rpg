import * as THREE from 'three';
import { makePerson, makeShadow, lerpAngle } from './models.js';
import { heightAt, resolveCollision } from './world.js';
import { getMove, consume, isHeld } from './input.js';
import { state } from './state.js';
import { hitArc, hitRadius, nearestEnemy, splash, ringFx } from './combat.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
import { save } from './save.js';

const SPAWN = new THREE.Vector3(0, 0, 8);
const tmp = new THREE.Vector3();

export class Player {
  constructor(scene) {
    this.model = makePerson({ coat: 0xf2c230, hood: true, umbrella: 0xd9434b, boots: 0x2a3a55 });
    this.root = new THREE.Group();
    this.root.add(this.model.group);
    this.shadow = makeShadow(0.55);
    scene.add(this.root, this.shadow);
    this.pos = this.root.position;
    this.dodgeDir = new THREE.Vector3();
    this.skillMax = 5;
    this.resetStats();
    this.respawn();
  }

  resetStats() {
    this.level = 1;
    this.exp = 0;
    this.maxHp = 100;
    this.hp = 100;
    this.atk = 12;
  }

  get nextExp() { return Math.floor(18 * Math.pow(this.level, 1.6)); }

  respawn() {
    this.pos.copy(SPAWN);
    this.pos.y = heightAt(SPAWN.x, SPAWN.z);
    this.facing = Math.PI;
    this.hp = this.maxHp;
    this.attackCd = 0; this.swingT = 0; this.swingDur = 0.28; this.combo = 0; this.comboT = 0;
    this.dodgeT = 0; this.dodgeCd = 0; this.skillCd = 0; this.spinT = 0;
    this.invuln = 0; this.hurtT = 0; this.blinkT = 0;
    this.walk = 0; this.stepT = 0; this.barrierMsgT = 0;
  }

  update(dt, camYaw) {
    this.attackCd -= dt; this.dodgeCd -= dt; this.swingT -= dt; this.spinT -= dt;
    this.comboT -= dt; this.invuln -= dt; this.hurtT -= dt; this.blinkT -= dt; this.barrierMsgT -= dt;
    this.skillCd = Math.max(0, this.skillCd - dt);

    const mv = getMove();
    const fwdX = -Math.sin(camYaw);
    const fwdZ = -Math.cos(camYaw);
    const rX = Math.cos(camYaw);
    const rZ = -Math.sin(camYaw);
    const mx = rX * mv.x + fwdX * mv.y;
    const mz = rZ * mv.x + fwdZ * mv.y;
    const mag = Math.hypot(mx, mz);
    let moving = false;

    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.pos.x += this.dodgeDir.x * 15 * dt;
      this.pos.z += this.dodgeDir.z * 15 * dt;
      moving = true;
    } else if (mag > 0.05) {
      const slow = this.swingT > 0 ? 0.35 : this.spinT > 0 ? 0.6 : 1;
      this.pos.x += mx * 6.4 * slow * dt;
      this.pos.z += mz * 6.4 * slow * dt;
      if (this.swingT <= 0) this.facing = lerpAngle(this.facing, Math.atan2(mx, mz), 1 - Math.exp(-dt * 14));
      moving = true;
    }
    if (resolveCollision(this.pos, 0.45, true) === 'barrier' && this.barrierMsgT <= 0) {
      this.barrierMsgT = 4;
      ui.message('ふしぎな結界に はばまれた…（晴れのかけらが必要だ）');
      sfx('barrier');
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);

    if (consume('dodge') && this.dodgeCd <= 0) {
      if (mag > 0.1) this.dodgeDir.set(mx / mag, 0, mz / mag);
      else this.dodgeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.facing = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
      this.dodgeT = 0.22;
      this.invuln = Math.max(this.invuln, 0.35);
      this.dodgeCd = 0.6;
      sfx('dash');
      splash(this.pos, 0x9fd3ff, 10, 3, 0.07, 3);
    }
    if ((consume('attack') || isHeld('attack')) && this.attackCd <= 0 && this.dodgeT <= 0) this.attack();
    if (consume('skill')) this.spin();
    if (consume('item')) this.useCocoa();

    this.animate(dt, moving);
  }

  attack() {
    const tgt = nearestEnemy(this.pos, 4.5);
    if (tgt) this.facing = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
    this.comboT = 0.9;
    const finisher = this.combo === 2;
    this.attackCd = finisher ? 0.55 : 0.32;
    this.swingDur = finisher ? 0.36 : 0.26;
    this.swingT = this.swingDur;
    sfx('swing');
    const mult = [1, 1.1, 1.6][this.combo];
    hitArc(this.pos, this.facing, finisher ? 2.9 : 2.4, Math.cos(1.1), this.atk * mult, finisher ? 7 : 3.5);
    tmp.set(this.pos.x + Math.sin(this.facing) * 1.5, this.pos.y + 1, this.pos.z + Math.cos(this.facing) * 1.5);
    splash(tmp, 0xcfe8ff, finisher ? 10 : 5, 3, 0.06, 2);
  }

  spin() {
    if (this.skillCd > 0) return;
    this.skillCd = this.skillMax;
    this.spinT = 0.55;
    this.invuln = Math.max(this.invuln, 0.3);
    sfx('spin');
    ringFx(this.pos, 4.8, 0xbfe6ff, 0.5);
    tmp.set(this.pos.x, this.pos.y + 1, this.pos.z);
    splash(tmp, 0x9fd3ff, 24, 8, 0.09, 3);
    hitRadius(this.pos, 4.2, this.atk * 2.2, 9);
  }

  useCocoa() {
    if (state.items.cocoa <= 0) { ui.message('ココアを持っていない…'); return; }
    if (this.hp >= this.maxHp) { ui.message('HPは まんたんだ'); return; }
    const heal = Math.ceil(this.maxHp * 0.5);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    state.items.cocoa--;
    ui.popText(this.pos, `+${heal}`, 'heal');
    ui.message('あたたかいココアを飲んだ。ほっとする…');
    sfx('heal');
    ringFx(this.pos, 2, 0x9dffb0, 0.6);
    save();
  }

  animate(dt, moving) {
    const m = this.model;
    this.root.rotation.y = this.facing;
    if (moving) this.walk += dt * 11;
    const sw = moving ? Math.sin(this.walk) : 0;
    m.group.position.y = moving ? Math.abs(Math.sin(this.walk)) * 0.07 : 0;
    m.bootL.position.z = sw * 0.18;
    m.bootR.position.z = -sw * 0.18;
    m.body.rotation.z = sw * 0.04;

    const u = m.umbrella;
    if (this.spinT > 0) {
      m.group.rotation.y = (1 - this.spinT / 0.55) * Math.PI * 4;
      u.rotation.set(0, 0, 1.35);
    } else {
      m.group.rotation.y = 0;
      if (this.swingT > 0) {
        const s = 1 - this.swingT / this.swingDur;
        const a = Math.sin(s * Math.PI);
        if (this.combo === 1) u.rotation.set(0.6 + a * 0.6, 0, 0.12 - a * 1.5);
        else u.rotation.set(-0.3 + a * 2.0, 0, 0.12 + (this.combo === 2 ? a * 0.3 : 0));
      } else {
        const k = 1 - Math.exp(-dt * 10);
        u.rotation.x += ((moving ? 0.25 : 0) - u.rotation.x) * k;
        u.rotation.z += (0.12 - u.rotation.z) * k;
        u.rotation.y = 0;
      }
    }

    m.bodyMat.emissive.setHex(this.hurtT > 0 ? 0x661111 : 0x000000);
    this.root.visible = !(this.blinkT > 0 && Math.floor(this.blinkT * 20) % 2 === 0);
    this.shadow.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z);

    if (moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.3;
        tmp.set(this.pos.x, this.pos.y + 0.05, this.pos.z);
        splash(tmp, 0xa9c9e8, 3, 1.5, 0.05, 1.8);
        sfx('step');
      }
    }
  }
}
