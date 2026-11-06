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
import { mergeVertices } from "../three/utils/BufferGeometryUtils.js";

const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 6);

const trackpadSurface = document.getElementById("trackpad-surface") || renderer.domElement;
const controls = new OrbitControls(camera, trackpadSurface);
controls.enableDamping = true;
controls.rotateSpeed = 0.5;

// Professional 3D Brush Cursor
const cursorGroup = new THREE.Group();
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false });
cursorGroup.add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 32), cursorMat));
const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: true, depthWrite: false });
cursorGroup.add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), dotMat));
const crossGeo = new THREE.BufferGeometry();
crossGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([ -1.2,0,0,-0.2,0,0, 0.2,0,0,1.2,0,0, 0,-1.2,0,0,-0.2,0, 0,0.2,0,0,1.2,0 ]), 3));
const crossMat = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: true, depthWrite: false, transparent: true, opacity: 0.6 });
cursorGroup.add(new THREE.LineSegments(crossGeo, crossMat));
cursorGroup.visible = false;
scene.add(cursorGroup);

// Transform Controls (Gizmo)
const transform = new TransformControls(camera, renderer.domElement);
transform.setMode('translate'); // Default but detach initially
transform.setSpace('local');
transform.setSize(0.8);
scene.add(transform);

// Disable orbit controls only when actively dragging the gizmo
transform.addEventListener('dragging-changed', e => controls.enabled = !e.value);

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
scene.add(new THREE.GridHelper(20, 20));

const compassLabels = [];
new FontLoader().load("./three/fonts/helvetiker_regular.typeface.json", font => {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  ["N|0|0|-10", "E|10|0|0", "S|0|0|10", "W|-10|0|0"].forEach(d => {
    const [t, x, y, z] = d.split("|");
    const geo = new TextGeometry(t, { font, size: 0.8, height: 0.05 });
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(parseFloat(x), 0.1, parseFloat(z));
    mesh.position.x += -(geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;
    compassLabels.push(mesh);
    scene.add(mesh);
  });
});

const undoStack = [], redoStack = [];
function saveState(mesh) {
  if (!mesh) return;
  undoStack.push({ geometry: mesh.geometry.clone(), hasColors: !!mesh.geometry.attributes.color });
  if (undoStack.length > 20) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!state.activeMesh || !undoStack.length) return;
  redoStack.push({ geometry: state.activeMesh.geometry.clone(), hasColors: !!state.activeMesh.geometry.attributes.color });
  const prev = undoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = prev.geometry;
  state.activeMesh.material.vertexColors = prev.hasColors;
  state.activeMesh.material.needsUpdate = true;
  state.activeMesh.geometry.computeVertexNormals();
  
  if (state.brush) state.brush.updateMesh(state.activeMesh);
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
}
function redo() {
  if (!state.activeMesh || !redoStack.length) return;
  undoStack.push({ geometry: state.activeMesh.geometry.clone(), hasColors: !!state.activeMesh.geometry.attributes.color });
  const next = redoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry = next.geometry;
  state.activeMesh.material.vertexColors = next.hasColors;
  state.activeMesh.material.needsUpdate = true;
  state.activeMesh.geometry.computeVertexNormals();
  
  if (state.brush) state.brush.updateMesh(state.activeMesh);
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
}

const actionArea = document.getElementById("action-area");

const state = {
  mode: "sculpt", 
  activeTool: "inflate", 
  trackpadMode: "camera", 
  trackpadSensitivity: 0.6,
  activeMesh: null, 
  brush: null, 
  wireframe: false, 
  scene, 
  controls, 
  transform, 
  paintColor: new THREE.Color("#ff0000"), 
  lastHit: null, 
  undo, 
  redo,
  
  setMode(mode) {
    this.mode = mode;
    
    if (mode === "sculpt" || mode === "paint") {
      transform.detach();
      controls.enabled = (this.trackpadMode === 'camera');
      // Allow action area to capture touches for sculpting
      if (actionArea) actionArea.style.pointerEvents = "auto";
    } else if (this.activeMesh) {
      transform.attach(this.activeMesh);
      transform.setMode(mode);
      controls.enabled = true; 
      // MUST disable action area so touches pass through to the 3D canvas/gizmo
      if (actionArea) actionArea.style.pointerEvents = "none"; 
    } else {
      transform.detach();
      controls.enabled = true;
      if (actionArea) actionArea.style.pointerEvents = "auto";
    }
  },
  
  setTrackpadMode(mode) {
    this.trackpadMode = mode;
    if (mode === "camera") { 
      controls.enabled = true; 
      cursorGroup.visible = false; 
      this.lastHit = null; 
    } else {
      if (this.mode === "sculpt" || this.mode === "paint") {
        controls.enabled = false;
      }
    }
  },
  
  setPaintColor(hex) { 
    this.paintColor.set(hex); 
    if (this.brush) this.brush.setPaintColor(this.paintColor); 
    cursorMat.color.set(hex); dotMat.color.set(hex); crossMat.color.set(hex);
  },
  
  setTool(tool) {
    this.activeTool = tool;
    if (this.brush) this.brush.setTool(tool);
  },
  
  toggleWireframe() { 
    this.wireframe = !this.wireframe; 
    if (this.activeMesh) this.activeMesh.material.wireframe = this.wireframe; 
  },
  
  createCube() {
    clearActiveMesh();
    let geo = new THREE.BoxGeometry(2, 2, 2, 24, 24, 24);
    geo = mergeVertices(geo); 
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    setActiveMesh(mesh); saveState(mesh); if (viewGizmo) viewGizmo.updateMesh(mesh);
  },
  
  createSphere() {
    clearActiveMesh();
    let geo = new THREE.SphereGeometry(1.5, 64, 64);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ff88, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    setActiveMesh(mesh); saveState(mesh); if (viewGizmo) viewGizmo.updateMesh(mesh);
  },
  
  setRadius(r) { 
    if (this.brush) this.brush.setRadius(r); 
    if (cursorGroup.visible) cursorGroup.scale.setScalar(r); 
  },
  
  setStrength(s) { if (this.brush) this.brush.setStrength(s); },
  
  exportGLTF() {
    if (!this.activeMesh) return;
    new GLTFExporter().parse(this.activeMesh, gltf => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(gltf)], { type: "application/json" })); a.download = "model.gltf"; a.click();
    });
  },
  
  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => new GLTFLoader().parse(reader.result, "", gltf => {
      const mesh = gltf.scene.getObjectByProperty("type", "Mesh");
      if (mesh) { 
        mesh.geometry = mergeVertices(mesh.geometry); 
        setActiveMesh(mesh); 
        if (viewGizmo) viewGizmo.updateMesh(mesh); 
      }
    });
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

