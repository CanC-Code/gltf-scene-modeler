// js/viewGizmo.js
// Author: CCVO
// Purpose: Dynamic miniature camera/orientation gizmo with auto-scaling

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, mainControls, options = {}) {
    this.mainCamera = mainCamera;
    this.mainControls = mainControls;
    this.size = options.size || 180;
    this.activeMesh = null;

    /* Scene */
    this.scene = new THREE.Scene();

    /* Orthographic camera for gizmo */
    const s = 2;
    this.camera = new THREE.OrthographicCamera(-s, s, s, -s, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* Renderer */
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
    window.addEventListener("pointermove", e => this.onDrag(e));

    /* Labels */
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);
    const loader = new FontLoader();
    loader.load("../three/fonts/helvetiker_regular.typeface.json", font => {
      this.font = font;
      this.createLabels();
    });
  }

  onDrag(e) {
    if (!this.dragging) return;
    const dx = (e.clientX - this.prev.x) * 0.005;
    const dy = (e.clientY - this.prev.y) * 0.005;

    this.mainControls.rotateLeft(dx);
    this.mainControls.rotateUp(dy);
    this.mainControls.update();

    this.prev.set(e.clientX, e.clientY);
  }

  setActiveMesh(mesh) {
    if (this.activeMesh) this.scene.remove(this.activeMesh);
    this.activeMesh = mesh ? mesh.clone() : null;

    if (this.activeMesh) {
      this.activeMesh.traverse(c => {
        if (c.isMesh) {
          c.material = new THREE.MeshNormalMaterial();
        }
      });
      this.scene.add(this.activeMesh);
      this.computeScale();
    }
  }

  computeScale() {
    if (!this.activeMesh) return;

    // Compute bounding box of mesh
    const box = new THREE.Box3().setFromObject(this.activeMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    // Scale down the mesh to fit within the gizmo
    const scale = maxDim > 0 ? 1.5 / maxDim : 1;
    this.activeMesh.scale.setScalar(scale);

    // Center the mesh
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.activeMesh.position.sub(center.multiplyScalar(scale));
  }

  createLabels() {
    if (!this.font) return;
    this.labelGroup.clear();

    const labels = [
      { text: "N", pos: [0, 0, -1.2] },
      { text: "S", pos: [0, 0, 1.2] },
      { text: "E", pos: [1.2, 0, 0] },
      { text: "W", pos: [-1.2, 0, 0] }
    ];

    labels.forEach(l => {
      const geo = new TextGeometry(l.text, { font: this.font, size: 0.35, height: 0.02 });
      geo.center();
      const mat = new THREE.MeshBasicMaterial({ color: 0x999999, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...l.pos);
      this.labelGroup.add(mesh);
    });
  }

  update() {
    // Keep labels facing camera
    this.labelGroup.quaternion.copy(this.camera.quaternion);

    // Align gizmo mesh to main camera
    if (this.activeMesh) {
      const m = new THREE.Matrix4();
      m.extractRotation(this.mainCamera.matrixWorld);
      this.activeMesh.quaternion.setFromRotationMatrix(m);
      this.computeScale();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
