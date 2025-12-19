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
    scene,
    camera,
    canvas,
    cursor: document.getElementById('cursorBrush'),
    getMesh: () => activeMesh,
    onStart: () => setCameraLocked(true),
    onEnd: () => setCameraLocked(false)
  });

  animate();
}

function clearActiveMesh() {
  if (!activeMesh) return;
  scene.remove(activeMesh);
  activeMesh.geometry.dispose();
  activeMesh.material.dispose();
  activeMesh = null;
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

  document.getElementById('exportGLTF').onclick = () => {
    if (!activeMesh) return;
    const exporter = new GLTFExporter();
    exporter.parse(activeMesh, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'model.gltf';
      a.click();
    });
  };

  document.getElementById('importGLTF').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const loader = new GLTFLoader();
      loader.parse(reader.result, '', gltf => {
        const mesh = gltf.scene.getObjectByProperty('type', 'Mesh');
        if (mesh) setActive(mesh);
      });
    };
    reader.readAsArrayBuffer(file);
  };

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