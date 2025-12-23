// js/main.js
// Author: CCVO
// Purpose: Main entry point for GLTF Scene Modeler

import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";

import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";

/* Renderer */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

/* Scene */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

/* Camera */
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

/* Controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* Lighting */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

/* Grid */
const grid = new THREE.GridHelper(20, 20);
grid.renderOrder = -10;
scene.add(grid);

/* Cardinal Directions */
function addDirectionLabel(text, x, z) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(makeTextCanvas(text)),
      depthWrite: false
    })
  );
  sprite.position.set(x, 0.01, z);
  sprite.scale.set(2, 2, 1);
  sprite.renderOrder = -9;
  scene.add(sprite);
}

function makeTextCanvas(text) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#888";
  ctx.font = "48px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 64);
  return c;
}

addDirectionLabel("N",  0, -9);
addDirectionLabel("S",  0,  9);
addDirectionLabel("E",  9,  0);
addDirectionLabel("W", -9,  0);

/* Sculpting, UI, etc — unchanged from your version */
initUI({ /* state object unchanged */ });

const viewGizmo = new ViewGizmo(camera, controls);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  viewGizmo.update();
}

animate();
