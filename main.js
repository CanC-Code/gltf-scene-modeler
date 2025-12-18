import * as THREE from "./three/three.module.js";
import { OrbitControls } from "./three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "./three/examples/jsm/controls/TransformControls.js";

let scene, camera, renderer;
let orbitControls, transformControls;
let activeObject = null;
let cameraLocked = false;
let activeBrush = "add";

const canvas = document.getElementById("viewport");

init();
animate();

function init() {
  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // --- Camera ---
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(6, 6, 6);

  // --- Renderer (REAL canvas) ---
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // --- Controls ---
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.visible = false;
  transformControls.addEventListener("dragging-changed", e => {
    orbitControls.enabled = !e.value;
  });
  scene.add(transformControls);

  // --- Lighting ---
  scene.add(new THREE.AmbientLight(0x404040));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 5);
  scene.add(dir);

  // --- Grid ---
  scene.add(new THREE.GridHelper(50, 50));

  // --- UI ---
  wireUI();
  window.addEventListener("resize", onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createPrimitive(type) {
  let geometry;

  if (type === "cube") {
    geometry = new THREE.BoxGeometry(1, 1, 1);
  } else if (type === "sphere") {
    geometry = new THREE.SphereGeometry(0.5, 24, 24);
  } else {
    return;
  }

  const material = new THREE.MeshStandardMaterial({ color: 0x88ccff });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  selectObject(mesh);
}

function selectObject(object) {
  activeObject = object;
  transformControls.attach(object);
  transformControls.visible = true;
}

function wireUI() {
  document.querySelectorAll("[data-primitive]").forEach(btn => {
    btn.addEventListener("click", () => {
      createPrimitive(btn.dataset.primitive);
    });
  });

  document.querySelectorAll("[data-brush]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeBrush = btn.dataset.brush;
    });
  });

  document.getElementById("cameraLock").onclick = () => {
    cameraLocked = !cameraLocked;
    orbitControls.enabled = !cameraLocked;
  };

  document.getElementById("gizmoToggle").onclick = () => {
    if (!activeObject) return;
    transformControls.visible = !transformControls.visible;
  };

  document.getElementById("newModel").onclick = () => {
    scene.children
      .filter(o => o.isMesh)
      .forEach(o => scene.remove(o));
    transformControls.detach();
    transformControls.visible = false;
    activeObject = null;
  };

  document.getElementById("saveModel").onclick = () => {
    const meshes = scene.children.filter(o => o.isMesh);
    const data = meshes.map(m => ({
      type: m.geometry.type,
      position: m.position.toArray()
    }));
    downloadJSON(data, "model.json");
  };

  document.getElementById("loadModel").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    file.text().then(text => {
      const data = JSON.parse(text);
      data.forEach(entry => {
        const type = entry.type === "BoxGeometry" ? "cube" : "sphere";
        createPrimitive(type);
        activeObject.position.fromArray(entry.position);
      });
    });
  };
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  renderer.render(scene, camera);
}