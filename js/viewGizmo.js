// js/main.js
import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";
import { TransformControls } from "../three/TransformControls.js";
import { GLTFLoader } from "../three/GLTFLoader.js";
import { GLTFExporter } from "../three/GLTFExporter.js";
import { SculptBrush } from "./sculptBrush.js";
import { initUI } from "./ui.js";
import { ViewGizmo } from "./viewGizmo.js";

/* ===============================
   Renderer / Scene
================================ */
const canvas = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.domElement.style.position = "absolute";
renderer.domElement.style.top = "0";
renderer.domElement.style.left = "0";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb0c4de);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth/window.innerHeight, 0.1, 1000
);
camera.position.set(4,4,6);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;

/* ===============================
   Transform Controls
================================ */
const transform = new TransformControls(camera,renderer.domElement);
scene.add(transform);

/* ===============================
   Lighting & Grid
================================ */
scene.add(new THREE.AmbientLight(0xffffff,0.6));
const dirLight = new THREE.DirectionalLight(0xffffff,0.8);
dirLight.position.set(5,10,7);
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(20,20,0x888888,0x888888);
scene.add(gridHelper);

/* ===============================
   Cardinal Markers behind object
================================ */
const cardinalDirs=["N","E","S","W"];
const positions=[[0,0,10],[10,0,0],[0,0,-10],[-10,0,0]];
cardinalDirs.forEach((dir,i)=>{
  const canvas=document.createElement("canvas");
  canvas.width=128; canvas.height=128;
  const ctx=canvas.getContext("2d");
  ctx.font="bold 80px sans-serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillStyle="#888888"; // match grid
  ctx.fillText(dir,64,64);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, depthTest:true }));
  sprite.position.set(...positions[i]);
  sprite.scale.set(2,2,1);
  sprite.renderOrder=0; // behind mesh
  scene.add(sprite);
});

/* ===============================
   Undo / Redo
================================ */
const undoStack=[]; const redoStack=[];
const MAX_UNDO=20;

function saveState(mesh){
  if(!mesh) return;
  undoStack.push(mesh.geometry.clone());
  if(undoStack.length>MAX_UNDO) undoStack.shift();
  redoStack.length=0;
}

function undo(){
  if(!state.activeMesh || undoStack.length===0) return;
  redoStack.push(state.activeMesh.geometry.clone());
  const prev = undoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry=prev;
  state.activeMesh.geometry.computeVertexNormals();
}

function redo(){
  if(!state.activeMesh || redoStack.length===0) return;
  undoStack.push(state.activeMesh.geometry.clone());
  const next = redoStack.pop();
  state.activeMesh.geometry.dispose();
  state.activeMesh.geometry=next;
  state.activeMesh.geometry.computeVertexNormals();
}

/* ===============================
   App State
================================ */
const state={
  mode:"sculpt",
  activeMesh:null,
  brush:null,
  wireframe:false,
  controls,
  transform,

  setMode(mode){
    this.mode=mode;
    if(mode==="sculpt"){ transform.detach(); controls.enabled=true; }
    else{ if(this.activeMesh) transform.attach(this.activeMesh); controls.enabled=mode!=="move"; }
  },

  toggleWireframe(){
    this.wireframe=!this.wireframe;
    if(this.activeMesh) this.activeMesh.material.wireframe=this.wireframe;
  },

  createCube(){
    clearActiveMesh();
    const mesh=new THREE.Mesh(
      new THREE.BoxGeometry(2,2,2,24,24,24),
      new THREE.MeshStandardMaterial({color:0x88ccff, wireframe:this.wireframe})
    );
    setActiveMesh(mesh); saveState(mesh);
  },

  createSphere(){
    clearActiveMesh();
    const mesh=new THREE.Mesh(
      new THREE.SphereGeometry(1.5,64,64),
      new THREE.MeshStandardMaterial({color:0x88ff88, wireframe:this.wireframe})
    );
    setActiveMesh(mesh); saveState(mesh);
  },

  setTool(tool){ if(this.brush) this.brush.setTool(tool); },
  setRadius(r){ if(this.brush) this.brush.setRadius(r); },
  setStrength(s){ if(this.brush) this.brush.setStrength(s); },

  exportGLTF(){
    if(!this.activeMesh) return;
    new GLTFExporter().parse(this.activeMesh,gltf=>{
      const blob=new Blob([JSON.stringify(gltf)],{type:"application/json"});
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob); a.download="model.gltf"; a.click();
    });
  },

  importGLTF(e){
    const reader=new FileReader();
    reader.onload=()=>{ new GLTFLoader().parse(reader.result,"",gltf=>{
      const mesh=gltf.scene.getObjectByProperty("type","Mesh");
      if(mesh) setActiveMesh(mesh);
    });};
    reader.readAsArrayBuffer(e.target.files[0]);
  }
};

/* ===============================
   Mesh Management
================================ */
function clearActiveMesh(){
  if(!state.activeMesh) return;
  transform.detach();
  scene.remove(state.activeMesh);
  state.activeMesh.geometry.dispose();
  state.activeMesh.material.dispose();
  state.activeMesh=null; state.brush=null;
}

function setActiveMesh(mesh){
  state.activeMesh=mesh; scene.add(mesh); transform.attach(mesh);
  state.brush=new SculptBrush(mesh);
}

/* ===============================
   Sculpting
================================ */
const raycaster=new THREE.Raycaster();
const mouse=new THREE.Vector2();
let sculpting=false;

renderer.domElement.addEventListener("pointerdown", e=>{
  if(state.mode!=="sculpt" || !state.activeMesh) return;
  sculpting=true; transform.detach(); sculptAt(e);
});

renderer.domElement.addEventListener("pointerup", ()=>{ sculpting=false; });
renderer.domElement.addEventListener("pointermove", e=>{ if(sculpting) sculptAt(e); });

function sculptAt(e){
  mouse.x=(e.clientX/window.innerWidth)*2-1;
  mouse.y=-(e.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObject(state.activeMesh)[0];
  if(!hit) return;
  state.brush.apply(hit.point);
  saveState(state.activeMesh);
}

/* ===============================
   Keyboard Shortcuts
================================ */
window.addEventListener("keydown", e=>{
  if(e.ctrlKey && e.key==="z") undo();
  if(e.ctrlKey && e.key==="y") redo();
});

/* ===============================
   Resize Handling
================================ */
window.addEventListener("resize", ()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

/* ===============================
   Init
================================ */
state.createCube();
initUI(state);
const viewGizmo=new ViewGizmo(camera,controls);

/* ===============================
   Render Loop
================================ */
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
  viewGizmo.update();
}
animate();
