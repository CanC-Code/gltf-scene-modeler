import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";
import { mergeVertices } from "../three/utils/BufferGeometryUtils.js";
import { extrudeFaces, subdivideLoop } from "./topology.js";

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
      editDummy.updateMatrix();
      state._editDragSnapshot = new Float32Array(pos.array);
      state._editDragStartMatrix = editDummy.matrix.clone();

      // Build mirror map for X/Y symmetry
      state._editMirrorMap = null;
      if (state.symmetryX || state.symmetryY) {
        const snap = state._editDragSnapshot;
        const count = pos.count;
        const threshold = 0.08;
        const mirrorMap = new Map();
        const selectedArr = Array.from(state.selectedVertices);
        for (const idx of selectedArr) {
          const vx = snap[idx*3], vy = snap[idx*3+1], vz = snap[idx*3+2];
          const mx = state.symmetryX ? -vx : vx;
          const my = state.symmetryY ? -vy : vy;
          let bestIdx = -1, bestDist = threshold;
          for (let i = 0; i < count; i++) {
            if (state.selectedVertices.has(i)) continue;
            const dx = snap[i*3] - mx, dy = snap[i*3+1] - my, dz = snap[i*3+2] - vz;
            const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (d < bestDist) { bestIdx = i; bestDist = d; }
          }
          if (bestIdx !== -1) mirrorMap.set(idx, bestIdx);
        }
        state._editMirrorMap = mirrorMap;
      }
    }
  } else if (!e.value && state.mode === 'edit' && state.activeMesh) {
    state.activeMesh.geometry.computeVertexNormals();
    state.brush.rebuildGrid();
    state._editDragSnapshot = null;
    state._editMirrorMap = null;
  }
});

