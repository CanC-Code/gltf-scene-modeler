// js/main.js
// Author: CCVO
// Purpose: Main entry point for GLTF Scene Modeler (Three.js r159)

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";

import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";

/* ============================================================
   Renderer / Scene
============================================================ */

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

/* ============================================================
   Camera
============================================================ */

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(4, 4, 6);
camera.lookAt(0, 0, 0);

/* ============================================================
   Controls
============================================================ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;

/* ============================================================
   Lighting
============================================================ */

scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(6, 10, 8);
scene.add(dirLight);

/* ============================================================
   Grid
============================================================ */

const grid = new THREE.GridHelper(20, 20, 0x666666, 0x999999);
grid.renderOrder = -20;
scene.add(grid);

/* ============================================================
   Cardinal Direction Labels (World-Aligned)
============================================================ */

function createDirectionSprite(label) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#999999"; // match grid color
  ctx.font = "48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 2, 1);
  sprite.renderOrder = -10;

  return sprite;
}

const north = createDirectionSprite("N");
north.position.set(0, 0.01, -9);

const south = createDirectionSprite("S");
south.position.set(0, 0.01, 9);

const east = createDirectionSprite("E");
east.position.set(9, 0.01, 0);

const west = createDirectionSprite("W");
west.position.set(-9, 0.01, 0);

scene.add(north, south, east, west);

/* ============================================================
   Transform Controls
============================================================ */

const transformControls = new TransformControls(camera, renderer.domElement);
scene.add(transformControls);

transformControls.addEventListener("dragging-changed", e => {
  controls.enabled = !e.value;
});

/* ============================================================
   Undo / Redo
============================================================ */

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

/* ============================================================
   Application State
============================================================ */

const state = {
  mode: "sculpt",
  activeMesh: null,
  brush: null,
  wireframe: false,

  setMode(mode) {
    this.mode = mode;
    if (mode === "sculpt") {
      transformControls.detach();
      controls.enabled = true;
    } else {
      if (this.activeMesh) transformControls.attach(this.activeMesh);
    }
  },

  createCube() {
    clearActiveMesh();

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2, 24, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x88ccff })
    );

    setActiveMesh(mesh);
    saveState(mesh);
  },

  createSphere() {
    clearActiveMesh();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88 })
    );

    setActiveMesh(mesh);
    saveState(mesh);
  },

  exportGLTF() {
    if (!this.activeMesh) return;

    new GLTFExporter().parse(this.activeMesh, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], {
        type: "application/json"
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "model.gltf";
      a.click();
    });
  }
};

/* ============================================================
   Mesh Management
============================================================ */

function clearActiveMesh() {
  if (!state.activeMesh) return;

  transformControls.detach();
  scene.remove(state.activeMesh);

  state.activeMesh.geometry.dispose();
  state.activeMesh.material.dispose();

  state.activeMesh = null;
  state.brush = null;
}

function setActiveMesh(mesh) {
  state.activeMesh = mesh;
  scene.add(mesh);
  transformControls.attach(mesh);
  state.brush = new SculptBrush(mesh);
}

/* ============================================================
   Sculpting
============================================================ */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;

renderer.domElement.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt" || !state.activeMesh) return;
  sculpting = true;
  transformControls.detach();
  sculptAt(e);
});

renderer.domElement.addEventListener("pointerup", () => {
  sculpting = false;
});

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

/* ============================================================
   Keyboard
============================================================ */

window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") undo();
  if (e.ctrlKey && e.key === "y") redo();
});

/* ============================================================
   Resize
============================================================ */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   Init
============================================================ */

state.createCube();
initUI(state);

const viewGizmo = new ViewGizmo(camera, controls, { size: 180 });

/* ============================================================
   Render Loop
============================================================ */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  viewGizmo.update();
}

animate();
