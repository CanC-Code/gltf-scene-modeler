// js/viewGizmo.js
// Author: CCVO
// Purpose: Fully functional dynamic camera orientation gizmo

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;
    this.size = options.size || 96;

    this.scene = new THREE.Scene();

    // Gizmo camera
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    // Base cube for reference
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: `${this.size}px`,
      height: `${this.size}px`,
      cursor: "grab",
      zIndex: 20
    });
    document.body.appendChild(this.renderer.domElement);

    // Interaction
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
      const dx = (e.clientX - this.prev.x) * 0.005;
      const dy = (e.clientY - this.prev.y) * 0.005;
      
      // Fixed: Check if controls exist and are enabled (property, not method)
      if (this.controls && this.controls.enabled) {
        this.controls.rotateLeft(dx);
        this.controls.rotateUp(dy);
        this.controls.update();
      }
      this.prev.set(e.clientX, e.clientY);
    });

    this.activeMesh = null;
    this.meshClone = null;
  }

  // Set or update the mesh displayed in the gizmo
  updateMesh(mesh) {
    this.activeMesh = mesh;

    if (this.meshClone) {
      this.scene.remove(this.meshClone);
      if (this.meshClone.geometry) this.meshClone.geometry.dispose();
      if (this.meshClone.material) this.meshClone.material.dispose();
      this.meshClone = null;
    }

    if (!mesh) return;

    this.meshClone = mesh.clone();
    this.meshClone.material = new THREE.MeshNormalMaterial();
    this.meshClone.geometry = mesh.geometry.clone();

    // Scale to fit gizmo
    const box = new THREE.Box3().setFromObject(this.meshClone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.5 / maxDim;
      this.meshClone.scale.setScalar(scale);
    }

    this.meshClone.position.set(0, 0, 0);
    this.scene.add(this.meshClone);
  }

  update() {
    if (this.activeMesh && this.meshClone) {
      // Match orientation
      this.meshClone.quaternion.copy(this.activeMesh.quaternion);
      this.meshClone.position.set(0, 0, 0);
    }

    // Base cube aligned to camera
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();

    this.renderer.render(this.scene, this.camera);
  }
}