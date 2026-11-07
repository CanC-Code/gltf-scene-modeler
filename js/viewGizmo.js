import * as THREE from "../three/three.module.js";

export class ViewGizmo {
  constructor(mainCamera, controls, options = {}) {
    this.mainCamera = mainCamera;
    this.controls = controls;
    this.size = options.size || 96;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 4);
    this.camera.lookAt(0, 0, 0);

    const amb = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    // Standard ViewCube geometry
    const cubeSize = 1.5;
    const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    
    // Use a nice grey material
    const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.1 });
    this.cube = new THREE.Mesh(geo, mat);
    
    // Add distinct edges for the "Blender/Maya" look
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 })
    );
    this.cube.add(edges);
    this.scene.add(this.cube);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    Object.assign(this.renderer.domElement.style, {
      position: "fixed", top: "12px", right: "12px",
      width: `${this.size}px`, height: `${this.size}px`,
      cursor: "grab", zIndex: 30,
      border: "2px solid #4a90e2", borderRadius: "8px"
    });
    document.body.appendChild(this.renderer.domElement);

    // Interaction State
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragging = false;
    this.prev = new THREE.Vector2();
    this.dragStart = new THREE.Vector2();
    this.clickedNormal = null;

    this.renderer.domElement.addEventListener("pointerdown", e => {
      e.stopPropagation();
      this.dragging = true;
      this.prev.set(e.clientX, e.clientY);
      this.dragStart.set(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = "grabbing";

      // Raycast to see if we clicked a face
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObject(this.cube);
      
      if (hits.length > 0) {
        // Store the normal, transformed by the cube's current rotation
        this.clickedNormal = hits[0].face.normal.clone();
        this.clickedNormal.applyQuaternion(this.cube.quaternion);
      } else {
        this.clickedNormal = null;
      }
    });

    window.addEventListener("pointerup", e => {
      this.dragging = false;
      this.renderer.domElement.style.cursor = "grab";
      
      // If pointer didn't move much, it's a click -> Snap!
      const dist = this.dragStart.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
      if (dist < 5 && this.clickedNormal) {
        this.snapToView(this.clickedNormal);
      }
      this.clickedNormal = null;
    });

    window.addEventListener("pointermove", e => {
      if (!this.dragging) return;
      e.stopPropagation();

      const dx = (e.clientX - this.prev.x) * 0.01;
      const dy = (e.clientY - this.prev.y) * 0.01;

      if (this.mainCamera && this.controls) {
        const offset = new THREE.Vector3();
        offset.copy(this.mainCamera.position).sub(this.controls.target);

        const spherical = new THREE.Spherical();
        spherical.setFromVector3(offset);

        spherical.theta -= dx;
        spherical.phi -= dy;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        offset.setFromSpherical(spherical);
        this.mainCamera.position.copy(this.controls.target).add(offset);
        this.mainCamera.lookAt(this.controls.target);
      }
      this.prev.set(e.clientX, e.clientY);
    });
  }

  snapToView(normal) {
    if (!this.mainCamera || !this.controls) return;
    
    // The clickedNormal is already in world space relative to the gizmo
    const dist = this.mainCamera.position.distanceTo(this.controls.target);
    const newPos = this.controls.target.clone().add(normal.multiplyScalar(dist));
    
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
    
    if (window.showToast) window.showToast("Camera snapped.");
  }

  updateMesh(mesh) {
    // No longer used (we use a fixed ViewCube instead of cloning the mesh)
  }

  update() {
    // Keep the cube rotated to match the camera
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
