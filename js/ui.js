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

  const modes = ["Sculpt", "Paint", "Edit", "Rig", "Move", "Rotate", "Scale"];
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { const b = document.getElementById("tool" + x); if (b) b.classList.remove("active"); });
      btn.classList.add("active");
    };
  });

  // --- Focus Camera Button ---
  const focusBtn = document.getElementById("focus-camera-btn");
  if (focusBtn) focusBtn.onclick = () => state.focusCamera();

  // --- Custom Color Picker UI ---
  const colorBtn = document.getElementById("color-picker-btn");
  const colorModal = document.getElementById("color-picker-modal");
  const colorClose = document.getElementById("color-picker-close");
  const cpApply = document.getElementById("cp-apply");
  const cpR = document.getElementById("cp-r"), cpG = document.getElementById("cp-g"), cpB = document.getElementById("cp-b");
  const colorPreview = document.getElementById("color-preview");
  const colorWheel = document.getElementById("color-wheel");

  if (colorBtn && colorModal) {
    colorBtn.onclick = () => colorModal.classList.add("show");
    colorClose.onclick = () => colorModal.classList.remove("show");
    cpApply.onclick = () => {
      state.setPaintColor(`rgb(${cpR.value}, ${cpG.value}, ${cpB.value})`);
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

  const bgColorInput = document.getElementById("bgColor");
  if (bgColorInput) bgColorInput.oninput = e => { if (state.scene) state.scene.background.set(e.target.value); };

  const sensInput = document.getElementById("trackpadSensitivity");
  if (sensInput) sensInput.oninput = e => { state.trackpadSensitivity = parseFloat(e.target.value); };

  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) toggleWire.onclick = () => { state.toggleWireframe(); toggleWire.classList.toggle("active", state.wireframe); };

  const newCube = document.getElementById("newCube"), newSphere = document.getElementById("newSphere");
  if (newCube) newCube.onclick = () => state.addCube();
  if (newSphere) newSphere.onclick = () => state.addSphere();

  const brushSize = document.getElementById("brushSize"), brushStrength = document.getElementById("brushStrength");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  const exportGltf = document.getElementById("exportGLTF"), importGltf = document.getElementById("importGLTF");
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF();
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  const symmetryBtn = document.getElementById("toggleSymmetry");
  if (symmetryBtn) symmetryBtn.onclick = () => {
    state.symmetryEnabled = !state.symmetryEnabled;
    symmetryBtn.classList.toggle("active", state.symmetryEnabled);
  };
}
