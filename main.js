import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './three/lil-gui.esm.min.js';

let scene, camera, renderer, orbitControls;
let mesh, sculptMode=false, showMesh=true;
let raycaster=new THREE.Raycaster();
let mouse=new THREE.Vector2();
let brush={ size:0.5, strength:0.1, color:0xffaa00, mode:'inflate' };
let gui;
let selectedVertex = null;

function startApp() {
    init();
    animate();
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', startApp);
}else{
    startApp();
}

function init(){
    // --- Scene ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x444455);

    // --- Camera ---
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(3,3,5);

    // --- Renderer ---
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // --- Orbit Controls ---
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.target.set(0,0.5,0);

    // --- Lights ---
    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.2));
    const dir = new THREE.DirectionalLight(0xffffff,1);
    dir.position.set(5,10,7);
    scene.add(dir);

    // --- Grid ---
    scene.add(new THREE.GridHelper(10,10));

    // --- Initial Mesh ---
    addMesh('cube');

    // --- GUI ---
    gui = new GUI();
    const brushFolder = gui.addFolder('Brush');
    brushFolder.add(brush,'size',0.1,2).name('Size');
    brushFolder.add(brush,'strength',0.01,1).name('Strength');
    brushFolder.addColor(brush,'color').name('Color');
    brushFolder.add(brush,'mode',['inflate','deflate','smooth']).name('Mode');

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    document.getElementById('toggleMode').addEventListener('click', ()=>{sculptMode=!sculptMode});
    document.getElementById('toggleMeshView').addEventListener('click', ()=>{showMesh=!showMesh; updateMeshView();});
    document.getElementById('newCube').addEventListener('click', ()=>addMesh('cube'));
    document.getElementById('newSphere').addEventListener('click', ()=>addMesh('sphere'));
    document.getElementById('exportGLTF').addEventListener('click', exportScene);
    document.getElementById('resetScene').addEventListener('click', resetScene);
}

function addMesh(type){
    if(mesh) scene.remove(mesh);
    let geom;
    if(type==='cube'){
        geom = new THREE.BoxGeometry(1,1,1,10,10,10);
    } else {
        geom = new THREE.SphereGeometry(0.5,32,32);
    }
    mesh = new THREE.Mesh(
        geom,
        new THREE.MeshStandardMaterial({color:0x44aa88, vertexColors:true, wireframe:false})
    );
    mesh.position.y = 0.5;
    scene.add(mesh);
}

function resetScene(){
    mesh.rotation.set(0,0,0);
}

function exportScene(){
    const exporter = new GLTFExporter();
    exporter.parse(scene, gltf=>{
        const blob = new Blob([JSON.stringify(gltf,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url;
        a.download='scene.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// --- Mesh View Toggle ---
function updateMeshView(){
    if(mesh){
        mesh.material.wireframe = !showMesh;
    }
}

// --- Sculpting / Point Selection ---
function onPointerDown(event){
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left)/rect.width)*2 -1;
    mouse.y = -((event.clientY - rect.top)/rect.height)*2 +1;

    raycaster.setFromCamera(mouse,camera);

    if(sculptMode){
        sculptMesh();
    }else{
        selectVertex();
    }
}

function sculptMesh(){
    if(!mesh.geometry.isBufferGeometry) return;
    const pos = mesh.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
        const vertex = new THREE.Vector3().fromBufferAttribute(pos,i);
        const distance = vertex.distanceTo(raycaster.ray.origin);
        if(distance < brush.size){
            const normal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,i);
            if(brush.mode==='inflate'){
                vertex.addScaledVector(normal, brush.strength);
            } else if(brush.mode==='deflate'){
                vertex.addScaledVector(normal, -brush.strength);
            } else if(brush.mode==='smooth'){
                vertex.multiplyScalar(1 - brush.strength);
            }
            pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
    }
    pos.needsUpdate = true;
}

function selectVertex(){
    if(!mesh.geometry.isBufferGeometry) return;
    const pos = mesh.geometry.attributes.position;
    let closest=null, minDist=Infinity;
    for(let i=0;i<pos.count;i++){
        const vertex = new THREE.Vector3().fromBufferAttribute(pos,i);
        const dist = vertex.distanceTo(raycaster.ray.origin);
        if(dist<minDist && dist<0.3){
            minDist = dist;
            closest=i;
        }
    }
    if(closest!==null){
        selectedVertex = closest;
        console.log('Vertex selected:', selectedVertex);
    }
}

function moveSelectedVertex(delta){
    if(selectedVertex===null) return;
    const pos = mesh.geometry.attributes.position;
    const vertex = new THREE.Vector3().fromBufferAttribute(pos, selectedVertex);
    vertex.add(delta);
    pos.setXYZ(selectedVertex, vertex.x, vertex.y, vertex.z);
    pos.needsUpdate=true;
}

function onWindowResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}

function animate(){
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene,camera);
}