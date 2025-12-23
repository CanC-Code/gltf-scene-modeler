// js/viewGizmo.js
// Author: CCVO
// Purpose: Provides a view cube for orientation and interactive camera snapping

import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls, gridColor = 0x888888) {
    this.mainCamera = mainCamera;
    this.controls = controls;
    this.size = 128;

    // Gizmo scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // Labels for cube faces
    const loader = new THREE.FontLoader();
    loader.load("../three/utils/helvetiker_regular.typeface.json", font => {
      this.labels = [];
      const texts = ["F", "B", "L", "R", "U", "D"];
      const positions = [
        [0, 0, 0.6],
        [0, 0, -0.6],
        [-0.6, 0, 0],
        [0.6, 0, 0],
        [0, 0.6, 0],
        [0, -0.6, 0]
      ];
      texts.forEach((txt, i) => {
        const textGeo = new THREE.TextGeometry(txt, { font, size: 0.15, height: 0.01 });
        const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(textGeo, textMat);
        mesh.position.set(...positions[i]);
        this.scene.add(mesh);
        this.labels.push(mesh);
      });
    });

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "12px"; // top-right corner
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";
    document.body.appendChild(this.renderer.domElement);

    // Raycaster for clicks
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e => this.onClick(e));
    this.isDragging = false;
    this.lastPointer = null;

    // Drag orbit for mobile/desktop
    this.renderer.domElement.addEventListener("pointermove", e => this.onDrag(e));
    this.renderer.domElement.addEventListener("pointerup", () => (this.isDragging = false));
  }

  onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;
    const dir = hit.face.normal.clone();
    this.snapCamera(dir);
  }

  onDrag(e) {
    if (e.buttons !== 1) {
      this.isDragging = false;
      this.lastPointer = null;
      return;
    }
    if (!this.isDragging) {
      this.isDragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };

    const angleX = (dy / 100) * Math.PI;
    const angleY = (dx / 100) * Math.PI;

    const target = this.controls.target.clone();
    const offset = this.mainCamera.position.clone().sub(target);
    const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
    const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
    offset.applyQuaternion(quatX).applyQuaternion(quatY);
    this.mainCamera.position.copy(target.clone().add(offset));
    this.mainCamera.lookAt(target);
    this.controls.update();
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
