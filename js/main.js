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

// NEW: Multi-touch gestures directly on the 3D viewport
const canvasControls = new OrbitControls(camera, renderer.domElement);
canvasControls.enableDamping = true;
canvasControls.rotateSpeed = 0.5;
canvasControls.enablePan = false; // Keep panning on the trackpad to avoid accidental moves
canvasControls.touches = {
  ONE: THREE.TOUCH.NONE,           // 1 finger = paint/sculpt (do not rotate)
  TWO: THREE.TOUCH.DOLLY_ROTATE    // 2 fingers = pinch to zoom, drag to rotate
};

const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0x4a90e2);
selectionBox.raycast = () => {};
selectionBox.visible = false;
scene.add(selectionBox);

const pointsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, vertexColors: true, depthTest: false, transparent: true, opacity: 1.0 });
const pointsGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
const pointsCloud = new THREE.Points(pointsGeo, pointsMat);
pointsCloud.visible = false;
scene.add(pointsCloud);

const emptyGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
const wireframeGeo = new THREE.WireframeGeometry(emptyGeo);
const wireframeMat = new THREE.LineBasicMaterial({ color: 0x4a90e2, transparent: true, opacity: 0.4 });
const wireframeLines = new THREE.LineSegments(wireframeGeo, wireframeMat);
wireframeLines.visible = false;
scene.add(wireframeLines);

const editDummy = new THREE.Object3D();
scene.add(editDummy);

const cursorGroup = new THREE.Group();
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthTest: true, depthWrite: false });
cursorGroup.add(new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 32), cursorMat));
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
  canvasControls.enabled = !e.value;
  if (e.value === true && state.activeMesh) {
    saveState(state.activeMesh); // Snapshot transform + geometry before drag
    if (state.mode === 'edit') {
      const pos = state.activeMesh.geometry.attributes.position;
      state._editDragSnapshot = new Float32Array(pos.array);
      state._editDragStartDummy = editDummy.position.clone();
      state._editDragSelectedPos = Array.from(state.selectedVertices).map(idx => new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx)));
    }
  } else if (!e.value && state.mode === 'edit' && state.activeMesh) {
    state.activeMesh.geometry.computeVertexNormals();
    state.brush.rebuildGrid();
    state._editDragSnapshot = null;
  }
});

