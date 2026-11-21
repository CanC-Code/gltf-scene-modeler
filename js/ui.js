import * as THREE from "../three/three.module.js";
import { applyUVProjection } from "./topology.js";

export function initUI(state, viewGizmo) {
  const matColorBtn = document.getElementById("mat-color-btn");

  // Material Preset buttons
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.onclick = () => {
      const presetName = btn.getAttribute('data-preset');
      state.applyMaterialPreset(presetName);
    };
  });

  // --- Settings Modal Logic ---
  const settingsModal = document.getElementById("settings-modal");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettings = document.getElementById("close-settings");
  if (settingsBtn && settingsModal) {
    settingsBtn.onclick = () => settingsModal.style.display = "flex";
    if (closeSettings) closeSettings.onclick = () => settingsModal.style.display = "none";
    settingsModal.onclick = (e) => {
      if (e.target === settingsModal) settingsModal.style.display = "none";
    };
  }
  const toggleMenu = document.getElementById("toggleMenu"), menu = document.getElementById("menu"), backdrop = document.getElementById("menu-backdrop");
  
  const toggleMenuDrawer = () => {
    if (!menu) return;
    const isCollapsed = menu.classList.toggle("collapsed");
    if (backdrop) backdrop.style.display = isCollapsed ? "none" : "block";
  };

  if (toggleMenu) toggleMenu.onclick = toggleMenuDrawer;
  if (backdrop) backdrop.onclick = toggleMenuDrawer;

  const bottomPanel = document.getElementById("bottom-panel"), panelHandle = document.getElementById("panel-handle");
  if (bottomPanel && panelHandle) {
    panelHandle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#tool-selector-container") || e.target.closest("#color-picker-btn") || e.target.closest("#focus-camera-btn") || e.target.closest("#sculpt-mirror-bar") || e.target.closest("#sculpt-right-popups")) return;
      bottomPanel.classList.toggle("expanded");
    });
  }

  // Toast Notification Helper
  window.showToast = (msg) => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const btnModeCamera = document.getElementById("btnModeCamera"), btnModeBrush = document.getElementById("btnModeBrush");
  if (btnModeCamera && btnModeBrush) {
    btnModeCamera.onclick = () => {
      state.setTrackpadMode('camera'); btnModeCamera.classList.add("active"); btnModeBrush.classList.remove("active");
      document.querySelector("#trackpad-surface span").textContent = "Move Camera (Trackpad)";
    };
    btnModeBrush.onclick = () => {
      state.setTrackpadMode('brush'); btnModeBrush.classList.add("active"); btnModeCamera.classList.remove("active");
      const span = document.querySelector("#trackpad-surface span");
      if (span) span.textContent = `Guide Brush: ${state.activeTool.charAt(0).toUpperCase() + state.activeTool.slice(1)}`;
    };
  }

  const toolSelBtn = document.getElementById("tool-selector-btn"), toolDropdown = document.getElementById("tool-dropdown"), toolOpts = document.querySelectorAll(".tool-opt");
  const TOOL_ICON_PRIMITIVES = {
    inflate: [["path", { d: "M4 17c3-6 13-6 16 0" }], ["path", { d: "M12 4v8" }], ["path", { d: "M9 7l3-3 3 3" }]],
    deflate: [["path", { d: "M4 12c3 5 13 5 16 0" }], ["path", { d: "M12 5v8" }], ["path", { d: "M9 10l3 3 3-3" }]],
    smooth: [["path", { d: "M3 15c3-5 6 5 9 0s6 5 9 0" }], ["path", { d: "M5 19h14" }]],
    flatten: [["path", { d: "M4 16l6-6 4 3 6-3" }], ["path", { d: "M4 19h16" }]],
    pinch: [["path", { d: "M4 7l6 5-6 5" }], ["path", { d: "M20 7l-6 5 6 5" }], ["line", { x1: "12", y1: "5", x2: "12", y2: "19" }]],
    grab: [["path", { d: "M18 11V6a2 2 0 0 0-4 0v5" }], ["path", { d: "M14 10V5a2 2 0 0 0-4 0v6" }], ["path", { d: "M10 10.5V7a2 2 0 0 0-4 0v8l3 4h6a4 4 0 0 0 4-4v-3a2 2 0 0 0-4 0" }]],
    clay: [["path", { d: "M4 18c2-7 14-7 16 0z" }], ["path", { d: "M8 11c1-3 7-3 8 0" }]],
    crease: [["path", { d: "M4 8l8 9 8-9" }], ["path", { d: "M12 17v4" }]],
    scrape: [["path", { d: "M4 13l12-6 4 4-12 6z" }], ["path", { d: "M4 19h16" }]],
    fill: [["path", { d: "M4 18h16" }], ["path", { d: "M5 12c2 4 12 4 14 0v6H5z" }], ["path", { d: "M12 5v6" }]],
    elastic: [["path", { d: "M4 14c4-8 12 8 16 0" }], ["circle", { cx: "12", cy: "12", r: "2" }]]
  };
  const buildToolSvg = (toolName, sourceSvg) => {
    const svgNs = "http://www.w3.org/2000/svg";
    const freshSvg = document.createElementNS(svgNs, "svg");
    const vb = (sourceSvg && sourceSvg.getAttribute("viewBox")) || "0 0 24 24";
    freshSvg.setAttributeNS(null, "viewBox", vb);
    freshSvg.setAttributeNS(null, "width", "15");
    freshSvg.setAttributeNS(null, "height", "15");
    freshSvg.setAttributeNS(null, "fill", "none");
    freshSvg.setAttributeNS(null, "stroke", "#ffffff");
    freshSvg.setAttributeNS(null, "stroke-width", "2");
    freshSvg.setAttributeNS(null, "stroke-linecap", "round");
    freshSvg.setAttributeNS(null, "stroke-linejoin", "round");
    freshSvg.style.cssText = "display:inline-block;width:15px;height:15px;min-width:15px;min-height:15px;flex-shrink:0;overflow:visible;";
    const prims = TOOL_ICON_PRIMITIVES[toolName];
    if (prims) {
      prims.forEach(([tag, attrs]) => {
        const el = document.createElementNS(svgNs, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttributeNS(null, k, v));
        freshSvg.appendChild(el);
      });
      return freshSvg;
    }
    if (!sourceSvg || !sourceSvg.children.length) return null;
    Array.from(sourceSvg.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      const el = document.createElementNS(svgNs, tag);
      Array.from(child.attributes).forEach((attr) => {
        el.setAttributeNS(null, attr.name, attr.value);
      });
      freshSvg.appendChild(el);
    });
    return freshSvg;
  };
  const syncToolSelectorButton = (opt) => {
    if (!toolSelBtn || !opt) return;
    const spanLabel = opt.querySelector("span");
    const label = (spanLabel ? spanLabel.textContent : opt.textContent).trim();
    const toolName = (opt.getAttribute("data-tool") || label).toLowerCase();
    const iconSvg = buildToolSvg(toolName, opt.querySelector("svg"));
    toolSelBtn.replaceChildren();
    if (iconSvg) {
      toolSelBtn.appendChild(iconSvg);
    }
    const textNode = document.createElement("span");
    textNode.textContent = `Tool: ${label} ▼`;
    toolSelBtn.appendChild(textNode);
  };
  if (toolSelBtn && toolDropdown) {
    const initialActive = toolDropdown.querySelector(".tool-opt.active") || toolOpts[0];
    if (initialActive) syncToolSelectorButton(initialActive);
    toolSelBtn.onclick = (e) => { e.stopPropagation(); toolDropdown.classList.toggle("show"); };
    document.addEventListener('click', (e) => { if (!toolDropdown.contains(e.target) && e.target !== toolSelBtn) toolDropdown.classList.remove("show"); });
    toolOpts.forEach(opt => {
      opt.onclick = () => {
        const label = opt.textContent.trim();
        const toolName = opt.getAttribute("data-tool");
        state.setTool(toolName);
        toolOpts.forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        syncToolSelectorButton(opt);
        if (state.trackpadMode === 'brush') {
          const span = document.querySelector("#trackpad-surface span");
          if (span) span.textContent = `Guide Brush: ${label}`;
        }
        toolDropdown.classList.remove("show");
      };
    });
  }

  const pUndo = document.getElementById("panelUndoBtn"), pRedo = document.getElementById("panelRedoBtn");
  if (pUndo) pUndo.onclick = () => state.undo();
  if (pRedo) pRedo.onclick = () => state.redo();

  // Scene Object List UI
  const dupBtn = document.getElementById("duplicateObject"), delBtn = document.getElementById("deleteObject");
  if (dupBtn) dupBtn.onclick = () => state.duplicateObject();
  if (delBtn) delBtn.onclick = () => state.deleteObject();
  
  const applyBtn = document.getElementById("applyTransform");
  const centerBtn = document.getElementById("centerOrigin");
  if (applyBtn) applyBtn.onclick = () => state.applyTransform();
  if (centerBtn) centerBtn.onclick = () => state.centerOrigin();

  const subdivideBtn = document.getElementById("subdivideBtn");
  if (subdivideBtn) subdivideBtn.onclick = () => state.subdivideMesh();

  const decimateBtn = document.getElementById("decimateBtn");
  if (decimateBtn) decimateBtn.onclick = () => state.decimateMesh();

  // Rigging UI
  const addBoneBtn = document.getElementById("addBoneChain");
  if (addBoneBtn) addBoneBtn.onclick = () => state.addBoneChain();
  
  const addChildBoneBtn = document.getElementById("addChildBone");
  if (addChildBoneBtn) addChildBoneBtn.onclick = () => state.addChildBone();

  const deleteBoneBtn = document.getElementById("deleteBone");
  if (deleteBoneBtn) deleteBoneBtn.onclick = () => state.deleteBone();

  const rollSlider = document.getElementById("bone-roll");
  if (rollSlider) {
    rollSlider.oninput = (e) => {
      state.setBoneRoll(parseFloat(e.target.value));
      if (state.mode === 'rig') state.updateBoneList();
    };
  }
  
  const renameBoneBtn = document.getElementById("renameBone");
  if (renameBoneBtn) renameBoneBtn.onclick = () => state.renameBone();

  const bindBtn = document.getElementById("bindSkin");
  if (bindBtn) bindBtn.onclick = () => state.bindSkin();

  const bindMultiBtn = document.getElementById("bindMulti");
  if (bindMultiBtn) bindMultiBtn.onclick = () => state.bindToActiveSkeleton();

  const ikBtn = document.getElementById("enableIKBtn");
  if (ikBtn) {
    ikBtn.onclick = () => {
      if (state.ikEnabled) {
        state.disableIK();
        ikBtn.textContent = "Enable IK on Active Bone";
        ikBtn.style.background = "#ff4081";
      } else {
        state.enableIK();
        if (state.ikEnabled) {
          ikBtn.textContent = "Disable IK";
          ikBtn.style.background = "#d32f2f";
        }
      }
    };
  }

  const transformBtn = document.getElementById("transformBtn");
  const transformMenu = document.getElementById("transformMenu");
  if (transformBtn && transformMenu) {
    transformBtn.onclick = (e) => {
      e.stopPropagation();
      const rect = transformBtn.getBoundingClientRect();
      transformMenu.style.position = "fixed";
      transformMenu.style.top = `${rect.bottom + 4}px`;
      transformMenu.style.left = `${rect.left}px`;
      transformMenu.style.display = transformMenu.style.display === "none" ? "flex" : "none";
    };
    document.addEventListener("click", (e) => { if (transformMenu && !transformMenu.contains(e.target) && !transformBtn.contains(e.target)) transformMenu.style.display = "none"; });
  }

  const viewBtn = document.getElementById("viewBtn");
  const viewMenu = document.getElementById("viewMenu");
  if (viewBtn && viewMenu) {
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      const rect = viewBtn.getBoundingClientRect();
      viewMenu.style.position = "fixed";
      viewMenu.style.top = `${rect.bottom + 4}px`;
      viewMenu.style.left = `${rect.left}px`;
      viewMenu.style.display = viewMenu.style.display === "none" ? "flex" : "none";
    };
    document.addEventListener("click", (e) => { if (viewMenu && !viewMenu.contains(e.target) && !viewBtn.contains(e.target)) viewMenu.style.display = "none"; });
  }

  const toggleGridBtn = document.getElementById("toggleGrid");
  if (toggleGridBtn) toggleGridBtn.onclick = () => state.toggleGrid();

  const symXBtn = document.getElementById("symXBtn");
  const symYBtn = document.getElementById("symYBtn");
  if (symXBtn) symXBtn.onclick = () => {
    state.symmetryX = !state.symmetryX;
    symXBtn.textContent = `⇹ Symmetry X: ${state.symmetryX ? 'ON' : 'OFF'}`;
    symXBtn.style.color = state.symmetryX ? '#4a90e2' : '#fff';
  };
  if (symYBtn) symYBtn.onclick = () => {
    state.symmetryY = !state.symmetryY;
    symYBtn.textContent = `⇕ Symmetry Y: ${state.symmetryY ? 'ON' : 'OFF'}`;
    symYBtn.style.color = state.symmetryY ? '#4a90e2' : '#fff';
  };

  const viewFocusBtn = document.getElementById("viewFocusBtn");
  if (viewFocusBtn) viewFocusBtn.onclick = () => { state.focusCamera(); if (viewMenu) viewMenu.style.display = "none"; };

  const modes = ["Object", "Sculpt", "Paint", "Edit", "Rig", "Move", "Rotate", "Scale"];
  modes.forEach(m => {
    const btn = document.getElementById("tool" + m);
    if (btn) btn.onclick = () => {
      state.setMode(m.toLowerCase());
      modes.forEach(x => { 
        const b = document.getElementById("tool" + x); 
        if (b) b.classList.remove("active"); 
      });
      
      // Update Transform button: highlight + label (min-width prevents jitter)
      if (["move", "rotate", "scale"].includes(m.toLowerCase())) {
        if (transformBtn) {
          transformBtn.classList.add("active");
          transformBtn.textContent = m + " ▼";
        }
      } else {
        if (transformBtn) {
          transformBtn.classList.remove("active");
          transformBtn.textContent = "Transform ▼";
        }
      }
      
      btn.classList.add("active");
      if (transformMenu) transformMenu.style.display = "none";
    };
  });

  // --- Top Bar Toggles ---
  const toggleEnv = document.getElementById("toggle-env");
  if (toggleEnv) toggleEnv.onclick = () => {
    state.toggleEnvironment();
    toggleEnv.classList.toggle("active", state.envEnabled);
  };

  const toggleWire = document.getElementById("toggleWire");
  if (toggleWire) toggleWire.onclick = () => { 
    state.toggleWireframe(); 
    toggleWire.classList.toggle("active", state.wireframe); 
    if (viewMenu) viewMenu.style.display = "none";
  };

  const toggleSnap = document.getElementById("toggleSnap");
  if (toggleSnap) toggleSnap.onclick = () => {
    state.snapEnabled = !state.snapEnabled;
    toggleSnap.classList.toggle("active", state.snapEnabled);
    state.updateSnap();
    if (viewMenu) viewMenu.style.display = "none";
  };

  // --- Focus Camera Button ---


  // --- Unified Custom Color Picker UI ---
  const colorBtn = document.getElementById("color-picker-btn");

  // Sculpt-mode inline Mirror (X, Y, Z) on left/center + right-side vertical Size & Strength popups
  const toolContainer = document.getElementById("tool-selector-container");
  const toolbarParent = toolContainer ? toolContainer.parentElement : null;

  let sculptMirrorBar = document.getElementById("sculpt-mirror-bar");
  if (!sculptMirrorBar && toolContainer) {
    sculptMirrorBar = document.createElement("div");
    sculptMirrorBar.id = "sculpt-mirror-bar";
    sculptMirrorBar.style.cssText = "display:none;align-items:center;gap:3px;margin-left:4px;font-size:11px;flex-shrink:0;position:relative;z-index:45;";
    sculptMirrorBar.innerHTML = `
      <span style="opacity:0.75;margin-right:1px;">M:</span>
      <button type="button" id="mirrorBtnX" style="padding:4px 7px;border-radius:4px;border:1px solid #555;background:#3a3a3a;color:#ddd;font-size:11px;font-weight:bold;cursor:pointer;touch-action:manipulation;">X</button>
      <button type="button" id="mirrorBtnY" style="padding:4px 7px;border-radius:4px;border:1px solid #555;background:#3a3a3a;color:#ddd;font-size:11px;font-weight:bold;cursor:pointer;touch-action:manipulation;">Y</button>
      <button type="button" id="mirrorBtnZ" style="padding:4px 7px;border-radius:4px;border:1px solid #555;background:#3a3a3a;color:#ddd;font-size:11px;font-weight:bold;cursor:pointer;touch-action:manipulation;">Z</button>
    `;
    toolContainer.insertAdjacentElement("afterend", sculptMirrorBar);
  }

  const sizeInput = document.getElementById("brushSize");
  const strengthInput = document.getElementById("brushStrength");
  const sizeRow = sizeInput ? (sizeInput.closest("div") || sizeInput.parentElement) : null;
  const strengthRow = strengthInput ? (strengthInput.closest("div") || strengthInput.parentElement) : null;

  if (colorBtn && sculptMirrorBar) {
    colorBtn.style.cssText = "width:22px;height:22px;border-radius:4px;border:1.5px solid #fff;cursor:pointer;flex-shrink:0;margin:0 auto;";
    sculptMirrorBar.insertAdjacentElement("afterend", colorBtn);
  }

  let sculptRightPopups = document.getElementById("sculpt-right-popups");
  let sizePop = document.getElementById("sculpt-size-popup");
  let strengthPop = document.getElementById("sculpt-strength-popup");

  if (!sculptRightPopups && toolbarParent && sizeInput && strengthInput) {
    sculptRightPopups = document.createElement("div");
    sculptRightPopups.id = "sculpt-right-popups";
    sculptRightPopups.style.cssText = "display:none;align-items:center;gap:4px;margin-left:auto;flex-shrink:0;position:relative;z-index:45;";
    sculptRightPopups.innerHTML = `
      <button type="button" id="sculptSizeBtn" class="sculpt-vslider-btn">R ▴</button>
      <button type="button" id="sculptStrengthBtn" class="sculpt-vslider-btn">S ▴</button>
    `;
    toolbarParent.appendChild(sculptRightPopups);

    sizePop = document.createElement("div");
    sizePop.id = "sculpt-size-popup";
    sizePop.className = "sculpt-vslider-pop";
    sizePop.innerHTML = `<span id="sculptSizeVal" class="sculpt-vslider-val"></span>`;
    sizePop.insertBefore(sizeInput, sizePop.firstChild);

    strengthPop = document.createElement("div");
    strengthPop.id = "sculpt-strength-popup";
    strengthPop.className = "sculpt-vslider-pop";
    strengthPop.innerHTML = `<span id="sculptStrengthVal" class="sculpt-vslider-val"></span>`;
    strengthPop.insertBefore(strengthInput, strengthPop.firstChild);

    document.body.appendChild(sizePop);
    document.body.appendChild(strengthPop);
  }

  const positionPopupUpward = (pop, anchorBtn) => {
    if (!pop || !anchorBtn) return;
    const rect = anchorBtn.getBoundingClientRect();
    const popHeight = pop.offsetHeight || 128;
    const popWidth = pop.offsetWidth || 38;
    pop.style.left = `${Math.max(6, Math.min(window.innerWidth - popWidth - 6, rect.right - popWidth))}px`;
    pop.style.top = `${Math.max(6, rect.top - popHeight - 6)}px`;
  };

  const closeAllSculptPopups = () => {
    if (sizePop) sizePop.classList.remove("show");
    if (strengthPop) strengthPop.classList.remove("show");
    const sb = document.getElementById("sculptSizeBtn");
    const stb = document.getElementById("sculptStrengthBtn");
    if (sb) sb.classList.remove("open");
    if (stb) stb.classList.remove("open");
  };

  const syncSliderReadouts = () => {
    const sv = document.getElementById("sculptSizeVal");
    const stv = document.getElementById("sculptStrengthVal");
    if (sv && sizeInput) sv.textContent = Number(sizeInput.value).toFixed(2);
    if (stv && strengthInput) stv.textContent = Number(strengthInput.value).toFixed(2);
  };

  const styleMirrorBtn = (btn, active) => {
    if (!btn) return;
    btn.classList.toggle("active", !!active);
    btn.style.background = active ? "#4a90e2" : "#3a3a3a";
    btn.style.borderColor = active ? "#6aa8f0" : "#555";
    btn.style.color = active ? "#ffffff" : "#cccccc";
  };

  const syncSculptBar = () => {
    const isSculpt = state.mode === "sculpt";
    if (colorBtn) {
      colorBtn.style.display = "";
      colorBtn.style.width = isSculpt ? "22px" : "";
      colorBtn.style.height = isSculpt ? "22px" : "";
      colorBtn.style.margin = isSculpt ? "0 auto" : "";
    }
    if (sculptMirrorBar) {
      sculptMirrorBar.style.display = isSculpt ? "inline-flex" : "none";
    }
    if (sculptRightPopups) {
      sculptRightPopups.style.display = isSculpt ? "inline-flex" : "none";
    }
    if (sizeRow) sizeRow.style.display = isSculpt ? "none" : "";
    if (strengthRow) strengthRow.style.display = isSculpt ? "none" : "";
    if (!isSculpt) closeAllSculptPopups();

    styleMirrorBtn(document.getElementById("mirrorBtnX"), state.symmetryX);
    styleMirrorBtn(document.getElementById("mirrorBtnY"), state.symmetryY);
    styleMirrorBtn(document.getElementById("mirrorBtnZ"), state.symmetryZ);
    syncSliderReadouts();
  };

  const bindAxisToggle = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      state[key] = !state[key];
      syncSculptBar();
    };
  };

  bindAxisToggle("mirrorBtnX", "symmetryX");
  bindAxisToggle("mirrorBtnY", "symmetryY");
  bindAxisToggle("mirrorBtnZ", "symmetryZ");

  const sizeBtn = document.getElementById("sculptSizeBtn");
  const strengthBtn = document.getElementById("sculptStrengthBtn");
  if (sizeBtn && sizePop) {
    sizeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !sizePop.classList.contains("show");
      closeAllSculptPopups();
      if (willOpen) {
        sizePop.classList.add("show");
        sizeBtn.classList.add("open");
        positionPopupUpward(sizePop, sizeBtn);
      }
    };
  }
  if (strengthBtn && strengthPop) {
    strengthBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !strengthPop.classList.contains("show");
      closeAllSculptPopups();
      if (willOpen) {
        strengthPop.classList.add("show");
        strengthBtn.classList.add("open");
        positionPopupUpward(strengthPop, strengthBtn);
      }
    };
  }
  if (sizeInput) sizeInput.oninput = syncSliderReadouts;
  if (strengthInput) strengthInput.oninput = syncSliderReadouts;

  document.addEventListener("pointerdown", (e) => {
    if (
      (sizePop && sizePop.contains(e.target)) ||
      (strengthPop && strengthPop.contains(e.target)) ||
      (sizeBtn && sizeBtn.contains(e.target)) ||
      (strengthBtn && strengthBtn.contains(e.target))
    ) {
      return;
    }
    closeAllSculptPopups();
  });
    window.addEventListener("resize", () => {
      if (sizePop && sizePop.classList.contains("show") && sizeBtn) {
        positionPopupUpward(sizePop, sizeBtn);
      }
      if (strengthPop && strengthPop.classList.contains("show") && strengthBtn) {
        positionPopupUpward(strengthPop, strengthBtn);
      }
    });

  if (!window.__sculptSyncUIWrapped) {
    window.__sculptSyncUIWrapped = true;
    const origSyncUI = state.syncUI.bind(state);
    state.syncUI = () => {
      origSyncUI();
      syncSculptBar();
    };
  }
  syncSculptBar();

  const bgBtn = document.getElementById("btn-bg-color");
  const colorModal = document.getElementById("color-picker-modal");
  const colorClose = document.getElementById("color-picker-close");
  const cpApply = document.getElementById("cp-apply");
  const cpR = document.getElementById("cp-r"), cpG = document.getElementById("cp-g"), cpB = document.getElementById("cp-b");
  const cpHex = document.getElementById("cp-hex");
  const colorPreview = document.getElementById("color-preview");
  const cpComp = document.getElementById("cp-comp");
  const colorWheel = document.getElementById("color-wheel");
  const pickerTitle = document.getElementById("color-picker-title");

  let colorTarget = 'paint';

  // Fix: updatePreview is now in the top-level scope alongside openColorPicker
  const updatePreview = () => {
    if (!cpR) return;
    const r = parseInt(cpR.value), g = parseInt(cpG.value), b = parseInt(cpB.value);
    const hex = `rgb(${r}, ${g}, ${b})`;
    if (colorPreview) colorPreview.style.background = hex;

    const hexStr = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    if (cpHex) cpHex.value = hexStr;

    const color = new THREE.Color(r/255, g/255, b/255);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.h = (hsl.h + 0.5) % 1.0;
    color.setHSL(hsl.h, hsl.s, hsl.l);
    if (cpComp) cpComp.style.background = '#' + color.getHexString();
  };

  const openColorPicker = (target) => {
    if (!colorModal) return;
    colorTarget = target;
    // Always reset Apply to the default handler to break any leftover swap chain
    if (cpApply && window.__defaultApplyHandler) {
      cpApply.onclick = window.__defaultApplyHandler;
    }
    if (pickerTitle) pickerTitle.textContent = target === 'paint' ? "Paint Color" : (target === 'background' ? "Background Color" : "Base Color");

    if (target === 'material' && state.activeMesh) {
      state.saveState(state.activeMesh);
    }

    const currentColor = target === 'paint' ? state.paintColor :
                         target === 'background' ? state.scene.background :
                         (state.activeMesh ? state.getActiveMaterial().color : new THREE.Color(0xffffff));

    if (cpR) cpR.value = Math.round(currentColor.r * 255);
    if (cpG) cpG.value = Math.round(currentColor.g * 255);
    if (cpB) cpB.value = Math.round(currentColor.b * 255);
    updatePreview();

    colorModal.classList.add("show");
  };

  if (colorBtn) colorBtn.onclick = () => openColorPicker('paint');
  if (bgBtn) bgBtn.onclick = () => openColorPicker('background');
  if (matColorBtn) matColorBtn.onclick = () => openColorPicker('material');

  if (colorModal) {
    if (colorClose) colorClose.onclick = () => colorModal.classList.remove("show");
    
    if (cpApply) {
      window.__defaultApplyHandler = () => {
        if (!cpR) return;
        const r = parseInt(cpR.value), g = parseInt(cpG.value), b = parseInt(cpB.value);
        const hex = `rgb(${r}, ${g}, ${b})`;

        if (colorTarget === 'paint') {
          state.setPaintColor(`#${new THREE.Color(r/255, g/255, b/255).getHexString()}`);
        } else if (colorTarget === 'background') {
          if (state.scene) state.scene.background.set(hex);
        } else if (colorTarget === 'material' && state.activeMesh) {
          state.getActiveMaterial().color.set(hex);
          state.getActiveMaterial().needsUpdate = true;
          if (state.updateMaterialPreview) state.updateMaterialPreview(state.getActiveMaterial());
          const _am = state.getActiveMaterial && state.getActiveMaterial(); if (matColorBtn && _am && _am.color) matColorBtn.style.background = '#' + _am.color.getHexString();
          if (state.syncUI) state.syncUI();
        }
        colorModal.classList.remove("show");
      };
      cpApply.onclick = window.__defaultApplyHandler;
    }

    if (cpR) cpR.oninput = updatePreview;
    if (cpG) cpG.oninput = updatePreview;
    if (cpB) cpB.oninput = updatePreview;

    if (cpHex) {
      cpHex.onchange = (e) => {
        const val = e.target.value.replace('#', '');
        if (val.length === 6) {
          const r = parseInt(val.substring(0, 2), 16);
          const g = parseInt(val.substring(2, 4), 16);
          const b = parseInt(val.substring(4, 6), 16);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            cpR.value = r; cpG.value = g; cpB.value = b;
            updatePreview();
          }
        }
      };
    }

    if (colorWheel) {
      const ctx = colorWheel.getContext('2d');
      const radius = colorWheel.width / 2;
      for (let angle = 0; angle < 360; angle++) {
        const startAngle = (angle - 1) * Math.PI / 180;
        const endAngle = (angle + 1) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, startAngle, endAngle);
        ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
        ctx.fill();
      }
      const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
      ctx.fill();

      colorWheel.onpointerdown = (e) => {
        const rect = colorWheel.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const data = ctx.getImageData(x, y, 1, 1).data;
        cpR.value = data[0]; cpG.value = data[1]; cpB.value = data[2];
        updatePreview();
      };
    }

    document.querySelectorAll('.swatch').forEach(sw => {
      sw.onclick = () => {
        const hex = sw.style.backgroundColor;
        const c = new THREE.Color(hex);
        cpR.value = Math.round(c.r * 255);
        cpG.value = Math.round(c.g * 255);
        cpB.value = Math.round(c.b * 255);
        updatePreview();
      };
    });
  }

  // --- Sliders in Bottom Panel ---
  const sensInput = document.getElementById("trackpadSensitivity");
  if (sensInput) sensInput.oninput = e => { state.trackpadSensitivity = parseFloat(e.target.value); };

  const brushSize = document.getElementById("brushSize"), brushStrength = document.getElementById("brushStrength");
  if (brushSize) brushSize.oninput = () => state.setRadius(parseFloat(brushSize.value));
  if (brushStrength) brushStrength.oninput = () => state.setStrength(parseFloat(brushStrength.value));

  const newCube = document.getElementById("newCube"), newSphere = document.getElementById("newSphere");
  if (newCube) newCube.onclick = () => state.addCube();
  if (newSphere) newSphere.onclick = () => state.addSphere();
  if (document.getElementById("newPlane")) document.getElementById("newPlane").onclick = () => state.addPlane();
  if (document.getElementById("newCylinder")) document.getElementById("newCylinder").onclick = () => state.addCylinder();
  if (document.getElementById("newCone")) document.getElementById("newCone").onclick = () => state.addCone();
  if (document.getElementById("newTorus")) document.getElementById("newTorus").onclick = () => state.addTorus();
  if (document.getElementById("newHumanoid")) document.getElementById("newHumanoid").onclick = () => state.addHumanoidBase();

  const exportGlb = document.getElementById("exportGLB"), exportGltf = document.getElementById("exportGLTF"), importGltf = document.getElementById("importGLTF");
  if (exportGlb) exportGlb.onclick = () => state.exportGLTF(true);
  if (exportGltf) exportGltf.onclick = () => state.exportGLTF(false);
  if (importGltf) importGltf.onchange = e => state.importGLTF?.(e);

  const saveProj = document.getElementById("saveProject"), loadProj = document.getElementById("loadProject");
  if (saveProj) saveProj.onclick = () => state.saveProject();
  if (loadProj) loadProj.onchange = e => state.loadProject(e);

  const toggleProp = document.getElementById("toggleProp");
  if (toggleProp) toggleProp.onclick = () => {
    state.proportionalEnabled = !state.proportionalEnabled;
    toggleProp.classList.toggle("active", state.proportionalEnabled);
    if (window.showToast) window.showToast(`Proportional Edit ${state.proportionalEnabled ? 'ON' : 'OFF'}`);
  };

  const propRadius = document.getElementById("propRadius");
  if (propRadius) propRadius.oninput = (e) => {
    state.proportionalRadius = parseFloat(e.target.value);
  };




  // --- Material Properties Panel ---
  const matRough = document.getElementById("mat-roughness");
  const matMetal = document.getElementById("mat-metalness");
  const matTex = document.getElementById("mat-texture");
  const matNormal = document.getElementById("mat-normal");

  const updateMaterialUI = (mesh) => {
    if (!mesh || !mesh.material) return;
    const m = mesh.material;
    if (matColorBtn && m && m.color) matColorBtn.style.background = '#' + m.color.getHexString();
    if (matRough) matRough.value = m.roughness;
    if (matMetal) matMetal.value = m.metalness;
    if (document.getElementById('mat-alpha')) document.getElementById('mat-alpha').value = m.opacity;
    if (matTex) matTex.value = ''; // Reset file input
    if (matNormal) matNormal.value = '';
    if (document.getElementById('uv-scale-u')) {
      document.getElementById('uv-scale-u').value = 1;
      document.getElementById('uv-off-u').value = 0;
      document.getElementById('uv-scale-v').value = 1;
      document.getElementById('uv-off-v').value = 0;
    }
    if (state.updateUVPreview) { try { state.updateUVPreview(); } catch(e) {} }
    
    // GUI Alignment: clear the mini texture viewer
    const miniTex = document.getElementById('mini-tex');
    if (miniTex) {
      const ctx = miniTex.getContext('2d');
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, miniTex.width, miniTex.height);
      if (m.map && m.map.image) {
        ctx.drawImage(m.map.image, 0, 0, miniTex.width, miniTex.height);
      }
    }
    if (state.updateMaterialPreview) state.updateMaterialPreview(m);
  };

  const applyUV = (type) => {
    if (!state.activeMesh) return;
    applyUVProjection(state.activeMesh.geometry, type);
    state.activeMesh.geometry.attributes.uv.needsUpdate = true;
    state.cacheBaseUVs();
    
    // If painting, the canvas might need a repaint if they just set the unwrap
    if (state.activeMesh.userData.paintTexture) {
      state.activeMesh.userData.paintTexture.needsUpdate = true;
    }
    if (window.showToast) window.showToast(`Applied ${type} UV unwrap.`);
  };

  const btnUVPlanar = document.getElementById("uv-planar");
  const btnUVCyl = document.getElementById("uv-cyl");
  const btnUVSph = document.getElementById("uv-sph");
  const uvScaleU = document.getElementById("uv-scale-u");
  const uvOffU = document.getElementById("uv-off-u");
  const uvScaleV = document.getElementById("uv-scale-v");
  const uvOffV = document.getElementById("uv-off-v");
  const uvReset = document.getElementById("uv-reset");

  const saveUVState = () => { if (state.activeMesh) state.saveState(state.activeMesh); };
  const uvScaleUEl = document.getElementById("uv-scale-u");
  const uvOffUEl = document.getElementById("uv-off-u");
  const uvScaleVEl = document.getElementById("uv-scale-v");
  const uvOffVEl = document.getElementById("uv-off-v");
  if (uvScaleUEl) uvScaleUEl.addEventListener('pointerdown', saveUVState);
  if (uvOffUEl) uvOffUEl.addEventListener('pointerdown', saveUVState);
  if (uvScaleVEl) uvScaleVEl.addEventListener('pointerdown', saveUVState);
  if (uvOffVEl) uvOffVEl.addEventListener('pointerdown', saveUVState);

  const applyUVSliders = () => {
    if (!uvScaleU) return;
    state.applyUVTransform(
      parseFloat(uvScaleU.value), parseFloat(uvOffU.value),
      parseFloat(uvScaleV.value), parseFloat(uvOffV.value)
    );
  };

  if (uvScaleU) uvScaleU.oninput = applyUVSliders;
  if (uvOffU) uvOffU.oninput = applyUVSliders;
  if (uvScaleV) uvScaleV.oninput = applyUVSliders;
  if (uvOffV) uvOffV.oninput = applyUVSliders;

  if (uvReset) uvReset.onclick = () => {
    if (uvScaleU) uvScaleU.value = 1;
    if (uvOffU) uvOffU.value = 0;
    if (uvScaleV) uvScaleV.value = 1;
    if (uvOffV) uvOffV.value = 0;
    applyUVSliders();
    if (window.showToast) window.showToast('UVs reset');
  };

  if (btnUVPlanar) btnUVPlanar.onclick = () => applyUV('planar');
  if (btnUVCyl) btnUVCyl.onclick = () => applyUV('cylindrical');
  if (btnUVSph) btnUVSph.onclick = () => applyUV('spherical');

  const btnDlTex = document.getElementById("btn-download-texture");
  if (btnDlTex) btnDlTex.onclick = () => state.downloadTexture();

  const btnNewTex = document.getElementById("btn-new-texture");
  if (btnNewTex) btnNewTex.onclick = () => {
    if (!state.activeMesh) return;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false; // glTF standard
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    const activeMat = state.getActiveMaterial();
    if (activeMat && activeMat.color) {
      activeMat.color.setHex(0xffffff);
    }
    state.activeMesh.userData.paintCanvas = canvas;
    state.activeMesh.userData.paintTexture = texture;
    if (activeMat) {
      activeMat.map = texture;
      activeMat.needsUpdate = true;
    }
    
    if (window.showToast) window.showToast('Canvas ready! Switch to Paint mode.');
  };

  if (matNormal) matNormal.onchange = (e) => {
    if (state.activeMesh) state.saveState(state.activeMesh);
    if (!state.activeMesh || !state.getActiveMaterial() || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.NoColorSpace; // Normal maps MUST be linear
      texture.flipY = false; // glTF standard
      state.getActiveMaterial().normalMap = texture;
      state.getActiveMaterial().needsUpdate = true;
      state.updateMaterialPreview(state.getActiveMaterial());
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Normal Map applied!');
    });
  };

  const saveMatState = () => { if (state.activeMesh) state.saveState(state.activeMesh); };
  if (matRough) matRough.addEventListener('pointerdown', saveMatState);
  if (matMetal) matMetal.addEventListener('pointerdown', saveMatState);


  if (matRough) matRough.oninput = (e) => {
    if (state.activeMesh && state.getActiveMaterial()) {
      state.getActiveMaterial().roughness = parseFloat(e.target.value);
      state.updateMaterialPreview(state.getActiveMaterial());
    }
  };

  if (matMetal) matMetal.oninput = (e) => {
    if (state.activeMesh && state.getActiveMaterial()) {
      state.getActiveMaterial().metalness = parseFloat(e.target.value);
      state.updateMaterialPreview(state.getActiveMaterial());
    }
  };


  const matAlpha = document.getElementById("mat-alpha");
  if (matAlpha) {
    matAlpha.addEventListener('pointerdown', saveMatState);
    matAlpha.oninput = (e) => {
      if (state.activeMesh && state.getActiveMaterial()) {
        const val = parseFloat(e.target.value);
        state.getActiveMaterial().opacity = val;
        state.getActiveMaterial().transparent = val < 1.0;
        state.getActiveMaterial().needsUpdate = true;
        state.updateMaterialPreview(state.getActiveMaterial());
      }
    };
  }

  const flatBtn = document.getElementById("toggleFlatShading");
  if (flatBtn) flatBtn.onclick = () => {
    if (!state.activeMesh || !state.getActiveMaterial()) return;
    state.saveState(state.activeMesh); // Catch for undo
    const m = state.getActiveMaterial();
    m.flatShading = !m.flatShading;
    m.needsUpdate = true;
    state.updateMaterialPreview(m);
    flatBtn.classList.toggle("active", m.flatShading);
    if (window.showToast) window.showToast(`Flat Shading ${m.flatShading ? 'ON' : 'OFF'}`);
  };

  if (matTex) matTex.onchange = (e) => {
    if (state.activeMesh) state.saveState(state.activeMesh);
    if (!state.activeMesh || !state.getActiveMaterial() || !e.target.files[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false; // glTF standard
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      state.getActiveMaterial().map = texture;
      state.getActiveMaterial().needsUpdate = true;
      state.updateMaterialPreview(state.getActiveMaterial());
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Texture applied!');
    });
  };

  // --- Animation Controls ---
  const addKfBtn = document.getElementById("addKeyframe");
  if (addKfBtn) addKfBtn.onclick = () => state.addKeyframe();

  const delKfBtn = document.getElementById("deleteKeyframe");
  if (delKfBtn) delKfBtn.onclick = () => state.deleteKeyframe();

  const playAnimBtn = document.getElementById("playAnim");
  if (playAnimBtn) playAnimBtn.onclick = () => state.playAnimation();

  const resetAnimBtn = document.getElementById("resetAnim");
  if (resetAnimBtn) resetAnimBtn.onclick = () => {
    if (state.mixer) state.mixer.stopAllAction();
    state.keyframes = [];
    state.setMode('rig');
    const scrubEl = document.getElementById('timeline-scrub');
    if (scrubEl) { scrubEl.max = 0; scrubEl.value = 0; scrubEl.disabled = true; }
    const lbl = document.getElementById('timeline-label');
    if (lbl) lbl.textContent = 'Frame: 0';
    if (window.showToast) window.showToast("Animation reset.");
  };

  const scrubEl = document.getElementById('timeline-scrub');
  if (scrubEl) scrubEl.oninput = (e) => state.scrubToTime(parseFloat(e.target.value));

  const fpsSlider = document.getElementById('anim-fps');
  const fpsLabel = document.getElementById('fps-label');
  if (fpsSlider) {
    fpsSlider.oninput = (e) => {
      state.animationFPS = parseInt(e.target.value) || 24;
      if (fpsLabel) fpsLabel.textContent = `${state.animationFPS} fps`;
    };
  }

  const loopToggle = document.getElementById('toggleLoop');
  if (loopToggle) {
    loopToggle.onclick = () => {
      state.loopAnim = !state.loopAnim;
      loopToggle.textContent = `Loop Animation: ${state.loopAnim ? 'ON' : 'OFF'}`;
      loopToggle.classList.toggle('active', state.loopAnim);
    };
  }

  // --- SANITY CHECK ---
  setTimeout(() => {
    const criticalIds = ['transformBtn', 'viewBtn', 'addKeyframe', 'playAnim', 'timeline-scrub', 'anim-fps', 'toggleLoop', 'toolSculpt', 'toolRig', 'toolMove', 'toolRotate', 'toolScale', 'toolObject', 'toolPaint', 'toolEdit', 'deleteKeyframe', 'addVertexBtn', 'buildFaceBtn', 'faceSelectToggle'];
    const missing = criticalIds.filter(id => {
      const el = document.getElementById(id);
      return !el || (!el.onclick && !el.oninput);
    });
    if (missing.length > 0) {
      console.error("Missing UI hooks:", missing);
      if (window.showToast) window.showToast(`UI Sanity Check Failed: ${missing.join(', ')}`);
    } else {
      console.log("UI Sanity Check Passed: All critical hooks attached.");
    }
  }, 100);


  const faceSelectBtn = document.getElementById("faceSelectToggle");
  if (faceSelectBtn) {
    faceSelectBtn.onclick = () => {
      state.faceSelectMode = !state.faceSelectMode;
      faceSelectBtn.textContent = `Face Select: ${state.faceSelectMode ? 'ON' : 'OFF'}`;
      faceSelectBtn.classList.toggle("active", state.faceSelectMode);
      faceSelectBtn.style.background = state.faceSelectMode ? "#4a90e2" : "#444";
    };
  }

  // --- Explicitly bind Settings Modal Controls ---
  const envStudio = document.getElementById("env-studio");
  const envSunset = document.getElementById("env-sunset");
  const envDark = document.getElementById("env-dark");
  if (envStudio) envStudio.onclick = () => state.applyEnvironmentPreset('studio');
  if (envSunset) envSunset.onclick = () => state.applyEnvironmentPreset('sunset');
  if (envDark) envDark.onclick = () => state.applyEnvironmentPreset('dark');

  const lightInt = document.getElementById("light-intensity");
  if (lightInt) {
    lightInt.oninput = (e) => {
      if (state.dirLight) state.dirLight.intensity = parseFloat(e.target.value);
    };
  }

  const trackpadSlider = document.getElementById("trackpadSensitivity");
  if (trackpadSlider) {
    trackpadSlider.oninput = (e) => {
      state.trackpadSensitivity = parseFloat(e.target.value);
    };
  }

  const lightColorBtn = document.getElementById("light-color-btn");
  if (lightColorBtn) {
    lightColorBtn.onclick = () => {
      // Re-use the unified color picker for lights
      const modal = document.getElementById("color-picker-modal");
      const title = document.getElementById("color-picker-title");
      if (title) title.textContent = "Light Color";
      
      const applyBtn = document.getElementById("cp-apply");
      const originalClick = applyBtn.onclick;
      
      applyBtn.onclick = () => {
        const r = parseInt(document.getElementById("cp-r").value);
        const g = parseInt(document.getElementById("cp-g").value);
        const b = parseInt(document.getElementById("cp-b").value);
        if (state.dirLight) state.dirLight.color.setRGB(r/255, g/255, b/255);
        if (lightColorBtn) lightColorBtn.style.background = `rgb(${r},${g},${b})`;
        modal.classList.remove("show");
        applyBtn.onclick = originalClick;
      };
      
      if (state.dirLight) {
        const c = state.dirLight.color;
        document.getElementById("cp-r").value = Math.round(c.r * 255);
        document.getElementById("cp-g").value = Math.round(c.g * 255);
        document.getElementById("cp-b").value = Math.round(c.b * 255);
      }
      modal.classList.add("show");
    };
  }
  
  const toggleEnvBtn = document.getElementById("toggle-env");
  if (toggleEnvBtn) {
    toggleEnvBtn.onclick = () => {
      state.toggleEnvironment();
      toggleEnvBtn.classList.toggle("active", state.envEnabled);
    };
  }
  
  const bgColorBtn = document.getElementById("btn-bg-color");
  if (bgColorBtn) {
    bgColorBtn.onclick = () => {
      // Re-use color picker for background (similar to light color logic)
      const modal = document.getElementById("color-picker-modal");
      const title = document.getElementById("color-picker-title");
      if (title) title.textContent = "Background Color";
      
      const applyBtn = document.getElementById("cp-apply");
      const originalClick = applyBtn.onclick;
      
      applyBtn.onclick = () => {
        const r = parseInt(document.getElementById("cp-r").value);
        const g = parseInt(document.getElementById("cp-g").value);
        const b = parseInt(document.getElementById("cp-b").value);
        if (state.scene) state.scene.background.setRGB(r/255, g/255, b/255);
        modal.classList.remove("show");
        applyBtn.onclick = originalClick;
      };
      
      if (state.scene && state.scene.background) {
        const c = state.scene.background;
        document.getElementById("cp-r").value = Math.round(c.r * 255);
        document.getElementById("cp-g").value = Math.round(c.g * 255);
        document.getElementById("cp-b").value = Math.round(c.b * 255);
      }
      modal.classList.add("show");
    };
  }

  // GLOBAL_SETTINGS_DELEGATION — bulletproof fallback for settings button
  document.addEventListener('click', (e) => {
    const target = e.target.closest && e.target.closest('#settingsBtn');
    if (target) {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.style.display = 'flex';
      else console.warn('[settings] modal not found');
    }
    const close = e.target.closest && e.target.closest('#close-settings');
    if (close) {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.style.display = 'none';
    }
    // Click outside modal content closes it
    if (e.target.id === 'settings-modal') {
      e.target.style.display = 'none';
    }
  });

  // --- Material Slot bar ---
  function renderMatSlots(mesh) {
    const bar = document.getElementById("mat-slots-bar");
    if (!bar) return;
    bar.innerHTML = "";
    if (!mesh) return;
    state.ensureMaterialSlots(mesh);
    const slots = mesh.userData.materialSlots || [mesh.material];
    const active = mesh.userData.activeSlot || 0;
    slots.forEach((mat, i) => {
      const tab = document.createElement("div");
      tab.className = "mat-slot" + (i === active ? " active" : "");
      tab.textContent = "Slot " + i;
      tab.style.borderLeft = "4px solid #" + (mat.color ? mat.color.getHexString() : "888888");
      tab.onclick = () => { state.switchActiveSlot(i); renderMatSlots(mesh); };
      bar.appendChild(tab);
    });
    const assignBtn = document.getElementById("assignFacesBtn");
    if (assignBtn) assignBtn.style.display = (state.mode === "edit") ? "block" : "none";
  }
  window.renderMatSlots = renderMatSlots;

  const addSlotBtn = document.getElementById("addMaterialSlotBtn");
  if (addSlotBtn) addSlotBtn.onclick = () => { state.addMaterialSlot(); renderMatSlots(state.activeMesh); };

  const removeSlotBtn = document.getElementById("removeMaterialSlotBtn");
  if (removeSlotBtn) removeSlotBtn.onclick = () => { state.removeMaterialSlot(); renderMatSlots(state.activeMesh); };

  const assignBtnEl = document.getElementById("assignFacesBtn");
  if (assignBtnEl) assignBtnEl.onclick = () => { state.assignFacesToSlot(); renderMatSlots(state.activeMesh); };

  // Sync UI when a new object is selected
  window.addEventListener('objectSelected', (e) => { updateMaterialUI(e.detail); renderMatSlots(e.detail); });
  // Also sync on load
  updateMaterialUI(state.activeMesh);
}

