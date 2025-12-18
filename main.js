import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { TransformControls } from './three/TransformControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';

const canvas = document.getElementById('viewport');

let scene, camera, renderer, controls, transform;
let mesh;
let mode = 'sculpt';
let brush = 'inflate';
let cameraLocked = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const brushCursor = new THREE.Mesh(
  new THREE.CircleGeometry(1, 64),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
);
brushCursor.rotation.x = -Math.PI / 2;

init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x555555);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(3, 3, 3);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  resize();

  controls = new OrbitControls(camera, canvas);

  transform = new TransformControls(camera, canvas);
  scene.add(transform);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

  createBaseMesh();
  scene.add(brushCursor);

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  document.getElementById('toggleCamera').onclick = () => {
    cameraLocked = !cameraLocked;
    controls.enabled = !cameraLocked;
  };

  document.querySelectorAll('[data-brush]').forEach(b =>
    b.onclick = () => brush = b.dataset.brush
  );

  document.getElementById('addCube').onclick = createBaseMesh;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function createBaseMesh() {
  if (mesh) scene.remove(mesh);

  const geo = new THREE.IcosahedronGeometry(1, 4);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.5,
    metalness: 0.1
  });

  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
}

function onPointerMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh);

  if (hit.length) {
    brushCursor.position.copy(hit[0].point);
    brushCursor.lookAt(hit[0].point.clone().add(hit[0].face.normal));
    brushCursor.scale.setScalar(document.getElementById('radius').value);
  }
}

function onPointerDown(e) {
  if (cameraLocked) return;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh);
  if (!hit.length) return;

  applyBrush(hit[0]);
}

function applyBrush(hit) {
  const radius = parseFloat(document.getElementById('radius').value);
  const strength = parseFloat(document.getElementById('strength').value);

  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const center = hit.point;

  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const d = v.distanceTo(center);

    if (d < radius) {
      const falloff = 1 - d / radius;
      const normal = hit.face.normal.clone();

      if (brush === 'inflate') v.addScaledVector(normal, falloff * strength);
      if (brush === 'deflate') v.addScaledVector(normal, -falloff * strength);
      if (brush === 'flatten') v.lerp(center, falloff * strength);
      if (brush === 'smooth') v.lerp(center, falloff * strength * 0.5);

      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}