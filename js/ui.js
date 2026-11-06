export function initUI(state, viewGizmo) {
  const toggleMenu = document.getElementById("toggleMenu"), menu = document.getElementById("menu");
  if (toggleMenu && menu) toggleMenu.onclick = () => menu.classList.toggle("collapsed");

  const bottomPanel = document.getElementById("bottom-panel"), panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) panelHandle.addEventListener("pointerdown", () => bottomPanel.classList.toggle("expanded"));

  const btnModeCamera = document.getElementById("btnModeCamera"), btnModeBrush = document.getElementById("btnModeBrush");
  if (btnModeCamera && btnModeBrush) {
    btnModeCamera.onclick = () => {
      state.setTrackpadMode('camera'); btnModeCamera.classList.add("active"); btnModeBrush.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span"); if (span) span.textContent = "Move Camera (Trackpad)";
    };
    btnModeBrush.onclick = () => {
      state.setTrackpadMode('brush'); btnModeBrush.classList.add("active"); btnModeCamera.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span"); if (span) span.textContent = "Guide Brush / Select";
    };
  }

  const pUndo = document.getElementById("panelUndoBtn"), pRedo = document.getElementById("panelRedoBtn");
  if (pUndo) pUndo.onclick = () => state.undo();
  if (pRedo) pRedo.onclick = () => state.redo();

  const modes = ["Sculpt", "Paint", "Edit", "Move", "Rotate", "Scale"], paintOptions = document.getElementById("paintOptions");
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { const b = document.getElementById("tool" + x); if (b) b.classList.remove("active"); });
      btn.classList.add("active");
      if (paintOptions) paintOptions.style.display = (m === "Paint") ? "block" : "none";
    };
  });

  const paintColorInput = document.getElementById("paintColor");
  if (paintColorInput) paintColorInput.oninput = e => state.setPaintColor(e.target.value);

  const bgColorInput = document.getElementById("bgColor");
  if (bgColorInput) bgColorInput.oninput = e => { if (state.scene) state.scene.background.set(e.target.value); };

  const sensInput = document.getElementById("trackpadSensitivity");
  if (sensInput) sensInput.oninput = e => { state.trackpadSensitivity = parseFloat(e.target.value); };

  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) toggleWire.onclick = () => { 
    state.toggleWireframe(); 
    toggleWire.classList.toggle("active", state.wireframe);
  };

  const newCube = document.getElementById("newCube"), newSphere = document.getElementById("newSphere");
  if (newCube) newCube.onclick = () => { state.createCube(); if (viewGizmo) viewGizmo.updateMesh(state.activeMesh); };
  if (newSphere) newSphere.onclick = () => { state.createSphere(); if (viewGizmo) viewGizmo.updateMesh(state.activeMesh); };

  const tools = ["Inflate", "Deflate", "Smooth", "Flatten", "Pinch"];
  tools.forEach(t => { const btn = document.getElementById("tool" + t); if (btn) btn.onclick = () => state.brush?.setTool(t.toLowerCase()); });

  const brushSize = document.getElementById("brushSize"), brushStrength = document.getElementById("brushStrength");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  const exportGltf = document.getElementById("exportGLTF"), importGltf = document.getElementById("importGLTF");
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF();
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  const symmetryBtn = document.getElementById("toggleSymmetry");
  let symmetryEnabled = false;
  if (symmetryBtn) symmetryBtn.onclick = () => { symmetryEnabled = !symmetryEnabled; symmetryBtn.classList.toggle("active"); };
}
