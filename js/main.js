// js/main.js
// Author: CCVO
// Purpose: Core logic of the GLTF Scene Modeler; fully compatible with desktop and mobile/touch devices. Adds multi-mesh support, undo/redo, dynamic brush cursor, and mobile-friendly controls.

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
  meshes: [],
  activeMesh: null,
  brush: null,
  wireframe: false,
  controls,
  transform,
  undoStack: [],
  redoStack: [],
  isTouch: 'ontouchstart' in window,
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
    this.meshes.forEach(mesh => mesh.material.wireframe = this.wireframe);
  },
  addMesh(mesh) {
    this.meshes.push(mesh);
    scene.add(mesh);
    setActiveMesh(mesh);
  },
  createCube() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2, 24, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe: this.wireframe })
    );
    this.addMesh(mesh);
  },
  createSphere() {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe: this.wireframe })
    );
    this.addMesh(mesh);
  },
  setTool(t) {
    if (this.brush) this.brush.setTool(t);
  },
  setRadius(r) {
    if (this.brush) {
      this.brush.setRadius(r);
      const scale = this.isTouch ? 2 : 1; // larger brush for touch
      cursorBrush.style.width = r * 40 * scale + "px";
      cursorBrush.style.height = r * 40 * scale + "px";
    }
  },
  setStrength(s) {
    if (this.brush) this.brush.setStrength(s);
  },
  exportGLTF() {
    if (!this.meshes.length) return;
    const group = new THREE.Group();
    this.meshes.forEach(m => group.add(m.clone()));
    new GLTFExporter().parse(group, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "scene.gltf";
      a.click();
    });
  },
  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => {
      new GLTFLoader().parse(reader.result, "", gltf => {
        gltf.scene.traverse(obj => {
          if (obj.isMesh) this.addMesh(obj);
        });
      });
    };
    reader.readAsArrayBuffer(e.target.files[0]);
  },
  undo() {
    if (!this.undoStack.length) return;
    const last = this.undoStack.pop();
    this.redoStack.push(last);
    last.restore();
  },
  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    next.restore();
  }
};

/* ===============================
   Active Mesh Handling
================================ */
function setActiveMesh(mesh) {
  state.activeMesh = mesh;
  transform.attach(mesh);
  state.brush = new SculptBrush(mesh, state); // pass state for undo
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

renderer.domElement.addEventListener("pointerup", e => {
  sculpting = false;
  if (state.activeMesh && state.mode !== "sculpt") transform.attach(state.activeMesh);

  // Tap-to-select for mobile
  if (state.isTouch && state.mode !== "sculpt") {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(state.meshes);
    if (intersects.length) setActiveMesh(intersects[0].object);
  }
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
   Multi-Mesh Selection via Click
================================ */
// Already covered by pointerup for touch, double-click for desktop
renderer.domElement.addEventListener("dblclick", e => {
  if (!state.isTouch) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(state.meshes);
    if (intersects.length) setActiveMesh(intersects[0].object);
  }
});

/* ===============================
   Keyboard Shortcuts
================================ */
window.addEventListener("keydown", e => {
  if (state.isTouch) return; // keyboard shortcuts ignored on touch
  switch (e.key.toLowerCase()) {
    case "s": state.setMode("sculpt"); break;
    case "m": state.setMode("move"); break;
    case "r": state.setMode("rotate"); break;
    case "e": state.setMode("scale"); break;
    case "z": if (e.ctrlKey) state.undo(); break;
    case "y": if (e.ctrlKey) state.redo(); break;
  }
});

/* ===============================
   TransformControls Mobile Fix
================================ */
transform.addEventListener('dragging-changed', function (event) {
  controls.enabled = !event.value;
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
