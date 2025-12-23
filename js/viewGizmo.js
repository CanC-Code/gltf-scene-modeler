// js/viewGizmo.js
// Author: CCVO
// Purpose: Provides a dynamic ViewCube gizmo with clickable/orbitable faces and orientation labels (N/E/S/W)

import * as THREE from "../three/three.module.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, controls, scene) {
    this.mainCamera = mainCamera;
    this.controls = controls;
    this.mainScene = scene;

    this.size = 128; // larger cube
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.camera.position.set(2, 2, 2);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Orientation labels (N/E/S/W)
    this.labels = [];
    this.loadFont();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "12px"; // top-right
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";
    document.body.appendChild(this.renderer.domElement);

    // Raycaster for click
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener("pointerdown", e => this.onPointerDown(e));
    this.renderer.domElement.addEventListener("pointermove", e => this.onPointerMove(e));

    this.dragging = false;
    this.prevMouse = new THREE.Vector2();
  }

  loadFont() {
    const loader = new FontLoader();
    loader.load("../three/fonts/helvetiker_regular.typeface.json", font => {
      this.font = font;
      this.createLabels();
    });
  }

  createLabels() {
    const labelPositions = {
      "N": new THREE.Vector3(0, 0, -1.2),
      "S": new THREE.Vector3(0, 0, 1.2),
      "E": new THREE.Vector3(1.2, 0, 0),
      "W": new THREE.Vector3(-1.2, 0, 0)
    };
    const mat = new THREE.MeshBasicMaterial({ color: 0x888888 }); // grid color

    for (const [text, pos] of Object.entries(labelPositions)) {
      const geo = new TextGeometry(text, { font: this.font, size: 0.2, height: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.lookAt(this.camera.position);
      this.scene.add(mesh);
      this.labels.push(mesh);
    }
  }

  onPointerDown(e) {
    this.dragging = true;
    this.prevMouse.set(e.clientX, e.clientY);
  }

  onPointerMove(e) {
    if (!this.dragging) return;
    const deltaX = e.clientX - this.prevMouse.x;
    const deltaY = e.clientY - this.prevMouse.y;
    this.prevMouse.set(e.clientX, e.clientY);

    const rotSpeed = 0.01;
    const offset = this.mainCamera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= deltaX * rotSpeed;
    spherical.phi -= deltaY * rotSpeed;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
    offset.setFromSpherical(spherical);

    this.mainCamera.position.copy(this.controls.target.clone().add(offset));
    this.mainCamera.lookAt(this.controls.target);
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.labels.forEach(l => l.lookAt(this.camera.position));
    this.renderer.render(this.scene, this.camera);
  }
}
