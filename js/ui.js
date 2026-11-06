// js/ui.js
export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");
  if (toggleMenu && menu) toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  // Bottom Panel Toggle
  const bottomPanel = document.getElementById("bottom-panel");
  const panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) {
    panelHandle.addEventListener("pointerdown", () => {
      bottomPanel.classList.toggle("expanded");
    });
  }

  // Trackpad Mode Toggle
  const btnModeCamera = document.getElementById("btnModeCamera");
  const btnModeBrush = document.getElementById("btnModeBrush");
  
  if (btnModeCamera && btnModeBrush) {
    btnModeCamera.onclick = () => {
      state.setTrackpadMode('camera');
      btnModeCamera.classList.add("active");
      btnModeBrush.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span");
      if (span) span.textContent = "Move Camera (Trackpad)";
    };
    
    btnModeBrush.onclick = () => {
      state.setTrackpadMode('brush');
      btnModeBrush.classList.add("active");
      btnModeCamera.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span");
      if (span) span.textContent = "Guide Brush Cursor";
    };
  }

  // Right Panel Undo/Redo
  const pUndo = document.getElementById("panelUndoBtn");
  const pRedo = document.getElementById("panelRedoBtn");
  if (pUndo) pUndo.onclick = () => state.undo();
  if (pRedo) pRedo.onclick = () => state.redo();

  // Mode buttons
  const modes = ["Sculpt", "Paint", "Move", "Rotate", "Scale"];
  const paintOptions = document.getElementById("paintOptions");
  
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) {
      btn.onclick = () => {
        state.setMode(m.toLowerCase());
        modes.forEach(x => {
          const b = document.getElementById("tool" + x);
          if (b) b.classList.remove("active");
        });
        btn.classList.add("active");
        if (paintOptions) paintOptions.style.display = (m === "Paint") ? "block" : "none";
      };
    }
  });

  // Paint Color Picker
  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) paintColorInput.oninput = (e) => state.setPaintColor(e.target.value);

  // Wireframe toggle
  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) {
    toggleWire.onclick = () => {
      state.wireframe = !state.wireframe;
      if (state.activeMesh) state.activeMesh.material.wireframe = state.wireframe;
    };
  }

  // New Mesh buttons
  const newCube = document.getElementById("newCube");
  if (newCube) {
    newCube.onclick = () => {
      state.createCube();
      if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
    };
  }
  
  const newSphere = document.getElementById("newSphere");
  if (newSphere) {
    newSphere.onclick = () => {
      state.createSphere();
      if (viewGizmo) viewGizmo.updateMesh(state.activeMesh);
    };
  }

  // Sculpt tools
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    if(btn) btn.onclick = () => state.brush?.setTool(t.toLowerCase());
  });

  // Brush sliders
  const brushSize = document.getElementById("brushSize");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));

  const brushStrength = document.getElementById("brushStrength");
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  // Export / Import
  const exportGltf = document.getElementById("exportGLTF");
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF();
  
  const importGltf = document.getElementById("importGLTF");
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  // Symmetry toggle
  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  if (symmetryBtn) {
    symmetryBtn.onclick = () => {
      symmetryEnabled = !symmetryEnabled;
      symmetryBtn.classList.toggle("active");
    };
  }
}
