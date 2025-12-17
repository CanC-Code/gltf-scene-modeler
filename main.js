// main.js – MC Voxel Builder (mobile & desktop safe)

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let cube, sphere;
let started = false;

// --- Entry point ---
function startApp() {
    if (started) return;
    started = true;
    init();
    animate();
}

// --- DOM ready handling ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// --- Safe container size ---
function getContainerSize() {
    const container = document.getElementById('canvasContainer');
    if (container && container.clientWidth && container.clientHeight) {
        return { width: container.clientWidth, height: container.clientHeight };
    } else {
        return { width: window.innerWidth, height: window.innerHeight * 0.6 };
    }
}

// --- Initialize scene ---
function init() {
    const size = getContainerSize();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    camera = new THREE.PerspectiveCamera(60, size.width / size.height, 0.1, 1000);
    camera.position.set(5, 5, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    scene.add(new THREE.GridHelper(20, 20));

    // UI hooks
    bindButton('exportBtn', exportScene);
    bindButton('resetScene', resetScene);
    bindButton('newCube', () => createShape('cube'));
    bindButton('newSphere', () => createShape('sphere'));

    window.addEventListener('resize', onWindowResize);
}

// --- Safe button binder ---
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

// --- Shape creation ---
function createShape(type) {
    // Remove previous objects
    if (cube) scene.remove(cube);
    if (sphere) scene.remove(sphere);

    if (type === 'cube') {
        cube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x44aa88 })
        );
        cube.position.y = 0.5;
        scene.add(cube);
    } else if (type === 'sphere') {
        sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xaa4444 })
        );
        sphere.position.y = 0.5;
        scene.add(sphere);
    }
}

// --- Export ---
function exportScene() {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
        const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// --- Reset ---
function resetScene() {
    if (cube) cube.rotation.set(0, 0, 0);
    if (sphere) sphere.rotation.set(0, 0, 0);
    controls.reset();
}

// --- Resize handler ---
function onWindowResize() {
    const size = getContainerSize();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
}

// --- Animation loop ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}