// js/viewGizmo.js
// Author: CCVO
// Purpose: Precision View Gizmo / View Cube
// Three.js r159 compatible

import * as THREE from "../three/three.module.js";
import { CSS2DRenderer, CSS2DObject } from "../three/CSS2DRenderer.js";

export class ViewGizmo {
  constructor(camera, controls, options = {}) {
    this.camera = camera;
    this.controls = controls;

    /* ===============================
       Config
    ================================ */
    this.size = options.size || 160;
    this.top = options.top ?? 16;
    this.right = options.right ?? 16;

    this.rotateSpeed = 0.002;
    this.snapDuration = 0.25; // seconds

    this.minPhi = 0.15;
    this.maxPhi = Math.PI - 0.15;

    /* ===============================
       Scene
    ================================ */
    this.scene = new THREE.Scene();

    this.gizmoCamera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 10);
    this.gizmoCamera.position.set(3, 3, 3);
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
    this.renderer.domElement.style.touchAction = "none";
    document.body.appendChild(this.renderer.domElement);

    /* ===============================
       Label Renderer
    ================================ */
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(this.size, this.size);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = this.top + "px";
    this.labelRenderer.domElement.style.right = this.right + "px";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.labelRenderer.domElement.style.zIndex = "11";
    document.body.appendChild(this.labelRenderer.domElement);

    /* ===============================
       Cube
    ================================ */
    const mats = [
      new THREE.MeshBasicMaterial({ color: 0xc94a4a }), // +X
      new THREE.MeshBasicMaterial({ color: 0x7a2a2a }), // -X
      new THREE.MeshBasicMaterial({ color: 0x4ac96d }), // +Y
      new THREE.MeshBasicMaterial({ color: 0x2a7a3f }), // -Y
      new THREE.MeshBasicMaterial({ color: 0x4a6fc9 }), // +Z
      new THREE.MeshBasicMaterial({ color: 0x2a3f7a })  // -Z
    ];

    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      mats
    );
    this.scene.add(this.cube);

    /* ===============================
       Axis Labels (CSS)
    ================================ */
    this.addLabel("+X", new THREE.Vector3(1.2, 0, 0));
    this.addLabel("-X", new THREE.Vector3(-1.2, 0, 0));
    this.addLabel("+Y", new THREE.Vector3(0, 1.2, 0));
    this.addLabel("-Y", new THREE.Vector3(0, -1.2, 0));
    this.addLabel("+Z", new THREE.Vector3(0, 0, 1.2));
    this.addLabel("-Z", new THREE.Vector3(0, 0, -1.2));

    /* ===============================
       Interaction
    ================================ */
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.dragging = false;
    this.dragMoved = false;
    this.lastX = 0;
    this.lastY = 0;

    this.snap = null;

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", e => this.onDown(e));
    window.addEventListener("pointermove", e => this.onMove(e));
    window.addEventListener("pointerup", () => this.onUp());

    console.log("[ViewGizmo] Loaded");
  }

  addLabel(text, pos) {
    const div = document.createElement("div");
    div.textContent = text;
    div.style.font = "11px monospace";
    div.style.color = "#ddd";
    div.style.background = "rgba(0,0,0,0.4)";
    div.style.padding = "2px 4px";
    div.style.borderRadius = "4px";

    const label = new CSS2DObject(div);
    label.position.copy(pos);
    this.cube.add(label);
  }

  updatePointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  onDown(e) {
    this.dragging = true;
    this.dragMoved = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.gizmoCamera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    this.hitNormal = hit ? hit.face.normal.clone() : null;
  }

  onMove(e) {
    if (!this.dragging) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (Math.abs(dx) + Math.abs(dy) > 2) this.dragMoved = true;
    if (!this.dragMoved) return;

    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);

    sph.theta -= dx * this.rotateSpeed;
    sph.phi -= dy * this.rotateSpeed;
    sph.phi = Math.max(this.minPhi, Math.min(this.maxPhi, sph.phi));

    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target.clone().add(offset));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  onUp() {
    if (this.dragging && !this.dragMoved && this.hitNormal) {
      const n = this.hitNormal.clone().applyQuaternion(this.cube.quaternion);
      const dist = this.camera.position.distanceTo(this.controls.target);

      this.snap = {
        start: this.camera.position.clone(),
        end: n.multiplyScalar(dist).add(this.controls.target),
        t: 0
      };
    }

    this.dragging = false;
    this.dragMoved = false;
    this.hitNormal = null;
  }

  update(delta = 1 / 60) {
    this.cube.quaternion.copy(this.camera.quaternion).invert();

    if (this.snap) {
      this.snap.t += delta / this.snapDuration;
      const t = Math.min(this.snap.t, 1);

      this.camera.position.lerpVectors(
        this.snap.start,
        this.snap.end,
        t
      );
      this.camera.lookAt(this.controls.target);
      this.controls.update();

      if (t >= 1) this.snap = null;
    }

    this.renderer.render(this.scene, this.gizmoCamera);
    this.labelRenderer.render(this.scene, this.gizmoCamera);
  }
}
