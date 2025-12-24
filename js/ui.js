// js/ui.js
// Author: CCVO
// Purpose: Initializes the UI controls for GLTF Scene Modeler

export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");
  toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  // Mode buttons
  const modes = ["Sculpt", "Move", "Rotate", "Scale"];
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => document.getElementById("tool" + x).classList.remove("active"));
      btn.classList.add("active");
    };
  });

  // Wireframe toggle
  document.getElementById("toggleWire").onclick = () => {
    state.wireframe = !state.wireframe;
    if (state.activeMesh) state.activeMesh.material.wireframe = state.wireframe;
  };

  // New Mesh buttons
  document.getElementById("newCube").onclick = () => {
    state.createCube();
    viewGizmo.updateMesh(state.activeMesh); // Fixed method name
  };
  document.getElementById("newSphere").onclick = () => {
    state.createSphere();
    viewGizmo.updateMesh(state.activeMesh); // Fixed method name
  };

  // Sculpt tools
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    btn.onclick = () => state.brush?.setTool(t.toLowerCase());
  });

  // Brush sliders
  const brushSize = document.getElementById("brushSize");
  brushSize.oninput = () => state.brush?.setRadius(parseFloat(brushSize.value));

  const brushStrength = document.getElementById("brushStrength");
  brushStrength.oninput = () => state.brush?.setStrength(parseFloat(brushStrength.value));

  // Export / Import
  document.getElementById("exportGLTF").onclick = () => state.exportGLTF();
  document.getElementById("importGLTF").onchange = e => state.importGLTF?.(e);

  /* ===============================
     Undo / Redo Buttons
  ================================= */
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  
  undoBtn.onclick = () => {
    state.undo();
  };

  redoBtn.onclick = () => {
    state.redo();
  };

  // Symmetry toggle
  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  symmetryBtn.onclick = () => {
    symmetryEnabled = !symmetryEnabled;
    symmetryBtn.classList.toggle("active");
  };
}