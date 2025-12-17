import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { GLTFLoader } from './three/GLTFLoader.js';

let scene, camera, renderer, orbitControls;
let mesh, originalMesh;
let started = false;

// Sculpting
let brushSize = 0.5;
let brushStrength = 0.2;
let brushMode = 'inflate';
let mirrorX = false, mirrorY = false, mirrorZ = false;
let lockCamera = false;

// Brush helper
let brushHelper;

// --- ENTRY ---
function startApp(){
    if(started) return;
    started = true;
    init();
    animate();
}

// DOM ready
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();

// --- INIT ---
function init(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x444455);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1,1000);
    camera.position.set(3,3,5);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;

    const hemi = new THREE.HemisphereLight(0xffffff,0x444444,1.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff,1);
    dir.position.set(5,10,7);
    scene.add(dir);

    scene.add(new THREE.GridHelper(10,10));

    addObject('cube');

    const geo = new THREE.RingGeometry(1,1.02,32);
    const mat = new THREE.MeshBasicMaterial({color:0xff0000, side:THREE.DoubleSide});
    brushHelper = new THREE.Mesh(geo, mat);
    brushHelper.rotation.x = -Math.PI/2;
    brushHelper.visible = false;
    scene.add(brushHelper);

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Tab switching
    document.querySelectorAll('.tabButton').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            document.querySelectorAll('.tabButton').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tabContent').forEach(c=>{
                c.classList.toggle('hidden', c.id!==tab);
            });
        });
    });

    // UI bindings
    bindButton('newCube', ()=>addObject('cube'));
    bindButton('newSphere', ()=>addObject('sphere'));
    bindButton('toggleMeshView', toggleMeshView);
    bindButton('resetScene', resetScene);
    bindButton('exportGLTF', exportScene);
    bindButton('importGLTF', importScene);

    document.getElementById('brushSize').addEventListener('input', e=>brushSize=parseFloat(e.target.value));
    document.getElementById('brushStrength').addEventListener('input', e=>brushStrength=parseFloat(e.target.value));
    document.getElementById('brushMode').addEventListener('change', e=>brushMode=e.target.value);
    document.getElementById('mirrorX').addEventListener('change', e=>mirrorX=e.target.checked);
    document.getElementById('mirrorY').addEventListener('change', e=>mirrorY=e.target.checked);
    document.getElementById('mirrorZ').addEventListener('change', e=>mirrorZ=e.target.checked);
    document.getElementById('lockCamera').addEventListener('change', e=>lockCamera=e.target.checked);
}

// --- UI helper ---
function bindButton(id, handler){
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', handler);
}

// --- OBJECTS ---
function addObject(type){
    if(mesh) scene.remove(mesh);

    let geometry;
    if(type==='cube') geometry = new THREE.BoxGeometry(1,1,1,16,16,16);
    else if(type==='sphere') geometry = new THREE.SphereGeometry(0.75,32,32);

    const material = new THREE.MeshStandardMaterial({color:0x44aa88, flatShading:false, roughness:0.5, metalness:0.1});
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    originalMesh = mesh.clone();
}

function toggleMeshView(){ if(mesh) mesh.material.wireframe = !mesh.material.wireframe; }
function resetScene(){ if(mesh) { scene.remove(mesh); addObject('cube'); } }

// --- EXPORT/IMPORT ---
function exportScene(){
    const exporter = new GLTFExporter();
    exporter.parse(scene, gltf=>{
        const blob = new Blob([JSON.stringify(gltf,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download='scene.gltf'; a.click();
        URL.revokeObjectURL(url);
    });
}

function importScene(){
    const input = document.createElement('input');
    input.type='file';
    input.accept='.gltf,.glb';
    input.onchange = e=>{
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = ev=>{
            const loader = new GLTFLoader();
            loader.parse(ev.target.result,'', gltf=>{
                if(mesh) scene.remove(mesh);
                mesh = gltf.scene.children[0];
                scene.add(mesh);
            });
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

// --- SCULPTING ---
let pointer = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let isPointerDown=false;

function onPointerMove(event){
    pointer.x = (event.clientX / window.innerWidth)*2 -1;
    pointer.y = -(event.clientY / window.innerHeight)*2 +1;

    if(mesh){
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObject(mesh);
        if(intersects.length>0){
            brushHelper.position.copy(intersects[0].point);
            brushHelper.scale.setScalar(brushSize);
            brushHelper.visible=true;

            if(isPointerDown) applyBrush(intersects[0].point);
        } else brushHelper.visible=false;
    }
}

function onPointerDown(event){
    isPointerDown=true;
    onPointerMove(event);
    window.addEventListener('pointerup',()=>isPointerDown=false,{once:true});
}

function applyBrush(point){
    if(!mesh) return;
    const pos = mesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i);
        const dist = v.distanceTo(point);
        if(dist<brushSize){
            const falloff = 1 - dist/brushSize;
            if(brushMode==='inflate') v.addScaledVector(v.clone().sub(point).normalize(), brushStrength*falloff);
            else if(brushMode==='deflate') v.addScaledVector(v.clone().sub(point).normalize(), -brushStrength*falloff);
            else if(brushMode==='smooth'){
                const neighbors=[];
                for(let j=0;j<pos.count;j++){
                    const v2 = new THREE.Vector3().fromBufferAttribute(pos,j);
                    if(v2.distanceTo(v)<brushSize) neighbors.push(v2);
                }
                const avg = new THREE.Vector3();
                neighbors.forEach(n=>avg.add(n));
                avg.divideScalar(neighbors.length||1);
                v.lerp(avg, brushStrength*falloff);
            } else if(brushMode==='flatten'){
                const planeY = point.y;
                v.y += (planeY - v.y)*brushStrength*falloff;
            }

            if(mirrorX) v.x=-v.x;
            if(mirrorY) v.y=-v.y;
            if(mirrorZ) v.z=-v.z;

            pos.setXYZ(i,v.x,v.y,v.z);
        }
    }
    pos.needsUpdate=true;
}

// --- RESIZE ---
function onWindowResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ANIMATE ---
function animate(){
    requestAnimationFrame(animate);
    if(!lockCamera) orbitControls.update();
    renderer.render(scene,camera);
}