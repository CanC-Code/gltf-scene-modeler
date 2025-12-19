import * as THREE from '../three/three.module.js';
import { OrbitControls } from '../three/OrbitControls.js';
import { GLTFLoader } from '../three/GLTFLoader.js';
import { GLTFExporter } from '../three/GLTFExporter.js';
import { SculptBrush } from './sculptBrush.js';
import { ensureTopology } from './topology.js';

let scene, camera, renderer, controls;
let activeMesh = null;
let wireframe = false;
let cameraLocked = false;
let mode = 'model';
let sculpt;

function initThree() {
  const canvas = document.getElementById('viewport');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3a3a);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(4, 4, 6);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  createCube();

  sculpt = new SculptBrush({
    camera,
    canvas,
    cursor: document.getElementById('cursorBrush'),
    getMesh: () => activeMesh,
    isEnabled: () => mode === 'sculpt',
    onStrokeStart: () => controls.enabled = false,
    onStrokeEnd: () => controls.enabled = !cameraLocked
  });

  animate();
}

function clearActiveMesh() {
  if (!activeMesh) return;
  scene.remove(activeMesh);
  activeMesh.geometry.dispose();
  activeMesh.material.dispose();
}

function setActive(mesh) {
  clearActiveMesh();
  activeMesh = mesh;
  scene.add(mesh);
}

function createCube() {
  const geo = new THREE.BoxGeometry(2, 2, 2, 12, 12, 12);
  ensureTopology(geo);
  const mat = new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe });
  setActive(new THREE.Mesh(geo, mat));
}

function createSphere() {
  const geo = new THREE.SphereGeometry(1.5, 32, 32);
  ensureTopology(geo);
  const mat = new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe });
  setActive(new THREE.Mesh(geo, mat));
}

function setCameraLocked(state) {
  cameraLocked = state;
  controls.enabled = !state;
  const btn = document.getElementById('lockCamera');
  btn.textContent = state ? 'Camera Locked' : 'Camera Free';
  btn.classList.toggle('active', state);
}

function initUI() {
  document.getElementById('toggleMenu').onclick =
    () => document.getElementById('menu').classList.toggle('collapsed');

  document.getElementById('lockCamera').onclick =
    () => setCameraLocked(!cameraLocked);

  document.getElementById('toggleWire').onclick = () => {
    wireframe = !wireframe;
    if (activeMesh) activeMesh.material.wireframe = wireframe;
  };

  document.getElementById('newCube').onclick = createCube;
  document.getElementById('newSphere').onclick = createSphere;

  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.tab;
      document.getElementById(`panel-${mode}`).classList.add('active');
    };
  });

  document.getElementById('brushSize').oninput =
    e => sculpt.radius = parseFloat(e.target.value);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', () => {
  initUI();
  initThree();
});