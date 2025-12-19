import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

/* =========================
   Renderer / Scene
========================= */

const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x1e1e1e);

const scene = new THREE.Scene();

/* =========================
   Camera
========================= */

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 2, 5);

/* =========================
   Lights
========================= */

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(5, 10, 5);
scene.add(key);

/* =========================
   Orbit Controls
========================= */

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableRotate = false;
controls.enablePan = false;

/* =========================
   Transform Controls
========================= */

const transformControls = new TransformControls(camera, canvas);
scene.add(transformControls);

transformControls.addEventListener("dragging-changed", e => {
  controls.enabled = !e.value;
});

/* =========================
   Mesh Management
========================= */

let activeMesh = null;
let wireframe = false;

function setActiveMesh(mesh) {
  if (activeMesh) {
    scene.remove(activeMesh);
    activeMesh.geometry.dispose();
    activeMesh.material.dispose();
  }

  activeMesh = mesh;
  scene.add(mesh);

  transformControls.attach(mesh);
  state.brush = new SculptBrush(mesh);
}

/* =========================
   Mesh Creation
========================= */

function createCube() {
  const geo = new THREE.BoxGeometry(1, 1, 1, 40, 40, 40);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    wireframe
  });
  setActiveMesh(new THREE.Mesh(geo, mat));
}

function createSphere() {
  const geo = new THREE.SphereGeometry(0.75, 64, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    wireframe
  });
  setActiveMesh(new THREE.Mesh(geo, mat));
}

/* =========================
   Export
========================= */

function exportGLTF() {
  if (!activeMesh) return;

  const exporter = new GLTFExporter();
  exporter.parse(activeMesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model.gltf";
    a.click();
  });
}

/* =========================
   State (UI CONTRACT)
========================= */

const state = {
  mode: "sculpt",
  brush: null,

  setMode(mode) {
    this.mode = mode;
    transformControls.visible = mode === "transform";
    controls.enableRotate = mode === "transform";
  },

  setTransform(type) {
    transformControls.setMode(type);
  },

  toggleWireframe() {
    wireframe = !wireframe;
    if (activeMesh) activeMesh.material.wireframe = wireframe;
  },

  setTool(tool) {
    this.brush?.setTool(tool);
  },

  setRadius(r) {
    this.brush?.setRadius(r);
  },

  setStrength(s) {
    this.brush?.setStrength(s);
  },

  createCube,
  createSphere,
  exportGLTF
};

/* =========================
   Sculpting
========================= */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;

function getHit(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  return hit?.point ?? null;
}

canvas.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt" || !activeMesh) return;
  if (e.button !== 0) return;

  sculpting = true;
  controls.enableRotate = false;
});

canvas.addEventListener("pointerup", () => {
  sculpting = false;
});

canvas.addEventListener("pointermove", e => {
  if (!sculpting || !state.brush) return;
  const p = getHit(e);
  if (p) state.brush.apply(p);
});

/* =========================
   Defaults
========================= */

createCube();
initUI(state);

/* =========================
   Resize & Render
========================= */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();