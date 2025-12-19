import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

/* ---------- Renderer / Scene ---------- */

const canvas = document.getElementById("viewport");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
// New background for better visibility
scene.background = new THREE.Color(0xb0c4de); // light steel blue

/* ---------- Camera ---------- */

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(3.5, 3.5, 5);

/* ---------- Orbit Controls ---------- */

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;

// Mouse mapping: right & middle orbit, left reserved for sculpt
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};

/* ---------- Lighting ---------- */

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(6, 10, 4);
scene.add(key);

const rim = new THREE.DirectionalLight(0xffffff, 0.4);
rim.position.set(-6, 4, -6);
scene.add(rim);

/* ---------- Grid ---------- */

const grid = new THREE.GridHelper(10, 10, 0x444444, 0x888888);
grid.position.y = -1.5;
scene.add(grid);

/* ---------- State ---------- */

let activeMesh = null;

const state = {
  cameraLocked: false,
  wireframe: false,
  brush: null,

  setTool: t => state.brush && state.brush.setTool(t),
  setRadius: r => state.brush && state.brush.setRadius(r),
  setStrength: s => state.brush && state.brush.setStrength(s)
};

/* ---------- Mesh Helpers ---------- */

function clearMesh() {
  if (!activeMesh) return;

  scene.remove(activeMesh);
  activeMesh.geometry.dispose();
  activeMesh.material.dispose();
  activeMesh = null;
  state.brush = null;
}

function setMesh(mesh) {
  clearMesh();
  activeMesh = mesh;
  scene.add(mesh);
  state.brush = new SculptBrush(mesh);
}

/* ---------- Material ---------- */

function createClayMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd8bfa3,
    roughness: 0.75,
    metalness: 0,
    wireframe: state.wireframe
  });
}

/* ---------- Primitives ---------- */

function createCube() {
  const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 24, 24, 24);
  setMesh(new THREE.Mesh(geo, createClayMaterial()));
}

function createSphere() {
  const geo = new THREE.SphereGeometry(1.2, 48, 48);
  setMesh(new THREE.Mesh(geo, createClayMaterial()));
}

/* ---------- Default ---------- */

createCube(); // Show default cube on load

/* ---------- UI Wiring ---------- */

initUI({
  ...state,
  createCube,
  createSphere,
  toggleWireframe: () => {
    state.wireframe = !state.wireframe;
    if (activeMesh) {
      activeMesh.material.wireframe = state.wireframe;
      activeMesh.material.needsUpdate = true;
    }
  },
  toggleCameraLock: () => {
    state.cameraLocked = !state.cameraLocked;
    controls.enableRotate = !state.cameraLocked;
  }
});

/* ---------- Sculpt Interaction ---------- */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let sculpting = false;

/* ---------- Helper Functions ---------- */

function getPointerPos(event) {
  if (event.touches) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1
    };
  } else {
    return {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: -(event.clientY / window.innerHeight) * 2 + 1
    };
  }
}

function handleSculpt(event) {
  if (!sculpting || !activeMesh || !state.brush) return;

  const pos = getPointerPos(event);
  mouse.x = pos.x;
  mouse.y = pos.y;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(activeMesh);
  if (!hits.length) return;

  const viewDir = new THREE.Vector3();
  camera.getWorldDirection(viewDir);

  state.brush.apply(hits[0].point, viewDir);
}

/* ---------- Pointer Events ---------- */

// Desktop mouse
canvas.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button === 0) sculpting = true;
});
canvas.addEventListener("pointerup", () => sculpting = false);
canvas.addEventListener("pointerleave", () => sculpting = false);
canvas.addEventListener("pointermove", handleSculpt);

// Touch
let touchState = {
  isSculpt: false,
  lastDistance: 0,
  lastTouchPos: null
};

canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 1) {
    sculpting = true;
    touchState.isSculpt = true;
  } else if (e.touches.length === 2) {
    sculpting = false;
    touchState.isSculpt = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchState.lastDistance = Math.hypot(dx, dy);
    touchState.lastTouchPos = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }
});

canvas.addEventListener("touchmove", e => {
  if (touchState.isSculpt) {
    handleSculpt(e);
  } else if (e.touches.length === 2) {
    // Two-finger orbit
    const dx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - touchState.lastTouchPos.x;
    const dy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - touchState.lastTouchPos.y;

    controls.rotateLeft(dx * 0.005);
    controls.rotateUp(dy * 0.005);

    // Pinch zoom
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const zoomFactor = touchState.lastDistance / dist;
    camera.position.multiplyScalar(zoomFactor);
    touchState.lastDistance = dist;

    touchState.lastTouchPos = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }
});

canvas.addEventListener("touchend", e => {
  if (e.touches.length === 0) sculpting = false;
});

/* ---------- Resize ---------- */

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Loop ---------- */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();