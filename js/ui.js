// js/ui.js
export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");
  toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  // Bottom Panel Toggle
  const bottomPanel = document.getElementById("bottom-panel");
  document.getElementById("panel-handle").addEventListener("pointerdown", () => {
    bottomPanel.classList.toggle("expanded");
  });

  // Trackpad Mode Toggle
  const btnModeCamera = document.getElementById("btnModeCamera");
  const btnModeBrush = document.getElementById("btnModeBrush");
  
  btnModeCamera.onclick = () => {
    state.setTrackpadMode('camera');
    btnModeCamera.classList.add("active");
    btnModeBrush.classList.remove("active");
    document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
  };
  
  btnModeBrush.onclick = () => {
    state.setTrackpadMode('brush');
    btnModeBrush.classList.add("active");
    btnModeCamera.classList.remove("active");
    document.querySelector("#trackpad-surface span").textContent = "Guide Brush Cursor";
  };

  // Right Panel Undo/Redo
  document.getElementById("panelUndoBtn").onclick = () => state.undo();
  document.getElementById("panelRedoBtn").onclick = () => state.redo();

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
        paintOptions.style.display = (m === "Paint") ? "block" : "none";
      };
    }
  });

  // Paint Color Picker
  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) paintColorInput.oninput = (e) => state.setPaintColor(e.target.value);

  // Wireframe toggle
  document.getElementById("toggleWire").onclick = () => {
    state.wireframe = !state.wireframe;
    if (state.activeMesh) state.activeMesh.material.wireframe = state.wireframe;
  };

  // New Mesh buttons
  document.getElementById("newCube").onclick = () => {
    state.createCube();
    viewGizmo.updateMesh(state.activeMesh);
  };
  document.getElementById("newSphere").onclick = () => {
    state.createSphere();
    viewGizmo.updateMesh(state.activeMesh);
  };

  // Sculpt tools
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    if(btn) btn.onclick = () => state.brush?.setTool(t.toLowerCase());
  });

  // Brush sliders
  const brushSize = document.getElementById("brushSize");
  brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));

  const brushStrength = document.getElementById("brushStrength");
  brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  // Export / Import
  document.getElementById("exportGLTF").onclick = () => state.exportGLTF();
  document.getElementById("importGLTF").onchange = e => state.importGLTF?.(e);

  // Symmetry toggle
  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  symmetryBtn.onclick = () => {
    symmetryEnabled = !symmetryEnabled;
    symmetryBtn.classList.toggle("active");
  };
}
