export function initUI(state) {
  /* ---------- Menu Toggle ---------- */

  const toggleMenuBtn = document.getElementById("toggleMenu");
  const menu = document.getElementById("menu");

  toggleMenuBtn.onclick = () => {
    menu.classList.toggle("collapsed");
  };

  /* ---------- Mode Buttons ---------- */

  const tools = {
    sculpt: document.getElementById("toolSculpt"),
    move: document.getElementById("toolMove"),
    rotate: document.getElementById("toolRotate"),
    scale: document.getElementById("toolScale")
  };

  function activate(btn) {
    Object.values(tools).forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }

  tools.sculpt.onclick = () => {
    state.setMode("sculpt");
    activate(tools.sculpt);
  };

  tools.move.onclick = () => {
    state.setMode("transform");
    state.setTransform("translate");
    activate(tools.move);
  };

  tools.rotate.onclick = () => {
    state.setMode("transform");
    state.setTransform("rotate");
    activate(tools.rotate);
  };

  tools.scale.onclick = () => {
    state.setMode("transform");
    state.setTransform("scale");
    activate(tools.scale);
  };

  /* ---------- Sculpt Tools ---------- */

  document.getElementById("toolInflate").onclick = () =>
    state.setTool("inflate");

  document.getElementById("toolDeflate").onclick = () =>
    state.setTool("deflate");

  document.getElementById("toolSmooth").onclick = () =>
    state.setTool("smooth");

  document.getElementById("toolFlatten").onclick = () =>
    state.setTool("flatten");

  document.getElementById("toolPinch").onclick = () =>
    state.setTool("pinch");

  /* ---------- Sliders ---------- */

  document.getElementById("brushSize").oninput = e =>
    state.setRadius(parseFloat(e.target.value));

  document.getElementById("brushStrength").oninput = e =>
    state.setStrength(parseFloat(e.target.value));

  /* ---------- Model ---------- */

  document.getElementById("newCube").onclick = () =>
    state.createCube();

  document.getElementById("newSphere").onclick = () =>
    state.createSphere();

  /* ---------- File ---------- */

  document.getElementById("toggleWire").onclick = () =>
    state.toggleWireframe();

  document.getElementById("exportGLTF").onclick = () =>
    state.exportGLTF();

  document.getElementById("importGLTF").onchange = e =>
    state.importGLTF(e);
}