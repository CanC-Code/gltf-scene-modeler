import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let mesh, geometry;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let brushCursor;

let sculpt = {
  tool: 'inflate',
  radius: 0.2,
  strength: 0.4,
  cameraLocked: true,
  active: false
};

init();
animate();

/* ---------------- SETUP ---------------- */

function init() {
  const viewport = document.getElementById('viewport');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3a3a);

  camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
  camera.position.set(3, 3, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  scene.add(new THREE.GridHelper(10, 10));

  createCube();
  createBrushCursor();

  bindUI();
  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', e => sculpt.active = true);
  renderer.domElement.addEventListener('pointerup', e => sculpt.active = false);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
}

/* ---------------- MODEL ---------------- */

function createCube() {
  if (mesh) scene.remove(mesh);

  geometry = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10);
  geometry.computeVertexNormals();

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x88cc88 })
  );
  mesh.position.y = 0.5;
  scene.add(mesh);
}

function createSphere() {
  if (mesh) scene.remove(mesh);

  geometry = new THREE.SphereGeometry(0.6, 32, 32);
  geometry.computeVertexNormals();

  mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x88aaff })
  );
  mesh.position.y = 0.6;
  scene.add(mesh);
}

/* ---------------- SCULPT ---------------- */

function onPointerMove(e) {
  if (!mesh) return;

  mouse.x = (e.offsetX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(e.offsetY / renderer.domElement.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh)[0];
  if (!hit) return;

  brushCursor.position.copy(hit.point);
  brushCursor.lookAt(hit.point.clone().add(hit.face.normal));

  if (!sculpt.active) return;

  applyBrush(hit);
}

function applyBrush(hit) {
  const pos = geometry.attributes.position;
  const normal = hit.face.normal;
  const center = hit.point;

  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const d = v.distanceTo(center);
    if (d > sculpt.radius) continue;

    const falloff = 1 - d / sculpt.radius;
    const strength = sculpt.strength * falloff * 0.1;

    if (sculpt.tool === 'inflate') {
      v.addScaledVector(normal, strength);
    }
    if (sculpt.tool === 'deflate') {
      v.addScaledVector(normal, -strength);
    }
    if (sculpt.tool === 'flatten') {
      const planeD = normal.dot(center);
      const dist = normal.dot(v) - planeD;
      v.addScaledVector(normal, -dist * strength);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

/* ---------------- BRUSH CURSOR ---------------- */

function createBrushCursor() {
  const geo = new THREE.RingGeometry(0.98, 1, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
  brushCursor = new THREE.Mesh(geo, mat);
  brushCursor.scale.setScalar(sculpt.radius);
  scene.add(brushCursor);
}

/* ---------------- UI ---------------- */

function bindUI() {
  document.getElementById('newCube').onclick = createCube;
  document.getElementById('newSphere').onclick = createSphere;

  document.getElementById('toggleCamera').onclick = () => {
    sculpt.cameraLocked = !sculpt.cameraLocked;
    controls.enabled = sculpt.cameraLocked;
  };

  document.getElementById('toggleUI').onclick = () => {
    document.getElementById('toolPanel').classList.toggle('hidden');
  };

  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.onclick = () => {
      sculpt.tool = btn.dataset.tool;
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  document.getElementById('radius').oninput = e => {
    sculpt.radius = parseFloat(e.target.value);
    brushCursor.scale.setScalar(sculpt.radius);
  };

  document.getElementById('strength').oninput = e => {
    sculpt.strength = parseFloat(e.target.value);
  };

  document.getElementById('saveModel').onclick = exportGLTF;
  document.getElementById('loadModel').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange = loadGLTF;
}

/* ---------------- LOAD / SAVE ---------------- */

function exportGLTF() {
  const exporter = new GLTFExporter();
  exporter.parse(mesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'model.gltf';
    a.click();
  });
}

function loadGLTF(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const loader = new GLTFLoader();
    loader.parse(ev.target.result, '', gltf => {
      if (mesh) scene.remove(mesh);
      mesh = gltf.scene.children[0];
      geometry = mesh.geometry;
      scene.add(mesh);
    });
  };
  reader.readAsArrayBuffer(file);
}

/* ---------------- RENDER ---------------- */

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  const v = document.getElementById('viewport');
  camera.aspect = v.clientWidth / v.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(v.clientWidth, v.clientHeight);
}