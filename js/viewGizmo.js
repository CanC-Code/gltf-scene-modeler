// js/viewGizmo.js
// Author: CCVO
// Purpose: Interactive camera orientation gizmo aligned with world axes

import * as THREE from "../three/three.module.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = options.size || 160;

    /* Scene */
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* Cube */
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubeMat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(cubeGeo, cubeMat);
    this.scene.add(this.cube);

    /* Labels */
    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);

    const loader = new FontLoader();
    loader.load("../three/fonts/helvetiker_regular.typeface.json", font => {
      this.createLabel(font, "N",  0, 0, -1.2);
      this.createLabel(font, "S",  0, 0,  1.2);
      this.createLabel(font, "E",  1.2, 0,  0);
      this.createLabel(font, "W", -1.2, 0,  0);
    });

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

  createLabel(font, text, x, y, z) {
    const geo = new TextGeometry(text, {
      font,
      size: 0.35,
      height: 0.02
    });

    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    geo.center();

    this.labelGroup.add(mesh);
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.labelGroup.quaternion.copy(this.cube.quaternion);

    this.renderer.render(this.scene, this.camera);
  }
}
