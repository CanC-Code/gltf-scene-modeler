import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let currentObject = null;
let started = false;

function startApp() {
  if (started) return;
  started = true;

  init();
  animate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

function init() {
  const container = document.getElementById('canvasContainer');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202025);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.5, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  scene.add(new THREE.GridHelper(20, 20));

  // --- UI BUTTONS ---
  bindButton('newCube', () => addShape('cube'));
  bindButton('newSphere', () => addShape('sphere'));
  bindButton('exportBtn', exportScene);
  bindButton('resetScene', resetScene);

  window.addEventListener('resize', onWindowResize);
}

// --- UI BINDING ---
function bindButton(id, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`UI element not found #${id}`);
    return;
  }
  el.addEventListener('click', handler);
}

// --- OBJECT MANAGEMENT ---
function addShape(type) {
  if (currentObject) scene.remove(currentObject);

  if (type === 'cube') {
    currentObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x44aa88 })
    );
  } else if (type === 'sphere') {
    currentObject = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xaa4444 })
    );
  }

  currentObject.position.y = 0.5;
  scene.add(currentObject);

  document.getElementById('status').textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} added`;
}

function exportScene() {
  const exporter = new GLTFExporter();
  exporter.parse(scene, (gltf) => {
    const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.gltf';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function resetScene() {
  if (currentObject) currentObject.rotation.set(0, 0, 0);
  controls.reset();
}

function onWindowResize() {
  const container = document.getElementById('canvasContainer');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// --- ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  if (currentObject) {
    currentObject.rotation.y += 0.01;
    currentObject.rotation.x += 0.01;
  }

  controls.update();
  renderer.render(scene, camera);
}