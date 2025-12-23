// js/main.js
// Author: CCVO
// Purpose: Main entry point for the 3D editor with world-aligned View Gizmo

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";

import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";

/* ------------------------------------------------------------------ */
/* Renderer */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* ------------------------------------------------------------------ */
/* Scene */
/* ------------------------------------------------------------------ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

/* ------------------------------------------------------------------ */
/* Camera */
/* ------------------------------------------------------------------ */

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(4, 4, 6);
camera.lookAt(0, 0, 0);

/* ------------------------------------------------------------------ */
/* Controls */
/* ------------------------------------------------------------------ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.panSpeed = 0.6;

/* ------------------------------------------------------------------ */
/* Lighting */
/* ------------------------------------------------------------------ */

scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
dirLight.position.set(6, 10, 8);
dirLight.target.position.set(0, 0, 0);
scene.add(dirLight);
scene.add(dirLight.target);

/* ------------------------------------------------------------------ */
/* Grid (World Space) */
/* ------------------------------------------------------------------ */

const grid = new THREE.GridHelper(20, 20, 0x666666, 0x999999);
grid.position.y = 0;
grid.renderOrder = -20;
scene.add(grid);

/* ------------------------------------------------------------------ */
/* Cardinal Direction Labels (Viewport Grid) */
/* ------------------------------------------------------------------ */

function createDirectionSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#777";
  ctx.font = "48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    depthWrite: false,
    depthTest: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 2, 1);
  sprite.renderOrder = -10;

  return sprite;
}

// World directions (right-handed, Three.js standard)
const north = createDirectionSprite("N");
north.position.set(0, 0.01, -9);

const south = createDirectionSprite("S");
south.position.set(0, 0.01, 9);

const east = createDirectionSprite("E");
east.position.set(9, 0.01, 0);

const west = createDirectionSprite("W");
west.position.set(-9, 0.01, 0);

scene.add(north, south, east, west);

/* ------------------------------------------------------------------ */
/* Placeholder Object (until model loading / sculpting) */
/* ------------------------------------------------------------------ */

const testMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xcccccc })
);
scene.add(testMesh);

/* ------------------------------------------------------------------ */
/* Transform Controls */
/* ------------------------------------------------------------------ */

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.attach(testMesh);
scene.add(transformControls);

transformControls.addEventListener("dragging-changed", e => {
  controls.enabled = !e.value;
});

/* ------------------------------------------------------------------ */
/* UI + Sculpt System */
/* ------------------------------------------------------------------ */

const sculptBrush = new SculptBrush(scene, camera, renderer.domElement);

initUI({
  scene,
  camera,
  renderer,
  controls,
  transformControls,
  sculptBrush
});

/* ------------------------------------------------------------------ */
/* View Gizmo (Perfectly Aligned) */
/* ------------------------------------------------------------------ */

const viewGizmo = new ViewGizmo(camera, controls);

/* ------------------------------------------------------------------ */
/* Resize Handling */
/* ------------------------------------------------------------------ */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ */
/* Animation Loop */
/* ------------------------------------------------------------------ */

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
  viewGizmo.update();
}

animate();