transform.addEventListener('objectChange', () => {
  if (state.mode === 'edit' && state.selectedVertices.size > 0 && state.activeMesh) {
    const mesh = state.activeMesh;
    const pos = mesh.geometry.attributes.position;

    const worldDelta = new THREE.Vector3().subVectors(editDummy.position, state.lastDummyPos);
    const M3 = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).invert();
    const localDelta = worldDelta.clone().applyMatrix3(M3);

    if (state.proportionalEnabled && state._editDragSnapshot) {
      const worldTotalDelta = new THREE.Vector3().subVectors(editDummy.position, state._editDragStartDummy);
      const localTotalDelta = worldTotalDelta.clone().applyMatrix3(M3);

      const snap = state._editDragSnapshot;
      const selPos = state._editDragSelectedPos;
      const radius = state.proportionalRadius;

      for (let i = 0; i < pos.count; i++) {
        let minD = Infinity;
        const vx = snap[i * 3], vy = snap[i * 3 + 1], vz = snap[i * 3 + 2];
        for (const sp of selPos) {
          const d = Math.sqrt((vx - sp.x)**2 + (vy - sp.y)**2 + (vz - sp.z)**2);
          if (d < minD) minD = d;
          if (minD === 0) break;
        }

        let weight = 0;
        if (minD <= radius) {
          weight = Math.pow(1 - minD / radius, 2);
        }

        if (weight > 0) {
          pos.setXYZ(i,
            snap[i * 3] + localTotalDelta.x * weight,
            snap[i * 3 + 1] + localTotalDelta.y * weight,
            snap[i * 3 + 2] + localTotalDelta.z * weight
          );
        }
      }
    } else {
      state.selectedVertices.forEach(idx => {
        pos.setXYZ(idx, pos.getX(idx) + localDelta.x,
                        pos.getY(idx) + localDelta.y,
                        pos.getZ(idx) + localDelta.z);
      });
    }

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
const gridHelper = new THREE.GridHelper(20, 20);
// Make the grid slightly more transparent so it doesn't overpower models
gridHelper.material.opacity = 0.4;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// --- Procedural Environment Map (for PBR reflections) ---
// Generates a simple sky-to-ground gradient using a canvas, then
// processes it via PMREMGenerator so metals have something to reflect.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const envCanvas = document.createElement('canvas');
envCanvas.width = 512; envCanvas.height = 256;
const envCtx = envCanvas.getContext('2d');
const grad = envCtx.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0, '#87ceeb'); // Sky
grad.addColorStop(0.5, '#aaaaaa'); // Horizon
grad.addColorStop(1, '#333333'); // Ground
envCtx.fillStyle = grad;
envCtx.fillRect(0, 0, 512, 256);
const envTex = new THREE.CanvasTexture(envCanvas);
envTex.mapping = THREE.EquirectangularReflectionMapping;
const envMap = pmremGenerator.fromEquirectangular(envTex).texture;
scene.environment = envMap;
envTex.dispose();
pmremGenerator.dispose();


const undoStack = [], redoStack = [];
function captureState(mesh) {
  const pos = mesh.geometry.attributes.position;
  const norm = mesh.geometry.attributes.normal;
  const col = mesh.geometry.attributes.color;
  const sw = mesh.geometry.attributes.skinWeight;
  const si = mesh.geometry.attributes.skinIndex;
  
  const uv = mesh.geometry.attributes.uv;
  
  let canvasSnap = null;
  if (mesh.userData.paintCanvas) {
    const c = mesh.userData.paintCanvas;
    canvasSnap = document.createElement('canvas');
    canvasSnap.width = c.width;
    canvasSnap.height = c.height;
    canvasSnap.getContext('2d').drawImage(c, 0, 0);
  }

  return { position: pos.clone(), normal: norm ? norm.clone() : null, color: col ? col.clone() : null, skinWeight: sw ? sw.clone() : null, skinIndex: si ? si.clone() : null, canvasSnap, uv: uv ? uv.clone() : null, matColor: mesh.material.color.getHex(), matRough: mesh.material.roughness, matMetal: mesh.material.metalness, matMap: mesh.material.map || null, matNormalMap: mesh.material.normalMap || null, matOpacity: mesh.material.opacity, matTransparent: mesh.material.transparent, matFlatShading: mesh.material.flatShading, meshPos: mesh.position.clone(), meshQuat: mesh.quaternion.clone(), meshScale: mesh.scale.clone() };
}
function saveState(mesh) {
  if (!mesh) return;
  const snap = captureState(mesh);
  undoStack.push(snap);
  
  // Dynamic limit: prevent OOM on large texture canvases
  const maxStates = snap.canvasSnap ? 5 : 20;
  if (undoStack.length > maxStates) undoStack.shift();
  
  redoStack.length = 0;
}
function undo() {
  if (!state.activeMesh || !undoStack.length) return;
  const snap = captureState(state.activeMesh);
  redoStack.push(snap);
  const maxStates = snap.canvasSnap ? 5 : 20;
  if (redoStack.length > maxStates) redoStack.shift();
  
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
  if (prev.uv) state.activeMesh.geometry.setAttribute('uv', prev.uv);
  if (prev.matColor !== undefined) {
    state.activeMesh.material.color.setHex(prev.matColor);
    state.activeMesh.material.roughness = prev.matRough;
    state.activeMesh.material.metalness = prev.matMetal;
    state.activeMesh.material.map = prev.matMap;
    state.activeMesh.material.normalMap = prev.matNormalMap;
  }
  
  state.activeMesh.material.needsUpdate = true;
  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
  state.syncUI();
}
function redo() {
  if (!state.activeMesh || !redoStack.length) return;
  const snap = captureState(state.activeMesh);
  undoStack.push(snap);
  const maxStates = snap.canvasSnap ? 5 : 20;
  if (undoStack.length > maxStates) undoStack.shift();
  
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
  if (next.uv) state.activeMesh.geometry.setAttribute('uv', next.uv);
  if (next.matColor !== undefined) {
    state.activeMesh.material.color.setHex(next.matColor);
    state.activeMesh.material.roughness = next.matRough;
    state.activeMesh.material.metalness = next.matMetal;
    state.activeMesh.material.map = next.matMap;
    state.activeMesh.material.normalMap = next.matNormalMap;
  }
  
  state.activeMesh.material.needsUpdate = true;
  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
  state.syncUI();
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
  proportionalEnabled: false,
  proportionalRadius: 1.0,
  _editDragSnapshot: null,
  _editDragStartDummy: null,
  _editDragSelectedPos: null,
  mixer: null,
  keyframes: [],
  undo,
  redo,
  envMap,
  envEnabled: true,
  dirLight,
  hemiLight,
  animationFPS: 24,
  loopAnim: false,
  _baseUVs: null,

  applyEnvironmentPreset(preset) {
    if (preset === 'studio') {
      scene.background = new THREE.Color(0x2a2a2a);
      this.dirLight.intensity = 2.0;
      this.dirLight.color.setHex(0xffffff);
      this.hemiLight.intensity = 1.5;
    } else if (preset === 'sunset') {
      scene.background = new THREE.Color(0xff9966);
      this.dirLight.intensity = 3.0;
      this.dirLight.color.setHex(0xffaa77);
      this.hemiLight.intensity = 0.8;
    } else if (preset === 'dark') {
      scene.background = new THREE.Color(0x111111);
      this.dirLight.intensity = 1.0;
      this.dirLight.color.setHex(0x4455ff);
      this.hemiLight.intensity = 0.3;
    }
    // Sync UI if the syncUI function exists (we'll call it safely)
    if (this.syncUI) this.syncUI();
  },

  toggleEnvironment() {
    this.envEnabled = !this.envEnabled;
    scene.environment = this.envEnabled ? this.envMap : null;
    this.objects.forEach(m => m.material.needsUpdate = true);
  },

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
    const bp = document.getElementById("bottom-panel");
    if (bp) {
      if (mode === "sculpt" || mode === "paint" || mode === "weight_paint") {
        bp.style.display = "flex";
      } else {
        bp.style.display = "none";
      }
    }

    // Save prior paint colours only when ENTERING weight paint (not on re-entry)
    if (mode === "weight_paint" && this.mode !== "weight_paint" && this.activeMesh) {
      if (this.activeMesh.geometry.attributes.color) {
        this._savedColors = this.activeMesh.geometry.attributes.color.clone();
      } else {
        this._savedColors = null;
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

    // UI Panel Toggles
    document.getElementById("scene-panel").classList.toggle("active", mode !== "rig" && mode !== "edit" && mode !== "weight_paint" && !isBoneTarget);
    document.getElementById("rig-panel").classList.toggle("active", mode === "rig" || mode === "weight_paint" || isBoneTarget);
    document.getElementById("edit-panel").classList.toggle("active", mode === "edit");
    document.getElementById("sculpt-panel").classList.toggle("active", mode === "sculpt" || mode === "paint" || mode === "weight_paint");

    if (mode === "sculpt" || mode === "paint" || mode === "weight_paint") {
      transform.detach();
      if (this.activeMesh) this.activeMesh.visible = true;
      controls.enabled = (this.trackpadMode === 'camera');
      if (actionArea) actionArea.style.pointerEvents = "auto";

      if (mode === "weight_paint") { 
        this.updateWeightVisuals(); 
      } else {
        if (this.activeMesh && this.activeMesh.geometry.attributes.color) {
          this.activeMesh.material.vertexColors = true;
        } else if (this.activeMesh) {
          this.activeMesh.material.vertexColors = false;
        }
        if (this.activeMesh) this.activeMesh.material.needsUpdate = true;
      }
    } else if (mode === "edit") {
      pointsCloud.visible = true;
      wireframeLines.visible = true;
      if (this.activeMesh) {
        this.activeMesh.visible = false;
        wireframeLines.geometry.dispose();
        wireframeLines.geometry = new THREE.WireframeGeometry(this.activeMesh.geometry);
        wireframeLines.position.copy(this.activeMesh.position);
        wireframeLines.quaternion.copy(this.activeMesh.quaternion);
        wireframeLines.scale.copy(this.activeMesh.scale);
      }
      syncPointsCloud();
      controls.enabled = true;
      transform.detach();
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else if (mode === "rig") {
      this.selectBone(this.activeBoneIndex);
      controls.enabled = true;
      pointsCloud.visible = false;
      wireframeLines.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
      if (actionArea) actionArea.style.pointerEvents = "none";
    } else {
      // Object, Move, Rotate, Scale
      pointsCloud.visible = false;
      wireframeLines.visible = false;
      if (this.activeMesh) this.activeMesh.visible = true;
      if (actionArea) actionArea.style.pointerEvents = "none";

      if (isBoneTarget) {
        // Keep gizmo on the bone, just swap tool
        if (mode === "move") transform.setMode("translate");
        else if (mode === "rotate") transform.setMode("rotate");
        else if (mode === "scale") transform.setMode("scale");
      } else if (this.activeMesh) {
        // Attach to mesh
        transform.attach(this.activeMesh);
        if (mode === "move") transform.setMode("translate");
        else if (mode === "rotate") transform.setMode("rotate");
        else if (mode === "scale") transform.setMode("scale");
        else transform.setMode("translate"); // Object mode defaults to translate
        selectionBox.setFromObject(this.activeMesh);
      } else {
        transform.detach();
      }
      controls.enabled = true;
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
  toggleGrid() {
    gridHelper.visible = !gridHelper.visible;
    if (window.showToast) window.showToast(`Grid ${gridHelper.visible ? 'ON' : 'OFF'}`);
  },

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
    canvasControls.target.copy(center);
    canvasControls.update();
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

  addPlane() {
    let geo = new THREE.PlaneGeometry(2, 2, 24, 24);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide, wireframe: this.wireframe }));
    mesh.rotation.x = -Math.PI / 2; // Lay flat
    mesh.position.set(0, 0, 0);
    this.addObject(mesh);
  },

  addCylinder() {
    let geo = new THREE.CylinderGeometry(1, 1, 2, 32, 24);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addCone() {
    let geo = new THREE.ConeGeometry(1.5, 3, 32, 24);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff8888, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addTorus() {
    let geo = new THREE.TorusGeometry(1.2, 0.4, 24, 48);
    geo = mergeVertices(geo);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffcc88, roughness: 0.3, metalness: 0.5, wireframe: this.wireframe }));
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
    this.cacheBaseUVs();
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
    
    // Prevent undoing into the deleted mesh's state
    undoStack.length = 0;
    redoStack.length = 0;

    if (this.skeletonHelper) { scene.remove(this.skeletonHelper); this.skeletonHelper = null; }
    if (this.boneProxies) { scene.remove(this.boneProxies); this.boneProxies = null; }
    if (this.tempSkin)       { scene.remove(this.tempSkin);       this.tempSkin = null; }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    this.keyframes = [];
    this.currentBones = null;
    const scrub = document.getElementById('timeline-scrub');
    if (scrub) { scrub.max = 0; scrub.value = 0; scrub.disabled = true; }
    const lbl = document.getElementById('timeline-label');
    if (lbl) lbl.textContent = 'Frame: 0';
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

  rebuildBoneProxies() {
    if (this.boneProxies) scene.remove(this.boneProxies);
    this.boneProxies = new THREE.Group();
    const proxyGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    
    const activeGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const activeMat = new THREE.MeshBasicMaterial({ color: 0x4a90e2, transparent: true, opacity: 0.5 });

    this.currentBones.forEach((bone, idx) => {
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.userData.boneIndex = idx;
      bone.getWorldPosition(proxy.position);
      this.boneProxies.add(proxy);
    });

    if (this.currentBones[this.activeBoneIndex]) {
      const activeMesh = new THREE.Mesh(activeGeo, activeMat);
      activeMesh.userData.boneIndex = this.activeBoneIndex;
      this.currentBones[this.activeBoneIndex].getWorldPosition(activeMesh.position);
      this.boneProxies.add(activeMesh);
    }
    scene.add(this.boneProxies);
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
    this.rebuildBoneProxies();
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

  _calculateSkinWeights(mesh) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const posCount = pos.count;

    mesh.updateMatrixWorld(true);
    const meshMatrixInv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const segments = this.currentBones.map((bone) => {
      const head = new THREE.Vector3();
      bone.getWorldPosition(head);
      head.applyMatrix4(meshMatrixInv);
      let tail;
      const childBones = bone.children.filter(c => c.isBone);
      if (childBones.length > 0) {
        tail = new THREE.Vector3();
        childBones.forEach(cb => {
          const cbPos = new THREE.Vector3();
          cb.getWorldPosition(cbPos);
          tail.add(cbPos);
        });
        tail.divideScalar(childBones.length);
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
    const POWER = 2.0;
    const EPS = 0.05;

    for (let i = 0; i < posCount; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const dists = segments.map(seg => {
        ab.subVectors(seg.tail, seg.head);
        ap.subVectors(v, seg.head);
        const lenSq = ab.lengthSq();
        const t = lenSq > 1e-9 ? Math.max(0, Math.min(1, ap.dot(ab) / lenSq)) : 0;
        closest.copy(seg.head).addScaledVector(ab, t);
        return v.distanceTo(closest);
      });
      const invW = dists.map(d => 1 / Math.pow(d + EPS, POWER));
      const indexed = invW.map((w, idx) => ({ w, idx })).sort((a, b) => b.w - a.w).slice(0, 4);
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
  },

  addChildBone() {
    if (!this.activeMesh) return;
    
    if (!this.currentBones) {
      // Create a root bone if none exists
      this.currentBones = [];
      const root = new THREE.Bone();
      root.name = 'RootBone';
      root.position.set(0, 0, 0);
      this.activeMesh.add(root);
      this.currentBones.push(root);
    }
    
    const parent = this.currentBones[this.activeBoneIndex];
    const newBone = new THREE.Bone();
    newBone.name = `Bone_${this.currentBones.length}`;
    newBone.position.set(0, 1, 0); // Default offset
    parent.add(newBone);
    
    undoStack.length = 0;
    redoStack.length = 0;
    this.currentBones.push(newBone);
    this.rebuildBoneProxies();
    this.selectBone(this.currentBones.length - 1);
    this.updateBoneList();
    
    if (window.showToast) window.showToast(`Added ${newBone.name} (undo cleared)`);
  },

  bindSkin() {
    if (!this.activeMesh || !this.currentBones) return;
    if (this.tempSkin) { scene.remove(this.tempSkin); this.tempSkin = null; }

    const mesh = this.activeMesh;
    this._calculateSkinWeights(mesh);

    const skinnedMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
    skinnedMesh.position.copy(mesh.position);
    skinnedMesh.rotation.copy(mesh.rotation);
    skinnedMesh.scale.copy(mesh.scale);
    skinnedMesh.add(this.currentBones[0]); // Primary mesh owns the bones

    const skeleton = new THREE.Skeleton(this.currentBones);
    skinnedMesh.bind(skeleton);

    scene.remove(mesh);
    if (this.skeletonHelper) scene.remove(this.skeletonHelper);
    
    // FIX: Replace in objects array so UI stays in sync
    const idx = this.objects.indexOf(mesh);
    if (idx !== -1) this.objects[idx] = skinnedMesh;

    scene.add(skinnedMesh);
    this.activeMesh = skinnedMesh;

    this.skeletonHelper = new THREE.SkeletonHelper(skinnedMesh);
    this.skeletonHelper.material.linewidth = 3;
    scene.add(this.skeletonHelper);

    undoStack.length = 0;
    redoStack.length = 0;
    if (window.showToast) window.showToast("Skin bound (undo history cleared).");
    this.selectBone(0);
    this.updateObjectList();
  },

  bindToActiveSkeleton() {
    if (!this.activeMesh || !this.currentBones) {
      if (window.showToast) window.showToast("No active skeleton to bind to.");
      return;
    }
    
    const mesh = this.activeMesh;
    this._calculateSkinWeights(mesh);
    
    const skinnedMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
    skinnedMesh.position.copy(mesh.position);
    skinnedMesh.rotation.copy(mesh.rotation);
    skinnedMesh.scale.copy(mesh.scale);
    // Do NOT add bones to this mesh. It shares the skeleton owned by the first mesh.
    
    const skeleton = new THREE.Skeleton(this.currentBones);
    skinnedMesh.bind(skeleton);
    
    scene.remove(mesh);
    const idx = this.objects.indexOf(mesh);
    if (idx !== -1) this.objects[idx] = skinnedMesh;
    
    scene.add(skinnedMesh);
    this.activeMesh = skinnedMesh;
    
    if (window.showToast) window.showToast("Mesh bound to active skeleton!");
    this.updateObjectList();
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

    this.currentBones.forEach((bone, index) => {
      const div = document.createElement("div");
      div.className = `list-item ${index === this.activeBoneIndex ? 'active' : ''}`;
      div.innerHTML = `<span>${bone.name || 'Bone_' + index}</span>`;
      div.onclick = () => this.selectBone(index);
      list.appendChild(div);
    });

    const active = this.currentBones[this.activeBoneIndex];
    const label = document.getElementById('active-bone-label');
    if (label) label.textContent = `Active: ${active ? (active.name || 'Bone_' + this.activeBoneIndex) : 'None'}`;
  },

  selectBone(index) {
    if (!this.currentBones || !this.currentBones[index]) return;
    this.activeBoneIndex = index;
    if (this.brush) this.brush.setActiveBone(index);
    transform.attach(this.currentBones[index]);
    transform.setMode('rotate');
    this.rebuildBoneProxies();
    this.updateBoneList();
    if (this.mode === 'weight_paint') this.updateWeightVisuals();
  },

  renameBone() {
    if (!this.currentBones || !this.currentBones[this.activeBoneIndex]) {
      if (window.showToast) window.showToast("No bone selected.");
      return;
    }
    const bone = this.currentBones[this.activeBoneIndex];
    const newName = prompt("Rename bone:", bone.name);
    if (newName && newName.trim() && newName.trim() !== bone.name) {
      bone.name = newName.trim();
      undoStack.length = 0;
      redoStack.length = 0;
      this.updateBoneList();
      if (window.showToast) window.showToast(`Renamed to ${bone.name}`);
    }
  },

  deleteBone() {
    if (!this.currentBones || this.currentBones.length === 0) {
      if (window.showToast) window.showToast("No bones to delete.");
      return;
    }
    if (this.activeMesh && this.activeMesh.isSkinnedMesh && this.activeMesh.skeleton) {
      if (window.showToast) window.showToast("Delete mesh before deleting bones from a bound rig.");
      return;
    }
    const idx = this.activeBoneIndex;
    const bone = this.currentBones[idx];
    if (!bone) return;

    const childBones = bone.children.filter(c => c.isBone);
    if (childBones.length > 0 && idx === 0) {
      if (window.showToast) window.showToast("Cannot delete root bone with children.");
      return;
    }

    if (bone.parent && bone.parent.isBone) {
      bone.parent.remove(bone);
    } else if (this.activeMesh) {
      this.activeMesh.remove(bone);
    }

    undoStack.length = 0;
    redoStack.length = 0;
    this.currentBones.splice(idx, 1);
    this.activeBoneIndex = Math.max(0, idx - 1);

    this.rebuildBoneProxies();
    this.updateBoneList();
    if (this.currentBones.length > 0) this.selectBone(this.activeBoneIndex);
    else transform.detach();

    if (window.showToast) window.showToast("Bone deleted.");
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

  _buildAnimationClip() {
    if (this.keyframes.length < 2 || !this.currentBones) return null;
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
    return new THREE.AnimationClip('Action', -1, tracks);
  },

  scrubToTime(frameIndex) {
    const clip = this._buildAnimationClip();
    if (!clip) return;
    if (this.mixer) this.mixer.stopAllAction();
    
    const fps = this.animationFPS || 24;
    const timeSec = frameIndex / fps;
    
    this.mixer = new THREE.AnimationMixer(this.activeMesh);
    this.mixer.timeScale = 0; // Pause mixer for scrubbing
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    this.mixer.setTime(timeSec);
    
    const label = document.getElementById('timeline-label');
    if (label) label.textContent = `Frame: ${Math.round(frameIndex)}`;
  },

  addKeyframe() {
    if (!this.currentBones) return;
    const fps = this.animationFPS || 24;
    const frameIndex = this.keyframes.length;
    const time = frameIndex / fps;
    const frame = { time, bones: [] };
    
    this.currentBones.forEach(bone => {
      frame.bones.push({
        pos: bone.position.clone(),
        quat: bone.quaternion.clone()
      });
    });
    
    this.keyframes.push(frame);
    
    const maxFrame = this.keyframes.length - 1;
    const scrub = document.getElementById('timeline-scrub');
    if (scrub) {
      scrub.max = maxFrame;
      scrub.value = maxFrame;
      scrub.disabled = false;
    }
    this.scrubToTime(maxFrame);
    
    if (window.showToast) window.showToast(`Keyframe ${time} added!`);
  },

  playAnimation() {
    const clip = this._buildAnimationClip();
    if (!clip) {
      if (window.showToast) window.showToast("Need at least 2 keyframes to play.");
      return;
    }
    if (this.mixer) this.mixer.stopAllAction();
    
    this.mixer = new THREE.AnimationMixer(this.activeMesh);
    this.mixer.timeScale = 1; // Play
    const action = this.mixer.clipAction(clip);
    action.setLoop(this.loopAnim ? THREE.LoopRepeat : THREE.LoopOnce);
    action.clampWhenFinished = !this.loopAnim;
    action.play();
  },

  setRadius(r) { if (this.brush) this.brush.setRadius(r); if (cursorGroup.visible) cursorGroup.scale.setScalar(r); },
  setStrength(s) { if (this.brush) this.brush.setStrength(s); },

  saveProject() {
    const data = { objects: [] };
    this.objects.forEach(obj => {
      const o = {
        isSkinned: !!obj.isSkinnedMesh,
        pos: obj.position.toArray(),
        quat: obj.quaternion.toArray(),
        scale: obj.scale.toArray(),
        color: '#' + obj.material.color.getHexString(),
        roughness: obj.material.roughness,
        metalness: obj.material.metalness,
        geometry: {}
      };
      
      for (const name in obj.geometry.attributes) {
        o.geometry[name] = {
          array: Array.from(obj.geometry.attributes[name].array),
          itemSize: obj.geometry.attributes[name].itemSize
        };
      }
      if (obj.geometry.index) {
        o.geometry.index = { array: Array.from(obj.geometry.index.array) };
      }
      if (obj.userData.paintCanvas) {
        o.texture = obj.userData.paintCanvas.toDataURL('image/png');
      }
      if (obj.isSkinnedMesh && obj.skeleton) {
        o.bones = obj.skeleton.bones.map(b => ({
          name: b.name, pos: b.position.toArray(), quat: b.quaternion.toArray()
        }));
      }
      data.objects.push(o);
    });

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'project.json';
    a.click();
    URL.revokeObjectURL(a.href);
    if (window.showToast) window.showToast('Project saved!');
  },

  loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Clear current scene
        this.objects.forEach(o => scene.remove(o));
        this.objects = [];
        this.activeMesh = null;
        this.brush = null;
        if (this.skeletonHelper) { scene.remove(this.skeletonHelper); this.skeletonHelper = null; }
        if (this.boneProxies) { scene.remove(this.boneProxies); this.boneProxies = null; }
        this.currentBones = null;
        
        data.objects.forEach(o => {
          const geo = new THREE.BufferGeometry();
          for (const name in o.geometry) {
            if (name === 'index') {
              geo.setIndex(new THREE.BufferAttribute(new Uint32Array(o.geometry[name].array), 1));
            } else {
              geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(o.geometry[name].array), o.geometry[name].itemSize));
            }
          }
          
          const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: o.roughness, metalness: o.metalness });
          let mesh;
          
          if (o.isSkinned && o.bones) {
            mesh = new THREE.SkinnedMesh(geo, mat);
            const bones = o.bones.map(b => {
              const bone = new THREE.Bone();
              bone.name = b.name;
              bone.position.fromArray(b.pos);
              bone.quaternion.fromArray(b.quat);
              return bone;
            });
            for (let i = 0; i < bones.length - 1; i++) bones[i].add(bones[i+1]);
            mesh.add(bones[0]);
            const skel = new THREE.Skeleton(bones);
            mesh.bind(skel);
            this.currentBones = bones;
            this.skeletonHelper = new THREE.SkeletonHelper(mesh);
            scene.add(this.skeletonHelper);
            this.updateBoneList();
          } else {
            mesh = new THREE.Mesh(geo, mat);
          }
          
          mesh.position.fromArray(o.pos);
          mesh.quaternion.fromArray(o.quat);
          mesh.scale.fromArray(o.scale);
          
          if (o.texture) {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width; canvas.height = img.height;
              canvas.getContext('2d').drawImage(img, 0, 0);
              const tex = new THREE.CanvasTexture(canvas);
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.flipY = false;
              mesh.material.map = tex;
              mesh.material.needsUpdate = true;
              mesh.userData.paintCanvas = canvas;
              mesh.userData.paintTexture = tex;
            };
            img.src = o.texture;
          }
          
          this.addObject(mesh);
        });
        
        if (window.showToast) window.showToast('Project loaded!');
      } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast('Failed to load project: invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  },

  selectEdgeLoop(startIdx, additive = false) {
    const geo = this.activeMesh.geometry;
    if (!geo.index) return;
    const pos = geo.attributes.position;
    const index = geo.index.array;

    // Build adjacency map on the fly
    const vAdj = new Map();
    for (let i = 0; i < index.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = index[i + j];
        const b = index[i + (j+1)%3];
        if (!vAdj.has(a)) vAdj.set(a, new Set());
        if (!vAdj.has(b)) vAdj.set(b, new Set());
        vAdj.get(a).add(b);
        vAdj.get(b).add(a);
      }
    }

    const loop = new Set([startIdx]);
    const neighbors = Array.from(vAdj.get(startIdx) || []);
    const getPos = (idx) => new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));

    for (const n of neighbors) {
      let prev = startIdx;
      let curr = n;
      let steps = 0;
      
      while (curr !== undefined && steps < 1000) {
        loop.add(curr);
        const adj = Array.from(vAdj.get(curr) || []);
        let next = -1;
        let bestDot = -2;
        
        const currPos = getPos(curr);
        const prevPos = getPos(prev);
        const dir1 = currPos.clone().sub(prevPos).normalize();
        
        for (const cand of adj) {
          if (cand === prev) continue;
          const candPos = getPos(cand);
          const dir2 = candPos.clone().sub(currPos).normalize();
          const dot = dir1.dot(dir2);
          if (dot > bestDot) {
            bestDot = dot;
            next = cand;
          }
        }
        
        if (next === -1 || loop.has(next)) break;
        prev = curr;
        curr = next;
        steps++;
      }
    }

    if (!additive) this.selectedVertices.clear();
    loop.forEach(v => this.selectedVertices.add(v));
    
    syncPointsCloud();
    updateEditGizmo();
    if (window.showToast) window.showToast(`Selected loop of ${loop.size} vertices.`);
  },

  updateMaterialPreview(mat) {
    // Stub: secondary WebGL context disabled for mobile compatibility.
    // The color swatch in the UI reflects the base color, and the main
    // viewport shows all other material properties in real time.
  },

  saveState(mesh) {
    saveState(mesh);
  },

  syncUI() {
    if (!this.activeMesh) return;
    const mat = this.activeMesh.material;
    const c = document.getElementById('mat-color');
    const r = document.getElementById('mat-roughness');
    const m = document.getElementById('mat-metalness');
    const a = document.getElementById('mat-alpha');
    const f = document.getElementById('toggleFlatShading');
    if (c) c.value = '#' + mat.color.getHexString();
    if (r) r.value = mat.roughness;
    if (m) m.value = mat.metalness;
    if (a) a.value = mat.opacity;
    if (f) f.classList.toggle('active', mat.flatShading);

    // Reset UV sliders on undo/redo because absolute UVs are restored
    const su = document.getElementById('uv-scale-u');
    if (su) {
      su.value = 1; document.getElementById('uv-off-u').value = 0;
      document.getElementById('uv-scale-v').value = 1; document.getElementById('uv-off-v').value = 0;
    }

    if (this.updateMaterialPreview) this.updateMaterialPreview(mat);
    if (this.updateUVPreview) this.updateUVPreview();
  },

  applyTransform() {
    if (!this.activeMesh) return;
    if (this.activeMesh.isSkinnedMesh) {
      if (window.showToast) window.showToast("Cannot bake transform on a SkinnedMesh. Bind skin first.");
      return;
    }
    
    saveState(this.activeMesh);
    const mesh = this.activeMesh;
    
    // Ensure matrixWorld is updated
    mesh.updateMatrix();
    
    // Apply current position, rotation, scale to the geometry
    mesh.geometry.applyMatrix4(mesh.matrix);
    
    // Reset the transform
    mesh.position.set(0, 0, 0);
    mesh.quaternion.set(0, 0, 0, 1);
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    
    // Recompute normals and bounding boxes
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    
    selectionBox.setFromObject(mesh);
    if (this.brush) { this.brush.updateMesh(mesh); this.brush.rebuildGrid(); }
    if (viewGizmo) viewGizmo.updateMesh(mesh);
    
    if (window.showToast) window.showToast("Transform baked into geometry.");
  },

  centerOrigin() {
    if (!this.activeMesh) return;
    saveState(this.activeMesh);
    
    const mesh = this.activeMesh;
    mesh.geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    mesh.geometry.boundingBox.getCenter(center);
    
    // Translate geometry so its center is at 0,0,0
    mesh.geometry.translate(-center.x, -center.y, -center.z);
    
    // Move the mesh object to compensate, so it visually stays in place
    center.applyMatrix4(mesh.matrix);
    mesh.position.copy(center);
    
    selectionBox.setFromObject(mesh);
    if (this.brush) { this.brush.updateMesh(mesh); this.brush.rebuildGrid(); }
    if (viewGizmo) viewGizmo.updateMesh(mesh);
    
    if (window.showToast) window.showToast("Origin centered to mesh.");
  },

  downloadTexture() {
    if (!this.activeMesh) return;
    let canvas = this.activeMesh.userData.paintCanvas;
    if (!canvas) {
      // If no canvas, but there is a texture map, try to draw that
      if (this.activeMesh.material.map && this.activeMesh.material.map.image) {
        canvas = document.createElement('canvas');
        canvas.width = this.activeMesh.material.map.image.width;
        canvas.height = this.activeMesh.material.map.image.height;
        canvas.getContext('2d').drawImage(this.activeMesh.material.map.image, 0, 0);
      } else {
        if (window.showToast) window.showToast('No texture to download.');
        return;
      }
    }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `texture_${this.activeMesh.uuid.substring(0,4)}.png`;
    a.click();
    if (window.showToast) window.showToast('Texture downloaded!');
  },

  cacheBaseUVs() {
    if (this.activeMesh && this.activeMesh.geometry.attributes.uv) {
      this._baseUVs = new Float32Array(this.activeMesh.geometry.attributes.uv.array);
    } else {
      this._baseUVs = null;
    }
    this.updateUVPreview();
  },

  applyUVTransform(scaleU, offsetU, scaleV, offsetV) {
    if (!this.activeMesh || !this.activeMesh.geometry.attributes.uv || !this._baseUVs) return;
    const uv = this.activeMesh.geometry.attributes.uv;
    const base = this._baseUVs;
    
    for (let i = 0; i < uv.count; i++) {
      // Apply scale, then offset
      uv.setXY(i, (base[i * 2] * scaleU) + offsetU, (base[i * 2 + 1] * scaleV) + offsetV);
    }
    uv.needsUpdate = true;
    this.updateUVPreview();
  },

  updateUVPreview() {
    const canvas = document.getElementById('uv-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * canvas.width;
      const y = (i / 4) * canvas.height;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (!this.activeMesh || !this.activeMesh.geometry.attributes.uv) return;
    
    const uv = this.activeMesh.geometry.attributes.uv;
    const index = this.activeMesh.geometry.index;
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 1.5;
    
    const drawLine = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(uv.getX(a) * canvas.width, (1 - uv.getY(a)) * canvas.height);
      ctx.lineTo(uv.getX(b) * canvas.width, (1 - uv.getY(b)) * canvas.height);
      ctx.stroke();
    };
    
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i+1), c = index.getX(i+2);
        drawLine(a, b); drawLine(b, c); drawLine(c, a);
      }
    } else {
      for (let i = 0; i < uv.count; i += 3) {
        drawLine(i, i+1); drawLine(i+1, i+2); drawLine(i+2, i);
      }
    }
  },

  exportGLTF(isBinary = false) {
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
    
    const options = { binary: isBinary };
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

    new GLTFExporter().parse(
      exportGroup,
      (result) => {
        let blob, filename;
        if (isBinary) {
          blob = new Blob([result], { type: 'application/octet-stream' });
          filename = 'scene.glb';
        } else {
          blob = new Blob([JSON.stringify(result)], { type: 'application/json' });
          filename = 'scene.gltf';
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      (err) => { console.error("Export failed:", err); },
      { binary: isBinary }
    );
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
      
      // GUI Alignment: Live update the 2D mini-texture viewer
      const miniTex = document.getElementById('mini-tex');
      if (miniTex) {
        const ctx = miniTex.getContext('2d');
        if (miniTex.width !== state.activeMesh.userData.paintCanvas.width) {
          miniTex.width = state.activeMesh.userData.paintCanvas.width;
          miniTex.height = state.activeMesh.userData.paintCanvas.height;
        }
        ctx.drawImage(state.activeMesh.userData.paintCanvas, 0, 0);
      }
    } else {
      state.brush.paint(localPoint, state.symmetryEnabled);
    }
  }
  else if (state.mode === "weight_paint") state.brush.paintWeight(localPoint); 
}

