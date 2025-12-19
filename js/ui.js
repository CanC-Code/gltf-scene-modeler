export function initUI(state) {
  /* ---------- Top Bar ---------- */
  const toggleMenuBtn = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");

  toggleMenuBtn.onclick = () => {
    menu.classList.toggle("collapsed");
  };

  const lockCameraBtn = document.getElementById("lockCamera");
  lockCameraBtn.onclick = () => {
    state.cameraLocked = !state.cameraLocked;
    state.controls.enabled = !state.cameraLocked;

    lockCameraBtn.textContent = state.cameraLocked
      ? "Camera Locked"
      : "Camera Free";

    lockCameraBtn.classList.toggle("active", state.cameraLocked);
    lockCameraBtn.classList.toggle("inactive", !state.cameraLocked);
  };

  const wireBtn = document.getElementById("toggleWire");
  wireBtn.onclick = () => {
    if (state.toggleWireframe) state.toggleWireframe();
  };

  /* ---------- Model ---------- */
  document.getElementById("newCube").onclick = () => {
    if (state.createCube) state.createCube();
  };
  document.getElementById("newSphere").onclick = () => {
    if (state.createSphere) state.createSphere();
  };

  /* ---------- Sculpt Tools ---------- */
  const tools = ["inflate", "deflate", "smooth", "flatten", "pinch", "clay", "scrape"];
  tools.forEach(tool => {
    const btn = document.getElementById(`tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
    if (btn) btn.onclick = () => state.setTool(tool);
  });

  const symmetryBtn = document.getElementById("toggleSymmetry");
  symmetryBtn.onclick = () => {
    state.symmetry = !state.symmetry;
    symmetryBtn.classList.toggle("active", state.symmetry);
    symmetryBtn.textContent = state.symmetry ? "Symmetry On" : "Symmetry Off";
  };

  /* ---------- Sliders ---------- */
  const sizeSlider = document.getElementById("brushSize");
  if (sizeSlider) sizeSlider.oninput = e => state.setRadius(parseFloat(e.target.value));

  const strengthSlider = document.getElementById("brushStrength");
  if (strengthSlider) strengthSlider.oninput = e => state.setStrength(parseFloat(e.target.value));

  /* ---------- File ---------- */
  const exportBtn = document.getElementById("exportGLTF");
  if (exportBtn && state.exportGLTF) exportBtn.onclick = state.exportGLTF;

  const importInput = document.getElementById("importGLTF");
  if (importInput && state.importGLTF) importInput.onchange = state.importGLTF;
}