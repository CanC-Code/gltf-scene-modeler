// js/viewGizmo.js
// Author: CCVO
// Purpose: Miniature interactive view gizmo reflecting the active mesh orientation

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = options.size || 120;

    // Gizmo scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Light (optional, not strictly needed with MeshNormalMaterial)
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);

    // Gizmo mesh
    this.gizmoMesh = null;

    // Group for labels (N/E/S/W)
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);

    // Create renderer
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

    this.activeMesh = null;
  }

  setActiveMesh(mesh) {
    // Remove previous gizmo mesh
    if (this.gizmoMesh) {
      this.scene.remove(this.gizmoMesh);
      this.gizmoMesh.geometry.dispose();
      if (Array.isArray(this.gizmoMesh.material)) {
        this.gizmoMesh.material.forEach(m => m.dispose());
      } else {
        this.gizmoMesh.material.dispose();
      }
    }

    if (!mesh) return;

    // Clone geometry and create a simple material to avoid lighting issues
    const geo = mesh.geometry.clone();
    const mat = new THREE.MeshNormalMaterial();
    this.gizmoMesh = new THREE.Mesh(geo, mat);

    // Compute bounding box to scale gizmo appropriately
    const box = new THREE.Box3().setFromObject(this.gizmoMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim; // scale to fit inside gizmo viewport
    this.gizmoMesh.scale.setScalar(scale);

    this.scene.add(this.gizmoMesh);

    this.activeMesh = mesh;
  }

  createLabel(text, position) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#888888";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.5, 0.5);
    this.labelGroup.add(sprite);
  }

  initLabels() {
    this.labelGroup.clear();
    this.createLabel("N", new THREE.Vector3(0, 0, -1.5));
    this.createLabel("S", new THREE.Vector3(0, 0, 1.5));
    this.createLabel("E", new THREE.Vector3(1.5, 0, 0));
    this.createLabel("W", new THREE.Vector3(-1.5, 0, 0));
  }

  update() {
    if (!this.activeMesh) return;

    // Copy rotation to match camera view
    this.gizmoMesh.quaternion.copy(this.activeMesh.quaternion);

    // Render
    this.renderer.render(this.scene, this.camera);
  }
}
