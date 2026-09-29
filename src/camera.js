import * as THREE from 'three';
import { heightAt, world } from './world.js';
import { lerpAngle } from './models.js';

// 三人称の追従カメラ。yaw=0 のときカメラはプレイヤーの南側（+z）から北を向く
const ray = new THREE.Raycaster();
const head = new THREE.Vector3();
const dir = new THREE.Vector3();

export class FollowCamera {
  constructor(cam) {
    this.cam = cam;
    this.yaw = 0;
    this.pitch = 0.55;
    this.dist = 10;
    this.baseDist = 10;
    this.target = new THREE.Vector3();
    this.autoYaw = null;
    this.autoPitch = null;
  }

  snap(focus) {
    this.target.copy(focus);
  }

  update(dt, focus, delta) {
    this.yaw -= delta.x * 0.006;
    this.pitch = Math.min(1.15, Math.max(0.08, this.pitch + delta.y * 0.004));
    if (this.autoYaw !== null) this.yaw = lerpAngle(this.yaw, this.autoYaw, 1 - Math.exp(-dt * 0.8));
    if (this.autoPitch !== null) this.pitch += (this.autoPitch - this.pitch) * (1 - Math.exp(-dt * 0.8));
    this.dist += (this.baseDist - this.dist) * (1 - Math.exp(-dt * 2));
    this.target.lerp(focus, 1 - Math.exp(-dt * 10));
    const cp = Math.cos(this.pitch);
    // 建物などがカメラとプレイヤーの間に入ったら、カメラを手前に寄せる
    head.set(this.target.x, this.target.y + 1.4, this.target.z);
    dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    ray.set(head, dir);
    ray.far = this.dist;
    const hit = ray.intersectObjects(world.occluders, true)[0];
    const dist = hit ? Math.max(2.2, hit.distance - 0.4) : this.dist;
    if (hit) this.dist = Math.max(dist, this.dist - dt * 40);
    const x = head.x + dir.x * dist;
    const z = head.z + dir.z * dist;
    let y = head.y + dir.y * dist;
    y = Math.max(y, heightAt(x, z) + 0.8);
    this.cam.position.set(x, y, z);
    this.cam.lookAt(this.target.x, this.target.y + 1.4, this.target.z);
  }
}
