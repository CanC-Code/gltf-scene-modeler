export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu"), menu = document.getElementById("menu");
  if (toggleMenu && menu) toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  const bottomPanel = document.getElementById("bottom-panel"), panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) panelHandle.addEventListener("pointerdown", () => bottomPanel.classList.toggle("expanded"));

  // --- Trackpad Modes ---
  const btnModeCamera = document.getElementById("btnModeCamera"), btnModeBrush = document.getElementById("btnModeBrush");
  if (btnModeCamera && btnModeBrush) {
    btnModeCamera.onclick = () => {
      state.setTrackpadMode('camera'); btnModeCamera.classList.add("active"); btnModeBrush.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span"); if (span) span.textContent = "Move Camera (Trackpad)";
    };
    btnModeBrush.onclick = () => {
      state.setTrackpadMode('brush'); btnModeBrush.classList.add("active"); btnModeCamera.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span"); 
      if (span) span.textContent = `Guide Brush: ${state.activeTool.charAt(0).toUpperCase() + state.activeTool.slice(1)}`;
    };
  }

  // --- Tool Selector Dropdown in Top Bar ---
  const toolSelBtn = document.getElementById("tool-selector-btn");
  const toolDropdown = document.getElementById("tool-dropdown");
  const toolOpts = document.querySelectorAll(".tool-opt");

  if (toolSelBtn && toolDropdown) {
    toolSelBtn.onclick = (e) => {
      e.stopPropagation();
      toolDropdown.classList.toggle("show");
    };

    document.addEventListener('click', (e) => {
      if (!toolDropdown.contains(e.target) && e.target !== toolSelBtn) {
        toolDropdown.classList.remove("show");
      }
    });

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

  // --- Top Bar Modes ---
  const pUndo = document.getElementById("panelUndoBtn"), pRedo = document.getElementById("panelRedoBtn");
  if (pUndo) pUndo.onclick = () => state.undo();
  if (pRedo) pRedo.onclick = () => state.redo();

  // Removed Edit Mode from here
  const modes = ["Sculpt", "Paint", "Move", "Rotate", "Scale"], paintOptions = document.getElementById("paintOptions");
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { const b = document.getElementById("tool" + x); if (b) b.classList.remove("active"); });
      btn.classList.add("active");
      if (paintOptions) paintOptions.style.display = (m === "Paint") ? "block" : "none";
    };
  });

  // --- Settings ---
  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) paintColorInput.oninput = e => state.setPaintColor(e.target.value);

  const bgColorInput = document.getElementById("bgColor");
  if (bgColorInput) bgColorInput.oninput = e => { if (state.scene) state.scene.background.set(e.target.value); };

  const sensInput = document.getElementById("trackpadSensitivity");
  if (sensInput) sensInput.oninput = e => { state.trackpadSensitivity = parseFloat(e.target.value); };

  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) toggleWire.onclick = () => { 
    state.toggleWireframe(); 
    toggleWire.classList.toggle("active", state.wireframe);
  };

  const newCube = document.getElementById("newCube"), newSphere = document.getElementById("newSphere");
  if (newCube) newCube.onclick = () => { state.createCube(); if (viewGizmo) viewGizmo.updateMesh(state.activeMesh); };
  if (newSphere) newSphere.onclick = () => { state.createSphere(); if (viewGizmo) viewGizmo.updateMesh(state.activeMesh); };

  const brushSize = document.getElementById("brushSize"), brushStrength = document.getElementById("brushStrength");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  const exportGltf = document.getElementById("exportGLTF"), importGltf = document.getElementById("importGLTF");
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF();
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  if (symmetryBtn) symmetryBtn.onclick = () => { symmetryEnabled = !symmetryEnabled; symmetryBtn.classList.toggle("active"); };
}
