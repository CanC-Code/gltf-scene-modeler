// js/main.js
import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";
import { FontLoader } from "../three/FontLoader.js";
import { TextGeometry } from "../three/TextGeometry.js";

/* ===============================
   Renderer / Scene
================================ */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(4, 4, 6);

// Attach OrbitControls to the left trackpad area
const trackpadSurface = document.querySelector(".area-surface");
const controls = new OrbitControls(camera, trackpadSurface);
controls.enableDamping = true;
controls.rotateSpeed = 0.5;

/* ===============================
   3D Brush Cursor
================================ */
const cursorGeo = new THREE.RingGeometry(0.8, 1.0, 32);
cursorGeo.rotateX(-Math.PI / 2);
const cursorMat = new THREE.MeshBasicMaterial({ 
  color: 0xff0000, 
  side: THREE.DoubleSide, 
  transparent: true, 
  opacity: 0.8, 
  depthTest: false 
});
const brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
brushCursor.visible = false;
scene.add(brushCursor);

/* ===============================
   Transform Controls
================================ */
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform);

transform.addEventListener('dragging-changed', function (event) {
  controls.enabled = !event.value;
});

/* ===============================
   Lighting & Helpers
================================ */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

scene.add(new THREE.GridHelper(20, 20));

/* ===============================
   Compass Labels (N/E/S/W)
================================ */
const compassLabels = [];
const fontLoader = new FontLoader();

fontLoader.load("./three/fonts/helvetiker_regular.typeface.json", font => {
  const labelMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false
  });
  
  const directions = [
    { text: "N", pos: [0, 0, -10] },
    { text: "E", pos: [10, 0, 0] },
    { text: "S", pos: [0, 0, 10] },
    { text: "W", pos: [-10, 0, 0] }
  ];
  
  directions.forEach(dir => {
    const textGeo = new TextGeometry(dir.text, { font: font, size: 0.8, height: 0.05 });
    textGeo.computeBoundingBox();
    const centerOffset = -(textGeo.boundingBox.max.x - textGeo.boundingBox.min.x) / 2;
    
    const textMesh = new THREE.Mesh(textGeo, labelMaterial);
    textMesh.position.set(dir.pos[0], 0.1, dir.pos[2]);
    textMesh.position.x += centerOffset;
    
    compassLabels.push(textMesh);
    scene.add(textMesh);
  });
});

/* ===============================
   Undo / Redo
================================ */
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 20;

function saveState(mesh) {
  if (!mesh) return;
  const state = { geometry: mesh.geometry.clone(), hasColors: !!mesh.geometry.attributes.color };
  undoStack.push(state);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  if (!state.activeMesh || undoStack.length === 0) return;
  const currentState = { geometry: state.activeMesh.geometry.clone(), hasColors: !!state.activeMesh.geometry.attributes.color };
  redoStack.push(currentState);
  
  const prev = undoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = prev.geometry;
  state.activeMesh.material.vertexColors = prev.hasColors;
  state.activeMesh.material.needsUpdate = true;
  state.activeMesh.geometry.computeVertexNormals();
  viewGizmo.updateMesh(state.activeMesh);
}

function redo() {
  if (!state.activeMesh || redoStack.length === 0) return;
  const currentState = { geometry: state.activeMesh.geometry.clone(), hasColors: !!state.activeMesh.geometry.attributes.color };
  undoStack.push(currentState);
  
  const next = redoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = next.geometry;
  state.activeMesh.material.vertexColors = next.hasColors;
  state.activeMesh.material.needsUpdate = true;
  state.activeMesh.geometry.computeVertexNormals();
  viewGizmo.updateMesh(state.activeMesh);
}

