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

// Selection Bounding Box
const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x4a90e2);
selectionBox.raycast = () => {}; // Prevent interfering with raycasting
selectionBox.visible = false;
scene.add(selectionBox);

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

const transform = new TransformControls(camera, renderer.domElement);
transform.setMode('translate');
transform.setSpace('local');
transform.setSize(0.8);
scene.add(transform);
transform.addEventListener('dragging-changed', e => controls.enabled = !e.value);
transform.addEventListener('objectChange', () => {
  if (state.activeMesh) selectionBox.setFromObject(state.activeMesh);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
scene.add(new THREE.GridHelper(20, 20));

/* Memory Safe Undo/Redo (Clones Position, Normal, Color) */
const undoStack = [], redoStack = [];
function captureState(mesh) {
  const pos = mesh.geometry.attributes.position;
  const norm = mesh.geometry.attributes.normal;
  const col = mesh.geometry.attributes.color;
  return {
    position: pos.clone(),
    normal: norm ? norm.clone() : null,
    color: col ? col.clone() : null
  };
}
function saveState(mesh) {
  if (!mesh) return;
  undoStack.push(captureState(mesh));
  if (undoStack.length > 20) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  if (!state.activeMesh || !undoStack.length) return;
  redoStack.push(captureState(state.activeMesh));

  const prev = undoStack.pop();
  state.activeMesh.geometry.setAttribute('position', prev.position);
  if (prev.normal) state.activeMesh.geometry.setAttribute('normal', prev.normal);
  else state.activeMesh.geometry.computeVertexNormals();
  
  if (prev.color) {
    state.activeMesh.geometry.setAttribute('color', prev.color);
    state.activeMesh.material.vertexColors = true;
  } else {
    state.activeMesh.geometry.deleteAttribute('color');
    state.activeMesh.material.vertexColors = false;
  }
  state.activeMesh.material.needsUpdate = true;

  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  selectionBox.setFromObject(state.activeMesh);
}
function redo() {
  if (!state.activeMesh || !redoStack.length) return;
  undoStack.push(captureState(state.activeMesh));

  const next = redoStack.pop();
  state.activeMesh.geometry.setAttribute('position', next.position);
  if (next.normal) state.activeMesh.geometry.setAttribute('normal', next.normal);
  else state.activeMesh.geometry.computeVertexNormals();
  
  if (next.color) {
    state.activeMesh.geometry.setAttribute('color', next.color);
    state.activeMesh.material.vertexColors = true;
  } else {
    state.activeMesh.geometry.deleteAttribute('color');
    state.activeMesh.material.vertexColors = false;
  }
  state.activeMesh.material.needsUpdate = true;

  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  selectionBox.setFromObject(state.activeMesh);
}

const actionArea = document.getElementById("action-area");
const state = {
  mode: "sculpt",
  activeTool: "inflate",
  trackpadMode: "camera",
  trackpadSensitivity: 0.6,
  activeMesh: null,
  objects: [],
  brush: null,
  wireframe: false,
  symmetryEnabled: false,
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
      if (actionArea) actionArea.style.pointerEvents = "auto";
    } else if (this.activeMesh) {
      transform.attach(this.activeMesh);
      transform.setMode(mode);
      controls.enabled = true;
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else {
      transform.detach();
      controls.enabled = true;
      if (actionArea) actionArea.style.pointerEvents = "auto";
    }
  },

  setTrackpadMode(mode) {
    this.trackpadMode = mode;
    if (mode === "camera") { controls.enabled = true; cursorGroup.visible = false; this.lastHit = null; }
    else { if (this.mode === "sculpt" || this.mode === "paint") controls.enabled = false; }
  },

  setPaintColor(hex) {
    this.paintColor.set(hex);
    if (this.brush) this.brush.setPaintColor(this.paintColor);
    cursorMat.color.set(hex); dotMat.color.set(hex); crossMat.color.set(hex);
  },

  setTool(tool) { this.activeTool = tool; if (this.brush) this.brush.setTool(tool); },

  toggleWireframe() { this.wireframe = !this.wireframe; this.objects.forEach(m => m.material.wireframe = this.wireframe); },

  addCube() {
    let geo = new THREE.BoxGeometry(2, 2, 2, 24, 24, 24);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addSphere() {
    let geo = new THREE.SphereGeometry(1.5, 64, 64);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ff88, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addObject(mesh) {
    this.objects.push(mesh);
    scene.add(mesh);
    this.selectObject(mesh);
    this.updateObjectList();
  },

  selectObject(mesh) {
    this.activeMesh = mesh;
    if (this.mode !== "sculpt" && this.mode !== "paint") transform.attach(mesh);

    this.brush = new SculptBrush(mesh);
    this.brush.setPaintColor(this.paintColor);
    this.brush.setRadius(parseFloat(document.getElementById("brushSize").value));
    this.brush.setStrength(parseFloat(document.getElementById("brushStrength").value));
    this.brush.setTool(this.activeTool);
    
    if (viewGizmo) viewGizmo.updateMesh(mesh);
    
    // Update Selection Box
    selectionBox.setFromObject(mesh);
    selectionBox.visible = true;
    
    this.updateObjectList();
  },

  duplicateObject() {
    if (!this.activeMesh) return;
    const newMesh = this.activeMesh.clone();
    newMesh.geometry = this.activeMesh.geometry.clone();
    newMesh.material = this.activeMesh.material.clone();
    newMesh.position.x += 1.5;
    this.addObject(newMesh);
  },

  deleteObject() {
    if (!this.activeMesh) return;
    const idx = this.objects.indexOf(this.activeMesh);
    if (idx > -1) this.objects.splice(idx, 1);
    scene.remove(this.activeMesh);
    this.activeMesh.geometry.dispose();
    this.activeMesh.material.dispose();
    this.activeMesh = null;
    this.brush = null;

    if (this.objects.length > 0) this.selectObject(this.objects[0]);
    else { 
      transform.detach(); 
      selectionBox.visible = false;
      if (viewGizmo) viewGizmo.updateMesh(null); 
    }
    this.updateObjectList();
  },

  updateObjectList() {
    const list = document.getElementById("object-list");
    if (!list) return;
    list.innerHTML = "";
    this.objects.forEach((obj, index) => {
      const div = document.createElement("div");
      div.className = `object-item ${obj === this.activeMesh ? 'active' : ''}`;
      div.innerHTML = `<span>${obj.geometry.type.replace("Geometry", "")} ${index + 1}</span>`;
      div.onclick = () => this.selectObject(obj);
      list.appendChild(div);
    });
  },

  setRadius(r) { if (this.brush) this.brush.setRadius(r); if (cursorGroup.visible) cursorGroup.scale.setScalar(r); },
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
      if (mesh) { mesh.geometry = mergeVertices(mesh.geometry); this.addObject(mesh); }
    });
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

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
    } else { state.lastHit = null; cursorGroup.visible = false; }
  });
}

