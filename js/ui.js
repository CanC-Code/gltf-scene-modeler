// js/ui.js
// Author: CCVO
// Purpose: Initialize and manage UI for GLTF Scene Modeler (desktop and mobile), including tool buttons, sliders, file import/export, and undo/redo controls

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

  // Undo/Redo buttons
  const topbar = document.getElementById("topbar");

  const undoBtn = document.createElement("button");
  undoBtn.id = "undoBtn";
  undoBtn.textContent = "⟲ Undo";
  topbar.appendChild(undoBtn);

  const redoBtn = document.createElement("button");
  redoBtn.id = "redoBtn";
  redoBtn.textContent = "⟳ Redo";
  topbar.appendChild(redoBtn);

  // Undo/Redo handlers
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
