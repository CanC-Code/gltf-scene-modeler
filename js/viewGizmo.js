// js/viewGizmo.js
// Author: CCVO
// Purpose: Dynamic interactive camera orientation gizmo

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, mainControls, options = {}) {
    this.mainCamera = mainCamera;
    this.mainControls = mainControls;

    this.size = options.size || 120;
    this.mesh = null;

    /* Scene & Camera for Gizmo */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // transparent if needed

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* Lighting */
    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    /* Renderer */
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    Object.assign(this.renderer.domElement.style, {
      position: "fixed",
      top: "56px",
      right: "16px",
      width: `${this.size}px`,
      height: `${this.size}px`,
      zIndex: 20,
      cursor: "grab",
      border: "1px solid #555",
      background: "#222"
    });
    document.body.appendChild(this.renderer.domElement);

    /* Interaction */
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
      this.mainControls.rotateLeft(dx);
      this.mainControls.rotateUp(dy);
      this.mainControls.update();
      this.prev.set(e.clientX, e.clientY);
    });

    /* Gizmo Cube */
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshNormalMaterial({ wireframe: false })
    );
    this.scene.add(this.cube);
  }

  updateMesh(mesh) {
    if (mesh) {
      // Clone the mesh for gizmo visualization
      if (this.mesh) this.scene.remove(this.mesh);
      this.mesh = mesh.clone();
      this.mesh.material = new THREE.MeshNormalMaterial({ wireframe: false });
      // Fit the mesh into gizmo cube size
      const box = new THREE.Box3().setFromObject(this.mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 1.8 / maxDim; // fit into cube
        this.mesh.scale.setScalar(scale);
      }
      this.mesh.position.set(0, 0, 0);
      this.scene.add(this.mesh);
    } else if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }

  update() {
    // Orient cube to match main camera rotation
    const quat = this.mainCamera.quaternion.clone();
    this.cube.quaternion.copy(quat).invert();
    if (this.mesh) this.mesh.quaternion.copy(this.cube.quaternion);

    this.renderer.render(this.scene, this.camera);
  }
}
