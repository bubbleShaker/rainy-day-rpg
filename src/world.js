import * as THREE from 'three';
import { phong, makeUmbrella } from './models.js';

// 島の中央に港町アマヤド。西に森、東に沼、南に岬、北の丘の上に祠がある
export const SHRINE = { x: 0, z: -80 };
export const HILL = { x: 0, z: -80, top: 13, r: 40, h: 9 };
export const MARSH = { x: 62, z: -2 };
export const ZONES = [
  { key: 'forest', name: 'しずくの森', short: '森', x: -62, z: -6 },
  { key: 'marsh', name: 'カエル沼', short: '沼', x: 62, z: -2 },
  { key: 'cliff', name: '港の岬', short: '岬', x: 4, z: 62 },
];
export const BARRIER_R = 12;
export const WORLD_R = 91;
export const SEA_Z = 83;

export const world = {
  colliders: [],
  barrierActive: true,
  barrier: null,
  barrierV: 1,
  beam: null,
  fountain: null,
  occluders: [],
};

const smooth = (t) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};

export function heightAt(x, z) {
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  const hill = smooth(1 - (dh - HILL.top) / (HILL.r - HILL.top));
  let h = HILL.h * hill;
  const r = Math.hypot(x, z);
  const rough = smooth((r - 32) / 24) * (1 - hill);
  h += rough * (Math.sin(x * 0.09 + 1.3) * Math.cos(z * 0.07) * 1.1 + Math.sin(z * 0.13 + x * 0.05) * 0.5);
  const marsh = smooth(1 - (Math.hypot(x - MARSH.x, z - MARSH.z) - 10) / 12);
  h = h * (1 - marsh) - 0.15 * marsh;
  h -= Math.max(smooth((z - 78) / 10), smooth((r - 88) / 10)) * 4;
  return h;
}

export function onRoad(x, z, m) {
  return (Math.abs(x) < m && z < 76 && z > -68) || (Math.abs(z) < m && Math.abs(x) < 76);
}

export function resolveCollision(p, r, isPlayer = false) {
  let hit = null;
  for (const c of world.colliders) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const min = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.0001;
      p.x = c.x + (dx / d) * min;
      p.z = c.z + (dz / d) * min;
    }
  }
  const d = Math.hypot(p.x, p.z);
  if (d > WORLD_R) { p.x *= WORLD_R / d; p.z *= WORLD_R / d; }
  if (p.z > SEA_Z) p.z = SEA_Z;
  if (isPlayer && world.barrierActive) {
    const dx = p.x - SHRINE.x;
    const dz = p.z - SHRINE.z;
    const db = Math.hypot(dx, dz);
    if (db < BARRIER_R + r) {
      const k = (BARRIER_R + r) / (db || 0.0001);
      p.x = SHRINE.x + dx * k;
      p.z = SHRINE.z + dz * k;
      hit = 'barrier';
    }
  }
  return hit;
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groundColor(x, z, c) {
  const r = Math.hypot(x, z);
  const n = (Math.sin(x * 1.7) * Math.sin(z * 1.3) + Math.sin(x * 0.37 + z * 0.51)) * 0.025;
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  if (r < 15) {
    const tile = ((Math.floor(x / 1.6) + Math.floor(z / 1.6)) & 1) ? 0.03 : -0.02;
    c.setRGB(0.4 + tile + n, 0.41 + tile + n, 0.44 + tile + n, THREE.SRGBColorSpace);
  } else if (onRoad(x, z, 2.8) || (dh < 10 && dh > 7.5)) {
    c.setRGB(0.37 + n, 0.37 + n, 0.39 + n, THREE.SRGBColorSpace);
  } else if (z > 74 || r > 86) {
    c.setRGB(0.55 + n, 0.51 + n, 0.41 + n, THREE.SRGBColorSpace);
  } else if (Math.hypot(x - MARSH.x, z - MARSH.z) < 21) {
    c.setRGB(0.24 + n, 0.3 + n, 0.22 + n, THREE.SRGBColorSpace);
  } else if (r < 34) {
    c.setRGB(0.28 + n, 0.38 + n, 0.25 + n, THREE.SRGBColorSpace);
  } else {
    c.setRGB(0.24 + n, 0.36 + n, 0.21 + n, THREE.SRGBColorSpace);
  }
}

