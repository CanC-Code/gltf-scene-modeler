// js/viewGizmo.js
// Author: CCVO
// Purpose: Fully dynamic miniature view gizmo for GLTF Scene Modeler
// Displays active mesh in perfect world alignment and allows orbiting camera via drag

import * as THREE from "../three/three.module.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, orbitControls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = orbitControls;
    this.size = options.size || 180;
    this.activeMesh = null;

    // Mini scene
    this.scene = new THREE.Scene();

    // Orthographic camera for gizmo
    const s = 2;
    this.camera = new THREE.OrthographicCamera(-s, s, s, -s, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Gizmo object placeholder
    this.gizmoGroup = new THREE.Group();
    this.scene.add(this.gizmoGroup);

    // Labels group
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);

    // Load font and create N/E/S/W labels
    const loader = new FontLoader();
    loader.load("../three/fonts/helvetiker_regular.typeface.json", font => {
      this.createLabel(font, "N", 0, 0, -1.2);
      this.createLabel(font, "S", 0, 0, 1.2);
      this.createLabel(font, "E", 1.2, 0, 0);
      this.createLabel(font, "W", -1.2, 0, 0);
    });

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      top: "56px",
      right: "16px",
      zIndex: 20,
      cursor: "grab"
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

      this.controls.rotateLeft(dx);
      this.controls.rotateUp(dy);
      this.controls.update();

      this.prev.set(e.clientX, e.clientY);
    });
  }

  setActiveMesh(mesh) {
    // Remove previous mesh
    if (this.activeMeshClone) {
      this.gizmoGroup.remove(this.activeMeshClone);
      this.activeMeshClone.geometry.dispose();
      this.activeMeshClone.material.dispose();
    }

    if (!mesh) {
      this.activeMesh = null;
      this.activeMeshClone = null;
      return;
    }

    this.activeMesh = mesh;

    // Clone geometry & material for gizmo
    const cloneGeo = mesh.geometry.clone();
    const cloneMat = mesh.material.clone();
    this.activeMeshClone = new THREE.Mesh(cloneGeo, cloneMat);

    // Scale down to fit gizmo
    const box = new THREE.Box3().setFromObject(this.activeMeshClone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;
    this.activeMeshClone.scale.setScalar(scale);

    this.gizmoGroup.add(this.activeMeshClone);
  }

  createLabel(font, text, x, y, z) {
    const geo = new TextGeometry(text, { font, size: 0.35, height: 0.02 });
    geo.center();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x999999,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.labelGroup.add(mesh);
  }

  update() {
    if (this.activeMesh) {
      // Sync rotation of active mesh to gizmo
      this.activeMeshClone.quaternion.copy(this.activeMesh.quaternion);
    }

    // Keep labels upright
    this.labelGroup.quaternion.copy(this.activeMeshClone?.quaternion || new THREE.Quaternion());

    this.renderer.render(this.scene, this.camera);
  }
}
