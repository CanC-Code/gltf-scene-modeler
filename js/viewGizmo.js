// js/viewGizmo.js
import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 96;

    /* ---------- Scene ---------- */
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* ---------- Cube ---------- */
    const geo = new THREE.BoxGeometry(1, 1, 1);

    // Use solid material so faces read clearly
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.4,
      metalness: 0.0
    });

    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

    // subtle lighting so faces are distinguishable
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 5, 5);
    this.scene.add(light);

    /* ---------- Renderer ---------- */
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });

    this.renderer.setSize(this.size, this.size);
    this.renderer.domElement.style.position = "fixed";
    this.renderer.domElement.style.top = "12px";
    this.renderer.domElement.style.right = "12px";
    this.renderer.domElement.style.cursor = "pointer";
    this.renderer.domElement.style.zIndex = "20";

    document.body.appendChild(this.renderer.domElement);

    /* ---------- Interaction ---------- */
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e =>
      this.onClick(e)
    );
  }

  /* ===============================
     Interaction
  ================================ */
  onClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;

    // Convert face normal into world-space direction
    const dir = hit.face.normal
      .clone()
      .applyQuaternion(this.cube.quaternion)
      .normalize();

    this.snapCamera(dir);
  }

  /* ===============================
     Camera Snap
  ================================ */
  snapCamera(direction) {
    const target = this.controls.target.clone();
    const distance = this.mainCamera.position.distanceTo(target);

    const newPos = direction.multiplyScalar(distance).add(target);

    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(target);
    this.controls.update();
  }

  /* ===============================
     Update
  ================================ */
  update() {
    // Mirror main camera orientation
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
