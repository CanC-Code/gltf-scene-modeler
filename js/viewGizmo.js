// js/viewGizmo.js
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

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(this.size, this.size);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    Object.assign(this.renderer.domElement.style, {
      position: "fixed", top: "12px", right: "12px",
      width: `${this.size}px`, height: `${this.size}px`,
      cursor: "grab", zIndex: 30, // Higher z-index to stay on top
      border: "2px solid #4a90e2", borderRadius: "8px"
    });
    document.body.appendChild(this.renderer.domElement);

    this.dragging = false;
    this.prev = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerdown", e => {
      e.stopPropagation();
      this.dragging = true;
      this.prev.set(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = "grabbing";
    });

    window.addEventListener("pointerup", () => {
      this.dragging = false;
      this.renderer.domElement.style.cursor = "grab";
    });

    window.addEventListener("pointermove", e => {
      if (!this.dragging) return;
      e.stopPropagation();
      
      const dx = (e.clientX - this.prev.x) * 0.01;
      const dy = (e.clientY - this.prev.y) * 0.01;
      
      // FIX: Removed the check for controls.enabled. 
      // The gizmo should ALWAYS rotate the camera, regardless of trackpad mode.
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
        
        // We must update the controls manually if they are disabled
        if (this.controls.enabled) this.controls.update();
      }
      this.prev.set(e.clientX, e.clientY);
    });

    this.activeMesh = null;
    this.meshClone = null;
  }

  updateMesh(mesh) {
    this.activeMesh = mesh;
    if (this.meshClone) {
      this.scene.remove(this.meshClone);
      if (this.meshClone.geometry) this.meshClone.geometry.dispose();
      if (this.meshClone.material) this.meshClone.material.dispose();
      this.meshClone = null;
    }
    if (!mesh) return;

    this.meshClone = mesh.clone();
    this.meshClone.material = new THREE.MeshNormalMaterial();
    this.meshClone.geometry = mesh.geometry.clone();

    const box = new THREE.Box3().setFromObject(this.meshClone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) this.meshClone.scale.setScalar(1.5 / maxDim);

    this.meshClone.position.set(0, 0, 0);
    this.scene.add(this.meshClone);
  }

  update() {
    if (this.activeMesh && this.meshClone) {
      this.meshClone.quaternion.copy(this.activeMesh.quaternion);
      this.meshClone.position.set(0, 0, 0);
      
      const mainCamDir = new THREE.Vector3();
      this.mainCamera.getWorldDirection(mainCamDir);
      
      this.camera.position.copy(mainCamDir).multiplyScalar(-4);
      this.camera.lookAt(0, 0, 0);
      this.camera.up.copy(this.mainCamera.up);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
