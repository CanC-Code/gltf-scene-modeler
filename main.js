import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { FBXLoader } from './three/FBXLoader.js';
import { MeshBVH, acceleratedRaycast } from './lib/index.module.js';

// Enable BVH accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let currentMesh = null;
let voxelGrid = {};
let voxelSize = 0.1;

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(3,3,3);

    renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10,10,10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Default cube
    createCube();

    // Handle window resize
    window.addEventListener('resize', ()=>{
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // OBJ input
    document.getElementById('objInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;

        status.innerText = 'Loading OBJ...';
        const reader = new FileReader();
        reader.onload = function(ev){
            const loader = new OBJLoader();
            const obj = loader.parse(ev.target.result);
            loadMesh(obj);
            status.innerText = 'OBJ loaded!';
        };
        reader.readAsText(file);
    });

    // Convert to voxels
    document.getElementById('convertBtn').onclick = () => {
        if(!currentMesh) return;
        voxelize(currentMesh);
        status.innerText = 'Voxelization done!';
    };

    // Export voxel JSON
    document.getElementById('exportBtn').onclick = () => {
        const data = { voxels: Object.values(voxelGrid) };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'scene.json';
        a.click();
        status.innerText = 'Export complete!';
    };

    // Sphere / cube buttons (if added to HTML)
    if(document.getElementById('createCube'))
        document.getElementById('createCube').onclick = createCube;
    if(document.getElementById('createSphere'))
        document.getElementById('createSphere').onclick = createSphere;
}

function createCube() {
    if(currentMesh) scene.remove(currentMesh);
    currentMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({color:0x44aa88})
    );
    scene.add(currentMesh);
}

function createSphere() {
    if(currentMesh) scene.remove(currentMesh);
    currentMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 32, 32),
        new THREE.MeshStandardMaterial({color:0xaa8844})
    );
    scene.add(currentMesh);
}

// Load and normalize mesh (OBJ/FBX)
function loadMesh(mesh) {
    if(currentMesh) scene.remove(currentMesh);

    // Compute bounding box
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3()).length();
    const scale = 2 / size; // fit into 2 unit cube
    mesh.scale.set(scale, scale, scale);

    const center = box.getCenter(new THREE.Vector3());
    mesh.position.sub(center.multiplyScalar(scale));

    scene.add(mesh);
    currentMesh = mesh;
}

// Simple voxelization (cube-based)
function voxelize(mesh) {
    voxelGrid = {}; // reset
    const geom = mesh.geometry;
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;

    const min = bbox.min;
    const max = bbox.max;

    const step = voxelSize;

    const positions = [];

    for(let x = min.x; x <= max.x; x += step) {
        for(let y = min.y; y <= max.y; y += step) {
            for(let z = min.z; z <= max.z; z += step) {
                const voxel = new THREE.Vector3(x, y, z);
                // Simple inclusion test: is this voxel inside mesh bounding box
                positions.push(voxel);
            }
        }
    }

    // Store in voxelGrid
    positions.forEach((v,i)=>{
        voxelGrid[i] = {x:v.x, y:v.y, z:v.z};
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', ()=>{ init(); animate(); });
