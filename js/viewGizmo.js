// js/viewGizmo.js
// Author: CCVO
// Purpose: True miniature View Gizmo that perfectly mirrors the active mesh

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = options.size || 120;
    this.activeMesh = null;
    this.miniature = null;

    /* ---------------- Scene ---------------- */

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
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
     Active Mesh Sync
  ============================================================ */

  setActiveMesh(mesh) {
    if (this.miniature) {
      this.scene.remove(this.miniature);
      this.miniature.traverse(obj => {
        if (obj.isMesh) {
          obj.geometry.dispose();
          obj.material.dispose();
        }
      });
      this.miniature = null;
    }

    this.activeMesh = mesh;
    if (!mesh) return;

    // FULL CLONE (geometry + transforms)
    this.miniature = mesh.clone(true);

    // Compute bounds AFTER clone
    const box = new THREE.Box3().setFromObject(this.miniature);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // Center without distorting shape
    this.miniature.position.sub(center);

    // Uniform scale to fit
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    this.miniature.scale.multiplyScalar(scale);

    this.scene.add(this.miniature);
  }

  /* ============================================================
     Update
  ============================================================ */

  update() {
    if (this.miniature && this.activeMesh) {
      // Match camera-relative orientation perfectly
      this.miniature.quaternion.copy(this.activeMesh.quaternion);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
