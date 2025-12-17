import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { TransformControls } from './three/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from './three/CSS2DRenderer.js'; // for gizmo labels if needed

let scene, camera, renderer, controls, transformControls;
let cube = null;
let currentObject = null;

let started = false;

function startApp() {
  if (started) return;
  started = true;

  init();
  animate();
}

// DOM-ready handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

function init() {
  const container = document.getElementById('canvas-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202025);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.5, 0);

  // Transform controls (optional for gizmo)
  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.addEventListener('change', () => renderer.render(scene, camera));
  scene.add(transformControls);

  // Lights
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Grid
  scene.add(new THREE.GridHelper(20, 20));

  // Initial cube
  cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x44aa88 })
  );
  cube.position.y = 0.5;
  addObject(cube);

  // UI Hooks
  bindButton('newCube', () => addObject(new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x44aa88 })
  )));
  bindButton('newSphere', () => addObject(new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xaa4444 })
  )));
  bindButton('exportBtn', exportScene);
  bindButton('resetScene', resetScene);

  // Window resize
  window.addEventListener('resize', onWindowResize);
}

function addObject(obj) {
  if (currentObject) {
    scene.remove(currentObject);
    transformControls.detach();
  }
  obj.position.y = 0.5;
  scene.add(obj);
  currentObject = obj;
  transformControls.attach(obj);
}

function bindButton(id, handler) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`UI element not found #${id}`);
    return;
  }
  el.addEventListener('click', handler);
}

function exportScene() {
  const exporter = new GLTFExporter();
  exporter.parse(scene, (gltf) => {
    const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.gltf';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function resetScene() {
  if (currentObject) currentObject.rotation.set(0, 0, 0);
  controls.reset();
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}