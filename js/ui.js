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

  const bindMultiBtn = document.getElementById("bindMulti");
  if (bindMultiBtn) bindMultiBtn.onclick = () => state.bindToActiveSkeleton();

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
  const matColorBtn = document.getElementById("mat-color-btn");
  const colorModal = document.getElementById("color-picker-modal");
  const colorClose = document.getElementById("color-picker-close");
  const cpApply = document.getElementById("cp-apply");
  const cpR = document.getElementById("cp-r"), cpG = document.getElementById("cp-g"), cpB = document.getElementById("cp-b");
  const cpHex = document.getElementById("cp-hex");
  const colorPreview = document.getElementById("color-preview");
  const cpComp = document.getElementById("cp-comp");
  const colorWheel = document.getElementById("color-wheel");
  const pickerTitle = document.getElementById("color-picker-title");

  let colorTarget = 'paint';

  const openColorPicker = (target) => {
    colorTarget = target;
    pickerTitle.textContent = target === 'paint' ? "Paint Color" : (target === 'background' ? "Background Color" : "Base Color");

    if (target === 'material' && state.activeMesh) {
      state.saveState(state.activeMesh);
    }

    const currentColor = target === 'paint' ? state.paintColor : 
                         target === 'background' ? state.scene.background : 
                         (state.activeMesh ? state.activeMesh.material.color : new THREE.Color(0xffffff));
                         
    cpR.value = Math.round(currentColor.r * 255);
    cpG.value = Math.round(currentColor.g * 255);
    cpB.value = Math.round(currentColor.b * 255);
    updatePreview();

    colorModal.classList.add("show");
  };

  if (colorBtn && colorModal) {
    colorBtn.onclick = () => openColorPicker('paint');
    if (bgBtn) bgBtn.onclick = () => openColorPicker('background');
    if (matColorBtn) matColorBtn.onclick = () => openColorPicker('material');

    colorClose.onclick = () => colorModal.classList.remove("show");
    
    cpApply.onclick = () => {
      const r = parseInt(cpR.value), g = parseInt(cpG.value), b = parseInt(cpB.value);
      const hex = `rgb(${r}, ${g}, ${b})`;
      
      if (colorTarget === 'paint') {
        state.setPaintColor(`#${new THREE.Color(r/255, g/255, b/255).getHexString()}`);
      } else if (colorTarget === 'background') {
        if (state.scene) state.scene.background.set(hex);
      } else if (colorTarget === 'material' && state.activeMesh) {
        state.activeMesh.material.color.set(hex);
        state.activeMesh.material.needsUpdate = true;
        if (state.updateMaterialPreview) state.updateMaterialPreview(state.activeMesh.material);
        if (matColorBtn) matColorBtn.style.background = '#' + state.activeMesh.material.color.getHexString();
        if (state.syncUI) state.syncUI();
      }
      colorModal.classList.remove("show");
    };

    const updatePreview = () => {
      const r = parseInt(cpR.value), g = parseInt(cpG.value), b = parseInt(cpB.value);
      const hex = `rgb(${r}, ${g}, ${b})`;
      colorPreview.style.background = hex;
      
      const hexStr = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
      if (cpHex) cpHex.value = hexStr;
      
      const color = new THREE.Color(r/255, g/255, b/255);
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      hsl.h = (hsl.h + 0.5) % 1.0;
      color.setHSL(hsl.h, hsl.s, hsl.l);
      if (cpComp) cpComp.style.background = '#' + color.getHexString();
    };

    cpR.oninput = updatePreview;
    cpG.oninput = updatePreview;
    cpB.oninput = updatePreview;
    
    if (cpHex) {
      cpHex.onchange = (e) => {
        const val = e.target.value.replace('#', '');
        if (val.length === 6) {
          const r = parseInt(val.substring(0, 2), 16);
          const g = parseInt(val.substring(2, 4), 16);
          const b = parseInt(val.substring(4, 6), 16);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            cpR.value = r; cpG.value = g; cpB.value = b;
            updatePreview();
          }
        }
      };
    }

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

    document.querySelectorAll('.swatch').forEach(sw => {
      sw.onclick = () => {
        const hex = sw.style.backgroundColor;
        const c = new THREE.Color(hex);
        cpR.value = Math.round(c.r * 255);
        cpG.value = Math.round(c.g * 255);
        cpB.value = Math.round(c.b * 255);
        updatePreview();
      };
    });
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
  const matRough = document.getElementById("mat-roughness");
  const matMetal = document.getElementById("mat-metalness");
  const matTex = document.getElementById("mat-texture");
  const matNormal = document.getElementById("mat-normal");

  const updateMaterialUI = (mesh) => {
    if (!mesh || !mesh.material) return;
    const m = mesh.material;
    const matColorBtn = document.getElementById('mat-color-btn');
    if (matColorBtn) matColorBtn.style.background = '#' + m.color.getHexString();
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
    if (state.updateMaterialPreview) state.updateMaterialPreview(m);
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

  const saveUVState = () => { if (state.activeMesh) state.saveState(state.activeMesh); };
  const uvScaleUEl = document.getElementById("uv-scale-u");
  const uvOffUEl = document.getElementById("uv-off-u");
  const uvScaleVEl = document.getElementById("uv-scale-v");
  const uvOffVEl = document.getElementById("uv-off-v");
  if (uvScaleUEl) uvScaleUEl.addEventListener('pointerdown', saveUVState);
  if (uvOffUEl) uvOffUEl.addEventListener('pointerdown', saveUVState);
  if (uvScaleVEl) uvScaleVEl.addEventListener('pointerdown', saveUVState);
  if (uvOffVEl) uvOffVEl.addEventListener('pointerdown', saveUVState);

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
    if (state.activeMesh) state.saveState(state.activeMesh);
    if (!state.activeMesh || !state.activeMesh.material || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.NoColorSpace; // Normal maps MUST be linear
      texture.flipY = false; // glTF standard
      state.activeMesh.material.normalMap = texture;
      state.activeMesh.material.needsUpdate = true;
      state.updateMaterialPreview(state.activeMesh.material);
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Normal Map applied!');
    });
  };

  const saveMatState = () => { if (state.activeMesh) state.saveState(state.activeMesh); };
  if (matColor) matColor.addEventListener('pointerdown', saveMatState);
  if (matRough) matRough.addEventListener('pointerdown', saveMatState);
  if (matMetal) matMetal.addEventListener('pointerdown', saveMatState);

  if (matColor) matColor.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.color.set(e.target.value);
      state.updateMaterialPreview(state.activeMesh.material);
    }
  };

  if (matRough) matRough.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.roughness = parseFloat(e.target.value);
      state.updateMaterialPreview(state.activeMesh.material);
    }
  };

  if (matMetal) matMetal.oninput = (e) => {
    if (state.activeMesh && state.activeMesh.material) {
      state.activeMesh.material.metalness = parseFloat(e.target.value);
      state.updateMaterialPreview(state.activeMesh.material);
    }
  };

  if (matTex) matTex.onchange = (e) => {
    if (state.activeMesh) state.saveState(state.activeMesh);
    if (!state.activeMesh || !state.activeMesh.material || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // glTF standard
      state.activeMesh.material.map = texture;
      state.activeMesh.material.needsUpdate = true;
      state.updateMaterialPreview(state.activeMesh.material);
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Texture applied!');
    });
  };

  // Sync UI when a new object is selected
  window.addEventListener('objectSelected', (e) => updateMaterialUI(e.detail));
  // Also sync on load
  updateMaterialUI(state.activeMesh);
}
