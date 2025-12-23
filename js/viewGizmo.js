// js/viewGizmo.js
import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls) {
    this.mainCamera = mainCamera;
    this.controls = controls;

    this.size = 96;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    /* ---------- Scene ---------- */
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(3, 3, 3);
    this.camera.lookAt(0, 0, 0);

    /* ---------- Cube ---------- */
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.4,
      metalness: 0.0
    });

    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);

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
    this.renderer.domElement.style.cursor = "grab";
    this.renderer.domElement.style.zIndex = "20";

    document.body.appendChild(this.renderer.domElement);

    /* ---------- Interaction ---------- */
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e =>
      this.onPointerDown(e)
    );
    window.addEventListener("pointermove", e =>
      this.onPointerMove(e)
    );
    window.addEventListener("pointerup", () =>
      this.onPointerUp()
    );
  }

  /* ===============================
     Pointer Handling
  ================================ */
  onPointerDown(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObject(this.cube)[0];
    if (!hit) return;

    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.renderer.domElement.style.cursor = "grabbing";
  }

  onPointerMove(e) {
    if (!this.dragging) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;

    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.orbitCamera(dx, dy);
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.renderer.domElement.style.cursor = "grab";
  }

  /* ===============================
     Orbit Logic
  ================================ */
  orbitCamera(dx, dy) {
    const target = this.controls.target;
    const offset = this.mainCamera.position.clone().sub(target);

    const spherical = new THREE.Spherical();
    spherical.setFromVector3(offset);

    const ROTATE_SPEED = 0.005;

    spherical.theta -= dx * ROTATE_SPEED;
    spherical.phi -= dy * ROTATE_SPEED;

    // prevent flipping
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

    offset.setFromSpherical(spherical);
    this.mainCamera.position.copy(target).add(offset);
    this.mainCamera.lookAt(target);

    this.controls.update();
  }

  /* ===============================
     Snap (Click without drag)
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
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