/* ===============================
   Application State
================================ */
const state = {
  mode: "sculpt",
  trackpadMode: "camera", // 'camera' or 'brush'
  activeMesh: null,
  brush: null,
  wireframe: false,
  controls,
  transform,
  paintColor: new THREE.Color("#ff0000"),
  lastHit: null, // Stores the raycast hit from the trackpad

  undo,
  redo,

  setMode(mode) {
    this.mode = mode;
    if (mode === "sculpt" || mode === "paint") {
      transform.detach();
      if (this.trackpadMode === 'camera') controls.enabled = true;
    } else {
      if (this.activeMesh) {
        transform.attach(this.activeMesh);
        transform.setMode(mode);
        controls.enabled = false;
      }
    }
  },

  setTrackpadMode(mode) {
    this.trackpadMode = mode;
    if (mode === "camera") {
      controls.enabled = true;
      brushCursor.visible = false;
      this.lastHit = null;
    } else {
      controls.enabled = false;
      // Cursor visibility handled by raycast in pointermove
    }
  },

  setPaintColor(hex) {
    this.paintColor.set(hex);
    if (this.brush) this.brush.setPaintColor(this.paintColor);
  },

  toggleWireframe() {
    this.wireframe = !this.wireframe;
    if (this.activeMesh) this.activeMesh.material.wireframe = this.wireframe;
  },

  createCube() {
    clearActiveMesh();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2, 24, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, wireframe: this.wireframe, vertexColors: false })
    );
    setActiveMesh(mesh);
    saveState(mesh);
    viewGizmo.updateMesh(mesh);
  },

  createSphere() {
    clearActiveMesh();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x88ff88, wireframe: this.wireframe, vertexColors: false })
    );
    setActiveMesh(mesh);
    saveState(mesh);
    viewGizmo.updateMesh(mesh);
  },

  setTool(tool) { if (this.brush) this.brush.setTool(tool); },
  setRadius(r) { 
    if (this.brush) this.brush.setRadius(r);
    if (this.lastHit) brushCursor.scale.setScalar(r);
  },
  setStrength(s) { if (this.brush) this.brush.setStrength(s); },

  exportGLTF() {
    if (!this.activeMesh) return;
    new GLTFExporter().parse(this.activeMesh, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "model.gltf";
      a.click();
    });
  },

  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => {
      new GLTFLoader().parse(reader.result, "", gltf => {
        const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
        if (mesh) {
          setActiveMesh(mesh);
          viewGizmo.updateMesh(mesh);
        }
      });
    };
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

/* ===============================
   Mesh Management
================================ */
function clearActiveMesh() {
  if (!state.activeMesh) return;
  transform.detach();
  scene.remove(state.activeMesh);
  state.activeMesh.geometry.dispose();
  state.activeMesh.material.dispose();
  state.activeMesh = null;
  state.brush = null;
  viewGizmo.updateMesh(null);
}

function setActiveMesh(mesh) {
  state.activeMesh = mesh;
  scene.add(mesh);
  if (state.mode !== "sculpt" && state.mode !== "paint") transform.attach(mesh);
  state.brush = new SculptBrush(mesh);
  state.brush.setPaintColor(state.paintColor);
}

/* ===============================
   Action Logic & Cursor Tracking
================================ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isActionActive = false;

// 1. Trackpad Cursor Tracking (Left Side)
trackpadSurface.addEventListener("pointermove", e => {
  if (state.trackpadMode !== 'brush' || !state.activeMesh) return;
  
  // Map trackpad touch to full screen coordinates
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(state.activeMesh)[0];
  
  if (hit) {
    state.lastHit = hit;
    brushCursor.visible = true;
    brushCursor.position.copy(hit.point);
    
    // Align cursor to surface normal
    const normal = hit.face.normal.clone();
    normal.transformDirection(state.activeMesh.matrixWorld);
    brushCursor.lookAt(hit.point.clone().add(normal));
    brushCursor.scale.setScalar(state.brush.radius);
  } else {
    state.lastHit = null;
    brushCursor.visible = false;
  }
});

// Hide cursor when finger lifts from trackpad
trackpadSurface.addEventListener("pointerup", () => {
  if (state.trackpadMode === 'brush') {
    // Keep cursor visible but stop tracking if they lift?
    // Actually, keep it visible so they know where it is
  }
});

// 2. Action Area Execution (Right Side)
const actionArea = document.getElementById("action-area");

actionArea.addEventListener("pointerdown", e => {
  if ((state.mode !== "sculpt" && state.mode !== "paint") || !state.activeMesh) return;
  e.preventDefault();
  isActionActive = true;
  saveState(state.activeMesh);
  handleAction(e);
});

actionArea.addEventListener("pointermove", e => {
  if (isActionActive) {
    e.preventDefault();
    handleAction(e);
  }
});

actionArea.addEventListener("pointerup", () => { isActionActive = false; });
actionArea.addEventListener("pointercancel", () => { isActionActive = false; });

function handleAction(e) {
  let hit = state.lastHit;
  
  // If NOT in brush mode (or no hit tracked), fallback to raycasting from the right touch
  if (!hit || state.trackpadMode !== 'brush') {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    hit = raycaster.intersectObject(state.activeMesh)[0];
  }
  
  if (!hit) return;
  
  if (state.mode === "sculpt") {
    state.brush.apply(hit.point);
  } else if (state.mode === "paint") {
    state.brush.paint(hit);
  }
}

/* ===============================
   Keyboard Shortcuts
================================ */
window.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") undo();
  if (e.ctrlKey && e.key === "y") redo();
});

/* ===============================
   Resize Handling
================================ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ===============================
   Init
================================ */
const viewGizmo = new ViewGizmo(camera, controls);
state.createCube();
initUI(state, viewGizmo);

/* ===============================
   Render Loop
================================ */
function animate() {
  requestAnimationFrame(animate);
  if (state.trackpadMode === 'camera') controls.update();
  
  compassLabels.forEach(label => label.lookAt(camera.position));
  
  renderer.render(scene, camera);
  viewGizmo.update();
}

animate();
