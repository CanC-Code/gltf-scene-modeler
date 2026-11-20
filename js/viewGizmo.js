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
    // Standard raycaster handles the world matrix automatically
    this.hitCube = new THREE.Mesh(hitGeo, hitMat);
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
      cursor: "grab", zIndex: 30, touchAction: "none",
      border: "2px solid #4a90e2", borderRadius: "8px"
    });
    document.body.appendChild(this.renderer.domElement);

    // Interaction
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._offset = new THREE.Vector3();
    this._spherical = new THREE.Spherical();
    this.dragging = false;
    this.activePointerId = null;
    this.prev = new THREE.Vector2();
    this.dragStart = new THREE.Vector2();
    this.clickedNormal = null;

    this.renderer.domElement.addEventListener("pointerdown", e => {
      e.stopPropagation();
      this.dragging = true;
      this.activePointerId = e.pointerId;
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
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
      if (!this.dragging) return;
      if (this.activePointerId !== null) {
        this.renderer.domElement.releasePointerCapture?.(this.activePointerId);
        this.activePointerId = null;
      }
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
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      e.stopPropagation();
      const dx = (e.clientX - this.prev.x) * 0.02;
      const dy = (e.clientY - this.prev.y) * 0.02;

      if (this.mainCamera && this.controls) {
        this._offset.copy(this.mainCamera.position).sub(this.controls.target);
        this._spherical.setFromVector3(this._offset);
        this._spherical.theta -= dx;
        this._spherical.phi -= dy;
        this._spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._spherical.phi));
        this._offset.setFromSpherical(this._spherical);
        this.mainCamera.position.copy(this.controls.target).add(this._offset);
        this.mainCamera.lookAt(this.controls.target);
        const prevDamping = this.controls.enableDamping;
        this.controls.enableDamping = false;
        this.controls.update();
        this.controls.enableDamping = prevDamping;
      }
      this.prev.set(e.clientX, e.clientY);
    });
  }

  snapToView(normal) {
    if (!this.mainCamera || !this.controls) return;
    const dist = this.mainCamera.position.distanceTo(this.controls.target);
    const newPos = this.controls.target.clone().add(normal.clone().multiplyScalar(dist));
    this.mainCamera.position.copy(newPos);
    this.mainCamera.lookAt(this.controls.target);
    this.controls.update();
    if (window.showToast) window.showToast("Camera snapped.");
  }

  updateMesh(mesh) {
    this._lastSourceMesh = mesh || null;
    if (this.meshClone) {
      this.cube.remove(this.meshClone);
      this.meshClone.geometry.dispose();
      this.meshClone.material.dispose();
      this.meshClone = null;
    }
    if (!mesh || !mesh.geometry) return;

    // Clone only the geometry so we don't inherit object position/rotation
    this.meshClone = new THREE.Mesh(mesh.geometry.clone());
    
    // Center the geometry perfectly within the cube
    this.meshClone.geometry.computeBoundingBox();
    const bbox = this.meshClone.geometry.boundingBox;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    this.meshClone.geometry.translate(-center.x, -center.y, -center.z);
    
    // Scale to fit the cube nicely
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) this.meshClone.scale.setScalar(1.4 / maxDim);

    const mat = mesh.material;
    const previewColor = mat && mat.color ? mat.color.getHex() : 0x88ccff;
    const previewMap = mat && mat.map ? mat.map : null;
    if (previewMap) previewMap.needsUpdate = true;
    this.meshClone.material = new THREE.MeshStandardMaterial({
      color: previewColor,
      map: previewMap,
      roughness: mat && mat.roughness !== undefined ? mat.roughness : 0.4,
      metalness: mat && mat.metalness !== undefined ? mat.metalness : 0.1,
      transparent: false,
      vertexColors: !!(mesh.geometry.attributes && mesh.geometry.attributes.color)
    });
    this.meshClone.material.needsUpdate = true;

    this.meshClone.raycast = () => {}; // Prevent clone from blocking raycasts
    this.cube.add(this.meshClone);
  }

  syncMesh(mesh) {
    if (!mesh || !mesh.geometry) {
      this.updateMesh(null);
      return;
    }
    const currentMap = mesh.material ? mesh.material.map || null : null;
    const srcPos = mesh.geometry.attributes.position;
    const clonePos = this.meshClone && this.meshClone.geometry.attributes.position;

    if (
      !this.meshClone ||
      this._lastSourceMesh !== mesh ||
      !srcPos ||
      !clonePos ||
      srcPos.count !== clonePos.count ||
      (this.meshClone.material.map || null) !== currentMap
    ) {
      this.updateMesh(mesh);
      return;
    }

    const _v = new THREE.Vector3();
    const _min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const _max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < srcPos.count; i++) {
      _v.fromBufferAttribute(srcPos, i);
      if (_v.x < _min.x) _min.x = _v.x;
      if (_v.y < _min.y) _min.y = _v.y;
      if (_v.z < _min.z) _min.z = _v.z;
      if (_v.x > _max.x) _max.x = _v.x;
      if (_v.y > _max.y) _max.y = _v.y;
      if (_v.z > _max.z) _max.z = _v.z;
    }
    const cx = (_min.x + _max.x) * 0.5;
    const cy = (_min.y + _max.y) * 0.5;
    const cz = (_min.z + _max.z) * 0.5;
    for (let i = 0; i < srcPos.count; i++) {
      clonePos.setXYZ(
        i,
        srcPos.getX(i) - cx,
        srcPos.getY(i) - cy,
        srcPos.getZ(i) - cz
      );
    }
    clonePos.needsUpdate = true;
    this.meshClone.geometry.computeBoundingBox();
    this.meshClone.geometry.computeBoundingSphere();
    const maxDim = Math.max(_max.x - _min.x, _max.y - _min.y, _max.z - _min.z);
    if (maxDim > 0) this.meshClone.scale.setScalar(1.4 / maxDim);

    const srcNorm = mesh.geometry.attributes.normal;
    const cloneNorm = this.meshClone.geometry.attributes.normal;
    if (srcNorm && cloneNorm && srcNorm.count === cloneNorm.count) {
      cloneNorm.array.set(srcNorm.array);
      cloneNorm.needsUpdate = true;
    }

    const srcCol = mesh.geometry.attributes.color;
    if (srcCol) {
      let cloneCol = this.meshClone.geometry.attributes.color;
      let matNeedsUpdate = false;
      if (!cloneCol || cloneCol.count !== srcCol.count) {
        cloneCol = new THREE.BufferAttribute(new Float32Array(srcCol.array), srcCol.itemSize);
        this.meshClone.geometry.setAttribute("color", cloneCol);
        matNeedsUpdate = true;
      } else {
        cloneCol.array.set(srcCol.array);
        cloneCol.needsUpdate = true;
      }
      if (!this.meshClone.material.vertexColors) {
        this.meshClone.material.vertexColors = true;
        matNeedsUpdate = true;
      }
      if (this.meshClone.material.color && this.meshClone.material.color.getHex() !== 0xffffff) {
        this.meshClone.material.color.setHex(0xffffff);
        matNeedsUpdate = true;
      }
      if (matNeedsUpdate) {
        this.meshClone.material.needsUpdate = true;
      }
    }

    if (currentMap) {
      currentMap.needsUpdate = true;
    }
  }

  update() {
    this.cube.quaternion.copy(this.mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}
