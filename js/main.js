import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// --- Renderer ---
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(2, 2, 4);

// --- Controls (FIXED) ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = true;
controls.screenSpacePanning = false;
controls.minDistance = 0.5;
controls.maxDistance = 50;
controls.target.set(0, 0.75, 0);
controls.update();

// --- Lighting ---
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
hemi.position.set(0, 20, 0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7.5);
scene.add(dir);

// --- Test Geometry ---
const grid = new THREE.GridHelper(10, 10);
scene.add(grid);

const geo = new THREE.BoxGeometry();
const mat = new THREE.MeshStandardMaterial({ color: 0x4da6ff });
const cube = new THREE.Mesh(geo, mat);
cube.position.y = 0.5;
scene.add(cube);

// --- Resize Handling ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Render Loop ---
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // REQUIRED
  renderer.render(scene, camera);
}

animate();