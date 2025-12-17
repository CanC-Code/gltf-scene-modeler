import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { GLTFLoader } from './three/GLTFLoader.js';

let scene, camera, renderer, orbitControls;
let mesh;
let sculptMode=false, brushMode='drag', showMesh=true, mirror=false, lockRotation=false;
let brush={size:0.5,strength:0.1};
let raycaster=new THREE.Raycaster();
let mouse=new THREE.Vector2();

function startApp(){
    init();
    animate();
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',startApp);
}else{
    startApp();
}

function init(){
    // Scene
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x444455);

    // Camera
    camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,1000);
    camera.position.set(3,3,5);

    // Renderer
    renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Orbit Controls
    orbitControls=new OrbitControls(camera,renderer.domElement);
    orbitControls.enableDamping=true;
    orbitControls.dampingFactor=0.08;
    orbitControls.target.set(0,0.5,0);

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.2));
    const dir=new THREE.DirectionalLight(0xffffff,1);
    dir.position.set(5,10,7);
    scene.add(dir);

    scene.add(new THREE.GridHelper(10,10));

    // Initial mesh
    addMesh('cube');

    // Events
    window.addEventListener('resize',onWindowResize);
    renderer.domElement.addEventListener('pointerdown',onPointerDown);

    setupMenu();
}

function setupMenu(){
    const collapseBtn=document.getElementById('collapseMenu');
    const menuContent=document.getElementById('menuContent');
    collapseBtn.addEventListener('click',()=>{menuContent.style.display=menuContent.style.display==='none'?'block':'none';});

    const tabs=document.querySelectorAll('.tabButton');
    tabs.forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.tabButton').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const tabId=btn.dataset.tab+'Tab';
            document.querySelectorAll('.tabContent').forEach(tc=>tc.style.display='none');
            document.getElementById(tabId).style.display='flex';
        });
    });

    document.getElementById('newCube').addEventListener('click',()=>addMesh('cube'));
    document.getElementById('newSphere').addEventListener('click',()=>addMesh('sphere'));
    document.getElementById('toggleMeshView').addEventListener('click',()=>{
        showMesh=!showMesh;
        if(mesh) mesh.material.wireframe=!showMesh;
    });

    document.getElementById('mirrorToggle').addEventListener('change',e=>mirror=e.target.checked);
    document.getElementById('lockRotationToggle').addEventListener('change',e=>lockRotation=e.target.checked);

    document.querySelectorAll('#sculptTab button').forEach(btn=>{
        btn.addEventListener('click',()=>{brushMode=btn.dataset.mode; sculptMode=true;});
    });
    document.getElementById('brushSize').addEventListener('input',e=>brush.size=parseFloat(e.target.value));
    document.getElementById('brushStrength').addEventListener('input',e=>brush.strength=parseFloat(e.target.value));

    document.getElementById('exportGLTF').addEventListener('click',exportScene);
    document.getElementById('resetScene').addEventListener('click',()=>{if(mesh) mesh.rotation.set(0,0,0);});
    document.getElementById('loadGLTF').addEventListener('click',loadScene);

    // Show initial tab
    tabs[0].click();
}

function addMesh(type){
    if(mesh) scene.remove(mesh);
    let geom;
    if(type==='cube') geom=new THREE.BoxGeometry(1,1,1,10,10,10);
    else geom=new THREE.SphereGeometry(0.5,32,32);
    mesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0x44aa88,vertexColors:true,wireframe:false}));
    mesh.position.y=0.5;
    scene.add(mesh);
}

function onPointerDown(event){
    if(!mesh || !sculptMode) return;
    const rect=renderer.domElement.getBoundingClientRect();
    mouse.x=((event.clientX-rect.left)/rect.width)*2-1;
    mouse.y=-((event.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    sculptMesh();
}

function sculptMesh(){
    if(!mesh.geometry.isBufferGeometry) return;
    const pos=mesh.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){
        const vertex=new THREE.Vector3().fromBufferAttribute(pos,i);
        const dist=vertex.distanceTo(raycaster.ray.origin);
        if(dist<brush.size){
            const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,i);
            if(brushMode==='inflate') vertex.addScaledVector(normal,brush.strength);
            else if(brushMode==='deflate') vertex.addScaledVector(normal,-brush.strength);
            else if(brushMode==='smooth') vertex.multiplyScalar(1-brush.strength);
            else if(brushMode==='drag') vertex.addScaledVector(normal,0); // placeholder for future precise drag
            pos.setXYZ(i,vertex.x,vertex.y,vertex.z);
            if(mirror){
                const mirroredX=-vertex.x;
                pos.setXYZ(i,mirroredX,vertex.y,vertex.z);
            }
        }
    }
    pos.needsUpdate=true;
}

function exportScene(){
    const exporter=new GLTFExporter();
    exporter.parse(scene,gltf=>{
        const blob=new Blob([JSON.stringify(gltf,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download='scene.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function loadScene(){
    alert('Load GLTF feature not implemented yet');
}

function onWindowResize(){
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}

function animate(){
    requestAnimationFrame(animate);
    if(!lockRotation) orbitControls.update();
    renderer.render(scene,camera);
}