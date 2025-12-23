// js/ui.js
// Author: CCVO
// Purpose: Initialize the UI elements and connect them to application state

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

  // Undo / Redo
  document.getElementById("undoBtn").onclick = () => {
    if (!state.activeMesh || state.undoStack.length === 0) return;
    const positions = state.undoStack.pop();
    if (positions) {
      const current = state.activeMesh.geometry.attributes.position.array.slice();
      state.redoStack.push(current);
      state.activeMesh.geometry.attributes.position.array.set(positions);
      state.activeMesh.geometry.attributes.position.needsUpdate = true;
      state.activeMesh.geometry.computeVertexNormals();
    }
  };

  document.getElementById("redoBtn").onclick = () => {
    if (!state.activeMesh || state.redoStack.length === 0) return;
    const positions = state.redoStack.pop();
    if (positions) {
      const current = state.activeMesh.geometry.attributes.position.array.slice();
      state.undoStack.push(current);
      state.activeMesh.geometry.attributes.position.array.set(positions);
      state.activeMesh.geometry.attributes.position.needsUpdate = true;
      state.activeMesh.geometry.computeVertexNormals();
    }
  };

  // Symmetry toggle
  state.symmetry = false;
  const symmetryBtn = document.getElementById("toggleSymmetry");
  symmetryBtn.onclick = () => {
    state.symmetry = !state.symmetry;
    symmetryBtn.style.background = state.symmetry ? "#4a90e2" : "#3a3a3a";
  };

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
}