function addCollider(x, z, r) { world.colliders.push({ x, z, r }); }

function buildGround(scene) {
  const geo = new THREE.PlaneGeometry(200, 200, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    groundColor(x, z, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, shininess: 45, specular: 0x3a4450,
  }));
  scene.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshPhongMaterial({ color: 0x24394d, shininess: 100, specular: 0x6a7f95 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.1;
  scene.add(sea);
}

function buildTown(scene, R) {
  const wallCols = [0xb58b6e, 0x8e9aa8, 0xc2a47f, 0x7f9486, 0xa87474, 0x9a8fb0, 0xc9b99a];
  const roofCols = [0x7a3b36, 0x3f4f6b, 0x5b4a3a, 0x4e6b5a, 0x6b3f5a];
  const wallMats = wallCols.map((c) => phong(c));
  const roofMats = roofCols.map((c) => phong(c, { shininess: 80, specular: 0x666666 }));
  const winLit = new THREE.MeshBasicMaterial({ color: 0xffc978 });
  const winDark = new THREE.MeshBasicMaterial({ color: 0x2a3340 });
  const doorMat = phong(0x5a3a26);
  const winGeo = new THREE.PlaneGeometry(0.9, 0.9);
  const doorGeo = new THREE.PlaneGeometry(1.0, 1.7);
  const awnGeo = new THREE.BoxGeometry(1.6, 0.08, 0.7);

  for (const ring of [{ r: 22, n: 10 }, { r: 31, n: 14 }]) {
    for (let i = 0; i < ring.n; i++) {
      const a = ((i + 0.5) / ring.n) * Math.PI * 2 + (ring.r === 31 ? 0.1 : 0);
      const m = a % (Math.PI / 2);
      const margin = 7 / ring.r;
      if (m < margin || m > Math.PI / 2 - margin) continue;
      const x = Math.sin(a) * ring.r;
      const z = Math.cos(a) * ring.r;
      const w = 4.6 + R() * 1.6;
      const d = 4.6 + R() * 1.4;
      const h = 3.2 + R() * 1.6;
      const house = new THREE.Group();
      house.position.set(x, heightAt(x, z) - 0.1, z);
      house.rotation.y = Math.atan2(-x, -z);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMats[Math.floor(R() * wallMats.length)]);
      walls.position.y = h / 2;
      house.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, 2.4, 4), roofMats[Math.floor(R() * roofMats.length)]);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + 1.2;
      house.add(roof);
      for (const sx of [-1, 1]) {
        const win = new THREE.Mesh(winGeo, R() < 0.75 ? winLit : winDark);
        win.position.set(sx * w * 0.3, h * 0.62, d / 2 + 0.01);
        house.add(win);
      }
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 0.85, d / 2 + 0.01);
      house.add(door);
      const awn = new THREE.Mesh(awnGeo, roof.material);
      awn.position.set(0, 1.95, d / 2 + 0.35);
      awn.rotation.x = 0.25;
      house.add(awn);
      scene.add(house);
      world.occluders.push(house);
      addCollider(x, z, Math.max(w, d) * 0.62);
    }
  }

  // 噴水（傘の石像つき）
  const stone = phong(0x8a8f96, { shininess: 60 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.7, 28), stone);
  basin.position.y = 0.35;
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.75, 28), phong(0x3d6f91, { shininess: 120, specular: 0xaaaaaa, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.62;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), stone);
  pillar.position.y = 1.4;
  const statue = makeUmbrella(0x9ca3ab);
  statue.scale.setScalar(1.5);
  statue.position.y = 1.9;
  statue.rotation.z = 0.2;
  scene.add(basin, water, pillar, statue);
  world.occluders.push(pillar, statue);
  world.fountain = water;
  addCollider(0, 0, 3.3);

  // 街灯
  const postMat = phong(0x2a2f36, { shininess: 80 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  const postGeo = new THREE.CylinderGeometry(0.07, 0.1, 3.4, 6);
  const bulbGeo = new THREE.BoxGeometry(0.32, 0.42, 0.32);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(a) * 12.5;
    const z = Math.cos(a) * 12.5;
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 1.7, z);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, 3.5, z);
    scene.add(post, bulb);
    world.occluders.push(post);
    addCollider(x, z, 0.3);
    if (i % 2 === 0) {
      const light = new THREE.PointLight(0xffb86a, 22, 16, 1.8);
      light.position.set(x, 3.2, z);
      scene.add(light);
    }
  }

  // 水たまり
  const puddleMat = new THREE.MeshPhongMaterial({
    color: 0x1f2c3a, shininess: 140, specular: 0xb0c0d0, transparent: true, opacity: 0.85, depthWrite: false,
  });
  const pg = new THREE.CircleGeometry(1, 20);
  pg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 34; i++) {
    let x; let z;
    if (i < 20) {
      const a = R() * Math.PI * 2;
      const rr = 4 + R() * 30;
      x = Math.sin(a) * rr; z = Math.cos(a) * rr;
    } else {
      const along = (R() - 0.5) * 140;
      if (R() < 0.5) { x = (R() - 0.5) * 4; z = along; } else { x = along; z = (R() - 0.5) * 4; }
    }
    if (Math.hypot(x, z) < 3.8) continue;
    const p = new THREE.Mesh(pg, puddleMat);
    p.scale.set(0.8 + R() * 1.6, 1, 0.6 + R() * 1.1);
    p.rotation.y = R() * Math.PI;
    p.position.set(x, heightAt(x, z) + 0.03, z);
    p.renderOrder = 1;
    scene.add(p);
  }
}

