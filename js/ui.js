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
        
        if (m === "Paint") {
          paintOptions.style.display = "block";
        } else {
          paintOptions.style.display = "none";
        }
      };
    }
  });

  // Paint Color Picker
  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) {
    paintColorInput.oninput = (e) => state.setPaintColor(e.target.value);
  }

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
  
  undoBtn.onclick = () => state.undo();
  redoBtn.onclick = () => state.redo();

  // Symmetry toggle
  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  symmetryBtn.onclick = () => {
    symmetryEnabled = !symmetryEnabled;
    symmetryBtn.classList.toggle("active");
  };
}
