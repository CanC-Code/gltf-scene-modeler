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
  const wireBtn = document.getElementById("toggleWire");
  if (wireBtn) {
    wireBtn.onclick = () => {
      state.wireframe = !state.wireframe;
      if (state.activeMesh) {
        state.activeMesh.material.wireframe = state.wireframe;
      }
    };
  }

  // New Mesh buttons
  const cubeBtn = document.getElementById("newCube");
  if (cubeBtn) cubeBtn.onclick = () => state.createCube();

  const sphereBtn = document.getElementById("newSphere");
  if (sphereBtn) sphereBtn.onclick = () => state.createSphere();

  // Sculpt tool buttons
  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => {
    const btn = document.getElementById("tool" + t);
    if (btn) {
      btn.onclick = () => {
        if (state.brush) state.brush.setTool(t.toLowerCase());
      };
    }
  });

  // Brush sliders
  const brushSize = document.getElementById("brushSize");
  if (brushSize) brushSize.oninput = () => {
    if (state.brush) state.brush.setRadius(parseFloat(brushSize.value));
  };

  const brushStrength = document.getElementById("brushStrength");
  if (brushStrength) brushStrength.oninput = () => {
    if (state.brush) state.brush.setStrength(parseFloat(brushStrength.value));
  };

  // Export / Import GLTF
  const exportBtn = document.getElementById("exportGLTF");
  if (exportBtn) exportBtn.onclick = () => state.exportGLTF();

  const importInput = document.getElementById("importGLTF");
  if (importInput) importInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const contents = evt.target.result;
      const loader = new THREE.GLTFLoader();
      loader.parse(contents, '', gltf => {
        if (state.activeMesh) state.activeMesh.geometry.dispose();
        if (state.activeMesh) state.activeMesh.material.dispose();
        state.activeMesh = gltf.scene.children[0];
        state.activeMesh.material = new THREE.MeshStandardMaterial({ color: 0x88ccff });
        state.brush = new SculptBrush(state.activeMesh);
        scene.add(state.activeMesh);
      });
    };
    reader.readAsArrayBuffer(file);
  };

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
