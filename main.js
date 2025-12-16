import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';

/* ---------------- DOM ELEMENTS ---------------- */
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
  console.log('Status:', msg);
}

/* ---------------- SCENE SETUP ---------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

// Helpful axes
scene.add(new THREE.AxesHelper(3));

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

/* ---------------- CONTROLS ---------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

/* ---------------- LIGHTING ---------------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 15, 10);
dirLight.castShadow = true;
scene.add(dirLight);

/* ---------------- CURRENT MODEL ---------------- */
let currentObject = null;

function removeCurrentObject() {
  if (currentObject) {
    scene.remove(currentObject);
    currentObject = null;
  }
}

function placeObject(object) {
  removeCurrentObject();

  // Collect valid meshes
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.geometry.attributes.position && child.geometry.attributes.position.count > 3) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    setStatus('Error: No valid geometry found in model');
    return;
  }

  // Apply visible material and fix normals
  meshes.forEach(mesh => {
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();

    mesh.material = new THREE.MeshStandardMaterial({
      color: 0x7799ff,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  // Temporarily add to scene to get accurate world-space bounding box
  scene.add(object);
  const box = new THREE.Box3().setFromObject(object);
  scene.remove(object);

  const size = box.getSize(new THREE.Vector3());
  if (size.length() < 0.0001) {
    setStatus('Error: Model has zero size (degenerate)');
    return;
  }

  const center = box.getCenter(new THREE.Vector3());

  // Center and uniformly scale to fit view
  object.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = 4; // Adjust as needed
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);

  // Final add
  scene.add(object);
  currentObject = object;

  controls.target.set(0, 0, 0);
  controls.reset();
  controls.update();

  const totalVerts = meshes.reduce((sum, m) => sum + m.geometry.attributes.position.count, 0);
  setStatus(`Loaded: ${meshes.length} mesh(s), ${totalVerts} vertices`);
}

/* ---------------- PRIMITIVES ---------------- */
function createCube() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
  const mesh = new THREE.Mesh(geometry, material);
  placeObject(mesh);
}

function createSphere() {
  const geometry = new THREE.SphereGeometry(0.8, 32, 24);
  const material = new THREE.MeshStandardMaterial({ color: 0xaa8844 });
  const mesh = new THREE.Mesh(geometry, material);
  placeObject(mesh);
}

/* ---------------- OBJ LOADING ---------------- */
document.getElementById('objInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.obj')) {
    setStatus('Please select a .obj file');
    return;
  }

  setStatus('Loading OBJ...');

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const loader = new OBJLoader();
      const object = loader.parse(event.target.result);
      placeObject(object);
    } catch (err) {
      setStatus('Failed to parse OBJ');
      console.error(err);
    }
  };
  reader.onerror = () => setStatus('Error reading file');
  reader.readAsText(file);
});

/* ---------------- UI BUTTONS ---------------- */
document.getElementById('newCube').onclick = createCube;
document.getElementById('newSphere').onclick = createSphere;

// Placeholder stubs for future features
document.getElementById('convertBtn').onclick = () => {
  setStatus('Convert to Voxels: Not implemented yet');
};

document.getElementById('exportBtn').onclick = () => {
  setStatus('Export JSON: Not implemented yet');
};

document.getElementById('paintBtn').onclick = () => {
  setStatus('Paint mode: Coming soon');
};

document.getElementById('scaleBtn').onclick = () => {
  setStatus('Scale tool: Coming soon');
};

document.getElementById('moveBtn').onclick = () => {
  setStatus('Move tool: Coming soon');
};

/* ---------------- ANIMATION LOOP ---------------- */
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

/* ---------------- INITIALIZE ---------------- */
createCube();
setStatus('Ready – Load an OBJ or create a primitive');