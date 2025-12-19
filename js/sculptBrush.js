import * as THREE from '../three/three.module.js';

export class SculptBrush {
  constructor({ scene, camera, canvas, cursor, getMesh, onStart, onEnd }) {
    this.camera = camera;
    this.canvas = canvas;
    this.cursor = cursor;
    this.getMesh = getMesh;
    this.onStart = onStart;
    this.onEnd = onEnd;

    this.radius = 1;
    this.strength = 0.15;
    this.active = false;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('pointerdown', e => this._start(e));
    this.canvas.addEventListener('pointermove', e => this._move(e));
    window.addEventListener('pointerup', () => this._end());
  }

  _start(e) {
    if (!this.getMesh()) return;
    this.active = true;
    this.onStart();
    this.cursor.style.display = 'block';
    this._update(e);
    this._sculpt();
  }

  _end() {
    if (!this.active) return;
    this.active = false;
    this.cursor.style.display = 'none';
    this.onEnd();
  }

  _move(e) {
    this._update(e);
    if (this.active) this._sculpt();
  }

  _update(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    this.cursor.style.left = e.clientX + 'px';
    this.cursor.style.top = e.clientY + 'px';
    this.cursor.style.width = this.radius * 40 + 'px';
    this.cursor.style.height = this.radius * 40 + 'px';
  }

  _sculpt() {
    const mesh = this.getMesh();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(mesh);
    if (!hit.length) return;

    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const normal = hit[0].face.normal.clone();
    const center = hit[0].point;

    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      mesh.localToWorld(v);
      const d = v.distanceTo(center);
      if (d > this.radius) continue;
      v.addScaledVector(normal, this.strength * (1 - d / this.radius));
      mesh.worldToLocal(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}