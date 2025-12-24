// js/viewGizmo.js
// Author: CCVO
// Purpose: Interactive camera orientation gizmo reflecting the active object dynamically

import * as THREE from "../three/three.module.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, mainControls, mainState, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = mainControls;
    this.state = mainState; // Reference to main scene state to get activeMesh
    this.size = options.size || 120;
    this.offset = options.offset || { top: 56, right: 16 };
    this.dragging = false;
    this.prev = new THREE.Vector2();

    // Scene
    this.scene = new THREE.Scene();

    // Gizmo Camera (Orthographic)
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.up.copy(this.mainCamera.up);
    this.camera.lookAt(0, 0, 0);

    // Gizmo Object placeholder
    this.gizmoObject = null;

    // Label Group
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);

    // Load Font & Labels
    const loader = new FontLoader();
    loader.load("../three/fonts/helvetiker_regular.typeface.json", font => {
      this.createLabel(font, "N",  0, 0, -1.2);
      this.createLabel(font, "S",  0, 0,  1.2);
      this.createLabel(font, "E",  1.2, 0,  0);
      this.createLabel(font, "W", -1.2, 0,  0);
    });

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      top: this.offset.top + "px",
      right: this.offset.right + "px",
      width: this.size + "px",
      height: this.size + "px",
      zIndex: 20,
      cursor: "grab",
      pointerEvents: "auto"
    });
    document.body.appendChild(this.renderer.domElement);

    // Interaction
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

      // Rotate main camera via controls
      this.controls.rotateLeft(dx);
      this.controls.rotateUp(dy);
      this.controls.update();

      this.prev.set(e.clientX, e.clientY);
    });
  }

  createLabel(font, text, x, y, z) {
    const geo = new TextGeometry(text, { font, size: 0.35, height: 0.02 });
    geo.center();
    const mat = new THREE.MeshBasicMaterial({ color: 0x999999, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.labelGroup.add(mesh);
  }

  update() {
    // If activeMesh exists, clone it into gizmo scene
    if (this.state.activeMesh) {
      if (!this.gizmoObject) {
        // Clone geometry + material
        this.gizmoObject = this.state.activeMesh.clone();
        this.scene.add(this.gizmoObject);
      } else {
        // Update geometry dynamically
        this.gizmoObject.geometry.dispose();
        this.gizmoObject.geometry = this.state.activeMesh.geometry.clone();
        // Update material if needed
        this.gizmoObject.material.dispose();
        this.gizmoObject.material = this.state.activeMesh.material.clone();
      }

      // Center & scale dynamically
      const bbox = new THREE.Box3().setFromObject(this.gizmoObject);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      this.gizmoObject.scale.setScalar(1 / maxDim);
      const center = bbox.getCenter(new THREE.Vector3());
      this.gizmoObject.position.copy(center).multiplyScalar(-1);
    }

    // Sync rotation with main camera
    if (this.gizmoObject) this.gizmoObject.quaternion.copy(this.mainCamera.quaternion);
    this.labelGroup.quaternion.copy(this.mainCamera.quaternion);

    this.renderer.render(this.scene, this.camera);
  }
}
