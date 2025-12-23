// js/ui.js
// Author: CCVO
// Purpose: Initializes UI elements for the GLTF Scene Modeler; handles mode/tool selection, brush sliders, mesh creation, import/export, and undo/redo with mobile-friendly sizing.

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
  document.getElementById("toggleWire").onclick = () => state.toggleWireframe();

  // New Mesh buttons
  document.getElementById("newCube").onclick = () => state.createCube();
  document.getElementById("newSphere").onclick = () => state.createSphere();

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
  document.getElementById("exportGLTF").onclick = () => state.exportGLTF();
  document.getElementById("importGLTF").onchange = e => state.importGLTF(e);

  // Undo / Redo buttons (create dynamically for mobile/desktop)
  const undoBtn = document.createElement("button");
  undoBtn.id = "undoBtn";
  undoBtn.textContent = "Undo";
  undoBtn.style.fontSize = state.isTouch ? "1.5em" : "1em";
  undoBtn.style.margin = "4px";
  undoBtn.onclick = () => state.undo();

  const redoBtn = document.createElement("button");
  redoBtn.id = "redoBtn";
  redoBtn.textContent = "Redo";
  redoBtn.style.fontSize = state.isTouch ? "1.5em" : "1em";
  redoBtn.style.margin = "4px";
  redoBtn.onclick = () => state.redo();

  // Add to topbar
  const topbar = document.getElementById("topbar");
  topbar.appendChild(undoBtn);
  topbar.appendChild(redoBtn);

  // Optional: increase button hit area for touch devices
  if (state.isTouch) {
    [...document.querySelectorAll("#menu button, #topbar button")].forEach(btn => {
      btn.style.padding = "12px";
      btn.style.fontSize = "1.2em";
    });
  }
}
