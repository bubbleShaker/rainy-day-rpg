import * as THREE from 'three';

// 人型キャラクター・傘・影など、プレイヤーと NPC で共有するモデル
const G = {
  body: new THREE.CapsuleGeometry(0.3, 0.5, 4, 12),
  head: new THREE.SphereGeometry(0.27, 16, 12),
  cap: new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  eye: new THREE.SphereGeometry(0.04, 6, 4),
  boot: new THREE.CylinderGeometry(0.1, 0.12, 0.26, 8),
  stick: new THREE.CylinderGeometry(0.025, 0.025, 1.45, 6),
  canopy: new THREE.ConeGeometry(1.05, 0.45, 12, 1, true),
  tip: new THREE.SphereGeometry(0.05, 6, 4),
  handle: new THREE.TorusGeometry(0.07, 0.02, 6, 10, Math.PI),
  shadow: new THREE.CircleGeometry(1, 20),
};
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

export function phong(color, extra = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 30, ...extra });
}

export function makeUmbrella(color) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(G.stick, phong(0x333333));
  stick.position.y = 0.72;
  g.add(stick);
  const canopy = new THREE.Mesh(G.canopy, phong(color, { side: THREE.DoubleSide, shininess: 90, specular: 0x777777 }));
  canopy.position.y = 1.5;
  g.add(canopy);
  const tip = new THREE.Mesh(G.tip, phong(0xdddddd));
  tip.position.y = 1.75;
  g.add(tip);
  const handle = new THREE.Mesh(G.handle, phong(0x5a3a22));
  handle.rotation.z = Math.PI;
  handle.position.set(0.07, 0.02, 0);
  g.add(handle);
  return g;
}

export function makePerson({
  coat = 0xf2c230, skin = 0xf3cfae, hair = 0x3b2a20, umbrella = 0xd9434b,
  hood = false, boots = 0x2a3a55, scale = 1,
} = {}) {
  const group = new THREE.Group();
  const bodyMat = phong(coat, { shininess: 70, specular: 0x444444 });
  const body = new THREE.Mesh(G.body, bodyMat);
  body.position.y = 0.72;
  group.add(body);
  const head = new THREE.Mesh(G.head, phong(skin));
  head.position.y = 1.36;
  group.add(head);
  const cap = new THREE.Mesh(G.cap, hood ? bodyMat : phong(hair));
  cap.position.set(0, 1.38, -0.02);
  cap.rotation.x = -0.35;
  group.add(cap);
  for (const sx of [-0.1, 0.1]) {
    const e = new THREE.Mesh(G.eye, eyeMat);
    e.position.set(sx, 1.36, 0.25);
    group.add(e);
  }
  const bootMat = phong(boots, { shininess: 80, specular: 0x555555 });
  const bootL = new THREE.Mesh(G.boot, bootMat);
  bootL.position.set(-0.13, 0.13, 0);
  const bootR = new THREE.Mesh(G.boot, bootMat);
  bootR.position.set(0.13, 0.13, 0);
  group.add(bootL, bootR);
  const umb = makeUmbrella(umbrella);
  umb.position.set(0.3, 0.75, 0.05);
  umb.rotation.z = 0.12;
  group.add(umb);
  group.scale.setScalar(scale);
  return { group, body, bodyMat, bootL, bootR, umbrella: umb };
}

export function makeCat() {
  const group = new THREE.Group();
  const fur = phong(0xe39a4c);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), fur);
  body.scale.set(0.8, 0.7, 1.2);
  body.position.y = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), fur);
  head.position.set(0, 0.5, 0.3);
  group.add(body, head);
  for (const sx of [-0.1, 0.1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), fur);
    ear.position.set(sx, 0.68, 0.3);
    const eye = new THREE.Mesh(G.eye, eyeMat);
    eye.position.set(sx * 0.8, 0.53, 0.48);
    group.add(ear, eye);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), fur);
  tail.position.set(0, 0.45, -0.35);
  tail.rotation.x = -0.6;
  group.add(tail);
  return { group, tail };
}

export function makeShadow(r) {
  const m = new THREE.Mesh(G.shadow, shadowMat);
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(r);
  m.renderOrder = 1;
  return m;
}

export function makeLabel(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '800 30px "M PLUS Rounded 1c", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineWidth = 7;
  x.strokeStyle = 'rgba(10,20,30,0.85)';
  x.strokeText(text, 128, 32);
  x.fillStyle = color;
  x.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(2.4, 0.6, 1);
  return s;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
