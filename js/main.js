import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";

import { SculptBrush } from "./sculptBrush.js";
import { subdivideIfNeeded } from "./topology.js";

const canvas = document.getElementById("viewport");
const cursor = document.getElementById("cursorBrush");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3a3a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

scene.add(new THREE.GridHelper(20, 20));

let activeMesh = null;
let wireframe = false;
let cameraLocked = false;
let sculpting = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const brush = new SculptBrush();

function setActive(mesh) {
  if (activeMesh) {
    scene.remove(activeMesh);
    activeMesh.geometry.dispose();
    activeMesh.material.dispose();
  }
  activeMesh = mesh;
  scene.add(mesh);
  transform.attach(mesh);
}

function createCube() {
  const geo = new THREE.BoxGeometry(2, 2, 2, 10, 10, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe });
  setActive(new THREE.Mesh(geo, mat));
}

function createSphere() {
  const geo = new THREE.SphereGeometry(1.5, 32, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe });
  setActive(new THREE.Mesh(geo, mat));
}

createCube();

document.getElementById("toggleMenu").onclick = () =>
  document.getElementById("menu").classList.toggle("collapsed");

document.getElementById("lockCamera").onclick = (e) => {
  cameraLocked = !cameraLocked;
  controls.enabled = !cameraLocked;
  e.target.textContent = cameraLocked ? "Camera Locked" : "Camera Free";
  e.target.className = cameraLocked ? "active" : "inactive";
};

document.getElementById("toggleWire").onclick = () => {
  wireframe = !wireframe;
  if (activeMesh) activeMesh.material.wireframe = wireframe;
};

document.getElementById("newCube").onclick = createCube;
document.getElementById("newSphere").onclick = createSphere;

window.addEventListener("pointerdown", () => {
  sculpting = true;
  controls.enabled = false;
  cursor.style.display = "block";
});

window.addEventListener("pointerup", () => {
  sculpting = false;
  controls.enabled = !cameraLocked;
  cursor.style.display = "none";
});

window.addEventListener("pointermove", (e) => {
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";

  if (!sculpting || !activeMesh) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh, false)[0];
  if (!hit) return;

  const radius = parseFloat(document.getElementById("brushSize").value);
  brush.clay(activeMesh, hit.point, hit.face.normal, radius);
  subdivideIfNeeded(activeMesh, hit.point, radius);
});

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
