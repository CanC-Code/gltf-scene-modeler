import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.setClearColor(0x1e1e1e);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(3, 3, 3);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.mouseButtons.LEFT = null; // sculpt uses left
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.touches.ONE = THREE.TOUCH.NONE;
controls.touches.TWO = THREE.TOUCH.ROTATE;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 5);
scene.add(dir);

// ---------- Mesh ----------
let activeMesh;
function createMesh(geo) {
  if (activeMesh) scene.remove(activeMesh);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4fa3ff,
    roughness: 0.35,
    metalness: 0.05,
  });

  activeMesh = new THREE.Mesh(geo, mat);
  scene.add(activeMesh);

  brush = new SculptBrush(activeMesh);
  transform.attach(activeMesh);
}

createMesh(new THREE.BoxGeometry(1, 1, 1, 32, 32, 32));

// ---------- Transform Gizmo ----------
const transform = new TransformControls(camera, canvas);
transform.setMode("translate");
transform.size = 0.9;
scene.add(transform);

// ---------- Sculpt ----------
let brush = new SculptBrush(activeMesh);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ---------- State ----------
const state = {
  mode: "sculpt",
  brush,

  setMode(mode) {
    this.mode = mode;

    if (mode === "move") transform.setMode("translate");
    if (mode === "rotate") transform.setMode("rotate");
    if (mode === "scale") transform.setMode("scale");

    controls.enabled = mode !== "sculpt";
  },

  toggleWireframe() {
    activeMesh.material.wireframe =
      !activeMesh.material.wireframe;
  },

  createCube() {
    createMesh(new THREE.BoxGeometry(1, 1, 1, 32, 32, 32));
  },

  createSphere() {
    createMesh(new THREE.SphereGeometry(0.75, 48, 48));
  },

  exportGLTF() {
    console.warn("GLTF export hook present (implementation next)");
  },
};

initUI(state);

// ---------- Sculpt Input ----------
canvas.addEventListener("pointerdown", e => {
  if (state.mode !== "sculpt") return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh);

  if (hit.length) {
    brush.apply(hit[0].point);
  }
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();