// js/main.js
// Author: CCVO
// Purpose: Core logic of the GLTF Scene Modeler; sets up Three.js scene, camera, renderer, controls, sculpting tools, gizmos, and GLTF import/export.

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

/* ===============================
   Core Setup
================================ */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Transform Gizmo
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

/* ===============================
   Lighting & Helpers
================================ */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);
scene.add(new THREE.GridHelper(20, 20));

/* ===============================
   App State
================================ */
const state = {
  mode: "sculpt",
  activeMesh: null,
  brush: null,
  wireframe: false,
  controls,
  transform,
  setMode(m) {
    this.mode = m;
    if (m === "sculpt") {
      this.transform.detach();
      controls.enabled = true;
    } else {
      if (this.activeMesh) this.transform.attach(this.activeMesh);
      controls.enabled = m !== "move";
    }
  },
  toggleWireframe() {
    this.wireframe = !this.wireframe;
    if (this.activeMesh) this.activeMesh.material.wireframe = this.wireframe;
  },
  createCube() {
    clearActiveMesh();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2, 24, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe: this.wireframe })
    );
    setActiveMesh(mesh);
  },
  createSphere() {
    clearActiveMesh();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe: this.wireframe })
    );
    setActiveMesh(mesh);
  },
  setTool(t) {
    if (this.brush) this.brush.setTool(t);
  },
  setRadius(r) {
    if (this.brush) this.brush.setRadius(r);
  },
  setStrength(s) {
    if (this.brush) this.brush.setStrength(s);
  },
  exportGLTF() {
    if (!this.activeMesh) return;
    new GLTFExporter().parse(this.activeMesh, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "model.gltf";
      a.click();
    });
  },
  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => {
      new GLTFLoader().parse(reader.result, "", gltf => {
        const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
        if (mesh) setActiveMesh(mesh);
      });
    };
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

/* ===============================
   Active Mesh Handling
================================ */
function clearActiveMesh() {
  if (!state.activeMesh) return;
  transform.detach();
  scene.remove(state.activeMesh);
  state.activeMesh.geometry.dispose();
  state.activeMesh.material.dispose();
  state.activeMesh = null;
  state.brush = null;
}

function setActiveMesh(mesh) {
  state.activeMesh = mesh;
  scene.add(mesh);
  transform.attach(mesh);
  state.brush = new SculptBrush(mesh);
}

/* ===============================
   Sculpting Core
================================ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;

renderer.domElement.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt" || !state.activeMesh) return;
  sculpting = true;
  transform.detach();
  sculptAtPointer(e);
});

renderer.domElement.addEventListener("pointerup", () => {
  sculpting = false;
  if (state.activeMesh && state.mode !== "sculpt") transform.attach(state.activeMesh);
});

renderer.domElement.addEventListener("pointermove", e => {
  if (sculpting) sculptAtPointer(e);
});

function sculptAtPointer(e) {
  if (!state.activeMesh) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(state.activeMesh)[0];
  if (!hit) return;
  state.brush.apply(hit.point);
}

/* ===============================
   Cursor Brush
================================ */
const cursorBrush = document.getElementById("cursorBrush");
renderer.domElement.addEventListener("pointermove", e => {
  cursorBrush.style.left = e.clientX + "px";
  cursorBrush.style.top = e.clientY + "px";
  cursorBrush.style.display = "block";
});
renderer.domElement.addEventListener("pointerleave", () => {
  cursorBrush.style.display = "none";
});

/* ===============================
   Resize Handling
================================ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===============================
   Default Cube
================================ */
state.createCube();

/* ===============================
   UI Initialization
================================ */
initUI(state);

/* ===============================
   Render Loop
================================ */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ===============================
   Enhancement Suggestions:
   - Add keyboard shortcuts for tools
   - Snap transform gizmo to grid option
   - Multiple mesh selection / group sculpting
   - Save / load multiple meshes in one scene
   - Scene undo/redo history
================================ */
