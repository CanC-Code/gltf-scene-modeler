// js/viewGizmo.js
// Author: CCVO
// Purpose: On-screen interactive view cube for snapping camera orientation

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 96;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);

    const el = this.renderer.domElement;
    el.style.position = "fixed";
    el.style.top = "12px";
    el.style.right = "12px";
    el.style.zIndex = "20";
    el.style.cursor = "pointer";
    el.style.touchAction = "none";

    document.body.appendChild(el);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    el.addEventListener("pointerdown", e => this.onPointerDown(e), {
      passive: false
    });
  }

  onPointerDown(e) {
    e.preventDefault();

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;

    this.snapCamera(hit.face.normal.clone());
  }

  snapCamera(dir) {
    dir.normalize();
    const target = this.controls.target.clone();
    const dist = this.mainCamera.position.distanceTo(target);

    this.mainCamera.position.copy(dir.multiplyScalar(dist).add(target));
    this.mainCamera.lookAt(target);
    this.controls.update();
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
