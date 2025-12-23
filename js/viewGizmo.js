// js/viewGizmo.js
// Author: CCVO
// Purpose: Provides a dynamic view cube gizmo with face labels for orientation and click-orbit functionality

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 120;
    this.offset = 16; // px from corner
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    // Cube
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Labels for faces
    this.labels = {};
    const faces = ["F", "B", "L", "R", "T", "D"];
    const positions = [
      [0, 0, 0.6],  // Front
      [0, 0, -0.6], // Back
      [-0.6, 0, 0], // Left
      [0.6, 0, 0],  // Right
      [0, 0.6, 0],  // Top
      [0, -0.6, 0]  // Bottom
    ];
    const canvasTexture = face => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(face, 32, 32);
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    faces.forEach((f, i) => {
      const spriteMat = new THREE.SpriteMaterial({
        map: canvasTexture(f),
        depthTest: false,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.5, 0.5, 0.5);
      sprite.position.set(...positions[i]);
      this.cube.add(sprite);
      this.labels[f] = sprite;
    });

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.bottom = this.offset + "px";
    this.renderer.domElement.style.right = this.offset + "px";
    this.renderer.domElement.style.cursor = "grab";
    this.renderer.domElement.style.zIndex = "20";
    document.body.appendChild(this.renderer.domElement);

    // Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;

    this.renderer.domElement.addEventListener("pointerdown", e => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    this.renderer.domElement.addEventListener("pointermove", e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      // Orbit the main camera based on drag
      const rotSpeed = 0.005;
      this.controls.rotateLeft(dx * rotSpeed);
      this.controls.rotateUp(dy * rotSpeed);
      this.controls.update();
    });

    this.renderer.domElement.addEventListener("pointerup", e => {
      this.isDragging = false;

      // Click detection
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.intersectObject(this.cube)[0];
      if (!hit) return;
      const n = hit.face.normal.clone();
      this.snapCamera(n);
    });
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
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
