import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";

const canvas = document.getElementById("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3, 3, 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

let mesh;
const state = {
  cameraLocked: false,
  brush: null,
  setTool: t => state.brush.setTool(t),
  setRadius: r => state.brush.setRadius(r),
  setStrength: s => state.brush.setStrength(s)
};

function createCube() {
  const geo = new THREE.BoxGeometry(1, 1, 1, 20, 20, 20);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  state.brush = new SculptBrush(mesh);
}

createCube();
initUI(state);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let sculpting = false;

canvas.onpointerdown = e => sculpting = true;
canvas.onpointerup = () => sculpting = false;

canvas.onpointermove = e => {
  if (!sculpting || !mesh) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh);
  if (!hit.length) return;

  const viewDir = new THREE.Vector3();
  camera.getWorldDirection(viewDir);

  state.brush.apply(hit[0].point, viewDir);
};

function animate() {
  requestAnimationFrame(animate);
  controls.enabled = !state.cameraLocked;
  renderer.render(scene, camera);
}
animate();