const _bindRigBtn = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.onclick = (e) => {
    const s = window.state;
    if (s) fn(s, e);
  };
};

_bindRigBtn("mirrorPoseBtn", (s) => s.mirrorPoseLR && s.mirrorPoseLR());
_bindRigBtn("genWalkCycleBtn", (s) => s.generateWalkCycle && s.generateWalkCycle());
_bindRigBtn("genWaveCycleBtn", (s) => s.generateWaveCycle && s.generateWaveCycle());
_bindRigBtn("updateKeyframe", (s) => s.updateKeyframe && s.updateKeyframe());
_bindRigBtn("stopAnim", (s) => s.stopAnimation && s.stopAnimation());
_bindRigBtn("prevKeyframe", (s) => s.stepKeyframe && s.stepKeyframe(-1));
_bindRigBtn("nextKeyframe", (s) => s.stepKeyframe && s.stepKeyframe(1));

const _handCurlEl = document.getElementById("hand-curl-slider");
if (_handCurlEl) {
  _handCurlEl.oninput = (e) => {
    const val = parseFloat(e.target.value) || 0;
    const lbl = document.getElementById("hand-curl-label");
    if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    const s = window.state;
    if (s && typeof s.setHandCurl === "function") s.setHandCurl(val);
  };
}

const _readWalkOpts = () => ({
  stepFrames: parseInt(document.getElementById("walk-step-slider")?.value || "6", 10),
  strideScale: (parseFloat(document.getElementById("walk-stride-slider")?.value || "100") / 100),
  armSwingScale: (parseFloat(document.getElementById("walk-arm-slider")?.value || "100") / 100)
});

