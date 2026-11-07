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
  if (e.value === true && state.activeMesh) {
    saveState(state.activeMesh); // Snapshot transform + geometry before drag
  }
  if (!e.value && state.mode === 'edit' && state.activeMesh) {
    state.activeMesh.geometry.computeVertexNormals();
    state.brush.rebuildGrid();
  }
});

transform.addEventListener('objectChange', () => {
  if (state.mode === 'edit' && state.selectedVertices.size > 0 && state.activeMesh) {
    const worldDelta = new THREE.Vector3().subVectors(editDummy.position, state.lastDummyPos);
    const M3 = new THREE.Matrix3().setFromMatrix4(state.activeMesh.matrixWorld).invert();
    const localDelta = worldDelta.clone().applyMatrix3(M3);
    const pos = state.activeMesh.geometry.attributes.position;
    
    state.selectedVertices.forEach(idx => {
      pos.setXYZ(idx, pos.getX(idx) + localDelta.x, pos.getY(idx) + localDelta.y, pos.getZ(idx) + localDelta.z);
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
  const si = mesh.geometry.attributes.skinIndex;
  
  let canvasSnap = null;
  if (mesh.userData.paintCanvas) {
    const c = mesh.userData.paintCanvas;
    canvasSnap = document.createElement('canvas');
    canvasSnap.width = c.width;
    canvasSnap.height = c.height;
    canvasSnap.getContext('2d').drawImage(c, 0, 0);
  }

  return { position: pos.clone(), normal: norm ? norm.clone() : null, color: col ? col.clone() : null, skinWeight: sw ? sw.clone() : null, skinIndex: si ? si.clone() : null, canvasSnap, meshPos: mesh.position.clone(), meshQuat: mesh.quaternion.clone(), meshScale: mesh.scale.clone() };
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
  if (prev.skinIndex)  state.activeMesh.geometry.setAttribute('skinIndex',  prev.skinIndex);
  
  if (prev.meshPos) {
    state.activeMesh.position.copy(prev.meshPos);
    state.activeMesh.quaternion.copy(prev.meshQuat);
    state.activeMesh.scale.copy(prev.meshScale);
    selectionBox.setFromObject(state.activeMesh);
  }
  
  if (prev.canvasSnap && state.activeMesh.userData.paintCanvas) {
    const currentCanvas = state.activeMesh.userData.paintCanvas;
    const ctx = currentCanvas.getContext('2d');
    ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
    ctx.drawImage(prev.canvasSnap, 0, 0);
    if (state.activeMesh.userData.paintTexture) {
      state.activeMesh.userData.paintTexture.needsUpdate = true;
    }
  }

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
  if (next.skinIndex)  state.activeMesh.geometry.setAttribute('skinIndex',  next.skinIndex);
  
  if (next.meshPos) {
    state.activeMesh.position.copy(next.meshPos);
    state.activeMesh.quaternion.copy(next.meshQuat);
    state.activeMesh.scale.copy(next.meshScale);
    selectionBox.setFromObject(state.activeMesh);
  }
  
  if (next.canvasSnap && state.activeMesh.userData.paintCanvas) {
    const currentCanvas = state.activeMesh.userData.paintCanvas;
    const ctx = currentCanvas.getContext('2d');
    ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
    ctx.drawImage(next.canvasSnap, 0, 0);
    if (state.activeMesh.userData.paintTexture) {
      state.activeMesh.userData.paintTexture.needsUpdate = true;
    }
  }

  state.activeMesh.material.needsUpdate = true;
  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
}

// Ensures a geometry has a `uv` attribute so GLTFExporter always writes
// TEXCOORD_0. Three.js primitives (Box/Sphere) already have UVs; this fallback
// fires for imported GLBs that were authored without UVs, and for any custom
// geometry added later. Simple XY-planar projection — valid but not unwrapped.
function ensureUVs(geometry) {
  if (!geometry || geometry.attributes.uv) return false;
  const pos = geometry.attributes.position;
  if (!pos) return false;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const sx = Math.max(1e-6, bb.max.x - bb.min.x);
  const sy = Math.max(1e-6, bb.max.y - bb.min.y);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2]     = (pos.getX(i) - bb.min.x) / sx;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / sy;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return true;
}

function validateGeometryForExport(geometry) {
  if (!geometry || !geometry.attributes.position) return "Missing POSITION attribute";
  const posCount = geometry.attributes.position.count;
  
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name];
    if (attr.count !== posCount) {
      return `Mismatched buffer sizes: ${name} (${attr.count}) != POSITION (${posCount})`;
    }
  }
  if (geometry.index && geometry.index.count % 3 !== 0) {
    return `Index count (${geometry.index.count}) is not a multiple of 3`;
  }
  return null; // Valid
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
  snapEnabled: false, // New Snap State
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
  mixer: null,
  keyframes: [],
  undo,
  redo,

  updateSnap() {
    if (this.snapEnabled) {
      transform.setTranslationSnap(0.5);
      transform.setRotationSnap(THREE.MathUtils.degToRad(15));
      transform.setScaleSnap(0.25);
    } else {
      transform.setTranslationSnap(null);
      transform.setRotationSnap(null);
      transform.setScaleSnap(null);
    }
  },

  setMode(mode) {
    // Save prior paint colours only when ENTERING weight paint (not on re-entry)
    if (mode === "weight_paint" && this.mode !== "weight_paint" && this.activeMesh) {
      if (this.activeMesh.geometry.attributes.color) {
        this._savedColors = this.activeMesh.geometry.attributes.color.clone();
      } else {
        this._savedColors = null; // nothing to preserve
      }
    }
    // Restore (or fully remove) on EXIT from weight paint
    if (this.mode === "weight_paint" && mode !== "weight_paint" && this.activeMesh) {
      if (this._savedColors) {
        this.activeMesh.geometry.setAttribute('color', this._savedColors);
        this.activeMesh.geometry.attributes.color.needsUpdate = true;
        this.activeMesh.material.vertexColors = true;
      } else {
        this.activeMesh.geometry.deleteAttribute('color');
        this.activeMesh.material.vertexColors = false;
      }
      this._savedColors = null;
      this.activeMesh.material.needsUpdate = true;
    }
    
    this.mode = mode;
    const isBoneTarget = transform.object && transform.object.isBone;

    document.getElementById("scene-panel").classList.toggle("active", mode !== "rig" && mode !== "edit" && mode !== "weight_paint" && !isBoneTarget);
    document.getElementById("rig-panel").classList.toggle("active", mode === "rig" || mode === "weight_paint" || isBoneTarget);
    document.getElementById("edit-panel").classList.toggle("active", mode === "edit");
    document.getElementById("sculpt-panel").classList.toggle("active", mode === "sculpt" || mode === "paint" || mode === "weight_paint");

    if (mode === "sculpt" || mode === "paint" || mode === "weight_paint") {
      transform.detach();
      if (this.activeMesh) this.activeMesh.visible = true;
      controls.enabled = (this.trackpadMode === 'camera');
      if (actionArea) actionArea.style.pointerEvents = "auto";

      if (mode === "weight_paint") { this.updateWeightVisuals(); } else {
        if (this.activeMesh && this.activeMesh.geometry.attributes.color) {
          this.activeMesh.material.vertexColors = true;
        } else if (this.activeMesh) {
          this.activeMesh.material.vertexColors = false;
        }
        if (this.activeMesh) this.activeMesh.material.needsUpdate = true;
      }
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
    } else if (mode === "object") {
      if (this.activeMesh) transform.attach(this.activeMesh);
      transform.setMode('translate');
      controls.enabled = true;
      pointsCloud.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else if (this.activeMesh) { // move, rotate, scale
      if (isBoneTarget) {
        transform.setMode(mode === "move" ? "translate" : mode);
      } else {
        transform.attach(this.activeMesh);
        transform.setMode(mode === "move" ? "translate" : mode);
      }
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
    let box;
    if (this.activeMesh.isSkinnedMesh && typeof this.activeMesh.computeBoundingBox === 'function') {
      // computeBoundingBox() walks every vertex through its bone transforms
      // and produces the DEFORMED shape (in the mesh's local space).
      // setFromObject() would only see the raw bind-pose positions.
      this.activeMesh.computeBoundingBox();
      box = this.activeMesh.boundingBox.clone().applyMatrix4(this.activeMesh.matrixWorld);
    } else {
      box = new THREE.Box3().setFromObject(this.activeMesh);
    }
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const fitHeightDistance = size / (2 * Math.tan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2;
    
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
    ensureUVs(mesh.geometry);
    this.selectObject(mesh);
    this.updateObjectList();
  },

  selectObject(mesh) {
    this._savedColors = null;
    this.activeMesh = mesh;
    
    if (this.mode === "rig" || this.mode === "weight_paint") {
      this.setMode("object");
    } else if (this.mode !== "sculpt" && this.mode !== "paint" && this.mode !== "edit") {
      transform.attach(mesh);
    }

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
    window.dispatchEvent(new CustomEvent('objectSelected', { detail: mesh }));
  },

  duplicateObject() {
    if (!this.activeMesh) return;
    const src = this.activeMesh;
    const newMesh = src.clone();
    newMesh.geometry = src.geometry.clone();
    newMesh.material = src.material.clone();
    newMesh.position.x += 1.5;

    if (src.isSkinnedMesh && src.skeleton) {
      // clone() copied the bone hierarchy as children, but left .skeleton
      // pointing at the ORIGINAL bones. Rebuild from the clone's own bones
      // (same DFS order as src.skeleton.bones, so boneInverses line up).
      const clonedBones = [];
      newMesh.traverse(o => { if (o.isBone) clonedBones.push(o); });
      const skel = new THREE.Skeleton(clonedBones, src.skeleton.boneInverses);
      newMesh.bind(skel, src.bindMatrix);
    }

    this.addObject(newMesh);
  },

  deleteObject() {
    if (!this.activeMesh) return;
    const idx = this.objects.indexOf(this.activeMesh);
    if (idx > -1) this.objects.splice(idx, 1);
    scene.remove(this.activeMesh);
    this.activeMesh.geometry.dispose();
    this.activeMesh.material.dispose();
    if (this.skeletonHelper) { scene.remove(this.skeletonHelper); this.skeletonHelper = null; }
    if (this.boneProxies) { scene.remove(this.boneProxies); this.boneProxies = null; }
    if (this.tempSkin)       { scene.remove(this.tempSkin);       this.tempSkin = null; }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    this.keyframes = [];
    this.currentBones = null;
    this.activeBoneIndex = 0;
    this._savedColors = null;
    this.activeMesh = null;
    this.brush = null;
    this.updateBoneList();

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
    const geo0 = this.activeMesh.geometry;
    geo0.computeBoundingBox();
    const bb = geo0.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const height = bb.max.y - bb.min.y;
    const bottomY = cy - height/3, midY = cy, topY = cy + height/3;

    const rootBone = new THREE.Bone(); rootBone.position.set(cx, bottomY, cz);
    const midBone = new THREE.Bone(); midBone.position.set(0, midY - bottomY, 0); rootBone.add(midBone);
    const endBone = new THREE.Bone(); endBone.position.set(0, topY - midY, 0); midBone.add(endBone);

    rootBone.name = 'RootBone';
    midBone.name = 'MidBone';
    endBone.name = 'EndBone';
    const bones = [rootBone, midBone, endBone];
    this.currentBones = bones;

    // Create invisible proxy spheres for raycasting bones in viewport
    if (this.boneProxies) {
      scene.remove(this.boneProxies);
    }
    this.boneProxies = new THREE.Group();
    const proxyGeo = new THREE.SphereGeometry(0.3, 8, 8); // small enough not to block view
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    
    bones.forEach((bone, idx) => {
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.userData.boneIndex = idx;
      // We'll update positions in the animate loop, but set initial pos
      bone.getWorldPosition(proxy.position);
      this.boneProxies.add(proxy);
    });
    scene.add(this.boneProxies);
    if (this.skeletonHelper) scene.remove(this.skeletonHelper);

    if (this.tempSkin) { scene.remove(this.tempSkin); this.tempSkin = null; }
    this.tempSkin = new THREE.SkinnedMesh(this.activeMesh.geometry, this.activeMesh.material);
    const tempSkin = this.tempSkin;
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
    if (this.tempSkin) { scene.remove(this.tempSkin); this.tempSkin = null; }
    const skeleton = new THREE.Skeleton(this.currentBones);
    const geo = this.activeMesh.geometry;
    const pos = geo.attributes.position;
    const posCount = pos.count;

    // --- Compute each bone's HEAD and TAIL in MESH-LOCAL space -----------
    // Weights are computed in the same coordinate space as vertex positions
    // (mesh local), so the top-4 inverse-distance weights match what the
    // skinned mesh shader sees.
    this.activeMesh.updateMatrixWorld(true);
    const meshMatrixInv = new THREE.Matrix4().copy(this.activeMesh.matrixWorld).invert();
    const segments = this.currentBones.map((bone) => {
      const head = new THREE.Vector3();
      bone.getWorldPosition(head);
      head.applyMatrix4(meshMatrixInv);
      let tail;
      const childBone = bone.children.find(c => c.isBone);
      if (childBone) {
        tail = new THREE.Vector3();
        childBone.getWorldPosition(tail);
        tail.applyMatrix4(meshMatrixInv);
      } else {
        const parent = bone.parent;
        if (parent && parent.isBone) {
          const pw = new THREE.Vector3();
          parent.getWorldPosition(pw);
          pw.applyMatrix4(meshMatrixInv);
          tail = head.clone().add(head.clone().sub(pw));
        } else {
          tail = head.clone().add(new THREE.Vector3(0, 1, 0));
        }
      }
      return { head, tail };
    });

    const skinIndices = new Uint16Array(posCount * 4);
    const skinWeights = new Float32Array(posCount * 4);
    const v = new THREE.Vector3();
    const closest = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ap = new THREE.Vector3();

    const POWER = 2.0;   // higher = tighter falloff (more rigid); lower = softer
    const EPS = 0.05;    // prevents div-by-zero at bone centerline

    for (let i = 0; i < posCount; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));

      // Distance from this vertex to each bone SEGMENT (not just head)
      const dists = segments.map(seg => {
        ab.subVectors(seg.tail, seg.head);
        ap.subVectors(v, seg.head);
        const lenSq = ab.lengthSq();
        const t = lenSq > 1e-9 ? Math.max(0, Math.min(1, ap.dot(ab) / lenSq)) : 0;
        closest.copy(seg.head).addScaledVector(ab, t);
        return v.distanceTo(closest);
      });

      // Inverse-distance-power weighting, keep top 4, normalize
      const invW = dists.map(d => 1 / Math.pow(d + EPS, POWER));
      const indexed = invW.map((w, idx) => ({ w, idx }))
                         .sort((a, b) => b.w - a.w)
                         .slice(0, 4);
      const totalW = indexed.reduce((s, x) => s + x.w, 0) || 1;
      for (let j = 0; j < 4; j++) {
        const entry = indexed[j];
        if (entry) {
          skinIndices[i * 4 + j] = entry.idx;
          skinWeights[i * 4 + j] = entry.w / totalW;
        } else {
          skinIndices[i * 4 + j] = 0;
          skinWeights[i * 4 + j] = 0;
        }
      }
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
    if (!this.currentBones) {
      const ph = document.createElement('p');
      ph.style.cssText = 'font-size: 12px; color: #888; text-align: center;';
      ph.textContent = 'No bones found';
      list.appendChild(ph);
      const lbl = document.getElementById('active-bone-label');
      if (lbl) lbl.textContent = 'Active: None';
      return;
    }
    const names = ["Root Bone", "Mid Bone", "End Bone"];
    this.currentBones.forEach((bone, index) => {
      const div = document.createElement("div");
      div.className = `list-item ${index === this.activeBoneIndex ? 'active' : ''}`;
      div.innerHTML = `<span>${names[index]}</span>`;
      div.onclick = () => this.selectBone(index);
      list.appendChild(div);
    });
    
    const label = document.getElementById("active-bone-label");
    if (label) label.textContent = `Active: ${names[this.activeBoneIndex]}`;
  },

  selectBone(index) {
    if (!this.currentBones || !this.currentBones[index]) return;
    this.activeBoneIndex = index;
    if (this.brush) this.brush.setActiveBone(index);
    transform.attach(this.currentBones[index]);
    transform.setMode('rotate'); // Default to rotate for posing
    this.updateBoneList();
    if (this.mode === 'weight_paint') this.updateWeightVisuals();
  },

  updateWeightVisuals() {
    if (!this.activeMesh || !this.activeMesh.geometry.attributes.skinWeight) return;
    
    const geo = this.activeMesh.geometry;
    const weights = geo.attributes.skinWeight;
    const indices = geo.attributes.skinIndex;
    
    if (!geo.attributes.color) {
      const colors = new Float32Array(geo.attributes.position.count * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    const colors = geo.attributes.color;
    
    for (let i = 0; i < geo.attributes.position.count; i++) {
      let w = 0;
      for (let j = 0; j < 4; j++) {
        if (indices.array[i * 4 + j] === this.activeBoneIndex) {
          w = weights.array[i * 4 + j];
          break;
        }
      }
      colors.setXYZ(i, w, 0, 1 - w);
    }
    colors.needsUpdate = true;
    this.activeMesh.material.vertexColors = true;
    this.activeMesh.material.needsUpdate = true;
  },

  addKeyframe() {
    if (!this.currentBones) return;
    const time = this.keyframes.length;
    const frame = { time, bones: [] };
    
    this.currentBones.forEach(bone => {
      frame.bones.push({
        pos: bone.position.clone(),
        quat: bone.quaternion.clone()
      });
    });
    
    this.keyframes.push(frame);
    if (window.showToast) window.showToast(`Keyframe ${time} added!`);
  },

  playAnimation() {
    if (this.keyframes.length < 2) {
      if (window.showToast) window.showToast("Need at least 2 keyframes to play.");
      return;
    }
    
    if (this.mixer) this.mixer.stopAllAction();
    
    const tracks = [];
    for (let i = 0; i < this.currentBones.length; i++) {
      const posValues = [];
      const quatValues = [];
      const times = [];
      
      this.keyframes.forEach(frame => {
        times.push(frame.time);
        posValues.push(frame.bones[i].pos.x, frame.bones[i].pos.y, frame.bones[i].pos.z);
        quatValues.push(frame.bones[i].quat.x, frame.bones[i].quat.y, frame.bones[i].quat.z, frame.bones[i].quat.w);
      });
      
      tracks.push(new THREE.VectorKeyframeTrack(`${this.currentBones[i].name}.position`, times, posValues));
      tracks.push(new THREE.QuaternionKeyframeTrack(`${this.currentBones[i].name}.quaternion`, times, quatValues));
    }
    
    const clip = new THREE.AnimationClip('Action', -1, tracks);
    this.mixer = new THREE.AnimationMixer(this.activeMesh);
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    this.mixer.update(0);
  },

  setRadius(r) { if (this.brush) this.brush.setRadius(r); if (cursorGroup.visible) cursorGroup.scale.setScalar(r); },
  setStrength(s) { if (this.brush) this.brush.setStrength(s); },

  exportGLTF() {
    if (!this.objects.length) return;

    // --- SAFETY NET: Validate all geometries before export ---
    for (const obj of this.objects) {
      const err = validateGeometryForExport(obj.geometry);
      if (err) {
        if (window.showToast) window.showToast(`Export blocked: ${err}`);
        console.error(`Export validation failed on mesh: ${err}`);
        return; // Abort export
      }
    }
    // ---------------------------------------------------------

    const exportGroup = new THREE.Group();
    this.objects.forEach(obj => {
      const clone = obj.clone();
      clone.geometry = obj.geometry.clone();
      if (obj.isSkinnedMesh && obj.skeleton) {
        // obj.clone() is recursive: it already cloned the bone hierarchy
        // as `clone`'s children (bindSkin adds rootBone to the mesh).
        // Just re-bind to THOSE bones — do not clone them a second time.
        // traverse() is DFS preorder, same order as Skeleton.bones, so
        // boneInverses (indexed by that order) stay aligned.
        const clonedBones = [];
        clone.traverse(o => { if (o.isBone) clonedBones.push(o); });
        const skel = new THREE.Skeleton(clonedBones, obj.skeleton.boneInverses);
        clone.bind(skel, obj.bindMatrix);
      }
      exportGroup.add(clone);
    });
    
    const options = {};
    if (this.keyframes.length >= 2 && this.currentBones) {
        const tracks = [];
        for (let i = 0; i < this.currentBones.length; i++) {
          const posValues = [];
          const quatValues = [];
          const times = [];
          
          this.keyframes.forEach(frame => {
            times.push(frame.time);
            posValues.push(frame.bones[i].pos.x, frame.bones[i].pos.y, frame.bones[i].pos.z);
            quatValues.push(frame.bones[i].quat.x, frame.bones[i].quat.y, frame.bones[i].quat.z, frame.bones[i].quat.w);
          });
          
          tracks.push(new THREE.VectorKeyframeTrack(`${this.currentBones[i].name}.position`, times, posValues));
          tracks.push(new THREE.QuaternionKeyframeTrack(`${this.currentBones[i].name}.quaternion`, times, quatValues));
        }
        options.animations = [new THREE.AnimationClip('Action', -1, tracks)];
    }

    new GLTFExporter().parse(exportGroup, gltf => {
      const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'scene.gltf';
      a.click();
      URL.revokeObjectURL(a.href);
    }, options);
  },

  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => new GLTFLoader().parse(reader.result, "", gltf => {
      let mesh = null;
      gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
      if (mesh) {
        if (!mesh.isSkinnedMesh && !mesh.geometry.attributes.skinIndex) {
          mesh.geometry = mergeVertices(mesh.geometry);
        }
        this.addObject(mesh);
      }
    });
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

function syncPointsCloud() {
  if (!state.activeMesh) return;
  const meshGeo = state.activeMesh.geometry;
  const pGeo = pointsCloud.geometry;

  pointsCloud.position.copy(state.activeMesh.position);
  pointsCloud.quaternion.copy(state.activeMesh.quaternion);
  pointsCloud.scale.copy(state.activeMesh.scale);

  if (pGeo.attributes.position !== meshGeo.attributes.position) {
    pGeo.setAttribute('position', meshGeo.attributes.position);
    pGeo.setAttribute('color',
      new THREE.BufferAttribute(new Float32Array(meshGeo.attributes.position.count * 3), 3));
  }
  if (!pGeo.attributes.color) {
    pGeo.setAttribute('color',
      new THREE.BufferAttribute(new Float32Array(meshGeo.attributes.position.count * 3), 3));
  }

  const colors = pGeo.attributes.color;
  for (let i = 0; i < colors.count; i++) colors.setXYZ(i, 1, 1, 1);
  state.selectedVertices.forEach(idx => colors.setXYZ(idx, 1, 0, 0));
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
  actionArea.addEventListener("pointerup", () => { 
    isActionActive = false; 
    if(state.brush) state.brush.rebuildGrid(); 
    if (state.mode === 'weight_paint') state.updateWeightVisuals();
  });
  actionArea.addEventListener("pointercancel", () => { isActionActive = false; if(state.brush) state.brush.rebuildGrid(); });
}

function handleAction() {
  if (state.trackpadMode !== 'brush') return;
  const hit = state.lastHit;
  if (!hit) return;
  const localPoint = state.activeMesh.worldToLocal(hit.point.clone());
  if (state.mode === "sculpt") state.brush.apply(localPoint, state.symmetryEnabled);
  else if (state.mode === "paint") {
    if (state.activeMesh.userData.paintCanvas) {
      state.brush.paintTexture(localPoint, state.symmetryEnabled);
    } else {
      state.brush.paint(localPoint, state.symmetryEnabled);
    }
  }
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
    const distToMesh = camera.position.distanceTo(state.activeMesh.position);
    raycaster.params.Points.threshold = distToMesh * 0.03;

    const hit = raycaster.intersectObject(pointsCloud)[0];
    raycaster.params.Points.threshold = 1;
    
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

// --- Bone Picking for Rig Mode ---
if (trackpadSurface) {
  trackpadSurface.addEventListener("pointerdown", e => {
    if (state.mode !== 'rig' || !state.activeMesh || !state.currentBones) return;
    
    const rect = trackpadSurface.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.x = THREE.MathUtils.clamp(rawX * state.trackpadSensitivity, -1, 1);
    mouse.y = THREE.MathUtils.clamp(rawY * state.trackpadSensitivity, -1, 1);
    
    raycaster.setFromCamera(mouse, camera);
    
    // Raycast against bone helper spheres if we create them
    if (state.boneProxies) {
      const hits = raycaster.intersectObjects(state.boneProxies.children);
      if (hits.length > 0) {
        const proxy = hits[0].object;
        const boneIndex = proxy.userData.boneIndex;
        if (boneIndex !== undefined) {
          state.selectBone(boneIndex);
        }
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
  const sel = Array.from(state.selectedVertices);
  if (sel.length !== 3) {
    if (window.showToast) window.showToast('Select exactly 3 vertices of one triangle.');
    return;
  }
  let selectedFace = -1;
  for (let i = 0; i < index.length; i += 3) {
    const fv = [index[i], index[i+1], index[i+2]];
    if (sel.every(v => fv.includes(v))) {
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
    if (window.showToast) window.showToast("Those 3 vertices are not all part of one triangle.");
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
state.setMode('sculpt');

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

document.getElementById("addKeyframe").onclick = () => state.addKeyframe();
document.getElementById("playAnim").onclick = () => state.playAnimation();
document.getElementById("resetAnim").onclick = () => {
  if (state.mixer) state.mixer.stopAllAction();
  state.keyframes = [];
  state.setMode('rig');
  if (window.showToast) window.showToast("Animation reset.");
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (state.mixer) state.mixer.update(delta);
  
  if (state.trackpadMode === 'camera' && controls) controls.update();
  if (state.activeMesh && selectionBox.visible && state.mode !== 'edit') {
    selectionBox.setFromObject(state.activeMesh);
  }
  if (state.skeletonHelper) state.skeletonHelper.update();
  if (state.boneProxies && state.currentBones) {
    state.currentBones.forEach((bone, idx) => {
      bone.getWorldPosition(state.boneProxies.children[idx].position);
    });
  }
  renderer.render(scene, camera);
  if (viewGizmo) viewGizmo.update();
}
animate();
