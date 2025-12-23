// js/main.js
// Author: CCVO
// Purpose: Main entry point for GLTF Scene Modeler; handles rendering, UI, sculpting, undo/redo, view gizmo, and directional labels

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { viewGizmo } from "./viewGizmo.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

/* ===============================
   Renderer / Scene
================================ */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* ===============================
   Transform Controls
================================ */
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

/* ===============================
   Lighting & Grid
================================ */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(20, 20);
scene.add(gridHelper);

/* ===============================
   Directional Labels N/E/S/W
================================ */
const loader = new FontLoader();
loader.load("three/fonts/helvetiker_regular.typeface.json", font => {
  const labelColor = 0x888888;
  const createLabel = (text, pos) => {
    const geo = new TextGeometry(text, { font, size: 0.5, height: 0.05 });
    const mat = new THREE.MeshBasicMaterial({ color: labelColor, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
  };
  const gridSize = 10;
  createLabel("N", new THREE.Vector3(0, 0.01, -gridSize));
  createLabel("S", new THREE.Vector3(0, 0.01, gridSize));
  createLabel("E", new THREE.Vector3(gridSize, 0.01, 0));
  createLabel("W", new THREE.Vector3(-gridSize, 0.01, 0));
  console.log("Scene N/E/S/W labels added");
});

/* ===============================
   Undo / Redo
================================ */
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 20;

function saveState(mesh) {
  if (!mesh) return;
  undoStack.push(mesh.geometry.clone());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (!state.activeMesh || undoStack.length === 0) return;
  redoStack.push(state.activeMesh.geometry.clone());
  const prev = undoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = prev;
  state.activeMesh.geometry.computeVertexNormals();
}

function redo() {
  if (!state.activeMesh || redoStack.length === 0) return;
  undoStack.push(state.activeMesh.geometry.clone());
  const next = redoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = next;
  state.activeMesh.geometry.computeVertexNormals();
}

/* ===============================
   Application State
================================ */
const state = {
  mode: "sculpt",
  activeMesh: null,
  brush: null,
  wireframe: false,
  controls,
  transform,

  setMode(mode) {
    this.mode = mode;
    if (mode === "sculpt") {
      transform.detach();
      controls.enabled = true;
    } else {
      if (this.activeMesh) transform.attach(this.activeMesh);
      controls.enabled = mode !== "move";
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
    saveState(mesh);
  },

  createSphere() {
    clearActiveMesh();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe: this.wireframe })
    );
    setActiveMesh(mesh);
    saveState(mesh);
  },

  setTool(tool) { if (this.brush) this.brush.setTool(tool); },
  setRadius(r) { if (this.brush) this.brush.setRadius(r); },
  setStrength(s) { if (this.brush) this.brush.setStrength(s); },

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
   Mesh Management
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
   Sculpting
================================ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;

renderer.domElement.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt" || !state.activeMesh) return;
  sculpting = true;
  transform.detach();
  sculptAt(e);
});

renderer.domElement.addEventListener("pointerup", () => sculpting = false);

renderer.domElement.addEventListener("pointermove", e => {
  if (sculpting) sculptAt(e);
});

function sculptAt(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(state.activeMesh)[0];
  if (!hit) return;
  state.brush.apply(hit.point);
  saveState(state.activeMesh);
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
renderer.domElement.addEventListener("pointerleave", () => { cursorBrush.style.display = "none"; });

/* ===============================
   Keyboard Shortcuts
================================ */
window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") undo();
  if (e.ctrlKey && e.key === "y") redo();
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
   Initialize App
================================ */
state.createCube();
initUI(state);

// ViewGizmo in top-right, larger
const viewGizmoInstance = new viewGizmo(camera, controls, { size: 128, top: 12, right: 12 });

/* ===============================
   Render Loop
================================ */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  viewGizmoInstance.update();
}

animate();
