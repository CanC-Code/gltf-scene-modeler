// js/viewGizmo.js
// Author: CCVO
// Purpose: Dynamic draggable ViewCube with labeled orientation for GLTF Scene Modeler

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 120; // larger cube
    this.labelSize = 24; // label font size

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Labels
    this.labels = {};
    const directions = ["F", "B", "L", "R", "T", "D"]; // Front, Back, Left, Right, Top, Down
    const positions = [
      [0, 0, 0.6],
      [0, 0, -0.6],
      [-0.6, 0, 0],
      [0.6, 0, 0],
      [0, 0.6, 0],
      [0, -0.6, 0],
    ];

    const loader = new THREE.TextureLoader();
    directions.forEach((dir, i) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.font = `${this.labelSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dir, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
      sprite.position.set(...positions[i]);
      sprite.scale.set(0.3, 0.3, 0.3);
      this.scene.add(sprite);
      this.labels[dir] = sprite;
    });

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "60px"; // lower to avoid menu
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "grab";
    this.renderer.domElement.style.zIndex = "20";

    document.body.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragging = false;

    this.renderer.domElement.addEventListener("pointerdown", e => {
      this.dragging = true;
      this.prevX = e.clientX;
      this.prevY = e.clientY;
    });
    window.addEventListener("pointerup", () => this.dragging = false);
    window.addEventListener("pointermove", e => {
      if (!this.dragging) return;
      const deltaX = e.clientX - this.prevX;
      const deltaY = e.clientY - this.prevY;
      this.prevX = e.clientX;
      this.prevY = e.clientY;
      this.rotateCamera(deltaX, deltaY);
    });

    this.renderer.domElement.addEventListener("click", e => this.onClick(e));
  }

  rotateCamera(dx, dy) {
    const angleX = dx / 150;
    const angleY = dy / 150;
    const offset = new THREE.Vector3().subVectors(this.mainCamera.position, this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= angleX;
    spherical.phi -= angleY;
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
    offset.setFromSpherical(spherical);
    this.mainCamera.position.copy(this.controls.target).add(offset);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
  }

  onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;
    const n = hit.face.normal.clone();
    const target = this.controls.target.clone();
    const distance = this.mainCamera.position.distanceTo(target);
    const newPos = n.multiplyScalar(distance).add(target);
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(target);
    this.controls.update();
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