const _stepSlider = document.getElementById("walk-step-slider");
if (_stepSlider) {
  _stepSlider.oninput = (e) => {
    const lbl = document.getElementById("walk-step-label");
    if (lbl) lbl.textContent = `${e.target.value}f`;
  };
}
const _strideSlider = document.getElementById("walk-stride-slider");
if (_strideSlider) {
  _strideSlider.oninput = (e) => {
    const lbl = document.getElementById("walk-stride-label");
    if (lbl) lbl.textContent = `${e.target.value}%`;
  };
}
const _armSlider = document.getElementById("walk-arm-slider");
if (_armSlider) {
  _armSlider.oninput = (e) => {
    const lbl = document.getElementById("walk-arm-label");
    if (lbl) lbl.textContent = `${e.target.value}%`;
  };
}
const _walkCycleBtnEl = document.getElementById("genWalkCycleBtn");
if (_walkCycleBtnEl) {
  _walkCycleBtnEl.onclick = () => {
    const s = window.state;
    if (s && typeof s.generateWalkCycle === "function") s.generateWalkCycle(_readWalkOpts());
  };
}

_bindRigBtn("dockPrevBone", (s) => s.stepBone && s.stepBone(-1));
_bindRigBtn("dockNextBone", (s) => s.stepBone && s.stepBone(1));
_bindRigBtn("dockAddKeyBtn", (s) => s.addKeyframe && s.addKeyframe());
_bindRigBtn("dockUpdateKeyBtn", (s) => s.updateKeyframe && s.updateKeyframe());
_bindRigBtn("dockPlayBtn", (s) => s.playAnimation && s.playAnimation());
_bindRigBtn("dockMirrorBtn", (s) => s.mirrorPoseLR && s.mirrorPoseLR());
_bindRigBtn("dockWalkBtn", (s) => {
  const opts = typeof _readWalkOpts === "function" ? _readWalkOpts() : {};
  if (s.generateWalkCycle) s.generateWalkCycle(opts);
});

