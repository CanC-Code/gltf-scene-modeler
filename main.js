// main.js – MC Voxel Builder

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let currentObject = null;
let overlayScene, overlayCamera;
let started = false;

function startApp() {
    if (started) return;
    started = true;
    init();
    animate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function init() {
    const container = document.getElementById('canvas-container');

    // --- SCENE ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    // --- CAMERA ---
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // --- RENDERER ---
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // --- CONTROLS ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);

    // --- LIGHTS ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // --- GRID ---
    scene.add(new THREE.GridHelper(20, 20));

    // --- VIEW CUBE / GIZMO ---
    overlayScene = new THREE.Scene();
    overlayCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    overlayCamera.position.set(2, 2, 2);
    const viewCube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshNormalMaterial()
    );
    overlayScene.add(viewCube);

    // --- UI HOOKS ---
    bindButton('newCube', () => spawnObject('cube'));
    bindButton('newSphere', () => spawnObject('sphere'));
    bindButton('exportBtn', exportScene);

    // --- RESIZE ---
    window.addEventListener('resize', onWindowResize);

    // --- INITIAL OBJECT ---
    spawnObject('cube');
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

function spawnObject(type) {
    if (currentObject) scene.remove(currentObject);

    if (type === 'cube') {
        currentObject = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x44aa88 })
        );
    } else if (type === 'sphere') {
        currentObject = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xaa4444 })
        );
    }

    currentObject.position.y = 0.5;
    scene.add(currentObject);

    document.getElementById('status').textContent = `Showing: ${type}`;
}

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

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);

    controls.update();
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
    renderer.render(scene, camera);

    // --- OVERLAY VIEW CUBE ---
    const size = 80;
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(renderer.domElement.width - size - 10, renderer.domElement.height - size - 10, size, size);
    renderer.setViewport(renderer.domElement.width - size - 10, renderer.domElement.height - size - 10, size, size);
    renderer.render(overlayScene, overlayCamera);
    renderer.setScissorTest(false);
}