import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

/* =========================
   Renderer / Scene / Camera
========================= */

const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x1e1e1e);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera.position.set(0, 2, 5);

/* =========================
   Lights (high contrast)
========================= */

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(5, 10, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.4);
rimLight.position.set(-5, 3, -5);
scene.add(rimLight);

/* =========================
   Controls
========================= */

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableRotate = false; // DEFAULT OFF
controls.enablePan = false;
controls.enableZoom = true;

/* =========================
   State
========================= */

const state = {
  mode: "sculpt", // sculpt | transform | view
  isSculpting: false,
  mesh: null,
  brush: null
};

/* =========================
   Default Mesh
========================= */

const geometry = new THREE.BoxGeometry(1, 1, 1, 40, 40, 40);
const material = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.45,
  metalness: 0.05,
  flatShading: false
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

state.mesh = mesh;
state.brush = new SculptBrush(mesh);

/* =========================
   Transform Gizmo
========================= */

const transformControls = new TransformControls(camera, canvas);
transformControls.attach(mesh);
transformControls.visible = false;
scene.add(transformControls);

transformControls.addEventListener("dragging-changed", e => {
  controls.enabled = !e.value;
});

/* =========================
   Raycasting
========================= */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function getHitPoint(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(state.mesh, false);
  return hits.length ? hits[0].point : null;
}

/* =========================
   Input Rules (CRITICAL)
========================= */

canvas.addEventListener("contextmenu", e => e.preventDefault());

canvas.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt") return;

  if (e.button === 0) {
    state.isSculpting = true;
    controls.enableRotate = false;
  }

  if (e.button === 2) {
    controls.enableRotate = true;
  }
});

canvas.addEventListener("pointerup", e => {
  state.isSculpting = false;

  if (state.mode === "sculpt") {
    controls.enableRotate = false;
  }
});

canvas.addEventListener("pointermove", e => {
  if (!state.isSculpting || state.mode !== "sculpt") return;

  const point = getHitPoint(e);
  if (point) {
    state.brush.apply(point);
  }
});

/* =========================
   Touch Support
========================= */

canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 2) {
    controls.enableRotate = true;
  } else {
    controls.enableRotate = false;
    state.isSculpting = true;
  }
});

canvas.addEventListener("touchend", () => {
  state.isSculpting = false;
  controls.enableRotate = false;
});

/* =========================
   Camera Reset
========================= */

function resetCamera() {
  camera.position.set(0, 2, 5);
  controls.target.set(0, 0, 0);
  controls.update();
}

/* =========================
   UI Hook
========================= */

initUI({
  setMode(mode) {
    state.mode = mode;

    if (mode === "transform") {
      transformControls.visible = true;
      controls.enableRotate = true;
    } else {
      transformControls.visible = false;
      controls.enableRotate = false;
    }
  },

  setTool(tool) {
    state.brush.setTool(tool);
  },

  setRadius(r) {
    state.brush.setRadius(r);
  },

  setStrength(s) {
    state.brush.setStrength(s);
  },

  resetCamera
});

/* =========================
   Resize
========================= */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================
   Render Loop
========================= */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();