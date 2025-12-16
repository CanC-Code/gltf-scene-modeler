import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';

/* ------------------ DOM ------------------ */

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
  console.log(msg);
}

/* ------------------ SCENE ------------------ */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

/* ------------------ CONTROLS ------------------ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* ------------------ LIGHTING ------------------ */

scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

/* ------------------ ACTIVE OBJECT ------------------ */

let currentObject = null;

/* ------------------ HELPERS ------------------ */

function clearCurrentObject() {
  if (currentObject) {
    scene.remove(currentObject);
    currentObject.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    currentObject = null;
  }
}

/**
 * This is the IMPORTANT function.
 * It works for Mesh OR Group.
 */
function placeImportedObject(object) {
  clearCurrentObject();

  // Ensure world matrices are valid
  object.updateWorldMatrix(true, true);

  // Compute bounding box for entire object
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  // Wrap in a parent so transforms are safe
  const wrapper = new THREE.Object3D();
  wrapper.add(object);

  // Center object
  object.position.sub(center);

  // Normalize scale
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1.5 / maxDim;
  wrapper.scale.setScalar(scale);

  scene.add(wrapper);
  currentObject = wrapper;

  controls.reset();
  controls.target.set(0, 0, 0);
  controls.update();

  setStatus('Object placed');
}

/* ------------------ PRIMITIVES ------------------ */

function createCube() {
  clearCurrentObject();

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x44aa88 })
  );

  placeImportedObject(mesh);
  setStatus('Cube created');
}

function createSphere() {
  clearCurrentObject();

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xaa8844 })
  );

  placeImportedObject(mesh);
  setStatus('Sphere created');
}

/* ------------------ OBJ LOADING ------------------ */

const objInput = document.getElementById('objInput');

objInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  setStatus('Loading OBJ…');

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loader = new OBJLoader();
      const obj = loader.parse(reader.result);

      // Ensure materials exist
      obj.traverse(child => {
        if (child.isMesh && !child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xcccccc
          });
        }
      });

      placeImportedObject(obj);
      setStatus('OBJ loaded successfully');
    } catch (err) {
      console.error(err);
      setStatus('OBJ load failed');
    }
  };

  reader.readAsText(file);
});

/* ------------------ BUTTONS ------------------ */

document.getElementById('newCube').onclick = createCube;
document.getElementById('newSphere').onclick = createSphere;

/* ------------------ RENDER LOOP ------------------ */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ------------------ RESIZE ------------------ */

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------ INIT ------------------ */

createCube();
setStatus('Ready');