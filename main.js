import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

function resize() {
  const w = canvas.clientWidth || window.innerWidth || 1;
  const h = canvas.clientHeight || window.innerHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e0e0);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(2, 2, 2);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 7);
scene.add(dir);

let mesh;
let subdivisions = 20;

function createCube(subdiv = subdivisions) {
  const geo = new THREE.BoxGeometry(1, 1, 1, subdiv, subdiv, subdiv);
  geo.setAttribute(
    'color',
    new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3)
  );
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.1
  });
  mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
}

createCube();
resize();

/* ---------- Sculpt Logic ---------- */

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let activeTool = 'inflate';
let strength = 0.01;
let paintColor = new THREE.Color('#ff0000');
let sculpting = false;

canvas.addEventListener('pointerdown', () => sculpting = true);
canvas.addEventListener('pointerup', () => sculpting = false);

canvas.addEventListener('pointermove', e => {
  if (!sculpting || !mesh) return;

  mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(mesh)[0];
  if (!hit) return;

  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const col = geo.attributes.color;

  let maxDist = 0;

  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const d = v.distanceTo(hit.point);
    if (d > 0.2) continue;

    maxDist = Math.max(maxDist, d);

    if (activeTool === 'inflate') v.addScaledVector(hit.face.normal, strength);
    if (activeTool === 'deflate') v.addScaledVector(hit.face.normal, -strength);
    if (activeTool === 'smooth') v.lerp(hit.point, strength);

    pos.setXYZ(i, v.x, v.y, v.z);
    col.setXYZ(i, paintColor.r, paintColor.g, paintColor.b);
  }

  pos.needsUpdate = true;
  col.needsUpdate = true;
  geo.computeVertexNormals();

  // 🔥 Dynamic refinement trigger
  if (maxDist > 0.18 && subdivisions < 60) {
    refineMesh();
  }
});

function refineMesh() {
  subdivisions += 10;

  const oldMesh = mesh;
  const oldPositions = oldMesh.geometry.attributes.position.array.slice();

  scene.remove(oldMesh);
  createCube(subdivisions);

  // Project old deformation into new mesh
  const newPos = mesh.geometry.attributes.position;
  for (let i = 0; i < Math.min(oldPositions.length / 3, newPos.count); i++) {
    newPos.setXYZ(
      i,
      oldPositions[i * 3],
      oldPositions[i * 3 + 1],
      oldPositions[i * 3 + 2]
    );
  }
  newPos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

/* ---------- UI ---------- */

document.querySelectorAll('#tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});
document.querySelector('#tabs button').click();

document.getElementById('sculptTool').onchange = e => activeTool = e.target.value;
document.getElementById('strength').oninput = e => strength = +e.target.value;
document.getElementById('paintColor').oninput = e => paintColor.set(e.target.value);
document.getElementById('lockCamera').onchange = e => controls.enabled = !e.target.checked;

document.getElementById('toggleWire').onclick = () => {
  mesh.material.wireframe = !mesh.material.wireframe;
};

document.getElementById('addCube').onclick = () => {
  scene.remove(mesh);
  subdivisions = 20;
  createCube();
};

document.getElementById('addSphere').onclick = () => {
  scene.remove(mesh);
  const geo = new THREE.SphereGeometry(0.7, 32, 32);
  geo.setAttribute('color', new THREE.BufferAttribute(
    new Float32Array(geo.attributes.position.count * 3), 3
  ));
  mesh = new THREE.Mesh(geo, mesh.material.clone());
  scene.add(mesh);
};

document.getElementById('exportGLTF').onclick = () => {
  new GLTFExporter().parse(mesh, gltf => {
    const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'model.gltf';
    a.click();
  });
};

document.getElementById('loadGLTF').onchange = e => {
  new GLTFLoader().load(URL.createObjectURL(e.target.files[0]), gltf => {
    scene.remove(mesh);
    mesh = gltf.scene.children[0];
    scene.add(mesh);
  });
};

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();