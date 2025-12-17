import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let viewCubeScene, viewCubeCamera, viewCubeRenderer, viewCubeControls;
let currentObject = null;

/** Entry point */
function startApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

startApp();

function init() {
  // --- MAIN SCENE ---
  const container = document.getElementById('canvasContainer');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202025);

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('mainCanvas') });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.5, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  scene.add(new THREE.GridHelper(20, 20));

  // --- VIEW CUBE SCENE ---
  const viewCanvas = document.getElementById('viewCubeCanvas');
  viewCubeScene = new THREE.Scene();
  viewCubeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  viewCubeCamera.position.set(2, 2, 2);
  viewCubeRenderer = new THREE.WebGLRenderer({ canvas: viewCanvas, alpha: true });
  viewCubeRenderer.setSize(viewCanvas.clientWidth, viewCanvas.clientHeight);

  viewCubeControls = new OrbitControls(viewCubeCamera, viewCanvas);
  viewCubeControls.enableRotate = true;
  viewCubeControls.enableZoom = false;
  viewCubeControls.enablePan = false;

  const axes = new THREE.AxesHelper(1);
  viewCubeScene.add(axes);

  // --- UI BINDING ---
  bindButton('newCube', () => createObject('cube'));
  bindButton('newSphere', () => createObject('sphere'));
  bindButton('exportBtn', exportScene);
  bindButton('resetScene', resetScene);

  window.addEventListener('resize', onWindowResize);

  animate();
}

function bindButton(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', handler);
}

function createObject(type) {
  if (currentObject) scene.remove(currentObject);
  if (type === 'cube') {
    currentObject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x44aa88 })
    );
  } else if (type === 'sphere') {
    currentObject = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xaa4444 })
    );
  }
  currentObject.position.y = 0.5;
  scene.add(currentObject);
  document.getElementById('status').textContent = `Created ${type}`;
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
  if (currentObject) {
    currentObject.rotation.set(0, 0, 0);
    currentObject.position.set(0, 0.5, 0);
  }
  controls.reset();
  document.getElementById('status').textContent = 'Ready';
}

function onWindowResize() {
  const container = document.getElementById('canvasContainer');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  viewCubeRenderer.setSize(document.getElementById('viewCubeCanvas').clientWidth, document.getElementById('viewCubeCanvas').clientHeight);
}

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  viewCubeControls.update();

  renderer.render(scene, camera);
  viewCubeRenderer.render(viewCubeScene, viewCubeCamera);
}