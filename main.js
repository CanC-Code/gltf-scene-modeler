// main.js – MC Voxel Builder Sculpt Base

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './three/lil-gui.esm.min.js';

let scene, camera, renderer, orbitControls;
let sculptMesh, brushSphere;
let gui, brushSettings = { size: 0.5, strength: 0.2, mode: 'inflate' };
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isDragging = false, lockCamera = false;

function startApp() {
    if (scene) return;
    initScene();
    initGUI();
    animate();
}

function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x444455);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.target.set(0, 0.5, 0);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // --- Initialize cube mesh ---
    sculptMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1, 16, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x88aa44, flatShading: false })
    );
    sculptMesh.position.y = 0.5;
    scene.add(sculptMesh);

    // --- Brush sphere ---
    brushSphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true, opacity: 0.5, transparent: true })
    );
    brushSphere.visible = false;
    scene.add(brushSphere);

    // --- Events ---
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', () => isDragging = true);
    renderer.domElement.addEventListener('pointerup', () => isDragging = false);
}

function initGUI() {
    gui = new GUI();
    const brushFolder = gui.addFolder('Brush');
    brushFolder.add(brushSettings, 'size', 0.05, 1).name('Radius');
    brushFolder.add(brushSettings, 'strength', 0.01, 1).name('Strength');
    brushFolder.add(brushSettings, 'mode', ['inflate', 'deflate', 'flatten', 'smooth', 'grab']).name('Mode');
    brushFolder.open();

    gui.add({ cameraLock: false }, 'cameraLock').name('Lock Camera').onChange(val => lockCamera = val);

    const meshFolder = gui.addFolder('Mesh');
    meshFolder.add({ reset: resetMesh }, 'reset').name('Reset Mesh');
    meshFolder.add({ export: exportMesh }, 'export').name('Export GLTF');
    meshFolder.open();
}

function resetMesh() {
    scene.remove(sculptMesh);
    sculptMesh.geometry.dispose();
    sculptMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1, 16, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x88aa44, flatShading: false })
    );
    sculptMesh.position.y = 0.5;
    scene.add(sculptMesh);
}

function exportMesh() {
    const exporter = new GLTFExporter();
    exporter.parse(sculptMesh, gltf => {
        const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sculptMesh);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        brushSphere.position.copy(point);
        brushSphere.scale.setScalar(brushSettings.size);
        brushSphere.visible = true;

        if (isDragging) applyBrush(intersects[0]);
    } else {
        brushSphere.visible = false;
    }
}

function applyBrush(intersect) {
    const pos = intersect.point;
    const geom = sculptMesh.geometry;
    geom.attributes.position.needsUpdate = true;

    const positions = geom.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        const dist = vertex.distanceTo(pos);
        if (dist < brushSettings.size) {
            const falloff = 1 - (dist / brushSettings.size);
            switch (brushSettings.mode) {
                case 'inflate':
                    vertex.addScaledVector(intersect.face.normal, brushSettings.strength * falloff);
                    break;
                case 'deflate':
                    vertex.addScaledVector(intersect.face.normal, -brushSettings.strength * falloff);
                    break;
                case 'flatten':
                    vertex.lerp(pos, brushSettings.strength * falloff);
                    break;
                case 'smooth':
                    // simple Laplacian smoothing
                    vertex.lerp(vertex.clone(), 1 - brushSettings.strength * falloff);
                    break;
            }
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
    }
    geom.computeVertexNormals();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (!lockCamera) orbitControls.update();
    renderer.render(scene, camera);
}

// --- DOM Ready ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}