function clearActiveMesh() {
  if (!state.activeMesh) return;
  transform.detach(); scene.remove(state.activeMesh); state.activeMesh.geometry.dispose(); state.activeMesh.material.dispose();
  state.activeMesh = null; state.brush = null; cursorGroup.visible = false;
  if (viewGizmo) viewGizmo.updateMesh(null);
}

function setActiveMesh(mesh) {
  state.activeMesh = mesh; 
  scene.add(mesh);
  
  // Re-attach gizmo if we are currently in a transform mode
  if (state.mode !== "sculpt" && state.mode !== "paint") {
     transform.attach(mesh);
     transform.setMode(state.mode);
  }
  
  state.brush = new SculptBrush(mesh); 
  state.brush.setPaintColor(state.paintColor);
  state.brush.setRadius(parseFloat(document.getElementById("brushSize").value));
  state.brush.setStrength(parseFloat(document.getElementById("brushStrength").value));
  state.brush.setTool(state.activeTool);
}

const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
let isActionActive = false;

if (trackpadSurface) {
  trackpadSurface.addEventListener("pointermove", e => {
    if (state.trackpadMode !== 'brush' || !state.activeMesh || !state.brush || (state.mode !== 'sculpt' && state.mode !== 'paint')) return;
    
    const rect = trackpadSurface.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    
    mouse.x = THREE.MathUtils.clamp(rawX * state.trackpadSensitivity, -1, 1);
    mouse.y = THREE.MathUtils.clamp(rawY * state.trackpadSensitivity, -1, 1);
    
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(state.activeMesh)[0];
    
    if (hit) {
      state.lastHit = hit;
      cursorGroup.visible = true;
      const normal = hit.face ? hit.face.normal.clone().transformDirection(state.activeMesh.matrixWorld) : new THREE.Vector3(0,1,0);
      cursorGroup.position.copy(hit.point).addScaledVector(normal, 0.02);
      cursorGroup.lookAt(hit.point.clone().addScaledVector(normal, 1));
      cursorGroup.scale.setScalar(state.brush.radius);
    } else {
      state.lastHit = null;
      cursorGroup.visible = false;
    }
  });
}

if (actionArea) {
  actionArea.addEventListener("pointerdown", e => {
    if (!state.activeMesh || state.mode === "camera" || state.mode === "move" || state.mode === "rotate" || state.mode === "scale") return;
    e.preventDefault(); isActionActive = true; saveState(state.activeMesh); handleAction();
  });
  actionArea.addEventListener("pointermove", e => { if (isActionActive) { e.preventDefault(); handleAction(); } });
  actionArea.addEventListener("pointerup", () => isActionActive = false);
  actionArea.addEventListener("pointercancel", () => isActionActive = false);
}

function handleAction() {
  if (state.trackpadMode !== 'brush') return; 
  const hit = state.lastHit;
  if (!hit) return;
  
  if (state.mode === "sculpt") state.brush.apply(hit.point);
  else if (state.mode === "paint") state.brush.paint(hit);
}

window.addEventListener("keydown", e => { if (e.ctrlKey && e.key === "z") undo(); if (e.ctrlKey && e.key === "y") redo(); });
window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

let viewGizmo = null;
try { viewGizmo = new ViewGizmo(camera, controls, { size: 96 }); viewGizmo.renderer.domElement.style.top = "60px"; } catch (e) { console.warn("Gizmo error", e); }

state.createCube();

state.setTrackpadMode("camera"); 
const btnModeCam = document.getElementById("btnModeCamera");
const btnModeBrsh = document.getElementById("btnModeBrush");
if (btnModeCam && btnModeBrsh) {
  btnModeCam.classList.add("active");
  btnModeBrsh.classList.remove("active");
  document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
}

initUI(state, viewGizmo);

function animate() {
  requestAnimationFrame(animate);
  if (state.trackpadMode === 'camera' && controls) controls.update();
  compassLabels.forEach(l => l.lookAt(camera.position));
  renderer.render(scene, camera);
  if (viewGizmo) viewGizmo.update();
}
animate();