if (actionArea) {
  actionArea.addEventListener("pointerdown", e => {
    if (!state.activeMesh || state.mode === "camera" || state.mode === "move" || state.mode === "rotate" || state.mode === "scale") return;
    e.preventDefault(); isActionActive = true; saveState(state.activeMesh); handleAction();
  });
  actionArea.addEventListener("pointermove", e => { if (isActionActive) { e.preventDefault(); handleAction(); } });
  actionArea.addEventListener("pointerup", () => { 
    isActionActive = false; 
    if(state.brush) state.brush.rebuildGrid(); 
    if(state.activeMesh) selectionBox.setFromObject(state.activeMesh);
  });
  actionArea.addEventListener("pointercancel", () => { 
    isActionActive = false; 
    if(state.brush) state.brush.rebuildGrid(); 
    if(state.activeMesh) selectionBox.setFromObject(state.activeMesh);
  });
}

function handleAction() {
  if (state.trackpadMode !== 'brush') return;
  const hit = state.lastHit;
  if (!hit) return;

  const localPoint = state.activeMesh.worldToLocal(hit.point.clone());

  if (state.mode === "sculpt") {
    state.brush.apply(localPoint, state.symmetryEnabled);
  } else if (state.mode === "paint") {
    state.brush.paint(localPoint, state.symmetryEnabled);
  }
}

window.addEventListener("keydown", e => { if (e.ctrlKey && e.key === "z") undo(); if (e.ctrlKey && e.key === "y") redo(); });
window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

let viewGizmo = null;
try { viewGizmo = new ViewGizmo(camera, controls, { size: 96 }); viewGizmo.renderer.domElement.style.top = "60px"; } catch (e) { console.warn("Gizmo error", e); }

state.addCube();
state.setTrackpadMode("camera");

initUI(state, viewGizmo);

const btnModeCam = document.getElementById("btnModeCamera");
const btnModeBrsh = document.getElementById("btnModeBrush");
if (btnModeCam && btnModeBrsh) {
  btnModeCam.classList.add("active");
  btnModeBrsh.classList.remove("active");
  document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
}

function animate() {
  requestAnimationFrame(animate);
  if (state.trackpadMode === 'camera' && controls) controls.update();
  renderer.render(scene, camera);
  if (viewGizmo) viewGizmo.update();
}
animate();