function buildTrees(scene, R) {
  const trees = [];
  const ok = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 37 || r > 86 || z > 71) return false;
    if (onRoad(x, z, 4.5)) return false;
    if (Math.hypot(x - HILL.x, z - HILL.z) < HILL.top + 4) return false;
    if (Math.hypot(x - MARSH.x, z - MARSH.z) < 20) return false;
    if (Math.hypot(x - ZONES[2].x, z - ZONES[2].z) < 15) return false;
    if (Math.hypot(x + 74, z + 10) < 8) return false;
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < 2.6) return false;
    return true;
  };
  for (let i = 0; i < 500 && trees.length < 75; i++) {
    const a = R() * Math.PI * 2;
    const rr = Math.sqrt(R()) * 28;
    const x = ZONES[0].x + Math.sin(a) * rr;
    const z = ZONES[0].z + Math.cos(a) * rr;
    if (ok(x, z)) trees.push({ x, z, s: 0.9 + R() * 0.7 });
  }
  for (let i = 0; i < 800 && trees.length < 170; i++) {
    const x = (R() - 0.5) * 180;
    const z = (R() - 0.5) * 180;
    if (ok(x, z)) trees.push({ x, z, s: 0.8 + R() * 0.6 });
  }
  const trunkG = new THREE.CylinderGeometry(0.18, 0.26, 1.6, 6); trunkG.translate(0, 0.8, 0);
  const leafG1 = new THREE.ConeGeometry(1.5, 2.8, 7); leafG1.translate(0, 2.7, 0);
  const leafG2 = new THREE.ConeGeometry(1.05, 2.1, 7); leafG2.translate(0, 3.9, 0);
  const trunk = new THREE.InstancedMesh(trunkG, phong(0x4a3728), trees.length);
  const leafMat = phong(0x2f5238, { shininess: 50, specular: 0x333b33 });
  const leaf1 = new THREE.InstancedMesh(leafG1, leafMat, trees.length);
  const leaf2 = new THREE.InstancedMesh(leafG2, leafMat, trees.length);
  const dummy = new THREE.Object3D();
  trees.forEach((t, i) => {
    dummy.position.set(t.x, heightAt(t.x, t.z) - 0.1, t.z);
    dummy.rotation.y = R() * Math.PI;
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    leaf1.setMatrixAt(i, dummy.matrix);
    leaf2.setMatrixAt(i, dummy.matrix);
    addCollider(t.x, t.z, 0.5 * t.s);
  });
  scene.add(trunk, leaf1, leaf2);
}

