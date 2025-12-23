// js/viewGizmo.js
// Author: CCVO
// Purpose: Interactive view cube with N/E/S/W labels

import * as THREE from "../three/three.module.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 160; // slightly larger
    this.offsetTop = 12;
    this.offsetRight = 12;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Main cube
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = this.offsetTop + "px";
    this.renderer.domElement.style.right = this.offsetRight + "px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";
    document.body.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;

    this.renderer.domElement.addEventListener("pointerdown", e => this.onPointerDown(e));
    this.renderer.domElement.addEventListener("pointermove", e => this.onPointerMove(e));
    this.renderer.domElement.addEventListener("pointerup", e => this.onPointerUp(e));

    this.font = null;
    this.labels = [];
    this.loadFont();
  }

  loadFont() {
    const loader = new FontLoader();
    loader.load(
      "three/fonts/helvetiker_regular.typeface.json",
      font => {
        console.log("ViewGizmo font loaded successfully");
        this.font = font;
        this.createLabels();
      },
      undefined,
      err => console.error("Font failed to load:", err)
    );
  }

  createLabels() {
    if (!this.font) return;
    const directions = ["N", "E", "S", "W"];
    const positions = [
      new THREE.Vector3(0, 0, 1.5),
      new THREE.Vector3(1.5, 0, 0),
      new THREE.Vector3(0, 0, -1.5),
      new THREE.Vector3(-1.5, 0, 0)
    ];

    directions.forEach((dir, i) => {
      const textGeo = new TextGeometry(dir, { font: this.font, size: 0.25, height: 0.05 });
      const mat = new THREE.MeshBasicMaterial({ color: 0x888888, depthTest: false });
      const mesh = new THREE.Mesh(textGeo, mat);
      mesh.position.copy(positions[i]);
      this.scene.add(mesh);
      this.labels.push(mesh);
    });

    console.log("ViewGizmo N/E/S/W labels created");
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.updateMouse(e);
    this.snapCameraIfClicked();
  }

  onPointerMove(e) {
    if (!this.isDragging) return;
    this.updateMouse(e);
    // dynamic orbit
    const deltaX = e.movementX * 0.005;
    const deltaY = e.movementY * 0.005;
    this.mainCamera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX);
    this.mainCamera.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), -deltaY);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
  }

  onPointerUp() {
    this.isDragging = false;
  }

  updateMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  snapCameraIfClicked() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;
    const n = hit.face.normal.clone();
    this.snapCamera(n);
  }

  snapCamera(dir) {
    dir.normalize();
    const target = this.controls.target.clone();
    const distance = this.mainCamera.position.distanceTo(target);
    const newPos = dir.multiplyScalar(distance).add(target);
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(target);
    this.controls.update();
    console.log("ViewGizmo camera snapped to direction:", dir);
  }

  update() {
    // Keep cube oriented correctly
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();

    // Ensure labels render in front of cube but behind main model
    this.labels.forEach(l => l.lookAt(this.camera.position));

    this.renderer.render(this.scene, this.camera);
  }
}