const _boneSel = document.getElementById("rigDockBoneSelect");
if (_boneSel) {
  _boneSel.onchange = (e) => {
    const s = window.state;
    const idx = parseInt(e.target.value, 10);
    if (s && !Number.isNaN(idx) && typeof s.selectBone === "function") {
      s.selectBone(idx);
    }
  };
}

const _autoBendBtn = document.getElementById("dockAutoBendBtn");
if (_autoBendBtn) {
  _autoBendBtn.onclick = () => {
    const s = window.state;
    if (!s) return;
    s.autoLimbBend = !s.autoLimbBend;
    _autoBendBtn.textContent = s.autoLimbBend ? "AutoBend: ON" : "AutoBend: OFF";
    _autoBendBtn.style.background = s.autoLimbBend ? "#2e7d32" : "#546e7a";
    if (window.showToast) window.showToast(`Auto-Bend ${s.autoLimbBend ? "enabled" : "disabled"}`);
  };
}

const _dockPadBtn = document.getElementById("dockTogglePadBtn");
if (_dockPadBtn) {
  _dockPadBtn.onclick = () => {
    const padDefault = document.getElementById("trackpad-default-ui");
    const rigDock = document.getElementById("rig-quick-dock");
    if (!padDefault || !rigDock) return;
    const showingDock = rigDock.style.display !== "none";
    rigDock.style.display = showingDock ? "none" : "flex";
    padDefault.style.display = showingDock ? "flex" : "none";
  };
}

const _dockCurl = document.getElementById("dock-hand-curl");
if (_dockCurl) {
  _dockCurl.oninput = (e) => {
    const val = parseFloat(e.target.value) || 0;
    const lbl = document.getElementById("dock-hand-curl-val");
    if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    const mainSlider = document.getElementById("hand-curl-slider");
    const mainLbl = document.getElementById("hand-curl-label");
    if (mainSlider) mainSlider.value = String(val);
    if (mainLbl) mainLbl.textContent = `${Math.round(val * 100)}%`;
    const s = window.state;
    if (s && typeof s.setHandCurl === "function") s.setHandCurl(val);
  };
}

const _dockMirrorBtn = document.getElementById("dockMirrorBtn");
if (_dockMirrorBtn) {
  _dockMirrorBtn.onclick = () => {
    const s = window.state;
    if (s && typeof s.mirrorBonePose === "function") s.mirrorBonePose();
  };
}
