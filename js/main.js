import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { initUI } from "./ui.js";
import { mergeVertices } from "../three/BufferGeometryUtils.js";
import { SculptBrush } from "./sculptBrush.js";

/* ===============================
   Core Setup
================================ */

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de); // light steel blue

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 4, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

/* ===============================
   State
================================ */

let activeMesh = null;
let wireframe = false;
let cameraLocked = false;
let sculpting = false;

const state = {
  brush: null,
  controls,
  cameraLocked,
  wireframe,
  setTool: t => state.brush && state.brush.setTool(t),
  setRadius: r => state.brush && state.brush.setRadius(r),
  setStrength: s => state.brush && state.brush.setStrength(s),
  toggleWireframe: () => {
    wireframe = !wireframe;
    if (activeMesh) activeMesh.material.wireframe = wireframe;
  },
  createCube,
  createSphere,
  exportGLTF,
  importGLTF
};

/* ===============================
   Lighting & Helpers
================================ */

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);
scene.add(new THREE.GridHelper(20, 20));

/* ===============================
   Resize
================================ */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===============================
   Active Mesh Handling
================================ */

function clearActiveMesh() {
  if (!activeMesh) return;
  transform.detach();
  scene.remove(activeMesh);
  activeMesh.geometry.dispose();
  activeMesh.material.dispose();
  activeMesh = null;
  state.brush = null;
}

function setActive(mesh) {
  clearActiveMesh();
  activeMesh = mesh;
  scene.add(mesh);
  transform.attach(mesh);

  // Initialize brush
  if (!state.brush) state.brush = new SculptBrush(activeMesh);
}

/* ===============================
   Mesh Creation
================================ */

function createCube() {
  const geo = new THREE.BoxGeometry(2, 2, 2, 24, 24, 24);
  mergeVertices(geo);
  setActive(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe }))
  );
}

function createSphere() {
  const geo = new THREE.SphereGeometry(1.5, 64, 64);
  mergeVertices(geo);
  setActive(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe }))
  );
}

/* ===============================
   GLTF Export / Import
================================ */

function exportGLTF() {
  if (!activeMesh) return;
  new GLTFExporter().parse(activeMesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model.gltf";
    a.click();
  });
}

function importGLTF(e) {
  const reader = new FileReader();
  reader.onload = () => {
    new GLTFLoader().parse(reader.result, "", gltf => {
      const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
      if (mesh) setActive(mesh);
    });
  };
  reader.readAsArrayBuffer(e.target.files[0]);
}

/* ===============================
   Cursor Brush
================================ */

const cursorBrush = document.getElementById("cursorBrush");

renderer.domElement.addEventListener("pointermove", e => {
  cursorBrush.style.left = e.clientX + "px";
  cursorBrush.style.top = e.clientY + "px";
  cursorBrush.style.display = "block";
});

renderer.domElement.addEventListener("pointerleave", () => {
  cursorBrush.style.display = "none";
});

/* ===============================
   Sculpting Core
================================ */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", e => {
  if (!activeMesh) return;
  sculpting = true;
  transform.detach();
  applyInflate(e);
});

renderer.domElement.addEventListener("pointerup", () => {
  sculpting = false;
  if (activeMesh) transform.attach(activeMesh);
});

renderer.domElement.addEventListener("pointermove", e => {
  if (sculpting) applyInflate(e);
});

function applyInflate(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  if (!hit) return;

  sculptInflateRegion(hit);
}

/* ===============================
   Sculpt Region
================================ */

function sculptInflateRegion(hit) {
  const geo = activeMesh.geometry;
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;

  const radius = parseFloat(document.getElementById("brushSize").value);
  const strength = parseFloat(document.getElementById("brushStrength").value);

  const inv = new THREE.Matrix4().copy(activeMesh.matrixWorld).invert();
  const center = hit.point.clone().applyMatrix4(inv);

  const region = [];
  const avgNormal = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (v.distanceTo(center) > radius) continue;

    region.push(i);
    n.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    avgNormal.add(n);
  }

  if (region.length === 0) return;
  avgNormal.normalize();

  for (const i of region) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const dist = v.distanceTo(center);
    const falloff = Math.exp(-(dist * dist) / (radius * radius));
    v.addScaledVector(avgNormal, strength * falloff);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  laplacianSmooth(geo, region, 0.45);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ===============================
   Laplacian Smooth
================================ */

function laplacianSmooth(geo, region, factor) {
  if (!geo.index) return;

  const pos = geo.attributes.position;
  const index = geo.index.array;
  const neighbors = {};
  for (const i of region) neighbors[i] = new Set();

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i],
      b = index[i + 1],
      c = index[i + 2];
    if (neighbors[a]) neighbors[a].add(b).add(c);
    if (neighbors[b]) neighbors[b].add(a).add(c);
    if (neighbors[c]) neighbors[c].add(a).add(b);
  }

  const original = {};
  const v = new THREE.Vector3();
  const avg = new THREE.Vector3();

  for (const i of region) {
    original[i] = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  }

  for (const i of region) {
    const neigh = neighbors[i];
    if (!neigh || neigh.size === 0) continue;

    avg.set(0, 0, 0);
    neigh.forEach(n =>
      avg.add(new THREE.Vector3(pos.getX(n), pos.getY(n), pos.getZ(n)))
    );
    avg.multiplyScalar(1 / neigh.size);
    v.copy(original[i]).lerp(avg, factor);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
}

/* ===============================
   Default Cube
================================ */

createCube();

/* ===============================
   UI
================================ */

initUI(state);

/* ===============================
   Render Loop
================================ */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();