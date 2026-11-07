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

    // Main cube container
    this.cube = new THREE.Group();
    this.scene.add(this.cube);

    // 1. Invisible clickable cube (for face clicking)
    const hitGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitCube = new THREE.Mesh(hitGeo, hitMat);
    this.hitCube.raycast = (raycaster, intersects) => {
        // Custom raycast to return face normals easily
        const mesh = new THREE.Mesh(hitGeo);
        mesh.position.copy(this.cube.position);
        mesh.quaternion.copy(this.cube.quaternion);
        const tempHits = [];
        mesh.raycast(raycaster, tempHits);
        if (tempHits.length > 0) {
            intersects.push(tempHits[0]);
        }
    };
    this.cube.add(this.hitCube);

    // 2. Visible wireframe cube
    const wireMat = new THREE.LineBasicMaterial({ color: 0x333333 });
    const wireGeo = new THREE.EdgesGeometry(hitGeo);
    const wireCube = new THREE.LineSegments(wireGeo, wireMat);
    wireCube.raycast = () => {}; // ignore raycast
    this.cube.add(wireCube);

    // 3. Mesh clone for object preview
    this.meshClone = null;

    // 4. Extrusion handles (pegs on faces)
    this.handles = new THREE.Group();
    const handleGeo = new THREE.ConeGeometry(0.12, 0.3, 16);
    const handleMat = new THREE.MeshBasicMaterial({ color: 0x4a90e2 });

    const faceData = [
      { pos: [0, 0, 0.9], rot: [Math.PI/2, 0, 0], normal: [0, 0, 1] },   // Front
      { pos: [0, 0, -0.9], rot: [-Math.PI/2, 0, 0], normal: [0, 0, -1] },// Back
      { pos: [0.9, 0, 0], rot: [0, 0, -Math.PI/2], normal: [1, 0, 0] },  // Right
      { pos: [-0.9, 0, 0], rot: [0, 0, Math.PI/2], normal: [-1, 0, 0] }, // Left
      { pos: [0, 0.9, 0], rot: [0, 0, 0], normal: [0, 1, 0] },           // Top
      { pos: [0, -0.9, 0], rot: [Math.PI, 0, 0], normal: [0, -1, 0] }    // Bottom
    ];

    faceData.forEach(f => {
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(...f.pos);
      handle.rotation.set(...f.rot);
      handle.userData.normal = new THREE.Vector3(...f.normal);
      this.handles.add(handle);
    });
    this.cube.add(this.handles);

    // Renderer setup
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

    // Interaction
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

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);

      // First check handles
      const handleHits = this.raycaster.intersectObjects(this.handles.children);
      if (handleHits.length > 0) {
        this.clickedNormal = handleHits[0].object.userData.normal.clone();
        this.clickedNormal.applyQuaternion(this.cube.quaternion);
      } else {
        // Fallback to cube faces
        const cubeHits = this.raycaster.intersectObject(this.hitCube);
        if (cubeHits.length > 0 && cubeHits[0].face) {
          this.clickedNormal = cubeHits[0].face.normal.clone();
          this.clickedNormal.applyQuaternion(this.cube.quaternion);
        } else {
          this.clickedNormal = null;
        }
      }
    });

    window.addEventListener("pointerup", e => {
      this.dragging = false;
      this.renderer.domElement.style.cursor = "grab";
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
    const dist = this.mainCamera.position.distanceTo(this.controls.target);
    const newPos = this.controls.target.clone().add(normal.multiplyScalar(dist));
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
    if (window.showToast) window.showToast("Camera snapped.");
  }

  updateMesh(mesh) {
    if (this.meshClone) {
      this.cube.remove(this.meshClone);
      this.meshClone.geometry.dispose();
      this.meshClone = null;
    }
    if (!mesh) return;

    this.meshClone = mesh.clone();
    this.meshClone.geometry = mesh.geometry.clone();

    const box = new THREE.Box3().setFromObject(this.meshClone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) this.meshClone.scale.setScalar(1.2 / maxDim);
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.meshClone.position.sub(center);

    if (mesh.material) {
      this.meshClone.material = mesh.material.clone();
      this.meshClone.material.opacity = 1.0;       // Force opaque
      this.meshClone.material.transparent = false; // Prevent seeing through it
      this.meshClone.material.depthWrite = true;
      this.meshClone.material.map = mesh.material.map;
      this.meshClone.material.vertexColors = true; // Show vertex paint if any
    }

    this.cube.add(this.meshClone);
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