function buildMarsh(scene, R) {
  const waterMat = phong(0x2c4a4f, { shininess: 130, specular: 0x99aaaa, transparent: true, opacity: 0.9 });
  const ponds = [[56, -9, 5], [69, 4, 4.5], [59, 9, 3.6], [71, -11, 3.2], [49, 2, 2.6]];
  const padMat = phong(0x4f8f3f);
  const padGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.04, 10);
  for (const [x, z, r] of ponds) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 28), waterMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(x, heightAt(x, z) + 0.05, z);
    scene.add(w);
    for (let i = 0; i < 4; i++) {
      const a = R() * Math.PI * 2;
      const rr = R() * r * 0.8;
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(x + Math.sin(a) * rr, heightAt(x, z) + 0.08, z + Math.cos(a) * rr);
      scene.add(pad);
    }
  }
  const reedG = new THREE.BoxGeometry(0.06, 1.3, 0.06); reedG.translate(0, 0.65, 0);
  const reeds = new THREE.InstancedMesh(reedG, phong(0x6f8f45), 110);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 110; i++) {
    const [px, pz, pr] = ponds[i % ponds.length];
    const a = R() * Math.PI * 2;
    const x = px + Math.sin(a) * (pr + 0.3 + R() * 0.8);
    const z = pz + Math.cos(a) * (pr + 0.3 + R() * 0.8);
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.set((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3);
    dummy.scale.set(1, 0.7 + R() * 0.7, 1);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
  }
  scene.add(reeds);
}

function buildCoast(scene, R) {
  // 岬の岩
  const rockG = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = phong(0x6b7078, { shininess: 60, flatShading: true });
  for (let i = 0; i < 22; i++) {
    const a = R() * Math.PI * 2;
    const rr = 9 + R() * 12;
    const x = ZONES[2].x + Math.sin(a) * rr;
    const z = ZONES[2].z + Math.cos(a) * rr;
    if (onRoad(x, z, 3.5) || z > 80) continue;
    const s = 0.6 + R() * 1.3;
    const rock = new THREE.Mesh(rockG, rockMat);
    rock.position.set(x, heightAt(x, z) + s * 0.3, z);
    rock.scale.set(s, s * 0.8, s);
    rock.rotation.set(R(), R(), R());
    scene.add(rock);
    addCollider(x, z, s * 0.85);
  }
  // 灯台
  const lx = 30; const lz = 78;
  const ly = heightAt(lx, lz);
  const white = phong(0xe8e8e8, { shininess: 60 });
  const red = phong(0xc0392b, { shininess: 60 });
  [[0, 3, white], [3, 2, red], [5, 3, white], [8, 1.5, red]].forEach(([y, h, m], i) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.6 - i * 0.2, 1.8 - i * 0.2, h, 16), m);
    seg.position.set(lx, ly + y + h / 2, lz);
    scene.add(seg);
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(lx, ly + 10.2, lz);
  scene.add(lamp);
  const beamGeo = new THREE.ConeGeometry(3, 40, 16, 1, true);
  beamGeo.translate(0, -20, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  beam.position.copy(lamp.position);
  scene.add(beam);
  world.beam = beam;
  addCollider(lx, lz, 2.2);

  // 桟橋と小舟
  const wood = phong(0x6b4a30);
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 24), wood);
  dock.position.set(-20, -0.3, 92);
  scene.add(dock);
  const boat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.5), phong(0x8a5a3a));
  boat.position.set(-15.5, -0.9, 96);
  boat.rotation.y = 0.2;
  scene.add(boat);
}

