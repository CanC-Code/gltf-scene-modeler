import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from './three/examples/jsm/loaders/OBJLoader.js';
import { OBJExporter } from './three/examples/jsm/exporters/OBJExporter.js';

const terminal = document.getElementById('terminal');
function log(msg) {
  terminal.textContent = msg;
  console.log(msg);
}

const canvas = document.getElementById('viewport');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// light (without this, everything looks white/blank)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

// proof-of-life mesh
let currentMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x44aa88 })
);
scene.add(currentMesh);

log('scene initialized');

// render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// OBJ import
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  log('loading OBJ…');

  const reader = new FileReader();
  reader.onload = () => {
    const loader = new OBJLoader();
    const obj = loader.parse(reader.result);

    scene.remove(currentMesh);
    currentMesh = obj;
    scene.add(obj);

    log('OBJ loaded');
  };
  reader.readAsText(file);
});

// create sphere
document.getElementById('createSphere').addEventListener('click', () => {
  scene.remove(currentMesh);

  currentMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xaa8844 })
  );

  scene.add(currentMesh);
  log('sphere created');
});

// export OBJ
document.getElementById('exportObj').addEventListener('click', () => {
  const exporter = new OBJExporter();
  const data = exporter.parse(currentMesh);

  const blob = new Blob([data], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'model.obj';
  a.click();

  log('OBJ exported');
});