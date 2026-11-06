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
import { extrudeFaces } from "./topology.js";

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

const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x4a90e2);
selectionBox.raycast = () => {};
selectionBox.visible = false;
scene.add(selectionBox);

const pointsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, vertexColors: true, depthTest: false, transparent: true, opacity: 1.0 });
const pointsCloud = new THREE.Points(new THREE.BufferGeometry(), pointsMat);
pointsCloud.visible = false;
scene.add(pointsCloud);

const editDummy = new THREE.Object3D();
scene.add(editDummy);

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

transform.addEventListener('dragging-changed', e => {
  controls.enabled = !e.value;
  if (!e.value && state.mode === 'edit' && state.activeMesh) {
    state.activeMesh.geometry.computeVertexNormals();
    state.brush.rebuildGrid();
  }
});

transform.addEventListener('objectChange', () => {
  if (state.mode === 'edit' && state.selectedVertices.size > 0) {
    const delta = new THREE.Vector3().subVectors(editDummy.position, state.lastDummyPos);
    const pos = state.activeMesh.geometry.attributes.position;
    
    state.selectedVertices.forEach(idx => {
      pos.setXYZ(idx, pos.getX(idx) + delta.x, pos.getY(idx) + delta.y, pos.getZ(idx) + delta.z);
    });
    
    pos.needsUpdate = true;
    pointsCloud.geometry.attributes.position.needsUpdate = true;
    state.lastDummyPos.copy(editDummy.position);
  } else if (state.activeMesh) {
    selectionBox.setFromObject(state.activeMesh);
  }
});

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);
scene.add(new THREE.GridHelper(20, 20));