function buildShrine(scene) {
  const top = heightAt(SHRINE.x, SHRINE.z);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.3, 0.12, 36), phong(0x7f848c, { shininess: 60 }));
  plaza.position.set(SHRINE.x, top + 0.02, SHRINE.z);
  scene.add(plaza);

  const wood = phong(0x7a4a2e);
  const hall = new THREE.Group();
  hall.position.set(SHRINE.x, top, SHRINE.z - 10);
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 5), phong(0x6b6b70));
  base.position.y = 0.3;
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wood);
  body.position.y = 2.1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.4, 4), phong(0x3a3f4a, { shininess: 80 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 1);
  roof.position.y = 4.8;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0xffd79a }));
  door.position.set(0, 1.8, 2.01);
  hall.add(base, body, roof, door);
  scene.add(hall);
  world.occluders.push(hall);
  addCollider(SHRINE.x, SHRINE.z - 10, 3.6);

  // 鳥居
  const red = phong(0xc23b2b, { shininess: 70 });
  const tz = SHRINE.z + 16;
  const ty = heightAt(0, tz);
  for (const sx of [-2.6, 2.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4.6, 10), red);
    post.position.set(sx, ty + 2.3, tz);
    scene.add(post);
    world.occluders.push(post);
    addCollider(sx, tz, 0.4);
  }
  const beam1 = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 0.5), phong(0x2a2a2a));
  beam1.position.set(0, ty + 4.7, tz);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 0.35), red);
  beam2.position.set(0, ty + 3.9, tz);
  scene.add(beam1, beam2);
  world.occluders.push(beam1, beam2);

  // 石灯籠
  const stone = phong(0x8a8f96);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffcf80 });
  for (const sx of [-4.5, 4.5]) {
    const z = SHRINE.z + 6;
    const y = heightAt(sx, z);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), stone);
    pole.position.set(sx, y + 0.7, z);
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), glow);
    fire.position.set(sx, y + 1.6, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), stone);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(sx, y + 2.0, z);
    scene.add(pole, fire, cap);
    addCollider(sx, z, 0.45);
  }

  // 結界
  const barrier = new THREE.Mesh(
    new THREE.CylinderGeometry(BARRIER_R, BARRIER_R, 8, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7fd6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  barrier.position.set(SHRINE.x, top + 3.5, SHRINE.z);
  scene.add(barrier);
  world.barrier = barrier;
}

export function buildWorld(scene) {
  const R = rng(20260929);
  world.colliders.length = 0;
  world.occluders.length = 0;
  buildGround(scene);
  buildTown(scene, R);
  buildTrees(scene, R);
  buildMarsh(scene, R);
  buildCoast(scene, R);
  buildShrine(scene);
}

export function setBarrier(active, instant = false) {
  world.barrierActive = active;
  if (instant) world.barrierV = active ? 1 : 0;
}

export function updateWorld(dt, t) {
  if (world.beam) world.beam.rotation.y = t * 0.6;
  if (world.fountain) world.fountain.material.opacity = 0.85 + Math.sin(t * 3) * 0.05;
  const b = world.barrier;
  if (b) {
    const target = world.barrierActive ? 1 : 0;
    world.barrierV += (target - world.barrierV) * Math.min(1, dt * 1.5);
    b.visible = world.barrierV > 0.01;
    b.material.opacity = world.barrierV * (0.14 + Math.sin(t * 2.4) * 0.05);
    b.rotation.y = t * 0.2;
  }
}
