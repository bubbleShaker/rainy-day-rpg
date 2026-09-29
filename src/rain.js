import * as THREE from 'three';
import { heightAt } from './world.js';
import * as ui from './ui.js';
import { thunder, setRain } from './audio.js';

const RAIN_SKY = new THREE.Color(0x3a4350);
const CLEAR_SKY = new THREE.Color(0x8ec5f0);
const RAIN_HEMI = new THREE.Color(0x9aaabf);
const CLEAR_HEMI = new THREE.Color(0xe4f1ff);
const RAIN_DIR = new THREE.Color(0xb8c6d8);
const CLEAR_DIR = new THREE.Color(0xfff0d0);

// 雨・波紋・稲光・晴れ上がり・虹をまとめて管理する
export class Weather {
  constructor(scene, lowSpec) {
    this.scene = scene;
    this.intensity = 1;
    this.target = 1;
    this.flashV = 0;
    this.lightT = 5 + Math.random() * 6;
    this.lastAudio = -1;

    scene.background = RAIN_SKY.clone();
    scene.fog = new THREE.Fog(RAIN_SKY.clone(), 14, 80);
    this.hemi = new THREE.HemisphereLight(RAIN_HEMI.clone(), 0x2c3526, 1.6);
    this.dir = new THREE.DirectionalLight(RAIN_DIR.clone(), 0.7);
    this.dir.position.set(-30, 60, 25);
    scene.add(this.hemi, this.dir);
    this.baseHemi = 1.6;
    this.baseDir = 0.7;

    // 雨粒: 各粒を短い線分で描く。プレイヤーの周囲の箱の中で循環させる
    this.N = lowSpec ? 1500 : 3600;
    this.area = 38;
    this.drops = new Float32Array(this.N * 3);
    this.speeds = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * this.area;
      this.drops[i * 3 + 1] = Math.random() * 24;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * this.area;
      this.speeds[i] = 20 + Math.random() * 8;
    }
    this.posArr = new Float32Array(this.N * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xb4c8de, transparent: true, opacity: 0.5, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.rainMat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);

    this.ripples = [];
    const rg = new THREE.RingGeometry(0.75, 1, 20);
    rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < (lowSpec ? 24 : 48); i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xcfe0f0, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.ripples.push({ mesh: m, t: 1 });
    }
    this.rippleIdx = 0;

    this.rainbow = new THREE.Group();
    const cols = [0xff4d4d, 0xff9a3c, 0xffe45c, 0x5ee07a, 0x4db8ff, 0x5a6bff, 0xb06bff];
    cols.forEach((c, i) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(95 - i * 1.7, 0.9, 6, 90, Math.PI),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      this.rainbow.add(m);
    });
    this.rainbow.position.set(0, -12, 200);
    this.rainbow.visible = false;
    this.rainbowV = 0;
    scene.add(this.rainbow);
    this.applyColors();
  }

  setInstant(v) {
    this.intensity = this.target = v;
    this.rainbowV = v < 0.35 ? 1 : 0;
    this.rainbow.visible = v < 0.35;
    this.applyColors();
  }

  clearUp() { this.target = 0; }

  flash(v = 1, withThunder = true, delay) {
    this.flashV = Math.max(this.flashV, v);
    ui.flash(v * 0.5);
    if (withThunder) thunder(delay ?? 0.25 + Math.random() * 1.3, 0.45 + v * 0.45);
  }

  applyColors() {
    const k = 1 - this.intensity;
    this.scene.background.copy(RAIN_SKY).lerp(CLEAR_SKY, k);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.near = 14 + k * 50;
    this.scene.fog.far = 80 + k * 200;
    this.hemi.color.copy(RAIN_HEMI).lerp(CLEAR_HEMI, k);
    this.dir.color.copy(RAIN_DIR).lerp(CLEAR_DIR, k);
    this.baseHemi = 1.6 + k * 0.5;
    this.baseDir = 0.7 + k * 1.9;
    this.rainMat.opacity = 0.5 * Math.min(1, this.intensity * 1.5);
  }

  spawnRipple(x, y, z) {
    const r = this.ripples[this.rippleIdx];
    this.rippleIdx = (this.rippleIdx + 1) % this.ripples.length;
    r.t = 0;
    r.mesh.position.set(x, y + 0.04, z);
    r.mesh.visible = true;
  }

  update(dt, center) {
    if (this.intensity !== this.target) {
      const rate = this.target < this.intensity ? 0.18 : 1;
      const diff = this.target - this.intensity;
      this.intensity += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
      this.applyColors();
    }
    if (Math.abs(this.lastAudio - this.intensity) > 0.01) {
      this.lastAudio = this.intensity;
      setRain(this.intensity);
    }

    if (this.intensity > 0.7) {
      this.lightT -= dt;
      if (this.lightT <= 0) {
        this.lightT = 8 + Math.random() * 14;
        this.flash(0.6 + Math.random() * 0.4);
      }
    }
    this.flashV = Math.max(0, this.flashV - dt * 3.2);
    const flick = this.flashV > 0 ? this.flashV * (0.5 + Math.random() * 0.9) : 0;
    this.hemi.intensity = this.baseHemi + flick * 4;
    this.dir.intensity = this.baseDir + flick * 2;

    // 雨粒
    const n = Math.floor(this.N * Math.min(1, this.intensity * 1.2));
    const d = this.drops;
    const p = this.posArr;
    const half = this.area / 2;
    const wind = 1.6;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let x = d[j];
      let y = d[j + 1];
      let z = d[j + 2];
      y -= this.speeds[i] * dt;
      x += wind * dt;
      if (x - center.x > half) x -= this.area; else if (x - center.x < -half) x += this.area;
      if (z - center.z > half) z -= this.area; else if (z - center.z < -half) z += this.area;
      const g = heightAt(x, z);
      if (y < g) {
        if (Math.random() < 0.012) {
          const dx = x - center.x;
          const dz = z - center.z;
          if (dx * dx + dz * dz < 260 && g > -0.5) this.spawnRipple(x, g, z);
        }
        y = center.y + 12 + Math.random() * 12;
      }
      d[j] = x; d[j + 1] = y; d[j + 2] = z;
      const k = i * 6;
      p[k] = x; p[k + 1] = y; p[k + 2] = z;
      p[k + 3] = x - wind * 0.045; p[k + 4] = y + 0.9; p[k + 5] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, n * 2);
    this.lines.visible = n > 0;

    for (const r of this.ripples) {
      if (r.t >= 1) continue;
      r.t += dt / 0.6;
      if (r.t >= 1) { r.mesh.visible = false; continue; }
      const s = 0.15 + r.t * 0.55;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = (1 - r.t) * 0.5;
    }

    if (this.intensity < 0.35) {
      this.rainbow.visible = true;
      this.rainbowV = Math.min(1, this.rainbowV + dt * 0.25);
    }
    if (this.rainbow.visible) {
      for (const m of this.rainbow.children) m.material.opacity = this.rainbowV * 0.38;
    }
  }
}