transform.addEventListener('objectChange', () => {
  // If we're rotating a bone, sync the roll slider
  if (transform.object && transform.object.isBone) {
    const rollInput = document.getElementById('bone-roll');
    if (rollInput) rollInput.value = transform.object.rotation.y || 0;
  }
  if (state.mode === 'edit' && state.selectedVertices.size > 0 && state.activeMesh) {
    const mesh = state.activeMesh;
    const pos = mesh.geometry.attributes.position;

    if (!state._editDragStartMatrix || !state._editDragSnapshot) return;
    
    // Compute the delta transformation matrix
    editDummy.updateMatrix();
    const deltaMatrix = new THREE.Matrix4().multiplyMatrices(editDummy.matrix, state._editDragStartMatrix.clone().invert());
    
    const meshMatrix = mesh.matrixWorld;
    const invMeshMatrix = meshMatrix.clone().invert();
    const snap = state._editDragSnapshot;
    
    if (state.proportionalEnabled) {
      // Proportional edit is harder with matrices, but we can use the translation part
      const worldTotalDelta = new THREE.Vector3().setFromMatrixPosition(deltaMatrix);
      const M3 = new THREE.Matrix3().setFromMatrix4(meshMatrix).invert();
      const localTotalDelta = worldTotalDelta.clone().applyMatrix3(M3);

      const selPos = Array.from(state.selectedVertices).map(idx => new THREE.Vector3(snap[idx * 3], snap[idx * 3 + 1], snap[idx * 3 + 2]));
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
          const v = new THREE.Vector3(vx, vy, vz);
          v.applyMatrix4(meshMatrix);
          // Apply only translation for proportional
          const tDelta = new THREE.Vector3().setFromMatrixPosition(deltaMatrix);
          v.add(tDelta.multiplyScalar(weight));
          v.applyMatrix4(invMeshMatrix);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
      }
    } else {
      state.selectedVertices.forEach(idx => {
        const v = new THREE.Vector3(snap[idx * 3], snap[idx * 3 + 1], snap[idx * 3 + 2]);
        v.applyMatrix4(meshMatrix);
        v.applyMatrix4(deltaMatrix);
        v.applyMatrix4(invMeshMatrix);
        pos.setXYZ(idx, v.x, v.y, v.z);
      });

      // Apply X/Y symmetry to mirror vertices
      if (state._editMirrorMap && (state.symmetryX || state.symmetryY)) {
        state._editMirrorMap.forEach((mirrorIdx, primaryIdx) => {
          const px = pos.getX(primaryIdx), py = pos.getY(primaryIdx), pz = pos.getZ(primaryIdx);
          const mx = state.symmetryX ? -px : px;
          const my = state.symmetryY ? -py : py;
          pos.setXYZ(mirrorIdx, mx, my, pz);
        });
      }
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
function captureState(mesh, stateObj) {
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

  const bonePoses = (stateObj.currentBones && stateObj.currentBones.length) ? stateObj.currentBones.map(b => ({
    pos: b.position.clone(),
    quat: b.quaternion.clone()
  })) : null;

  const keyframesSnap = stateObj.keyframes ? JSON.parse(JSON.stringify(stateObj.keyframes)) : [];

  return { position: pos.clone(), normal: norm ? norm.clone() : null, color: col ? col.clone() : null, skinWeight: sw ? sw.clone() : null, skinIndex: si ? si.clone() : null, canvasSnap, uv: uv ? uv.clone() : null, matColor: mesh.material.color.getHex(), matRough: mesh.material.roughness, matMetal: mesh.material.metalness, matMap: mesh.material.map || null, matNormalMap: mesh.material.normalMap || null, matOpacity: mesh.material.opacity, matTransparent: mesh.material.transparent, matFlatShading: mesh.material.flatShading, meshPos: mesh.position.clone(), meshQuat: mesh.quaternion.clone(), meshScale: mesh.scale.clone(), bonePoses, keyframesSnap };
}
function saveState(mesh) {
  if (!mesh) return;
  const snap = captureState(mesh, state);
  undoStack.push(snap);
  
  // Dynamic limit: prevent OOM on large texture canvases
  const maxStates = snap.canvasSnap ? 5 : 20;
  if (undoStack.length > maxStates) undoStack.shift();
  
  redoStack.length = 0;
}
function undo() {
  if (!state.activeMesh || !undoStack.length) return;
  const snap = captureState(state.activeMesh, state);
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
  
  // Restore rigging / animation state
  if (prev.bonePoses && state.currentBones) {
    prev.bonePoses.forEach((p, i) => {
      if (state.currentBones[i]) {
        state.currentBones[i].position.copy(p.pos);
        state.currentBones[i].quaternion.copy(p.quat);
        state.currentBones[i].updateMatrixWorld(true);
      }
    });
  }
  if (prev.keyframesSnap) {
    state.keyframes = prev.keyframesSnap;
  }

  if (state.brush) { state.brush.updateMesh(state.activeMesh); state.brush.rebuildGrid(); }
  if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
  if (state.mode === 'edit') syncPointsCloud();
  state.syncUI();
}
function redo() {
  if (!state.activeMesh || !redoStack.length) return;
  const snap = captureState(state.activeMesh, state);
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
  
  // Restore rigging / animation state
  if (next.bonePoses && state.currentBones) {
    next.bonePoses.forEach((p, i) => {
      if (state.currentBones[i]) {
        state.currentBones[i].position.copy(p.pos);
        state.currentBones[i].quaternion.copy(p.quat);
        state.currentBones[i].updateMatrixWorld(true);
      }
    });
  }
  if (next.keyframesSnap) {
    state.keyframes = next.keyframesSnap;
  }

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
  symmetryX: false,
  symmetryY: false,
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
  faceSelectMode: false,
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
  ikEnabled: false,
  ikTarget: null,
  _baseUVs: null,

  applyMaterialPreset(presetName) {
    if (!this.activeMesh || !this.activeMesh.material) return;
    const mat = this.activeMesh.material;
    
    const presets = {
      skin:    { color: 0xffddc4, roughness: 0.55, metalness: 0.0, opacity: 1.0, transparent: false },
      metal:   { color: 0x8a8a8a, roughness: 0.35, metalness: 0.9, opacity: 1.0, transparent: false },
      chrome:  { color: 0xe8e8e8, roughness: 0.05, metalness: 1.0, opacity: 1.0, transparent: false },
      gold:    { color: 0xffb739, roughness: 0.25, metalness: 1.0, opacity: 1.0, transparent: false },
      glass:   { color: 0xc8e8ff, roughness: 0.05, metalness: 0.1, opacity: 0.25, transparent: true },
      wood:    { color: 0x8b5a2b, roughness: 0.75, metalness: 0.05, opacity: 1.0, transparent: false },
      stone:   { color: 0x7a7a7a, roughness: 0.9, metalness: 0.0, opacity: 1.0, transparent: false },
      cloth:   { color: 0x4a7ab5, roughness: 0.9, metalness: 0.0, opacity: 1.0, transparent: false },
      rubber:  { color: 0x222222, roughness: 0.95, metalness: 0.0, opacity: 1.0, transparent: false },
      plastic: { color: 0xff6b6b, roughness: 0.4, metalness: 0.0, opacity: 1.0, transparent: false },
      ice:     { color: 0xaaddff, roughness: 0.1, metalness: 0.3, opacity: 0.5, transparent: true },
      default: { color: 0x88ccff, roughness: 0.4, metalness: 0.1, opacity: 1.0, transparent: false }
    };
    
    const p = presets[presetName];
    if (!p) return;
    
    saveState(this.activeMesh);
    
    mat.color.setHex(p.color);
    mat.roughness = p.roughness;
    mat.metalness = p.metalness;
    mat.opacity = p.opacity;
    mat.transparent = p.transparent;
    mat.needsUpdate = true;
    
    // Sync UI sliders + color swatch
    const cb = document.getElementById('mat-color-btn');
    if (cb) cb.style.background = '#' + mat.color.getHexString();
    const r = document.getElementById('mat-roughness');
    const mt = document.getElementById('mat-metalness');
    const a = document.getElementById('mat-alpha');
    if (r) r.value = p.roughness;
    if (mt) mt.value = p.metalness;
    if (a) a.value = p.opacity;
    
    this.updateMaterialPreview(mat);
    if (window.showToast) window.showToast(`Preset: ${presetName.charAt(0).toUpperCase() + presetName.slice(1)}`);
  },

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
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addSphere() {
    let geo = new THREE.SphereGeometry(1.5, 64, 64);
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ff88, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addPlane() {
    let geo = new THREE.PlaneGeometry(2, 2, 24, 24);
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide, wireframe: this.wireframe }));
    mesh.rotation.x = -Math.PI / 2; // Lay flat
    mesh.position.set(0, 0, 0);
    this.addObject(mesh);
  },

  addCylinder() {
    let geo = new THREE.CylinderGeometry(1, 1, 2, 32, 24);
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addCone() {
    let geo = new THREE.ConeGeometry(1.5, 3, 32, 24);
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff8888, roughness: 0.4, metalness: 0.1, wireframe: this.wireframe }));
    mesh.position.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
    this.addObject(mesh);
  },

  addTorus() {
    let geo = new THREE.TorusGeometry(1.2, 0.4, 24, 48);
    geo.deleteAttribute('normal');

    geo.deleteAttribute('uv');

    geo = mergeVertices(geo);

    geo.computeVertexNormals();
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
    if (this.ikEnabled) this.disableIK();
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
    
    if (this.ikEnabled) this.disableIK();

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

  setBoneRoll(roll) {
    if (!this.currentBones || !this.currentBones[this.activeBoneIndex]) return;
    const bone = this.currentBones[this.activeBoneIndex];
    bone.rotation.y = roll;
    bone.updateMatrixWorld(true);
    if (this.activeMesh) this.activeMesh.updateMatrixWorld(true);
  },

  selectBone(index) {
    if (this.ikEnabled) this.disableIK();
    if (!this.currentBones || !this.currentBones[index]) return;
    this.activeBoneIndex = index;
    if (this.brush) this.brush.setActiveBone(index);
    transform.attach(this.currentBones[index]);
    transform.setMode('rotate');
    this.rebuildBoneProxies();
    this.updateBoneList();

    // Sync bone roll slider
    const rollInput = document.getElementById('bone-roll');
    if (rollInput) rollInput.value = this.currentBones[index].rotation.y || 0;
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

  enableIK() {
    if (!this.currentBones || this.currentBones.length < 2) {
      if (window.showToast) window.showToast("Need at least 2 bones.");
      return;
    }
    if (this.activeBoneIndex < 1) {
      if (window.showToast) window.showToast("Select a bone with a parent.");
      return;
    }
    this.activeMesh.updateMatrixWorld(true);
    const lastBone = this.currentBones[this.activeBoneIndex];
    const prevBone = this.currentBones[this.activeBoneIndex - 1];
    const lastW = new THREE.Vector3();
    const prevW = new THREE.Vector3();
    lastBone.getWorldPosition(lastW);
    prevBone.getWorldPosition(prevW);
    const tail = lastW.clone().add(lastW.clone().sub(prevW));
    if (this.ikTarget) scene.remove(this.ikTarget);
    this.ikTarget = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    this.ikTarget.position.copy(tail);
    scene.add(this.ikTarget);
    transform.attach(this.ikTarget);
    transform.setMode('translate');
    this.ikEnabled = true;
    if (window.showToast) window.showToast("IK enabled. Drag the pink target.");
  },
  disableIK() {
    if (this.ikTarget) { scene.remove(this.ikTarget); this.ikTarget = null; }
    this.ikEnabled = false;
    if (this.currentBones && this.currentBones[this.activeBoneIndex]) {
      transform.attach(this.currentBones[this.activeBoneIndex]);
    } else {
      transform.detach();
    }
    if (window.showToast) window.showToast("IK disabled.");
  },
  solveIK() {
    if (!this.ikEnabled || !this.ikTarget || !this.currentBones) return;
    const chain = this.currentBones.slice(0, this.activeBoneIndex + 1);
    if (chain.length < 2) return;
    this.activeMesh.updateMatrixWorld(true);
    const wp = chain.map(b => { const p = new THREE.Vector3(); b.getWorldPosition(p); return p; });
    const lastW = wp[wp.length - 1];
    const prevW = wp[wp.length - 2];
    wp.push(lastW.clone().add(lastW.clone().sub(prevW)));
    const target = this.ikTarget.position.clone();
    const rootPos = wp[0].clone();
    const lengths = [];
    for (let i = 0; i < wp.length - 1; i++) lengths.push(wp[i + 1].distanceTo(wp[i]));
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    if (rootPos.distanceTo(target) > totalLen - 0.01) {
      const dir = target.clone().sub(rootPos).normalize();
      for (let i = 1; i < wp.length; i++) wp[i] = wp[i - 1].clone().add(dir.clone().multiplyScalar(lengths[i - 1]));
    } else {
      for (let iter = 0; iter < 15; iter++) {
        wp[wp.length - 1].copy(target);
        for (let i = wp.length - 2; i >= 0; i--) {
          const dir = wp[i].clone().sub(wp[i + 1]).normalize();
          wp[i].copy(wp[i + 1].clone().add(dir.multiplyScalar(lengths[i])));
        }
        wp[0].copy(rootPos);
        for (let i = 1; i < wp.length; i++) {
          const dir = wp[i].clone().sub(wp[i - 1]).normalize();
          wp[i].copy(wp[i - 1].clone().add(dir.multiplyScalar(lengths[i - 1])));
        }
        if (wp[wp.length - 1].distanceTo(target) < 0.01) break;
      }
    }
    for (let i = 0; i < chain.length; i++) {
      const bone = chain[i];
      bone.updateMatrixWorld(true);
      const currW = new THREE.Vector3();
      bone.getWorldPosition(currW);
      let currChildW;
      if (i < chain.length - 1) {
        currChildW = new THREE.Vector3();
        chain[i + 1].getWorldPosition(currChildW);
      } else {
        const prevBoneW = new THREE.Vector3();
        if (i > 0) {
          chain[i - 1].getWorldPosition(prevBoneW);
          currChildW = currW.clone().add(currW.clone().sub(prevBoneW));
        } else {
          currChildW = currW.clone().add(new THREE.Vector3(0, 1, 0));
        }
      }
      const currDir = currChildW.clone().sub(currW).normalize();
      const desiredDir = wp[i + 1].clone().sub(currW).normalize();
      const worldRot = new THREE.Quaternion().setFromUnitVectors(currDir, desiredDir);
      const boneWorldQuat = new THREE.Quaternion();
      bone.getWorldQuaternion(boneWorldQuat);
      const newWorldQuat = worldRot.clone().multiply(boneWorldQuat);
      if (bone.parent) {
        const parentWorldQuat = new THREE.Quaternion();
        bone.parent.getWorldQuaternion(parentWorldQuat);
        bone.quaternion.copy(parentWorldQuat.clone().invert().multiply(newWorldQuat));
      } else {
        bone.quaternion.copy(newWorldQuat);
      }
      bone.updateMatrixWorld(true);
    }
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
    if (scrub) scrub.value = maxFrame;
    this._refreshTimeline();
    this.scrubToTime(maxFrame);
    
    if (window.showToast) window.showToast(`Keyframe ${time} added!`);
  },

  _refreshTimeline() {
    const scrub = document.getElementById('timeline-scrub');
    const label = document.getElementById('timeline-label');
    if (!scrub) return;
    const maxFrame = Math.max(0, this.keyframes.length - 1);
    scrub.max = maxFrame;
    scrub.disabled = this.keyframes.length < 2;
    let v = parseFloat(scrub.value);
    if (isNaN(v) || v > maxFrame) v = maxFrame;
    scrub.value = v;
    if (label) label.textContent = `Frame: ${Math.round(v)} / ${maxFrame}`;
  },

  deleteKeyframe() {
    if (!this.keyframes.length) {
      if (window.showToast) window.showToast("No keyframes to delete.");
      return;
    }
    const scrub = document.getElementById('timeline-scrub');
    const idx = scrub ? Math.round(parseFloat(scrub.value)) : this.keyframes.length - 1;
    if (idx < 0 || idx >= this.keyframes.length) return;

    const fps = this.animationFPS || 24;
    this.keyframes.splice(idx, 1);
    // Rebuild times to keep them monotonic (0, 1/fps, 2/fps...)
    this.keyframes.forEach((frame, i) => { frame.time = i / fps; });

    if (this.keyframes.length === 0 && this.currentBones) {
      // Reset bones to rest pose since there are no keyframes
      this.currentBones.forEach(b => {
        b.position.set(0, 0, 0);
        b.quaternion.set(0, 0, 0, 1);
      });
      if (this.mixer) this.mixer.stopAllAction();
    }

    this._refreshTimeline();
    const newIdx = Math.min(idx, this.keyframes.length - 1);
    if (newIdx >= 0) this.scrubToTime(newIdx);
    if (window.showToast) window.showToast(`Deleted keyframe ${idx}. ${this.keyframes.length} remaining.`);
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
    const data = {
      objects: [],
      keyframes: this.keyframes,
      animationFPS: this.animationFPS,
      loopAnim: this.loopAnim
    };
    this.objects.forEach(obj => {
      const o = {
        isSkinned: !!obj.isSkinnedMesh,
        pos: obj.position.toArray(),
        quat: obj.quaternion.toArray(),
        scale: obj.scale.toArray(),
        color: '#' + obj.material.color.getHexString(),
        roughness: obj.material.roughness,
        metalness: obj.material.metalness,
        opacity: obj.material.opacity,
        transparent: obj.material.transparent,
        flatShading: obj.material.flatShading,
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
        const skelBones = obj.skeleton.bones;
        o.bones = skelBones.map((b, i) => {
          // Find parent bone's index in the same skeleton array
          let parentIndex = -1;
          if (b.parent && b.parent.isBone) {
            parentIndex = skelBones.indexOf(b.parent);
          }
          return {
            name: b.name,
            pos: b.position.toArray(),
            quat: b.quaternion.toArray(),
            roll: b.rotation.y || 0,
            parentIndex
          };
        });
        // Preserve bind pose: boneInverses + bindMatrix
        o.boneInverses = obj.skeleton.boneInverses.map(m => m.toArray().flat());
        o.bindMatrix = obj.bindMatrix.toArray().flat();
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
        if (this.ikEnabled) this.disableIK();
        if (this.ikTarget) { scene.remove(this.ikTarget); this.ikTarget = null; }
        if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
        this.objects.forEach(o => scene.remove(o));
        this.objects = [];
        this.activeMesh = null;
        this.brush = null;
        if (this.skeletonHelper) { scene.remove(this.skeletonHelper); this.skeletonHelper = null; }
        if (this.boneProxies) { scene.remove(this.boneProxies); this.boneProxies = null; }
        this.currentBones = null;
        this.keyframes = [];
        this.animationFPS = 24;
        this.loopAnim = false;
        
        data.objects.forEach(o => {
          const geo = new THREE.BufferGeometry();
          for (const name in o.geometry) {
            if (name === 'index') {
              geo.setIndex(new THREE.BufferAttribute(new Uint32Array(o.geometry[name].array), 1));
            } else {
              geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(o.geometry[name].array), o.geometry[name].itemSize));
            }
          }
          
          const mat = new THREE.MeshStandardMaterial({
            color: o.color,
            roughness: o.roughness,
            metalness: o.metalness,
            opacity: o.opacity !== undefined ? o.opacity : 1.0,
            transparent: o.transparent || false,
            flatShading: o.flatShading || false
          });
          let mesh;
          
          if (o.isSkinned && o.bones) {
            mesh = new THREE.SkinnedMesh(geo, mat);
            const bones = o.bones.map(b => {
              const bone = new THREE.Bone();
              bone.name = b.name;
              bone.position.fromArray(b.pos);
              bone.quaternion.fromArray(b.quat);
              bone.rotation.y = b.roll || 0;
              return bone;
            });
            // Rebuild hierarchy from saved parentIndex (fixes branched rigs)
            const hasParentInfo = o.bones.some(b => b.parentIndex !== undefined);
            if (hasParentInfo) {
              o.bones.forEach((b, i) => {
                if (b.parentIndex !== undefined && b.parentIndex >= 0 && bones[b.parentIndex]) {
                  bones[b.parentIndex].add(bones[i]);
                }
              });
              // Roots (parentIndex -1) become children of the mesh
              o.bones.forEach((b, i) => {
                if (b.parentIndex === undefined || b.parentIndex < 0) {
                  mesh.add(bones[i]);
                }
              });
            } else {
              // Legacy format: fall back to linear chain
              for (let i = 0; i < bones.length - 1; i++) bones[i].add(bones[i+1]);
              if (bones[0]) mesh.add(bones[0]);
            }

            // Restore boneInverses (preserves original bind pose)
            let skel;
            if (o.boneInverses && Array.isArray(o.boneInverses) && o.boneInverses.length === bones.length) {
              const invs = o.boneInverses.map(arr => {
                const m = new THREE.Matrix4();
                m.fromArray(arr);
                return m;
              });
              skel = new THREE.Skeleton(bones, invs);
            } else {
              skel = new THREE.Skeleton(bones);
            }

            // Restore bindMatrix if saved
            let bindMat = undefined;
            if (o.bindMatrix && Array.isArray(o.bindMatrix) && o.bindMatrix.length === 16) {
              bindMat = new THREE.Matrix4().fromArray(o.bindMatrix);
            }
            mesh.bind(skel, bindMat);

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
        
        // Restore animation data
        if (data.keyframes) this.keyframes = data.keyframes;
        if (data.animationFPS) this.animationFPS = data.animationFPS;
        if (data.loopAnim !== undefined) this.loopAnim = data.loopAnim;
        this._refreshTimeline();

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

  subdivideMesh() {
    if (!this.activeMesh) return;
    if (!this.activeMesh.geometry.index) {
      if (window.showToast) window.showToast("Subdivision requires indexed geometry.");
      return;
    }
    const triCount = this.activeMesh.geometry.index.count / 3;
    if (triCount > 40000) {
      if (window.showToast) window.showToast(`Too many triangles (${triCount}). Subdividing would exceed mobile limits.`);
      return;
    }
    saveState(this.activeMesh);
    subdivideLoop(this.activeMesh.geometry);
    this.activeMesh.userData.subdivLevel = (this.activeMesh.userData.subdivLevel || 0) + 1;
    refreshAfterTopologyEdit();
    if (window.showToast) window.showToast(`Subdivided to Level ${this.activeMesh.userData.subdivLevel}. ${(this.activeMesh.geometry.index.count / 3)} triangles.`);
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
      options
    );
  },

  importGLTF(e) {
    const reader = new FileReader();
    reader.onload = () => new GLTFLoader().parse(reader.result, "", gltf => {
      let mesh = null;
      gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
      if (mesh) {
        if (!mesh.isSkinnedMesh && !mesh.geometry.attributes.skinIndex) {
          mesh.geometry.deleteAttribute('normal');

          mesh.geometry.deleteAttribute('uv');

          mesh.geometry = mergeVertices(mesh.geometry);

          mesh.geometry.computeVertexNormals();
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
    e.preventDefault(); isActionActive = true; saveState(state.activeMesh); 
    if (state.brush) state.brush.lastGrabPoint = null; // Reset grab state
    handleAction();
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
  if (state.mode === "sculpt") state.brush.apply(localPoint, ({ x: state.symmetryX, y: state.symmetryY }));
  else if (state.mode === "paint") {
    if (state.activeMesh.userData.paintCanvas) {
      state.brush.paintTexture(localPoint, ({ x: state.symmetryX, y: state.symmetryY }));
      
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
      state.brush.paint(localPoint, ({ x: state.symmetryX, y: state.symmetryY }));
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
    editDummy.updateMatrix();
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

      // Face Select Mode
      if (state.faceSelectMode && state.activeMesh) {
        // Raycast against the invisible activeMesh (which is still in the scene)
        const hits = raycaster.intersectObject(state.activeMesh);
        if (hits.length > 0) {
          const hit = hits[0];
          const face = hit.face;
          const geo = state.activeMesh.geometry;
          if (face && geo.index) {
            const i0 = geo.index.getX(hit.faceIndex * 3);
            const i1 = geo.index.getX(hit.faceIndex * 3 + 1);
            const i2 = geo.index.getX(hit.faceIndex * 3 + 2);
            state.selectedVertices.clear();
            state.selectedVertices.add(i0);
            state.selectedVertices.add(i1);
            state.selectedVertices.add(i2);
            syncPointsCloud();
            updateEditGizmo();
            if (window.showToast) window.showToast(`Selected face (${i0}, ${i1}, ${i2})`);
            return;
          }
        }
      }

      // Standard Vertex Raycast
      const distToMesh = camera.position.distanceTo(state.activeMesh.position);
      raycaster.params.Points.threshold = distToMesh * 0.012; // Smaller threshold for exact selection

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


function bevelSelected(amount = 0.2) {
  if (!state.activeMesh || state.selectedVertices.size === 0) return;
  saveState(state.activeMesh);
  const geo = state.activeMesh.geometry;
  if (!geo.index) {
    if (window.showToast) window.showToast("Bevel requires indexed geometry.");
    return;
  }
  const index = geo.index.array;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const attrSnapshots = {};
  for (const name in geo.attributes) {
    const attr = geo.attributes[name];
    attrSnapshots[name] = {
      data: Array.from(attr.array),
      itemSize: attr.itemSize,
      ctor: attr.array.constructor,
      normalized: attr.normalized
    };
  }
  let nextIdx = pos.count;
  const clonesPerVertex = new Map();
  const newIndices = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t+1], index[t+2]];
    const clonedTri = tri.map((vIdx, k) => {
      if (!state.selectedVertices.has(vIdx)) return vIdx;
      const aIdx = tri[(k + 1) % 3];
      const bIdx = tri[(k + 2) % 3];
      const mx = (pos.getX(aIdx) + pos.getX(bIdx)) / 2;
      const my = (pos.getY(aIdx) + pos.getY(bIdx)) / 2;
      const mz = (pos.getZ(aIdx) + pos.getZ(bIdx)) / 2;
      const vx = pos.getX(vIdx), vy = pos.getY(vIdx), vz = pos.getZ(vIdx);
      const nx = vx + (mx - vx) * amount;
      const ny = vy + (my - vy) * amount;
      const nz = vz + (mz - vz) * amount;
      for (const name in attrSnapshots) {
        const snap = attrSnapshots[name];
        for (let p = 0; p < snap.itemSize; p++) {
          snap.data.push(snap.data[vIdx * snap.itemSize + p]);
        }
      }
      attrSnapshots.position.data[nextIdx * 3] = nx;
      attrSnapshots.position.data[nextIdx * 3 + 1] = ny;
      attrSnapshots.position.data[nextIdx * 3 + 2] = nz;
      const cloneIdx = nextIdx++;
      if (!clonesPerVertex.has(vIdx)) clonesPerVertex.set(vIdx, []);
      clonesPerVertex.get(vIdx).push(cloneIdx);
      return cloneIdx;
    });
    newIndices.push(clonedTri[0], clonedTri[1], clonedTri[2]);
  }
  for (const [vIdx, clones] of clonesPerVertex) {
    if (clones.length < 3) continue;
    const vPos = new THREE.Vector3(pos.getX(vIdx), pos.getY(vIdx), pos.getZ(vIdx));
    const vN = new THREE.Vector3(nrm ? nrm.getX(vIdx) : 0, nrm ? nrm.getY(vIdx) : 1, nrm ? nrm.getZ(vIdx) : 0).normalize();
    let tangent = new THREE.Vector3(1, 0, 0);
    if (Math.abs(vN.dot(tangent)) > 0.9) tangent.set(0, 1, 0);
    const bitangent = new THREE.Vector3().crossVectors(vN, tangent).normalize();
    const realTangent = new THREE.Vector3().crossVectors(bitangent, vN).normalize();
    clones.sort((a, b) => {
      const pa = new THREE.Vector3(attrSnapshots.position.data[a * 3], attrSnapshots.position.data[a * 3 + 1], attrSnapshots.position.data[a * 3 + 2]).sub(vPos);
      const pb = new THREE.Vector3(attrSnapshots.position.data[b * 3], attrSnapshots.position.data[b * 3 + 1], attrSnapshots.position.data[b * 3 + 2]).sub(vPos);
      const angleA = Math.atan2(pa.dot(bitangent), pa.dot(realTangent));
      const angleB = Math.atan2(pb.dot(bitangent), pb.dot(realTangent));
      return angleA - angleB;
    });
    for (let i = 1; i < clones.length - 1; i++) {
      newIndices.push(clones[0], clones[i], clones[i+1]);
    }
  }
  for (const name in attrSnapshots) {
    const snap = attrSnapshots[name];
    geo.setAttribute(name, new THREE.BufferAttribute(new snap.ctor(snap.data), snap.itemSize, snap.normalized));
  }
  geo.setIndex(newIndices);
  compactGeometry(geo);
  geo.computeVertexNormals();
  state.selectedVertices.clear();
  refreshAfterTopologyEdit();
  if (window.showToast) window.showToast(`Beveled ${clonesPerVertex.size} vertices.`);
}

function weldSelectedVertices() {
  if (!state.activeMesh || state.selectedVertices.size < 2) {
    if (window.showToast) window.showToast("Select at least 2 vertices to weld.");
    return;
  }
  
  saveState(state.activeMesh);
  const geo = state.activeMesh.geometry;
  const pos = geo.attributes.position;
  
  // Calculate center of all selected vertices
  const center = new THREE.Vector3();
  const sel = Array.from(state.selectedVertices);
  sel.forEach(idx => {
    center.x += pos.getX(idx);
    center.y += pos.getY(idx);
    center.z += pos.getZ(idx);
  });
  center.divideScalar(sel.length);
  
  // Move all selected vertices to the center
  sel.forEach(idx => {
    pos.setXYZ(idx, center.x, center.y, center.z);
  });
  
  pos.needsUpdate = true;
  compactGeometry(geo);
  geo.computeVertexNormals();
  refreshAfterTopologyEdit();
  if (window.showToast) window.showToast(`Welded ${sel.length} vertices.`);
}

function snapSelectedToGrid() {
  if (!state.activeMesh || state.selectedVertices.size === 0) return;
  
  saveState(state.activeMesh);
  const geo = state.activeMesh.geometry;
  const pos = geo.attributes.position;
  const grid = 0.1;
  
  state.selectedVertices.forEach(idx => {
    pos.setX(idx, Math.round(pos.getX(idx) / grid) * grid);
    pos.setY(idx, Math.round(pos.getY(idx) / grid) * grid);
    pos.setZ(idx, Math.round(pos.getZ(idx) / grid) * grid);
  });
  
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  refreshAfterTopologyEdit();
  if (window.showToast) window.showToast("Snapped to 0.1 grid.");
}

function appendVertexToGeometry(geo, x, y, z, sourceIdx = 0) {
  const newIdx = geo.attributes.position.count;
  for (const name in geo.attributes) {
    const attr = geo.attributes[name];
    const oldArr = attr.array;
    const newArr = new attr.array.constructor(oldArr.length + attr.itemSize);
    newArr.set(oldArr);
    
    // Copy attributes from source vertex if available, otherwise use defaults
    if (sourceIdx < attr.count) {
      for (let k = 0; k < attr.itemSize; k++) {
        newArr[oldArr.length + k] = attr.array[sourceIdx * attr.itemSize + k];
      }
    } else {
      // Fallbacks
      if (name === 'uv') { newArr[oldArr.length] = 0.5; newArr[oldArr.length + 1] = 0.5; }
      else if (name === 'normal') { newArr[oldArr.length] = 0; newArr[oldArr.length + 1] = 1; newArr[oldArr.length + 2] = 0; }
      else if (name === 'color') { newArr[oldArr.length] = 1; newArr[oldArr.length + 1] = 1; newArr[oldArr.length + 2] = 1; }
    }
    
    // Override position
    if (name === 'position') {
      newArr[oldArr.length] = x;
      newArr[oldArr.length + 1] = y;
      newArr[oldArr.length + 2] = z;
    }
    
    geo.setAttribute(name, new THREE.BufferAttribute(newArr, attr.itemSize, attr.normalized));
  }
  return newIdx;
}

function refreshAfterTopologyEdit() {
  if (!state.activeMesh) return;
  const mesh = state.activeMesh;
  const geo = mesh.geometry;
  
  // Recompute bounding volumes so the mesh doesn't get frustum-culled
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  
  // Refresh the brush — updateMesh re-caches position/normal AND rebuilds
  // spatial hash + adjacency map. rebuildGrid only rebuilds the hash.
  if (state.brush) state.brush.updateMesh(mesh);
  
  // Refresh UI overlays
  if (viewGizmo) viewGizmo.updateMesh(mesh);
  selectionBox.setFromObject(mesh);
  
  // Refresh wireframe overlay if visible
  if (wireframeLines.visible) {
    wireframeLines.geometry.dispose();
    wireframeLines.geometry = new THREE.WireframeGeometry(geo);
    wireframeLines.position.copy(mesh.position);
    wireframeLines.quaternion.copy(mesh.quaternion);
    wireframeLines.scale.copy(mesh.scale);
  }
  
  syncPointsCloud();
  updateEditGizmo();
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
  compactGeometry(geo);
  state.selectedVertices.clear();
  refreshAfterTopologyEdit();
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
  if (sel.length < 3) {
    if (window.showToast) window.showToast('Select at least 3 vertices.');
    return;
  }
  
  // Find ALL faces fully contained in the selection
  const facesToExtrude = [];
  for (let i = 0; i < index.length; i += 3) {
    const fv = [index[i], index[i+1], index[i+2]];
    if (fv.every(v => sel.includes(v))) {
      facesToExtrude.push(i / 3);
    }
  }
  
  const selectedFace = facesToExtrude.length > 0 ? facesToExtrude[0] : -1;
  
  if (selectedFace !== -1) {
    saveState(state.activeMesh);
    extrudeFaces(geometry, facesToExtrude);
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

document.getElementById("selectAllBtn").onclick = () => {
  if (!state.activeMesh) return;
  const count = state.activeMesh.geometry.attributes.position.count;
  for (let i = 0; i < count; i++) state.selectedVertices.add(i);
  syncPointsCloud();
  updateEditGizmo();
};

document.getElementById("invertSelBtn").onclick = () => {
  if (!state.activeMesh) return;
  const count = state.activeMesh.geometry.attributes.position.count;
  const newSel = new Set();
  for (let i = 0; i < count; i++) {
    if (!state.selectedVertices.has(i)) newSel.add(i);
  }
  state.selectedVertices = newSel;
  syncPointsCloud();
  updateEditGizmo();
};

document.getElementById("extrudeBtn").onclick = extrudeSelected;
document.getElementById("deleteVertexBtn").onclick = deleteSelectedVertices;
document.getElementById("weldBtn").onclick = weldSelectedVertices;
document.getElementById("snapBtn").onclick = snapSelectedToGrid;
document.getElementById("bevelBtn").onclick = () => bevelSelected(0.2);

document.getElementById("addVertexBtn").onclick = () => {
  if (!state.activeMesh) return;
  saveState(state.activeMesh);
  const geo = state.activeMesh.geometry;
  const pos = geo.attributes.position;
  
  // Find center of selection and a source vertex to copy data from
  const center = new THREE.Vector3(0, 0, 0);
  let sourceIdx = 0;
  
  if (state.selectedVertices.size > 0) {
    const sel = Array.from(state.selectedVertices);
    sourceIdx = sel[0]; // Copy weights/colors from the first selected vertex
    sel.forEach(idx => {
      center.x += pos.getX(idx);
      center.y += pos.getY(idx);
      center.z += pos.getZ(idx);
    });
    center.divideScalar(state.selectedVertices.size);
  }
  
  const newIdx = appendVertexToGeometry(geo, center.x, center.y, center.z, sourceIdx);
  geo.computeVertexNormals();
  state.selectedVertices.clear();
  state.selectedVertices.add(newIdx);
  refreshAfterTopologyEdit();
  if (window.showToast) window.showToast("Added and selected new vertex.");
};

document.getElementById("buildFaceBtn").onclick = () => {
  if (!state.activeMesh || state.selectedVertices.size < 3) {
    if (window.showToast) window.showToast("Select at least 3 vertices to build a face.");
    return;
  }
  saveState(state.activeMesh);
  const geo = state.activeMesh.geometry;
  if (!geo.index) return;
  
  const sel = Array.from(state.selectedVertices);
  const pos = geo.attributes.position;
  
  // Calculate winding order to face outwards
  const vA = new THREE.Vector3(pos.getX(sel[0]), pos.getY(sel[0]), pos.getZ(sel[0]));
  const vB = new THREE.Vector3(pos.getX(sel[1]), pos.getY(sel[1]), pos.getZ(sel[1]));
  const vC = new THREE.Vector3(pos.getX(sel[2]), pos.getY(sel[2]), pos.getZ(sel[2]));
  
  const normal = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA)).normalize();
  
  // Average normal of the selected vertices to check if we are pointing inwards
  const avgNormal = new THREE.Vector3();
  const nrm = geo.attributes.normal;
  if (nrm) {
    [sel[0], sel[1], sel[2]].forEach(idx => {
      avgNormal.x += nrm.getX(idx);
      avgNormal.y += nrm.getY(idx);
      avgNormal.z += nrm.getZ(idx);
    });
    avgNormal.normalize();
  }
  
  const indices = Array.from(geo.index.array);
  
  // If the face normal points opposite to the average normal, reverse the winding order
  if (nrm && normal.dot(avgNormal) < 0) {
    indices.push(sel[0], sel[2], sel[1]);
  } else {
    indices.push(sel[0], sel[1], sel[2]);
  }
  
  geo.setIndex(indices);
  geo.computeVertexNormals();
  refreshAfterTopologyEdit();
  if (window.showToast) window.showToast("Built new face.");
};
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
  
  if (state.ikEnabled && state.ikTarget && (!state.mixer || state.mixer.timeScale === 0)) state.solveIK();
  
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
