// js/viewGizmo.js
// Author: CCVO
// Purpose: Dynamic, perfectly aligned View Gizmo with live miniature mesh (Three.js r159)

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = options.size || 120; // slightly smaller, cleaner
    this.activeMesh = null;
    this.gizmoMesh = null;

    /* ---------------- Scene ---------------- */

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 50);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* ---------------- Lighting ---------------- */

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const light = new THREE.DirectionalLight(0xffffff, 0.6);
    light.position.set(5, 5, 5);
    this.scene.add(light);

    /* ---------------- Renderer ---------------- */

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.size, this.size);

    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      top: "64px",
      right: "16px",
      zIndex: 20,
      cursor: "grab"
    });

    document.body.appendChild(this.renderer.domElement);

    /* ---------------- Interaction ---------------- */

    this.dragging = false;
    this.prev = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e => {
      this.dragging = true;
      this.prev.set(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = "grabbing";
    });

    window.addEventListener("pointerup", () => {
      this.dragging = false;
      this.renderer.domElement.style.cursor = "grab";
    });

    window.addEventListener("pointermove", e => {
      if (!this.dragging) return;

      const dx = (e.clientX - this.prev.x) * 0.004;
      const dy = (e.clientY - this.prev.y) * 0.004;

      // Rotate camera directly (NO OrbitControls internals)
      const offset = new THREE.Vector3().subVectors(
        this.mainCamera.position,
        this.controls.target
      );

      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= dx;
      spherical.phi -= dy;
      spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

      offset.setFromSpherical(spherical);
      this.mainCamera.position.copy(this.controls.target).add(offset);
      this.mainCamera.lookAt(this.controls.target);

      this.prev.set(e.clientX, e.clientY);
    });
  }

  /* ============================================================
     Active Mesh Handling
  ============================================================ */

  setActiveMesh(mesh) {
    if (this.gizmoMesh) {
      this.scene.remove(this.gizmoMesh);
      this.gizmoMesh.geometry.dispose();
      this.gizmoMesh.material.dispose();
      this.gizmoMesh = null;
    }

    this.activeMesh = mesh;
    if (!mesh) return;

    // Clone geometry only (cheap, stable, no flicker)
    const geo = mesh.geometry.clone();
    geo.computeBoundingBox();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.4,
      metalness: 0.1
    });

    this.gizmoMesh = new THREE.Mesh(geo, mat);

    // Center geometry
    const box = geo.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.gizmoMesh.position.sub(center);

    // Scale to fit view
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.4 / maxDim;
    this.gizmoMesh.scale.setScalar(scale);

    this.scene.add(this.gizmoMesh);
  }

  /* ============================================================
     Update Loop
  ============================================================ */

  update() {
    if (this.gizmoMesh && this.activeMesh) {
      // PERFECT orientation sync (no inversion)
      this.gizmoMesh.quaternion.copy(this.activeMesh.quaternion);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
