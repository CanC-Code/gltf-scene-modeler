import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { GLTFLoader } from './three/GLTFLoader.js';

let scene, camera, renderer, controls;
let mesh = null;
let cameraLocked = false;

const canvas = document.getElementById('viewport');

init();
animate();

/* ---------- INIT ---------- */

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x666666);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(3, 3, 3);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  resize();

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 5, 5);
  scene.add(dir);

  createCube();

  window.addEventListener('resize', resize);

  document.getElementById('toggleCamera').onclick = () => {
    cameraLocked = !cameraLocked;
    controls.enabled = !cameraLocked;
  };

  document.getElementById('addCube').onclick = createCube;
  document.getElementById('exportGLTF').onclick = exportGLTF;
  document.getElementById('importGLTF').onchange = importGLTF;
}

/* ---------- BASE MESH ---------- */

function createCube() {
  if (mesh) scene.remove(mesh);

  const geo = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.4,
    metalness: 0.1
  });

  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
}

/* ---------- EXPORT / IMPORT ---------- */

function exportGLTF() {
  if (!mesh) return;

  const exporter = new GLTFExporter();
  exporter.parse(
    mesh,
    gltf => {
      const blob = new Blob(
        [JSON.stringify(gltf)],
        { type: 'application/json' }
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'model.gltf';
      a.click();
    },
    { binary: false }
  );
}

function importGLTF(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const loader = new GLTFLoader();
    loader.parse(reader.result, '', gltf => {
      if (mesh) scene.remove(mesh);
      mesh = gltf.scene.children[0];
      scene.add(mesh);
    });
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- RENDER ---------- */

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight - 40;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}