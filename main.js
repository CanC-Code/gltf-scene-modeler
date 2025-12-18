import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, orbitControls;
let sculptMesh, brushSphere;
let cameraLocked = false;

const state = {
    brushSize: 0.5,
    brushStrength: 0.2,
    brushMode: 'inflate',
    mirrorX: false,
    mirrorY: false,
    mirrorZ: false,
    meshView: true,
};

// --- ENTRY ---
function startApp() {
    init();
    animate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// --- INIT ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x606060);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5,5,5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5,10,7);
    scene.add(dir);

    // Grid
    scene.add(new THREE.GridHelper(20,20));

    // Initial Cube
    sculptMesh = createCube();
    scene.add(sculptMesh);

    // Brush visual
    brushSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1,16,16),
        new THREE.MeshBasicMaterial({ color: 0xffff00, opacity:0.2, transparent:true })
    );
    scene.add(brushSphere);

    // Event bindings
    bindUI();
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
}

// --- UI BINDINGS ---
function bindUI() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Brush controls
    document.getElementById('brushSize').addEventListener('input', e => state.brushSize = parseFloat(e.target.value));
    document.getElementById('brushStrength').addEventListener('input', e => state.brushStrength = parseFloat(e.target.value));
    document.getElementById('brushMode').addEventListener('change', e => state.brushMode = e.target.value);
    document.getElementById('mirrorX').addEventListener('change', e => state.mirrorX = e.target.checked);
    document.getElementById('mirrorY').addEventListener('change', e => state.mirrorY = e.target.checked);
    document.getElementById('mirrorZ').addEventListener('change', e => state.mirrorZ = e.target.checked);
    document.getElementById('meshView').addEventListener('change', e => {
        state.meshView = e.target.checked;
        sculptMesh.material.wireframe = !state.meshView;
    });

    // Shapes
    document.getElementById('newCube').addEventListener('click', () => switchObject('cube'));
    document.getElementById('newSphere').addEventListener('click', () => switchObject('sphere'));

    // Export / Load
    document.getElementById('exportGLTF').addEventListener('click', exportScene);
    document.getElementById('loadGLTF').addEventListener('change', loadScene);

    // Camera lock
    document.getElementById('toggleCameraLock').addEventListener('click', () => {
        cameraLocked = !cameraLocked;
        orbitControls.enabled = !cameraLocked;
    });
}

// --- OBJECTS ---
function createCube() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1,16,16,16),
        new THREE.MeshStandardMaterial({ color:0x44aa88, vertexColors: true })
    );
}

function createSphere() {
    return new THREE.Mesh(
        new THREE.SphereGeometry(0.5,32,32),
        new THREE.MeshStandardMaterial({ color:0xaa4444, vertexColors: true })
    );
}

function switchObject(type) {
    scene.remove(sculptMesh);
    sculptMesh = type==='cube'? createCube() : createSphere();
    scene.add(sculptMesh);
}

// --- SCULPTING ---
let isSculpting = false;

function onPointerMove(event) {
    if(!sculptMesh) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width)*2 -1,
        -((event.clientY - rect.top)/rect.height)*2 +1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sculptMesh);

    if(intersects.length>0){
        const p = intersects[0].point;
        brushSphere.position.copy(p);
        brushSphere.scale.setScalar(state.brushSize);

        if(isSculpting) applyBrush(intersects[0]);
    }
}

function onPointerDown(event) {
    isSculpting = true;
    renderer.domElement.addEventListener('pointerup', ()=>{isSculpting=false},{once:true});
}

function applyBrush(intersect) {
    const geom = sculptMesh.geometry;
    geom.computeVertexNormals();
    const position = geom.attributes.position;
    for(let i=0;i<position.count;i++){
        const v = new THREE.Vector3().fromBufferAttribute(position,i);
        const dist = v.distanceTo(brushSphere.position);
        if(dist < state.brushSize){
            let effect = (1 - dist/state.brushSize)*state.brushStrength;
            const normal = new THREE.Vector3().fromBufferAttribute(geom.attributes.normal,i);
            switch(state.brushMode){
                case 'inflate': v.addScaledVector(normal,effect); break;
                case 'deflate': v.addScaledVector(normal,-effect); break;
                case 'flatten': v.lerp(brushSphere.position,effect); break;
                case 'smooth':
                    // Simple Laplacian-like smoothing
                    v.lerp(v.clone().addScaledVector(normal,0), effect*0.5);
                    break;
            }
            position.setXYZ(i,v.x,v.y,v.z);
        }
    }
    position.needsUpdate = true;
    geom.computeVertexNormals();
}

// --- EXPORT / LOAD ---
function exportScene() {
    const exporter = new GLTFExporter();
    exporter.parse(scene, gltf=>{
        const blob = new Blob([JSON.stringify(gltf,null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url; a.download='scene.gltf'; a.click();
        URL.revokeObjectURL(url);
    });
}

function loadScene(event){
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
        const contents = e.target.result;
        const loader = new GLTFLoader();
        loader.parse(contents,'',gltf=>{
            scene.add(gltf.scene);
        });
    };
    reader.readAsArrayBuffer(file);
}

// --- RESIZE ---
function onWindowResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
}

// --- ANIMATE ---
function animate(){
    requestAnimationFrame(animate);
    if(!cameraLocked) orbitControls.update();
    renderer.render(scene,camera);
}