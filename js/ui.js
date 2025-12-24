// js/ui.js
// Author: CCVO
// Purpose: Initializes the UI controls for GLTF Scene Modeler, fully integrated with main.js and ViewGizmo

export function initUI(state) {
  const toggleMenu = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");
  toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  /* -----------------------------
     Mode Buttons (Sculpt, Move, Rotate, Scale)
  ------------------------------ */
  const modes = ["Sculpt", "Move", "Rotate", "Scale"];
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => document.getElementById("tool" + x).classList.remove("active"));
      btn.classList.add("active");
    };
  });

  /* -----------------------------
     Wireframe Toggle
  ------------------------------ */
  const wireBtn = document.getElementById("toggleWire");
  wireBtn.onclick = () => {
    if (!state.activeMesh) return;
    state.wireframe = !state.wireframe;
    state.activeMesh.material.wireframe = state.wireframe;
  };

  /* -----------------------------
     New Mesh Creation
  ------------------------------ */
  const cubeBtn = document.getElementById("newCube");
  cubeBtn.onclick = () => {
    state.createCube();
  };

  const sphereBtn = document.getElementById("newSphere");
  sphereBtn.onclick = () => {
    state.createSphere();
  };

  /* -----------------------------
     Sculpt Tools (Inflate, Deflate, Smooth, Flatten, Pinch)
  ------------------------------ */
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    btn.onclick = () => {
      if (state.brush) state.brush.setTool(t.toLowerCase());
    };
  });

  /* -----------------------------
     Brush Sliders (Size, Strength)
  ------------------------------ */
  const brushSize = document.getElementById("brushSize");
  brushSize.oninput = () => {
    if (state.brush) state.brush.setRadius(parseFloat(brushSize.value));
  };

  const brushStrength = document.getElementById("brushStrength");
  brushStrength.oninput = () => {
    if (state.brush) state.brush.setStrength(parseFloat(brushStrength.value));
  };

  /* -----------------------------
     Export / Import
  ------------------------------ */
  const exportBtn = document.getElementById("exportGLTF");
  exportBtn.onclick = () => state.exportGLTF();

  const importInput = document.getElementById("importGLTF");
  importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const loader = new THREE.ObjectLoader();
      const obj = loader.parse(JSON.parse(event.target.result));
      if (state.activeMesh) state.activeMesh.parent.remove(state.activeMesh);
      state.activeMesh = obj;
      state.brush = new SculptBrush(obj);
      state.setMode("move");
    };
    reader.readAsText(file);
  };

  /* -----------------------------
     Undo / Redo Buttons
  ------------------------------ */
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

  // Touch-friendly styling
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
