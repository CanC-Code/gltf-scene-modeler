import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';

/* ---------------- DOM ---------------- */
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
  console.log('Status:', msg);
}

/* ---------------- SCENE SETUP ---------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

// Always show axes to help debug positioning
scene.add(new THREE.AxesHelper(2));

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

/* ---------------- CONTROLS ---------------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

/* ---------------- LIGHTING ---------------- */
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

/* ---------------- CURRENT OBJECT ---------------- */
let currentObject = null;

function removeCurrentObject() {
  if (currentObject) {
    scene.remove(currentObject);
    currentObject = null;
  }
}

function placeObject(object) {
  removeCurrentObject();

  let meshCount = 0;
  let totalVertices = 0;

  object.traverse((child) => {
    if (child.isMesh) {
      meshCount++;
      const pos = child.geometry.attributes.position;
      totalVertices += pos ? pos.count : 0;

      // Ensure valid geometry
      child.geometry.computeBoundingBox();
      child.geometry.computeVertexNormals(); // Critical for lighting

      // Override with a clearly visible material
      child.material = new THREE.MeshStandardMaterial({
        color: 0x6688ff,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  console.log(`Loaded: ${meshCount} mesh(es), ${totalVertices} vertices`);

  if (meshCount === 0 || totalVertices === 0) {
    setStatus('Error: No valid meshes found in model');
    return;
  }

  // Compute overall bounding box
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.length() < 0.0001) {
    setStatus('Error: Model is degenerate (zero size)');
    console.warn('Degenerate bounding box:', box);
    return;
  }

  // Center the model
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.sub(center);

  // Scale to fit nicely in view
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetSize = 3; // Adjust if you want bigger/smaller models
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);

  scene.add(object);
  currentObject = object;

  controls.reset(); // Re-center view
  controls.update();

  setStatus(`Loaded: ${meshCount} mesh(es)`);
}

/* ---------------- PRIMITIVES ---------------- */
function createCube() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x44aa88 })
  );
  placeObject(mesh);
}

function createSphere() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xaa8844 })
  );
  placeObject(mesh);
}

/* ---------------- OBJ LOADING ---------------- */
document.getElementById('objInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setStatus('Loading OBJ...');

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const loader = new OBJLoader();
      const object = loader.parse(event.target.result);

      if (object.children.length === 0) {
        setStatus('Error: Empty OBJ file');
        return;
      }

      placeObject(object);
    } catch (err) {
      setStatus('Failed to parse OBJ');
      console.error(err);
    }
  };

  reader.onerror = () => setStatus('File read error');
  reader.readAsText(file);
});

/* ---------------- UI BUTTONS ---------------- */
document.getElementById('newCube').onclick = createCube;
document.getElementById('newSphere').onclick = createSphere;

/* ---------------- ANIMATION LOOP ---------------- */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ---------------- RESIZE HANDLER ---------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- INITIALIZE ---------------- */
createCube();
setStatus('Ready – Load an OBJ or create a primitive');