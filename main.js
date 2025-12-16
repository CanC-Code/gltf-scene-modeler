import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';

/* ---------- DOM ---------- */
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

const cubeBtn = document.getElementById('cubeBtn');
const sphereBtn = document.getElementById('sphereBtn');
const inflateBtn = document.getElementById('inflateBtn');
const deflateBtn = document.getElementById('deflateBtn');
const brushSizeEl = document.getElementById('brushSize');
const strengthEl = document.getElementById('brushStrength');

function setStatus(msg) {
  statusEl.textContent = msg;
  console.log(msg);
}

/* ---------- SCENE ---------- */
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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* ---------- LIGHT ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

/* ---------- MODEL ---------- */
let mesh = null;

function createBase(geometry) {
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  geometry = geometry.toNonIndexed();
  geometry.computeVertexNormals();

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x6699ff,
      roughness: 0.8,
      metalness: 0.1
    })
  );

  scene.add(mesh);
  setStatus('Tap to sculpt • Two fingers to move camera');
}

createBase(new THREE.BoxGeometry(1, 1, 1, 20, 20, 20));

cubeBtn.onclick = () =>
  createBase(new THREE.BoxGeometry(1, 1, 1, 20, 20, 20));

sphereBtn.onclick = () =>
  createBase(new THREE.SphereGeometry(0.8, 32, 24));

/* ---------- SCULPT MODE ---------- */
let mode = 'inflate';

inflateBtn.onclick = () => {
  mode = 'inflate';
  inflateBtn.classList.add('active');
  deflateBtn.classList.remove('active');
};

deflateBtn.onclick = () => {
  mode = 'deflate';
  deflateBtn.classList.add('active');
  inflateBtn.classList.remove('active');
};

/* ---------- RAYCAST ---------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let activePointers = 0;

canvas.addEventListener('pointerdown', e => {
  activePointers++;
});

canvas.addEventListener('pointerup', e => {
  activePointers = Math.max(0, activePointers - 1);
});

canvas.addEventListener('pointercancel', () => {
  activePointers = 0;
});

canvas.addEventListener('pointerdown', e => {
  if (activePointers !== 1 || !mesh) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(mesh, false)[0];
  if (!hit) return;

  sculpt(hit.point);
});

/* ---------- SCULPT ---------- */
function sculpt(point) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;

  const radius = parseFloat(brushSizeEl.value);
  const strength = parseFloat(strengthEl.value) * (mode === 'inflate' ? 1 : -1);

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.distanceTo(point);
    if (d > radius) continue;

    const falloff = 1 - d / radius;
    n.fromBufferAttribute(normal, i);
    v.addScaledVector(n, falloff * strength);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ---------- LOOP ---------- */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ---------- RESIZE ---------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});