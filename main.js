import * as THREE from "./three/three.module.js";
import { OrbitControls } from "./three/OrbitControls.js";
import { TransformControls } from "./three/TransformControls.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { GLTFExporter } from "./three/GLTFExporter.js";

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3a3a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

let activeMesh = null;
let wireframe = false;
let cameraLocked = false;
let sculpting = false;

/* ---------- Lighting ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

/* ---------- Helpers ---------- */
scene.add(new THREE.GridHelper(20, 20));

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Active mesh ---------- */
function clearActiveMesh() {
  if (!activeMesh) return;
  transform.detach();
  scene.remove(activeMesh);
  activeMesh.geometry.dispose();
  activeMesh.material.dispose();
  activeMesh = null;
}

function setActive(mesh) {
  clearActiveMesh();
  activeMesh = mesh;
  scene.add(mesh);
  transform.attach(mesh);
}

/* ---------- Mesh creation ---------- */
function createCube() {
  setActive(new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2, 20, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe })
  ));
}

function createSphere() {
  setActive(new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe })
  ));
}

createCube();

/* ---------- UI ---------- */
document.getElementById("toggleMenu").onclick = () =>
  document.getElementById("menu").classList.toggle("collapsed");

const lockBtn = document.getElementById("lockCamera");
lockBtn.onclick = () => {
  cameraLocked = !cameraLocked;
  controls.enabled = !cameraLocked;
  lockBtn.classList.toggle("active", cameraLocked);
  lockBtn.textContent = cameraLocked ? "Camera Locked" : "Camera Free";
};

document.getElementById("toggleWire").onclick = () => {
  wireframe = !wireframe;
  if (activeMesh) activeMesh.material.wireframe = wireframe;
};

document.getElementById("newCube").onclick = createCube;
document.getElementById("newSphere").onclick = createSphere;

/* ---------- Cursor brush ---------- */
const cursorBrush = document.getElementById("cursorBrush");

renderer.domElement.addEventListener("pointermove", e => {
  cursorBrush.style.left = e.clientX + "px";
  cursorBrush.style.top = e.clientY + "px";
  cursorBrush.style.display = "block";
});

renderer.domElement.addEventListener("pointerleave", () => {
  cursorBrush.style.display = "none";
});

/* ---------- Sculpting ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", e => {
  if (!cameraLocked || !activeMesh) return;
  sculpting = true;
  applySculpt(e);
});

renderer.domElement.addEventListener("pointerup", () => sculpting = false);
renderer.domElement.addEventListener("pointermove", e => sculpting && applySculpt(e));

function applySculpt(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  if (hit) sculptInflate(hit);
}

function sculptInflate(hit) {
  const geo = activeMesh.geometry;
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;

  const radius = parseFloat(document.getElementById("brushSize").value);
  const strength = 0.12;

  const inv = new THREE.Matrix4().copy(activeMesh.matrixWorld).invert();
  const center = hit.point.clone().applyMatrix4(inv);

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const d = v.distanceTo(center);
    if (d > radius) continue;

    const falloff = Math.exp(-(d * d) / (radius * radius));
    n.set(normal.getX(i), normal.getY(i), normal.getZ(i)).normalize();
    v.addScaledVector(n, strength * falloff);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  relaxSurface(geo, center, radius * 1.3);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function relaxSurface(geo, center, radius) {
  if (!geo.index) return;

  const pos = geo.attributes.position;
  const neighbors = {};

  for (let i = 0; i < geo.index.count; i += 3) {
    const a = geo.index.array[i];
    const b = geo.index.array[i + 1];
    const c = geo.index.array[i + 2];
    neighbors[a] ??= new Set();
    neighbors[b] ??= new Set();
    neighbors[c] ??= new Set();
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }

  const v = new THREE.Vector3();
  const avg = new THREE.Vector3();

  for (const i in neighbors) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (v.distanceTo(center) > radius) continue;

    avg.set(0, 0, 0);
    neighbors[i].forEach(n =>
      avg.add(new THREE.Vector3(pos.getX(n), pos.getY(n), pos.getZ(n)))
    );

    avg.multiplyScalar(1 / neighbors[i].size);
    v.lerp(avg, 0.35);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
}

/* ---------- Export ---------- */
document.getElementById("exportGLTF").onclick = () => {
  if (!activeMesh) return;
  new GLTFExporter().parse(activeMesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model.gltf";
    a.click();
  });
};

/* ---------- Import ---------- */
document.getElementById("importGLTF").onchange = e => {
  const reader = new FileReader();
  reader.onload = () =>
    new GLTFLoader().parse(reader.result, "", gltf => {
      const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
      if (mesh) setActive(mesh);
    });
  reader.readAsArrayBuffer(e.target.files[0]);
};

/* ---------- Render loop ---------- */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();