// js/viewGizmo.js
// Author: CCVO
// Purpose: Provides an interactive ViewCube for scene orientation; allows dynamic orbiting and shows axis directions

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 96;

    // Scene and camera for the cube
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Cube geometry
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Orientation labels
    this.createLabels();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "60px"; // lowered from 12px
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "grab";
    this.renderer.domElement.style.zIndex = "20";

    document.body.appendChild(this.renderer.domElement);

    // Mouse interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.prevMouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e => this.onPointerDown(e));
    this.renderer.domElement.addEventListener("pointermove", e => this.onPointerMove(e));
    this.renderer.domElement.addEventListener("pointerup", () => this.onPointerUp());
  }

  createLabels() {
    // Simple text sprites for each cube direction
    const createLabel = text => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 64);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      return new THREE.Sprite(mat);
    };

    const front = createLabel("Front");
    front.position.set(0, 0, 0.6);
    const back = createLabel("Back");
    back.position.set(0, 0, -0.6);
    const left = createLabel("Left");
    left.position.set(-0.6, 0, 0);
    const right = createLabel("Right");
    right.position.set(0.6, 0, 0);
    const top = createLabel("Top");
    top.position.set(0, 0.6, 0);
    const bottom = createLabel("Bottom");
    bottom.position.set(0, -0.6, 0);

    this.scene.add(front, back, left, right, top, bottom);
  }

  onPointerDown(e) {
    this.isDragging = true;
    this.prevMouse.set(e.clientX, e.clientY);
    this.renderer.domElement.style.cursor = "grabbing";

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (hit) {
      // Snap camera to clicked face
      const n = hit.face.normal.clone();
      this.snapCamera(n);
    }
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.prevMouse.x;
    const deltaY = e.clientY - this.prevMouse.y;
    this.prevMouse.set(e.clientX, e.clientY);

    // Orbit main camera around target based on drag
    const offset = this.mainCamera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    const ROTATE_SPEED = 0.005;
    spherical.theta -= deltaX * ROTATE_SPEED;
    spherical.phi -= deltaY * ROTATE_SPEED;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    offset.setFromSpherical(spherical);
    this.mainCamera.position.copy(this.controls.target).add(offset);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
  }

  onPointerUp() {
    this.isDragging = false;
    this.renderer.domElement.style.cursor = "grab";
  }

  snapCamera(dir) {
    dir.normalize();
    const target = this.controls.target.clone();
    const distance = this.mainCamera.position.distanceTo(target);
    const newPos = dir.multiplyScalar(distance).add(target);
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(target);
    this.controls.update();
  }

  update() {
    // Cube always faces camera
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