const undoStack = [], redoStack = [];
function captureState(mesh) {
  const pos = mesh.geometry.attributes.position;
  const norm = mesh.geometry.attributes.normal;
  const col = mesh.geometry.attributes.color;
  const sw = mesh.geometry.attributes.skinWeight;
  return { position: pos.clone(), normal: norm ? norm.clone() : null, color: col ? col.clone() : null, skinWeight: sw ? sw.clone() : null };
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
  if (prev.skinWeight) state.activeMesh.geometry.setAttribute('skinWeight', prev.skinWeight);
  state.activeMesh.material.needsUpdate = true;
  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
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
  if (next.skinWeight) state.activeMesh.geometry.setAttribute('skinWeight', next.skinWeight);
  state.activeMesh.material.needsUpdate = true;
  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
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
  skeletonHelper: null,
  currentBones: null,
  activeBoneIndex: 0,
  selectedVertices: new Set(),
  lastDummyPos: new THREE.Vector3(),
  undo,
  redo,

  setMode(mode) {
    this.mode = mode;

    document.getElementById("scene-panel").classList.toggle("active", mode !== "rig" && mode !== "edit" && mode !== "weight_paint");
    document.getElementById("rig-panel").classList.toggle("active", mode === "rig" || mode === "weight_paint");
    document.getElementById("edit-panel").classList.toggle("active", mode === "edit");
    document.getElementById("sculpt-panel").classList.toggle("active", mode === "sculpt" || mode === "paint" || mode === "weight_paint");

    if (mode === "sculpt" || mode === "paint" || mode === "weight_paint") {
      transform.detach();
      pointsCloud.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
      controls.enabled = (this.trackpadMode === 'camera');
      if (actionArea) actionArea.style.pointerEvents = "auto";
    } else if (mode === "edit") {
      pointsCloud.visible = true;
      if (this.activeMesh) this.activeMesh.visible = false;
      syncPointsCloud();
      controls.enabled = true;
      transform.detach();
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else if (mode === "rig") {
      this.selectBone(this.activeBoneIndex);
      controls.enabled = true;
      pointsCloud.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else if (this.activeMesh) {
      transform.attach(this.activeMesh);
      transform.setMode(mode === "move" ? "translate" : mode);
      controls.enabled = true;
      pointsCloud.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
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
    else { if (this.mode === "sculpt" || this.mode === "paint" || this.mode === "weight_paint") controls.enabled = false; }
  },

  setPaintColor(hex) {
    this.paintColor.set(hex);
    if (this.brush) this.brush.setPaintColor(this.paintColor);
    cursorMat.color.set(hex); dotMat.color.set(hex); crossMat.color.set(hex);
    const btn = document.getElementById("color-picker-btn");
    if (btn) btn.style.background = hex;
  },

  setTool(tool) { this.activeTool = tool; if (this.brush) this.brush.setTool(tool); },
  toggleWireframe() { this.wireframe = !this.wireframe; this.objects.forEach(m => m.material.wireframe = this.wireframe); },

  focusCamera() {
    if (!this.activeMesh) return;
    const box = new THREE.Box3().setFromObject(this.activeMesh);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const fitHeightDistance = size / (2 * Math.tan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2; // 20% padding
    
    const direction = camera.position.clone().sub(center).normalize().multiplyScalar(distance);
    camera.position.copy(center).add(direction);
    controls.target.copy(center);
    controls.update();
  },

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
    if (this.mode !== "sculpt" && this.mode !== "paint" && this.mode !== "rig" && this.mode !== "edit" && this.mode !== "weight_paint") transform.attach(mesh);

    this.brush = new SculptBrush(mesh);
    this.brush.setPaintColor(this.paintColor);
    this.brush.setRadius(parseFloat(document.getElementById("brushSize").value));
    this.brush.setStrength(parseFloat(document.getElementById("brushStrength").value));
    this.brush.setTool(this.activeTool);

    if (viewGizmo) viewGizmo.updateMesh(mesh);
    selectionBox.setFromObject(mesh);
    selectionBox.visible = true;
    this.selectedVertices.clear();
    if (this.mode === 'edit') syncPointsCloud();

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
      div.className = `list-item ${obj === this.activeMesh ? 'active' : ''}`;
      div.innerHTML = `<span>${obj.geometry.type.replace("Geometry", "")} ${index + 1}</span>`;
      div.onclick = () => this.selectObject(obj);
      list.appendChild(div);
    });
  },

  addBoneChain() {
    if (!this.activeMesh) return;
    const box = new THREE.Box3().setFromObject(this.activeMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const height = box.max.y - box.min.y;
    const bottomY = -height/3, midY = 0, topY = height/3;

    const rootBone = new THREE.Bone(); rootBone.position.set(0, bottomY, 0);
    const midBone = new THREE.Bone(); midBone.position.set(0, midY - bottomY, 0); rootBone.add(midBone);
    const endBone = new THREE.Bone(); endBone.position.set(0, topY - midY, 0); midBone.add(endBone);

    const bones = [rootBone, midBone, endBone];
    this.currentBones = bones;
    if (this.skeletonHelper) scene.remove(this.skeletonHelper);

    const tempSkin = new THREE.SkinnedMesh(this.activeMesh.geometry, this.activeMesh.material);
    tempSkin.position.copy(this.activeMesh.position);
    tempSkin.rotation.copy(this.activeMesh.rotation);
    tempSkin.scale.copy(this.activeMesh.scale);
    tempSkin.add(rootBone);
    scene.add(tempSkin);

    this.skeletonHelper = new THREE.SkeletonHelper(tempSkin);
    this.skeletonHelper.material.linewidth = 3;
    scene.add(this.skeletonHelper);

    this.updateBoneList();
    this.selectBone(0);
    if (window.showToast) window.showToast("Armature created! Now click 'Bind Skin to Bones'.");
  },

  bindSkin() {
    if (!this.activeMesh || !this.currentBones) return;
    const skeleton = new THREE.Skeleton(this.currentBones);
    const geo = this.activeMesh.geometry;
    const posCount = geo.attributes.position.count;
    const skinIndices = new Uint16Array(posCount * 4);
    const skinWeights = new Float32Array(posCount * 4);

    const box = new THREE.Box3().setFromObject(this.activeMesh);
    const minY = box.min.y; const maxY = box.max.y;
    const range = maxY - minY;

    for (let i = 0; i < posCount; i++) {
      const y = geo.attributes.position.getY(i);
      const normalizedY = (y - minY) / range;
      if (normalizedY < 0.33) { skinIndices[i * 4] = 0; skinWeights[i * 4] = 1; }
      else if (normalizedY < 0.66) { skinIndices[i * 4] = 1; skinWeights[i * 4] = 1; }
      else { skinIndices[i * 4] = 2; skinWeights[i * 4] = 1; }
    }

    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const skinnedMesh = new THREE.SkinnedMesh(geo, this.activeMesh.material);
    skinnedMesh.position.copy(this.activeMesh.position);
    skinnedMesh.rotation.copy(this.activeMesh.rotation);
    skinnedMesh.scale.copy(this.activeMesh.scale);
    skinnedMesh.add(this.currentBones[0]);
    skinnedMesh.bind(skeleton);

    scene.remove(this.activeMesh);
    if (this.skeletonHelper) scene.remove(this.skeletonHelper);
    scene.add(skinnedMesh);
    this.activeMesh = skinnedMesh;

    this.skeletonHelper = new THREE.SkeletonHelper(skinnedMesh);
    this.skeletonHelper.material.linewidth = 3;
    scene.add(this.skeletonHelper);

    if (window.showToast) window.showToast("Skin bound successfully! Select Move/Rotate to pose.");
    this.selectBone(0);
  },

  updateBoneList() {
    const list = document.getElementById("bone-list");
    if (!list) return;
    list.innerHTML = "";
    if (!this.currentBones) return;
    const names = ["Root Bone", "Mid Bone", "End Bone"];
    this.currentBones.forEach((bone, index) => {
      const div = document.createElement("div");
      div.className = `list-item ${index === this.activeBoneIndex ? 'active' : ''}`;
      div.innerHTML = `<span>${names[index]}</span>`;
      div.onclick = () => this.selectBone(index);
      list.appendChild(div);
    });
    
    // Update Active Bone Label
    const label = document.getElementById("active-bone-label");
    if (label) label.textContent = `Active: ${names[this.activeBoneIndex]}`;
  },

  selectBone(index) {
    if (!this.currentBones || !this.currentBones[index]) return;
    this.activeBoneIndex = index;
    this.brush.setActiveBone(index);
    transform.attach(this.currentBones[index]);
    transform.setMode('translate');
    this.updateBoneList();
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

function syncPointsCloud() {
  if (!state.activeMesh) return;
  pointsCloud.geometry = state.activeMesh.geometry;
  if (!pointsCloud.geometry.attributes.color) {
    const colors = new Float32Array(pointsCloud.geometry.attributes.position.count * 3);
    colors.fill(1.0);
    pointsCloud.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const colors = pointsCloud.geometry.attributes.color;
  for (let i = 0; i < colors.count; i++) {
    colors.setXYZ(i, 1.0, 1.0, 1.0); // White
  }
  state.selectedVertices.forEach(idx => {
    colors.setXYZ(idx, 1.0, 0.0, 0.0); // Red
  });
  colors.needsUpdate = true;
}

const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
let isActionActive = false;

if (trackpadSurface) {
  trackpadSurface.addEventListener("pointermove", e => {
    if (state.trackpadMode !== 'brush' || !state.activeMesh || !state.brush || (state.mode !== 'sculpt' && state.mode !== 'paint' && state.mode !== 'weight_paint')) return;
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
    if (!state.activeMesh || state.mode === "camera" || state.mode === "move" || state.mode === "rotate" || state.mode === "scale" || state.mode === "rig" || state.mode === "edit") return;
    e.preventDefault(); isActionActive = true; saveState(state.activeMesh); handleAction();
  });
  actionArea.addEventListener("pointermove", e => { if (isActionActive) { e.preventDefault(); handleAction(); } });
  actionArea.addEventListener("pointerup", () => { isActionActive = false; if(state.brush) state.brush.rebuildGrid(); });
  actionArea.addEventListener("pointercancel", () => { isActionActive = false; if(state.brush) state.brush.rebuildGrid(); });
}

function handleAction() {
  if (state.trackpadMode !== 'brush') return;
  const hit = state.lastHit;
  if (!hit) return;
  const localPoint = state.activeMesh.worldToLocal(hit.point.clone());
  if (state.mode === "sculpt") state.brush.apply(localPoint, state.symmetryEnabled);
  else if (state.mode === "paint") state.brush.paint(localPoint, state.symmetryEnabled);
  else if (state.mode === "weight_paint") state.brush.paintWeight(localPoint); 
}

if (trackpadSurface) {
  trackpadSurface.addEventListener("pointerdown", e => {
    if (state.mode !== 'edit' || !state.activeMesh) return;
    const rect = trackpadSurface.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.x = THREE.MathUtils.clamp(rawX * state.trackpadSensitivity, -1, 1);
    mouse.y = THREE.MathUtils.clamp(rawY * state.trackpadSensitivity, -1, 1);
    
    raycaster.setFromCamera(mouse, camera);
    
    // Dynamic threshold based on camera distance
    const distToMesh = camera.position.distanceTo(state.activeMesh.position);
    raycaster.params.Points.threshold = distToMesh * 0.03;

    const hit = raycaster.intersectObject(pointsCloud)[0];
    
    if (hit) {
      const idx = hit.index;
      if (state.selectedVertices.has(idx)) state.selectedVertices.delete(idx);
      else state.selectedVertices.add(idx);
      syncPointsCloud();
      
      if (state.selectedVertices.size > 0) {
        const avgPos = new THREE.Vector3();
        const pos = state.activeMesh.geometry.attributes.position;
        state.selectedVertices.forEach(v => {
          avgPos.x += pos.getX(v); avgPos.y += pos.getY(v); avgPos.z += pos.getZ(v);
        });
        avgPos.divideScalar(state.selectedVertices.size);
        
        state.activeMesh.localToWorld(avgPos);
        editDummy.position.copy(avgPos);
        transform.attach(editDummy);
        transform.setMode('translate');
        state.lastDummyPos.copy(editDummy.position);
      } else {
        transform.detach();
      }
    }
  });
}

function extrudeSelected() {
  if (!state.activeMesh || state.selectedVertices.size === 0) return;
  const geometry = state.activeMesh.geometry;
  if (!geometry.index) {
    if (window.showToast) window.showToast("Extrude requires an indexed geometry.");
    return;
  }
  
  const index = geometry.index.array;
  let selectedFace = -1;
  const v0 = Array.from(state.selectedVertices)[0];
  for (let i = 0; i < index.length; i += 3) {
    if (index[i] === v0 || index[i+1] === v0 || index[i+2] === v0) {
       selectedFace = i / 3;
       break;
    }
  }
  
  if (selectedFace !== -1) {
    saveState(state.activeMesh);
    extrudeFaces(geometry, [selectedFace]);
    state.selectedVertices.clear();
    syncPointsCloud();
    transform.detach();
    selectionBox.setFromObject(state.activeMesh);
    state.brush.updateMesh(state.activeMesh);
    state.brush.rebuildGrid();
    if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  } else {
    if (window.showToast) window.showToast("Could not find a face for the selected vertices.");
  }
}

window.addEventListener("keydown", e => { if (e.ctrlKey && e.key === "z") undo(); if (e.ctrlKey && e.key === "y") redo(); });
window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

let viewGizmo = null;
try { viewGizmo = new ViewGizmo(camera, controls, { size: 96 }); viewGizmo.renderer.domElement.style.top = "60px"; } catch (e) { console.warn("Gizmo error", e); }

state.addCube();
state.setTrackpadMode("camera");
initUI(state, viewGizmo);

state.setPaintColor("#ff0000");

const btnModeCam = document.getElementById("btnModeCamera");
const btnModeBrsh = document.getElementById("btnModeBrush");
if (btnModeCam && btnModeBrsh) {
  btnModeCam.classList.add("active");
  btnModeBrsh.classList.remove("active");
  document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
}

document.getElementById("extrudeBtn").onclick = extrudeSelected;
document.getElementById("clearSelection").onclick = () => {
  state.selectedVertices.clear();
  syncPointsCloud();
  transform.detach();
};

let weightPaintMode = false;
document.getElementById("toggleWeightPaint").onclick = (e) => {
  weightPaintMode = !weightPaintMode;
  e.target.classList.toggle("active", weightPaintMode);
  if (weightPaintMode) {
    state.setMode("weight_paint"); 
  } else {
    state.setMode("rig");
  }
};

function animate() {
  requestAnimationFrame(animate);
  if (state.trackpadMode === 'camera' && controls) controls.update();
  if (state.activeMesh && selectionBox.visible && state.mode !== 'edit') {
    selectionBox.setFromObject(state.activeMesh);
  }
  if (state.skeletonHelper) state.skeletonHelper.update();
  renderer.render(scene, camera);
  if (viewGizmo) viewGizmo.update();
}
animate();
