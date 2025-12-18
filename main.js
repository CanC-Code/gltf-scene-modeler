import * as THREE from "./three/three.module.js";
import { OrbitControls } from "./three/OrbitControls.js";
import { TransformControls } from "./three/TransformControls.js";
import { GLTFLoader } from "./three/GLTFLoader.js";
import { GLTFExporter } from "./three/GLTFExporter.js";

/* ---------- Renderer / Scene ---------- */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3a3a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(6, 6, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

/* ---------- State ---------- */
let activeMesh = null;
let wireframe = false;
let cameraLocked = false;

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

/* ---------- Mesh Utilities ---------- */
function createLatticeCube(size = 2, segments = 24, color = 0x88ccff) {
  const geo = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, wireframe });
  return new THREE.Mesh(geo, mat);
}

function createLatticeSphere(radius = 1.5, segments = 32, color = 0x88ff88) {
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, wireframe });
  return new THREE.Mesh(geo, mat);
}

/* ---------- Active Mesh Handling ---------- */
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

/* ---------- Default ---------- */
setActive(createLatticeCube());

/* ---------- UI ---------- */
document.getElementById("toggleMenu").onclick = () => document.getElementById("menu").classList.toggle("collapsed");
document.getElementById("lockCamera").onclick = () => {
  cameraLocked = !cameraLocked;
  controls.enabled = !cameraLocked;
};
document.getElementById("toggleWire").onclick = () => {
  wireframe = !wireframe;
  if (activeMesh) activeMesh.material.wireframe = wireframe;
};
document.getElementById("newCube").onclick = () => setActive(createLatticeCube());
document.getElementById("newSphere").onclick = () => setActive(createLatticeSphere());

/* ---------- Export ---------- */
document.getElementById("exportGLTF").onclick = () => {
  if (!activeMesh) return;
  const exporter = new GLTFExporter();
  exporter.parse(activeMesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "model.gltf";
    a.click();
  });
};

/* ---------- Import ---------- */
document.getElementById("importGLTF").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const loader = new GLTFLoader();
    loader.parse(reader.result, "", gltf => {
      const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
      if (mesh) setActive(mesh);
    });
  };
  reader.readAsArrayBuffer(file);
};

/* ---------- Sculpt ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;
let savedControlsEnabled = true;

const brushRing = new THREE.Mesh(
  new THREE.RingGeometry(0.95, 1, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
);
brushRing.visible = false;
scene.add(brushRing);

function updateMouse(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function sculptInflate(hit) {
  if (!activeMesh) return;
  const geo = activeMesh.geometry;
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;
  const radius = parseFloat(document.getElementById("brushSize").value);
  const strength = 0.12;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const worldPos = new THREE.Vector3(vx, vy, vz).applyMatrix4(activeMesh.matrixWorld);
    const dist = worldPos.distanceTo(hit.point);
    if (dist > radius) continue;
    const falloff = 1 - dist / radius;
    const move = new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i))
      .multiplyScalar(strength * falloff);
    pos.setXYZ(i, vx + move.x, vy + move.y, vz + move.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ---------- Pointer Events ---------- */
renderer.domElement.addEventListener("pointerdown", e => {
  if (!activeMesh) return;
  updateMouse(e);
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  if (!hit) return;
  sculpting = true;
  savedControlsEnabled = controls.enabled;
  controls.enabled = false;
  transform.enabled = false;
});

renderer.domElement.addEventListener("pointermove", e => {
  updateMouse(e);
  raycaster.setFromCamera(mouse, camera);
  const hit = activeMesh ? raycaster.intersectObject(activeMesh)[0] : null;

  if (hit) {
    const r = parseFloat(document.getElementById("brushSize").value);
    brushRing.visible = true;
    brushRing.scale.set(r, r, r);
    brushRing.position.copy(hit.point);
    brushRing.lookAt(hit.point.clone().add(hit.face.normal));

    if (sculpting) sculptInflate(hit);
  } else brushRing.visible = false;
});

window.addEventListener("pointerup", () => {
  if (!sculpting) return;
  sculpting = false;
  controls.enabled = savedControlsEnabled;
  transform.enabled = true;
});

/* ---------- Render Loop ---------- */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();