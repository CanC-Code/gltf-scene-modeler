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
let voxelSize = 0.05;

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Toolbar buttons
    document.getElementById('convertBtn').onclick = () => {
        if(currentMesh) voxelizeMesh(currentMesh);
    };

    document.getElementById('exportBtn').onclick = () => {
        exportVoxels();
    };

    // OBJ input
    document.getElementById('objInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(ev){
            status.innerText = 'Loading OBJ...';
            const loader = new OBJLoader();
            const obj = loader.parse(ev.target.result);
            loadMesh(obj);
            status.innerText = 'OBJ loaded!';
        };
        reader.readAsText(file);
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initial cube
    createPrimitive('cube');
}

function loadMesh(obj) {
    if(currentMesh) scene.remove(currentMesh);

    const group = new THREE.Group();
    let bbox = new THREE.Box3();

    obj.traverse(child => {
        if(child.isMesh) {
            child.geometry.computeBoundingBox();
            bbox.expandByPoint(child.geometry.boundingBox.min);
            bbox.expandByPoint(child.geometry.boundingBox.max);
            group.add(child);
        }
    });

    if(group.children.length === 0) return;

    const size = bbox.getSize(new THREE.Vector3()).length();
    const scale = 2 / size;
    const center = bbox.getCenter(new THREE.Vector3());

    group.scale.set(scale, scale, scale);
    group.position.sub(center.multiplyScalar(scale));

    scene.add(group);
    currentMesh = group;
}

function createPrimitive(type) {
    if(currentMesh) scene.remove(currentMesh);

    let geometry;
    let material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

    if(type === 'cube') geometry = new THREE.BoxGeometry(1,1,1);
    else if(type === 'sphere') geometry = new THREE.SphereGeometry(1,32,32);
    else return;

    currentMesh = new THREE.Mesh(geometry, material);
    scene.add(currentMesh);
}

function voxelizeMesh(mesh) {
    // Placeholder: replace with proper voxelization
    console.log('Voxelizing mesh:', mesh);
    // Iterate over all child meshes
    mesh.traverse(child => {
        if(child.isMesh) {
            // Here you would implement voxelization per geometry
        }
    });
}

function exportVoxels() {
    const data = JSON.stringify({ voxels: voxelGrid, skeleton: {} }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scene.json';
    a.click();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});
