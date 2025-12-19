import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { initUI } from "./ui.js";
import { SculptBrush } from "./sculptBrush.js";
import { ViewGizmo } from "./viewGizmo.js";

/* ===============================
   Core
================================ */

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb7c7d6);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 4, 6);

/* ===============================
   Controls
================================ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};

const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

/* ===============================
   View Gizmo
================================ */

const viewGizmo = new ViewGizmo(camera, controls);

/* ===============================
   State
================================ */

let activeMesh = null;
let sculpting = false;

const state = {
  brush: null,
  controls,
  setTool: t => state.brush?.setTool(t),
  setRadius: r => state.brush?.setRadius(r),
  setStrength: s => state.brush?.setStrength(s),
  toggleWireframe: () => {
    if (activeMesh)
      activeMesh.material.wireframe = !activeMesh.material.wireframe;
  },
  createCube,
  createSphere,
  exportGLTF,
  importGLTF
};

/* ===============================
   Lighting
================================ */

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
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
   Mesh Handling
================================ */

function setActive(mesh) {
  if (activeMesh) {
    transform.detach();
    scene.remove(activeMesh);
  }

  activeMesh = mesh;
  scene.add(mesh);
  transform.attach(mesh);
  state.brush = new SculptBrush(mesh);
}

function createCube() {
  setActive(
    new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2, 32, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x88ccff })
    )
  );
}

function createSphere() {
  setActive(
    new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88 })
    )
  );
}

/* ===============================
   Sculpting
================================ */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", e => {
  if (!activeMesh || e.button !== 0) return;
  sculpting = true;
  controls.enabled = false;
  transform.detach();
  sculpt(e);
});

renderer.domElement.addEventListener("pointerup", () => {
  sculpting = false;
  controls.enabled = true;
  if (activeMesh) transform.attach(activeMesh);
});

renderer.domElement.addEventListener("pointermove", e => {
  if (sculpting) sculpt(e);
});

function sculpt(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(activeMesh)[0];
  if (!hit) return;

  const localPoint = hit.point
    .clone()
    .applyMatrix4(activeMesh.matrixWorld.clone().invert());

  state.brush.apply(localPoint);
}

/* ===============================
   Import / Export
================================ */

function exportGLTF() {
  if (!activeMesh) return;
  new GLTFExporter().parse(activeMesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], {
      type: "application/json"
    });
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
   Init
================================ */

createCube();
initUI(state);

/* ===============================
   Render Loop
================================ */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  viewGizmo.update();
  renderer.render(scene, camera);
}

animate();