import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

const canvas = document.getElementById('canvas');

/* ---------- Scene ---------- */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 1, 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(2, 5, 3);
scene.add(light);

/* ---------- State ---------- */

let activeMesh;
let mode = 'orbit';
let tool = 'inflate';
let isDragging = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();

/* ---------- UI ---------- */

document.getElementById('togglePanel').onclick = () =>
  document.getElementById('panel').classList.toggle('collapsed');

/* Tabs */
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  };
});

/* Modes */

function setMode(m) {
  mode = m;
  controls.enabled = (m === 'orbit');
}

orbitBtn.onclick = () => setMode('orbit');
sculptBtn.onclick = () => setMode('sculpt');
paintBtn.onclick = () => setMode('paint');

inflateBtn.onclick = () => tool = 'inflate';
smoothBtn.onclick = () => tool = 'smooth';

/* ---------- Mesh ---------- */

function addMesh(geo) {
  if (activeMesh) scene.remove(activeMesh);
  const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, vertexColors: true });
  activeMesh = new THREE.Mesh(geo, mat);
  geo.computeVertexNormals();
  scene.add(activeMesh);
}

addCube.onclick = () => addMesh(new THREE.BoxGeometry(1, 1, 1, 32, 32, 32));
addSphere.onclick = () => addMesh(new THREE.SphereGeometry(0.6, 64, 64));

/* ---------- Input ---------- */

canvas.addEventListener('pointerdown', () => {
  if (mode !== 'orbit') isDragging = true;
});

canvas.addEventListener('pointerup', () => isDragging = false);

canvas.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
});

/* ---------- Sculpt / Paint ---------- */

function applyBrush() {
  if (!activeMesh || !isDragging || mode === 'orbit') return;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  if (!hit) return;

  const geo = activeMesh.geometry;
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;

  const radius = +brushSize.value;
  const strength = +brushStrength.value * clock.getDelta();
  const hitPoint = hit.point;

  if (mode === 'paint') {
    let color = geo.attributes.color;
    if (!color) {
      color = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
      geo.setAttribute('color', color);
    }
    const c = new THREE.Color(paintColor.value);

    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      if (v.distanceTo(hitPoint) > radius) continue;
      color.setXYZ(i, c.r, c.g, c.b);
    }
    color.needsUpdate = true;
    return;
  }

  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const d = v.distanceTo(hitPoint);
    if (d > radius) continue;

    const falloff = 1 - d / radius;

    if (tool === 'inflate') {
      const n = new THREE.Vector3().fromBufferAttribute(normal, i);
      v.addScaledVector(n, strength * falloff);
    } else {
      v.lerp(hitPoint, strength * falloff * 0.3);
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ---------- Load / Export ---------- */

const loader = new GLTFLoader();

fileInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  loader.load(URL.createObjectURL(file), gltf => {
    const mesh = gltf.scene.children.find(o => o.isMesh);
    if (mesh) addMesh(mesh.geometry.clone());
  });
};

exportBtn.onclick = () => {
  const exporter = new GLTFExporter();
  exporter.parse(activeMesh, data => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'model.gltf';
    a.click();
  });
};

/* ---------- Loop ---------- */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  applyBrush();
  renderer.render(scene, camera);
}

animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});