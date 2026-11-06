export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu"), menu = document.getElementById("menu");
  if (toggleMenu && menu) toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  const bottomPanel = document.getElementById("bottom-panel"), panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) {
    panelHandle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#tool-selector-container")) return;
      bottomPanel.classList.toggle("expanded");
    });
  }

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

  const showSkelBtn = document.getElementById("showSkeleton");
  if (showSkelBtn) showSkelBtn.onclick = () => {
    if (state.skeletonHelper) {
      state.skeletonHelper.visible = !state.skeletonHelper.visible;
      showSkelBtn.classList.toggle("active", state.skeletonHelper.visible);
    }
  };

  const modes = ["Sculpt", "Paint", "Rig", "Move", "Rotate", "Scale"], paintOptions = document.getElementById("paintOptions");
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { const b = document.getElementById("tool" + x); if (b) b.classList.remove("active"); });
      btn.classList.add("active");
      if (paintOptions) paintOptions.style.display = (m === "Paint") ? "block" : "none";
    };
  });

  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) paintColorInput.oninput = e => state.setPaintColor(e.target.value);

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
