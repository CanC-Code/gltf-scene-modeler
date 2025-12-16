import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';

/* ---------------- DOM ---------------- */

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

/* ---------------- SCENE ---------------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

scene.add(new THREE.AxesHelper(3));

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* ---------------- LIGHTS ---------------- */

scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(10, 15, 10);
scene.add(dir);

/* ---------------- BASE OBJECT ---------------- */

let baseObject = null;

const material = new THREE.MeshStandardMaterial({
  color: 0x7799ff,
  roughness: 0.7,
  metalness: 0.1
});

function clearBaseObject() {
  if (!baseObject) return;
  scene.remove(baseObject);
  baseObject.geometry.dispose();
  baseObject = null;
}

function createCube() {
  clearBaseObject();
  baseObject = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    material.clone()
  );
  scene.add(baseObject);
  setStatus('Cube created');
}

function createSphere() {
  clearBaseObject();
  baseObject = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 32, 24),
    material.clone()
  );
  scene.add(baseObject);
  setStatus('Sphere created');
}

/* ---------------- TRANSFORM MODE ---------------- */

let mode = null;
let dragging = false;
let lastX = 0;
let lastY = 0;

function setMode(newMode) {
  mode = newMode;
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.remove('active');
  });

  if (newMode) {
    document.getElementById(newMode + 'Btn').classList.add('active');
    setStatus(`Mode: ${newMode}`);
  }
}

canvas.addEventListener('mousedown', e => {
  if (!baseObject || !mode) return;
  dragging = true;
  controls.enabled = false;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', () => {
  dragging = false;
  controls.enabled = true;
});

window.addEventListener('mousemove', e => {
  if (!dragging || !baseObject) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  const speed = 0.01;

  if (mode === 'move') {
    baseObject.position.x += dx * speed;
    baseObject.position.y -= dy * speed;
  }

  if (mode === 'rotate') {
    baseObject.rotation.y += dx * speed;
    baseObject.rotation.x += dy * speed;
  }

  if (mode === 'scale') {
    const s = 1 + dy * 0.01;
    baseObject.scale.multiplyScalar(s);
  }
});

/* ---------------- UI ---------------- */

document.getElementById('newCube').onclick = createCube;
document.getElementById('newSphere').onclick = createSphere;

document.getElementById('moveBtn').onclick = () => setMode('move');
document.getElementById('rotateBtn').onclick = () => setMode('rotate');
document.getElementById('scaleBtn').onclick = () => setMode('scale');

/* ---------------- RENDER LOOP ---------------- */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ---------------- RESIZE ---------------- */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- INIT ---------------- */

createCube();
setStatus('Drag to sculpt. Choose Move / Rotate / Scale.');