function updateEditGizmo() {
  if (state.selectedVertices.size > 0 && state.activeMesh) {
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

let boxSelecting = false;
let boxStartX = 0, boxStartY = 0;
let lastClickIdx = -1;
let lastClickTime = 0;

if (trackpadSurface) {
  trackpadSurface.addEventListener("pointerdown", e => {
    if (state.mode !== 'edit' || !state.activeMesh) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Only left click

    boxSelecting = true;
    boxStartX = e.clientX;
    boxStartY = e.clientY;
    
    const box = document.getElementById('selection-box');
    if (box) {
      box.style.left = `${boxStartX}px`;
      box.style.top = `${boxStartY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      box.style.display = 'block';
    }
  });

  window.addEventListener("pointermove", e => {
    if (!boxSelecting) return;
    const box = document.getElementById('selection-box');
    if (!box) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const minX = Math.min(boxStartX, currentX);
    const minY = Math.min(boxStartY, currentY);
    const width = Math.abs(currentX - boxStartX);
    const height = Math.abs(currentY - boxStartY);
    
    box.style.left = `${minX}px`;
    box.style.top = `${minY}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  });

  window.addEventListener("pointerup", e => {
    if (!boxSelecting) return;
    boxSelecting = false;
    
    const box = document.getElementById('selection-box');
    if (box) box.style.display = 'none';
    
    if (state.mode !== 'edit' || !state.activeMesh) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const dist = Math.sqrt((currentX - boxStartX)**2 + (currentY - boxStartY)**2);
    
    if (dist < 5) {
      // It was a click
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
        const now = Date.now();
        
        // Double click detection
        if (idx === lastClickIdx && (now - lastClickTime) < 350) {
          state.selectEdgeLoop(idx, e.shiftKey);
          lastClickIdx = -1; // Reset so triple-click doesn't trigger again
        } else {
          // Single click behavior
          if (!e.shiftKey && !state.selectedVertices.has(idx)) {
            state.selectedVertices.clear();
          }
          if (state.selectedVertices.has(idx)) state.selectedVertices.delete(idx);
          else state.selectedVertices.add(idx);
          syncPointsCloud();
          updateEditGizmo();
          
          lastClickIdx = idx;
          lastClickTime = now;
        }
      } else {
        // Clicked empty space, clear selection
        state.selectedVertices.clear();
        syncPointsCloud();
        updateEditGizmo();
        lastClickIdx = -1;
      }
    } else {
      // It was a drag, do box selection
      const rect = trackpadSurface.getBoundingClientRect();
      const minX = Math.min(boxStartX, currentX);
      const maxX = Math.max(boxStartX, currentX);
      const minY = Math.min(boxStartY, currentY);
      const maxY = Math.max(boxStartY, currentY);

      const pos = state.activeMesh.geometry.attributes.position;
      const v = new THREE.Vector3();
      const matrixWorld = state.activeMesh.matrixWorld;

      // For additive selection, hold Shift
      if (!e.shiftKey) state.selectedVertices.clear();

      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        v.applyMatrix4(matrixWorld);
        v.project(camera);

        // NDC to Screen
        const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;

        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          state.selectedVertices.add(i);
        }
      }
      
      syncPointsCloud();
      updateEditGizmo();
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


function compactGeometry(geo) {
  if (!geo.index) return;
  const oldIndex = geo.index.array;
  
  const usedMap = new Map(); // oldIdx -> newIdx
  const newIndices = [];
  let newIdx = 0;
  
  for (let i = 0; i < oldIndex.length; i++) {
    const oldIdx = oldIndex[i];
    if (!usedMap.has(oldIdx)) {
      usedMap.set(oldIdx, newIdx++);
    }
    newIndices.push(usedMap.get(oldIdx));
  }
  
  // Build new attributes
  const newAttrs = {};
  for (const name in geo.attributes) {
    const oldAttr = geo.attributes[name];
    const itemSize = oldAttr.itemSize;
    const newArray = new oldAttr.array.constructor(usedMap.size * itemSize);
    
    usedMap.forEach((newI, oldI) => {
      for (let k = 0; k < itemSize; k++) {
        newArray[newI * itemSize + k] = oldAttr.array[oldI * itemSize + k];
      }
    });
    
    newAttrs[name] = new THREE.BufferAttribute(newArray, itemSize, oldAttr.normalized);
  }
  
  for (const name in newAttrs) {
    geo.setAttribute(name, newAttrs[name]);
  }
  geo.setIndex(newIndices);
}

function deleteSelectedVertices() {
  if (!state.activeMesh || state.selectedVertices.size === 0) return;
  const geo = state.activeMesh.geometry;
  if (!geo.index) {
    if (window.showToast) window.showToast("Requires indexed geometry.");
    return;
  }

  saveState(state.activeMesh);
  
  const index = geo.index.array;
  const newIndices = [];
  
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i+1], c = index[i+2];
    if (!state.selectedVertices.has(a) && !state.selectedVertices.has(b) && !state.selectedVertices.has(c)) {
      newIndices.push(a, b, c);
    }
  }
  
  geo.setIndex(newIndices);
  compactGeometry(geo); // Remove orphaned vertices
  state.selectedVertices.clear();
  
  syncPointsCloud();
  updateEditGizmo();
  
  if (state.activeMesh) {
    wireframeLines.geometry.dispose();
    wireframeLines.geometry = new THREE.WireframeGeometry(geo);
  }
  
  if (state.brush) state.brush.rebuildGrid();
  if (window.showToast) window.showToast("Vertices deleted.");
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
try {
  initUI(state, viewGizmo);
} catch (e) {
  console.error("initUI failed:", e);
  if (window.showToast) window.showToast("UI failed to load: " + e.message);
}

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
document.getElementById("deleteVertexBtn").onclick = deleteSelectedVertices;
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
  if (state.mixer) {
    state.mixer.update(delta);
    if (state.mixer.timeScale === 1) {
      const scrub = document.getElementById('timeline-scrub');
      const label = document.getElementById('timeline-label');
      if (scrub && label) {
        const t = Math.round(state.mixer.time);
        scrub.value = t;
        label.textContent = `Frame: ${t}`;
      }
    }
  }
  
  if (state.trackpadMode === 'camera' && controls) controls.update();
  if (canvasControls) canvasControls.update();
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
