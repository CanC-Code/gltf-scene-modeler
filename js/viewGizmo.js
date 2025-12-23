// js/viewGizmo.js
// Author: CCVO
// Purpose: Provides a corner view cube gizmo for camera orientation and snapping

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;
    this.size = 96;

    // Scene & cube
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "12px";
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";
    document.body.appendChild(this.renderer.domElement);

    // Raycaster for clicks
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e => this.onClick(e));

    // Touch support
    this.renderer.domElement.addEventListener("touchstart", e => {
      if (e.touches.length > 0) this.onClick(e.touches[0]);
    });

    window.addEventListener("resize", () => this.onResize());
  }

  onResize() {
    this.renderer.setSize(this.size, this.size);
  }

  onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;

    const n = hit.face.normal.clone();
    this.snapCamera(n);
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
    // Sync rotation with main camera
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }
}
