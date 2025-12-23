// js/viewGizmo.js
// Author: CCVO
// Purpose: Interactive View Cube / Gizmo for camera orientation (Three.js r159 compatible)

import * as THREE from "../three/three.module.js";

export class viewGizmo {
  constructor(camera, controls, options = {}) {
    this.camera = camera;
    this.controls = controls;

    this.size = options.size || 128;
    this.top = options.top ?? 12;
    this.right = options.right ?? 12;

    /* ===============================
       Internal Scene
    ================================ */
    this.scene = new THREE.Scene();
    this.gizmoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.gizmoCamera.position.set(2, 2, 2);
    this.gizmoCamera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = this.top + "px";
    this.renderer.domElement.style.right = this.right + "px";
    this.renderer.domElement.style.pointerEvents = "auto";
    this.renderer.domElement.style.zIndex = "10";
    document.body.appendChild(this.renderer.domElement);

    /* ===============================
       Gizmo Cube
    ================================ */
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragging = false;

    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff5555 }), // +X
      new THREE.MeshBasicMaterial({ color: 0xaa0000 }), // -X
      new THREE.MeshBasicMaterial({ color: 0x55ff55 }), // +Y
      new THREE.MeshBasicMaterial({ color: 0x006600 }), // -Y
      new THREE.MeshBasicMaterial({ color: 0x5555ff }), // +Z
      new THREE.MeshBasicMaterial({ color: 0x000066 })  // -Z
    ];

    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      materials
    );
    this.scene.add(this.cube);

    /* ===============================
       Interaction
    ================================ */
    this.renderer.domElement.addEventListener("pointerdown", e => this.onPointerDown(e));
    window.addEventListener("pointermove", e => this.onPointerMove(e));
    window.addEventListener("pointerup", () => this.dragging = false);

    console.log("ViewGizmo initialized");
  }

  /* ===============================
     Pointer Handling
  ================================ */
  getPointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  onPointerDown(event) {
    this.getPointer(event);
    this.raycaster.setFromCamera(this.pointer, this.gizmoCamera);
    const hits = this.raycaster.intersectObject(this.cube);
    if (!hits.length) return;

    this.dragging = true;

    const normal = hits[0].face.normal.clone();
    normal.applyQuaternion(this.cube.quaternion);

    const distance = this.camera.position.distanceTo(this.controls.target);
    const newPos = normal.multiplyScalar(distance).add(this.controls.target);

    this.camera.position.copy(newPos);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  onPointerMove(event) {
    if (!this.dragging) return;

    const dx = event.movementX * 0.005;
    const dy = event.movementY * 0.005;

    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta -= dx;
    spherical.phi -= dy;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target.clone().add(offset));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  /* ===============================
     Update Loop
  ================================ */
  update() {
    this.cube.quaternion.copy(this.camera.quaternion).invert();
    this.renderer.render(this.scene, this.gizmoCamera);
  }
}
