// js/viewGizmo.js
// Author: CCVO
// Purpose: On-screen interactive view cube for camera orientation and snapping
// Supports mouse and touch input; renders as an overlay without interfering with main renderer

import * as THREE from "../three/three.module.js";

export class viewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 96;

    /* ---------- Scene & Camera ---------- */
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* ---------- Cube ---------- */
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    /* ---------- Renderer ---------- */
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "12px";
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";
    this.renderer.domElement.style.touchAction = "none";

    document.body.appendChild(this.renderer.domElement);

    /* ---------- Interaction ---------- */
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener(
      "pointerdown",
      e => this.onPointerDown(e),
      { passive: false }
    );
  }

  onPointerDown(e) {
    e.preventDefault();

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;

    const normal = hit.face.normal.clone();
    this.snapCamera(normal);
  }

  snapCamera(dir) {
    dir.normalize();

    const target = this.controls.target.clone();
    const distance = this.mainCamera.position.distanceTo(target);

    const newPos = dir.multiplyScalar(distance).add(target);

    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(target);
    this.controls.update();
  }

  update() {
    // Inverse rotation so cube reflects camera orientation
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
