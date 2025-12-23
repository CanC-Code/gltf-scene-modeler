// js/ui.js
// Author: CCVO
// Purpose: Initializes and manages all UI elements and their interactions for GLTF Scene Modeler, including undo/redo, tool selection, and mesh creation.

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

  // Wireframe
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

  // Undo/Redo stacks
  state.undoStack = [];
  state.redoStack = [];

  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");

  undoBtn.onclick = () => {
    if (!state.activeMesh || state.undoStack.length === 0) return;
    const current = state.activeMesh.geometry.attributes.position.array.slice();
    state.redoStack.push(current);

    const prev = state.undoStack.pop();
    state.activeMesh.geometry.attributes.position.array.set(prev);
    state.activeMesh.geometry.attributes.position.needsUpdate = true;
    state.activeMesh.geometry.computeVertexNormals();
  };

  redoBtn.onclick = () => {
    if (!state.activeMesh || state.redoStack.length === 0) return;
    const current = state.activeMesh.geometry.attributes.position.array.slice();
    state.undoStack.push(current);

    const next = state.redoStack.pop();
    state.activeMesh.geometry.attributes.position.array.set(next);
    state.activeMesh.geometry.attributes.position.needsUpdate = true;
    state.activeMesh.geometry.computeVertexNormals();
  };
}
