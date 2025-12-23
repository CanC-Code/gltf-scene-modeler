// js/viewGizmo.js
// Author: CCVO
// Purpose: Polished interactive View Cube for camera orientation
// Compatible with Three.js r159

import * as THREE from "../three/three.module.js";

export class viewGizmo {
  constructor(camera, controls, options = {}) {
    this.camera = camera;
    this.controls = controls;

    /* ===============================
       Configuration
    ================================ */
    this.size = options.size || 140;
    this.top = options.top ?? 12;
    this.right = options.right ?? 12;

    this.rotateSpeed = 0.0025;   // << slowed way down
    this.minPhi = 0.15;
    this.maxPhi = Math.PI - 0.15;

    /* ===============================
       Internal Scene
    ================================ */
    this.scene = new THREE.Scene();

    this.gizmoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.gizmoCamera.position.set(2.5, 2.5, 2.5);
    this.gizmoCamera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = this.top + "px";
    this.renderer.domElement.style.right = this.right + "px";
    this.renderer.domElement.style.zIndex = "10";
    this.renderer.domElement.style.pointerEvents = "auto";
    document.body.appendChild(this.renderer.domElement);

    /* ===============================
       Gizmo Cube
    ================================ */
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff6666 }), // +X
      new THREE.MeshBasicMaterial({ color: 0xaa2222 }), // -X
      new THREE.MeshBasicMaterial({ color: 0x66ff66 }), // +Y
      new THREE.MeshBasicMaterial({ color: 0x228822 }), // -Y
      new THREE.MeshBasicMaterial({ color: 0x6666ff }), // +Z
      new THREE.MeshBasicMaterial({ color: 0x222288 })  // -Z
    ];

    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      materials
    );
    this.scene.add(this.cube);

    /* ===============================
       Interaction State
    ================================ */
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.dragging = false;
    this.dragMoved = false;
    this.lastX = 0;
    this.lastY = 0;

    /* ===============================
       Events
    ================================ */
    const el = this.renderer.domElement;

    el.addEventListener("pointerdown", e => this.onPointerDown(e));
    window.addEventListener("pointermove", e => this.onPointerMove(e));
    window.addEventListener("pointerup", () => this.onPointerUp());

    console.log("[ViewGizmo] Ready");
  }

  /* ===============================
     Pointer Helpers
  ================================ */
  updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /* ===============================
     Pointer Down
  ================================ */
  onPointerDown(event) {
    event.preventDefault();

    this.dragging = true;
    this.dragMoved = false;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.gizmoCamera);

    const hits = this.raycaster.intersectObject(this.cube);
    this.clickedFace = hits.length ? hits[0].face.normal.clone() : null;
  }

  /* ===============================
     Pointer Move (Smooth Orbit)
  ================================ */
  onPointerMove(event) {
    if (!this.dragging) return;

    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;

    if (Math.abs(dx) + Math.abs(dy) > 2) {
      this.dragMoved = true;
    }

    this.lastX = event.clientX;
    this.lastY = event.clientY;

    if (!this.dragMoved) return;

    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta -= dx * this.rotateSpeed;
    spherical.phi -= dy * this.rotateSpeed;
    spherical.phi = Math.max(this.minPhi, Math.min(this.maxPhi, spherical.phi));

    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target.clone().add(offset));
    this.camera.lookAt(this.controls.target);

    this.controls.update();
  }

  /* ===============================
     Pointer Up (Snap if Click)
  ================================ */
  onPointerUp() {
    if (this.dragging && !this.dragMoved && this.clickedFace) {
      const normal = this.clickedFace.clone();
      normal.applyQuaternion(this.cube.quaternion);

      const distance = this.camera.position.distanceTo(this.controls.target);
      const newPos = normal.multiplyScalar(distance).add(this.controls.target);

      this.camera.position.copy(newPos);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
    }

    this.dragging = false;
    this.dragMoved = false;
    this.clickedFace = null;
  }

  /* ===============================
     Update
  ================================ */
  update() {
    // Invert camera rotation so cube matches view
    this.cube.quaternion.copy(this.camera.quaternion).invert();
    this.renderer.render(this.scene, this.gizmoCamera);
  }
}
