import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let activeObject = null;
let mode = 'orbit';

const canvas = document.getElementById('viewport');
const status = document.getElementById('status');

/* ---------- INIT ---------- */
init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202025);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
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

  createCube();

  setupUI();
  window.addEventListener('resize', onResize);
}

/* ---------- UI ---------- */
function setupUI() {
  // panel collapse
  document.getElementById('panel-header').onclick = () =>
    document.getElementById('panel').classList.toggle('collapsed');

  // modes
  document.getElementById('mode-orbit').onclick = () => setMode('orbit');
  document.getElementById('mode-sculpt').onclick = () => setMode('sculpt');
  document.getElementById('mode-paint').onclick = () => setMode('paint');

  // tabs
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    };
  });

  // objects
  document.getElementById('newCube').onclick = createCube;
  document.getElementById('newSphere').onclick = createSphere;
  document.getElementById('exportGLTF').onclick = exportGLTF;

  // load
  document.getElementById('loadModel').onchange = loadModel;
}

/* ---------- MODES ---------- */
function setMode(m) {
  mode = m;
  controls.enabled = (m === 'orbit');
  status.textContent = `Mode: ${m}`;
}

/* ---------- OBJECTS ---------- */
function clearObject() {
  if (activeObject) scene.remove(activeObject);
}

function createCube() {
  clearObject();
  activeObject = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x44aa88 })
  );
  activeObject.position.y = 0.5;
  scene.add(activeObject);
}

function createSphere() {
  clearObject();
  activeObject = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xaa4444 })
  );
  activeObject.position.y = 0.6;
  scene.add(activeObject);
}

/* ---------- LOAD / EXPORT ---------- */
function loadModel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const loader = new GLTFLoader();
    loader.parse(reader.result, '', gltf => {
      clearObject();
      activeObject = gltf.scene;
      scene.add(activeObject);
    });
  };
  reader.readAsArrayBuffer(file);
}

function exportGLTF() {
  if (!activeObject) return;

  const exporter = new GLTFExporter();
  exporter.parse(activeObject, gltf => {
    const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'model.gltf';
    a.click();
  });
}

/* ---------- RENDER ---------- */
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}