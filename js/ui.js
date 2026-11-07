import * as THREE from "../three/three.module.js";
import { applyUVProjection } from "./topology.js";

export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu"), menu = document.getElementById("menu");
  if (toggleMenu && menu) toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  const bottomPanel = document.getElementById("bottom-panel"), panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) {
    panelHandle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#tool-selector-container") || e.target.closest("#color-picker-btn") || e.target.closest("#focus-camera-btn")) return;
      bottomPanel.classList.toggle("expanded");
    });
  }

  // Toast Notification Helper
  window.showToast = (msg) => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const btnModeCamera = document.getElementById("btnModeCamera"), btnModeBrush = document.getElementById("btnModeBrush");
  if (btnModeCamera && btnModeBrush) {
    btnModeCamera.onclick = () => {
      state.setTrackpadMode('camera'); btnModeCamera.classList.add("active"); btnModeBrush.classList.remove("active");
      document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
    };
    btnModeBrush.onclick = () => {
      state.setTrackpadMode('brush'); btnModeBrush.classList.add("active"); btnModeCamera.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span");
      if (span) span.textContent = `Guide Brush: ${state.activeTool.charAt(0).toUpperCase() + state.activeTool.slice(1)}`;
    };
  }

  const toolSelBtn = document.getElementById("tool-selector-btn"), toolDropdown = document.getElementById("tool-dropdown"), toolOpts = document.querySelectorAll(".tool-opt");
  if (toolSelBtn && toolDropdown) {
    toolSelBtn.onclick = (e) => { e.stopPropagation(); toolDropdown.classList.toggle("show"); };
    document.addEventListener('click', (e) => { if (!toolDropdown.contains(e.target) && e.target !== toolSelBtn) toolDropdown.classList.remove("show"); });
    toolOpts.forEach(opt => {
      opt.onclick = () => {
        const toolName = opt.getAttribute("data-tool");
        state.setTool(toolName);
        toolOpts.forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        toolSelBtn.textContent = `Tool: ${opt.textContent} ▼`;
        if (state.trackpadMode === 'brush') {
          const span = document.querySelector("#trackpad-surface span");
          if (span) span.textContent = `Guide Brush: ${opt.textContent}`;
        }
        toolDropdown.classList.remove("show");
      };
    });
  }

  const pUndo = document.getElementById("panelUndoBtn"), pRedo = document.getElementById("panelRedoBtn");
  if (pUndo) pUndo.onclick = () => state.undo();
  if (pRedo) pRedo.onclick = () => state.redo();

  // Scene Object List UI
  const dupBtn = document.getElementById("duplicateObject"), delBtn = document.getElementById("deleteObject");
  if (dupBtn) dupBtn.onclick = () => state.duplicateObject();
  if (delBtn) delBtn.onclick = () => state.deleteObject();

  // Rigging UI
  const addBoneBtn = document.getElementById("addBoneChain");
  if (addBoneBtn) addBoneBtn.onclick = () => state.addBoneChain();

  const bindBtn = document.getElementById("bindSkin");
  if (bindBtn) bindBtn.onclick = () => state.bindSkin();

  const showSkelBtn = document.getElementById("showSkeleton");
  if (showSkelBtn) showSkelBtn.onclick = () => {
    if (state.skeletonHelper) {
      state.skeletonHelper.visible = !state.skeletonHelper.visible;
      showSkelBtn.classList.toggle("active", state.skeletonHelper.visible);
    }
  };

  const modes = ["Object", "Sculpt", "Paint", "Edit", "Rig", "Move", "Rotate", "Scale"];
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { const b = document.getElementById("tool" + x); if (b) b.classList.remove("active"); });
      btn.classList.add("active");
    };
  });

  // --- Top Bar Toggles ---
  const toggleEnv = document.getElementById("toggle-env");
  if (toggleEnv) toggleEnv.onclick = () => {
    state.toggleEnvironment();
    toggleEnv.classList.toggle("active", state.envEnabled);
  };

  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) toggleWire.onclick = () => { state.toggleWireframe(); toggleWire.classList.toggle("active", state.wireframe); };

  const toggleSnap = document.getElementById("toggleSnap");
  if (toggleSnap) toggleSnap.onclick = () => {
    state.snapEnabled = !state.snapEnabled;
    toggleSnap.classList.toggle("active", state.snapEnabled);
    state.updateSnap();
  };

  // --- Focus Camera Button ---
  const focusBtn = document.getElementById("focus-camera-btn");
  if (focusBtn) focusBtn.onclick = () => state.focusCamera();

  // --- Unified Custom Color Picker UI ---
  const colorBtn = document.getElementById("color-picker-btn");
  const bgBtn = document.getElementById("btn-bg-color");
  const colorModal = document.getElementById("color-picker-modal");
  const colorClose = document.getElementById("color-picker-close");
  const cpApply = document.getElementById("cp-apply");
  const cpR = document.getElementById("cp-r"), cpG = document.getElementById("cp-g"), cpB = document.getElementById("cp-b");
  const colorPreview = document.getElementById("color-preview");
  const colorWheel = document.getElementById("color-wheel");
  const pickerTitle = document.getElementById("color-picker-title");

  let colorTarget = 'paint'; // 'paint' or 'background'

  const openColorPicker = (target) => {
    colorTarget = target;
    pickerTitle.textContent = target === 'paint' ? "Paint Color" : "Background Color";
    
    // Initialize sliders with current color
    const currentColor = target === 'paint' ? state.paintColor : state.scene.background;
    cpR.value = Math.round(currentColor.r * 255);
    cpG.value = Math.round(currentColor.g * 255);
    cpB.value = Math.round(currentColor.b * 255);
    updatePreview();
    
    colorModal.classList.add("show");
  };

  if (colorBtn && colorModal) {
    colorBtn.onclick = () => openColorPicker('paint');
    if (bgBtn) bgBtn.onclick = () => openColorPicker('background');
    
    colorClose.onclick = () => colorModal.classList.remove("show");
    cpApply.onclick = () => {
      const hex = `rgb(${cpR.value}, ${cpG.value}, ${cpB.value})`;
      if (colorTarget === 'paint') {
        state.setPaintColor(hex);
      } else {
        if (state.scene) state.scene.background.set(hex);
      }
      colorModal.classList.remove("show");
    };

    const updatePreview = () => {
      const hex = `rgb(${cpR.value}, ${cpG.value}, ${cpB.value})`;
      colorPreview.style.background = hex;
    };

    cpR.oninput = updatePreview;
    cpG.oninput = updatePreview;
    cpB.oninput = updatePreview;

    // Draw Color Wheel
    const ctx = colorWheel.getContext('2d');
    const radius = colorWheel.width / 2;
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius, startAngle, endAngle);
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
    ctx.fill();

    colorWheel.onpointerdown = (e) => {
       const rect = colorWheel.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       const data = ctx.getImageData(x, y, 1, 1).data;
       cpR.value = data[0]; cpG.value = data[1]; cpB.value = data[2];
       updatePreview();
    };
  }

  // --- Sliders in Bottom Panel ---
  const sensInput = document.getElementById("trackpadSensitivity");
  if (sensInput) sensInput.oninput = e => { state.trackpadSensitivity = parseFloat(e.target.value); };

  const brushSize = document.getElementById("brushSize"), brushStrength = document.getElementById("brushStrength");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  const newCube = document.getElementById("newCube"), newSphere = document.getElementById("newSphere");
  if (newCube) newCube.onclick = () => state.addCube();
  if (newSphere) newSphere.onclick = () => state.addSphere();

  const exportGltf = document.getElementById("exportGLTF"), importGltf = document.getElementById("importGLTF");
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF();
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  const saveProj = document.getElementById("saveProject"), loadProj = document.getElementById("loadProject");
  if (saveProj) saveProj.onclick = () => state.saveProject();
  if (loadProj) loadProj.onchange = e => state.loadProject(e);

  const toggleProp = document.getElementById("toggleProp");
  if (toggleProp) toggleProp.onclick = () => {
    state.proportionalEnabled = !state.proportionalEnabled;
    toggleProp.classList.toggle("active", state.proportionalEnabled);
    if (window.showToast) window.showToast(`Proportional Edit ${state.proportionalEnabled ? 'ON' : 'OFF'}`);
  };

  const propRadius = document.getElementById("propRadius");
  if (propRadius) propRadius.oninput = (e) => {
    state.proportionalRadius = parseFloat(e.target.value);
  };

  const symmetryBtn = document.getElementById("toggleSymmetry");
  if (symmetryBtn) symmetryBtn.onclick = () => {
    state.symmetryEnabled = !state.symmetryEnabled;
    symmetryBtn.classList.toggle("active", state.symmetryEnabled);
  };

  // --- Material Properties Panel ---
  const matColor = document.getElementById("mat-color");
  const matRough = document.getElementById("mat-roughness");
  const matMetal = document.getElementById("mat-metalness");
  const matTex = document.getElementById("mat-texture");
  const matNormal = document.getElementById("mat-normal");

  const updateMaterialUI = (mesh) => {
    if (!mesh || !mesh.material) return;
    const m = mesh.material;
    if (matColor) matColor.value = '#' + m.color.getHexString();
    if (matRough) matRough.value = m.roughness;
    if (matMetal) matMetal.value = m.metalness;
    if (matTex) matTex.value = ''; // Reset file input
    if (matNormal) matNormal.value = '';
    if (document.getElementById('uv-scale-u')) {
      document.getElementById('uv-scale-u').value = 1;
      document.getElementById('uv-off-u').value = 0;
      document.getElementById('uv-scale-v').value = 1;
      document.getElementById('uv-off-v').value = 0;
    }
    if (state.updateUVPreview) state.updateUVPreview();
  };

  const applyUV = (type) => {
    if (!state.activeMesh) return;
    applyUVProjection(state.activeMesh.geometry, type);
    state.activeMesh.geometry.attributes.uv.needsUpdate = true;
    state.cacheBaseUVs();
    
    // If painting, the canvas might need a repaint if they just set the unwrap
    if (state.activeMesh.userData.paintTexture) {
      state.activeMesh.userData.paintTexture.needsUpdate = true;
    }
    if (window.showToast) window.showToast(`Applied ${type} UV unwrap.`);
  };

  const btnUVPlanar = document.getElementById("uv-planar");
  const btnUVCyl = document.getElementById("uv-cyl");
  const btnUVSph = document.getElementById("uv-sph");
  const uvScaleU = document.getElementById("uv-scale-u");
  const uvOffU = document.getElementById("uv-off-u");
  const uvScaleV = document.getElementById("uv-scale-v");
  const uvOffV = document.getElementById("uv-off-v");
  const uvReset = document.getElementById("uv-reset");

  const applyUVSliders = () => {
    if (!uvScaleU) return;
    state.applyUVTransform(
      parseFloat(uvScaleU.value), parseFloat(uvOffU.value),
      parseFloat(uvScaleV.value), parseFloat(uvOffV.value)
    );
  };

  if (uvScaleU) uvScaleU.oninput = applyUVSliders;
  if (uvOffU) uvOffU.oninput = applyUVSliders;
  if (uvScaleV) uvScaleV.oninput = applyUVSliders;
  if (uvOffV) uvOffV.oninput = applyUVSliders;

  if (uvReset) uvReset.onclick = () => {
    if (uvScaleU) uvScaleU.value = 1;
    if (uvOffU) uvOffU.value = 0;
    if (uvScaleV) uvScaleV.value = 1;
    if (uvOffV) uvOffV.value = 0;
    applyUVSliders();
    if (window.showToast) window.showToast('UVs reset');
  };

  if (btnUVPlanar) btnUVPlanar.onclick = () => applyUV('planar');
  if (btnUVCyl) btnUVCyl.onclick = () => applyUV('cylindrical');
  if (btnUVSph) btnUVSph.onclick = () => applyUV('spherical');

  const btnNewTex = document.getElementById("btn-new-texture");
  if (btnNewTex) btnNewTex.onclick = () => {
    if (!state.activeMesh) return;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false; // glTF standard
    
    state.activeMesh.userData.paintCanvas = canvas;
    state.activeMesh.userData.paintTexture = texture;
    state.activeMesh.material.map = texture;
    state.activeMesh.material.needsUpdate = true;
    
    if (window.showToast) window.showToast('Canvas ready! Switch to Paint mode.');
  };

  if (matNormal) matNormal.onchange = (e) => {
    if (!state.activeMesh || !state.activeMesh.material || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.NoColorSpace; // Normal maps MUST be linear
      texture.flipY = false; // glTF standard
      state.activeMesh.material.normalMap = texture;
      state.activeMesh.material.needsUpdate = true;
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Normal Map applied!');
    });
  };

  if (matColor) matColor.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.color.set(e.target.value);
    }
  };

  if (matRough) matRough.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.roughness = parseFloat(e.target.value);
    }
  };

  if (matMetal) matMetal.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.metalness = parseFloat(e.target.value);
    }
  };

  if (matTex) matTex.onchange = (e) => {
    if (!state.activeMesh || !state.activeMesh.material || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // glTF standard
      state.activeMesh.material.map = texture;
      state.activeMesh.material.needsUpdate = true;
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Texture applied!');
    });
  };

  // Sync UI when a new object is selected
  window.addEventListener('objectSelected', (e) => updateMaterialUI(e.detail));
  // Also sync on load
  updateMaterialUI(state.activeMesh);
}
