// js/ui.js
// Author: CCVO
// Purpose: Initializes the UI controls for GLTF Scene Modeler, including top bar, menus, brush sliders, sculpt tools, and Undo/Redo buttons

export function initUI(state) {
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
  document.getElementById("toggleWire").onclick = state.toggleWireframe;

  // New Mesh
  document.getElementById("newCube").onclick = state.createCube;
  document.getElementById("newSphere").onclick = state.createSphere;

  // Sculpt tools
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    btn.onclick = () => state.setTool(t.toLowerCase());
  });

  // Brush sliders
  const brushSize = document.getElementById("brushSize");
  brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));

  const brushStrength = document.getElementById("brushStrength");
  brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  // Export / Import
  document.getElementById("exportGLTF").onclick = state.exportGLTF;
  document.getElementById("importGLTF").onchange = state.importGLTF;

  /* ===============================
     Undo / Redo Buttons
  ================================= */
  const topbar = document.getElementById("topbar");

  const undoBtn = document.createElement("button");
  undoBtn.textContent = "⎌ Undo";
  undoBtn.style.marginLeft = "8px";
  undoBtn.onclick = () => window.undo?.();

  const redoBtn = document.createElement("button");
  redoBtn.textContent = "↻ Redo";
  redoBtn.style.marginLeft = "4px";
  redoBtn.onclick = () => window.redo?.();

  topbar.appendChild(undoBtn);
  topbar.appendChild(redoBtn);

  // Make buttons touch-friendly
  [undoBtn, redoBtn].forEach(btn => {
    btn.style.padding = "6px 8px";
    btn.style.fontSize = "14px";
    btn.style.borderRadius = "4px";
    btn.style.background = "#3a3a3a";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
  });
}
