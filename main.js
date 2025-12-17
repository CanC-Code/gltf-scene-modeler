// main.js – MC Voxel Builder (DOM-safe, mobile + desktop compatible)

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { TransformControls } from './three/TransformControls.js';

let scene, camera, renderer, orbitControls, transformControls;
let activeObject;
let started = false;

/**
 * Entry point – guaranteed single execution
 */
function startApp() {
    if (started) return;
    started = true;

    init();
    animate();
}

/**
 * DOM-ready handling (all browsers)
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

/**
 * Initialize scene, camera, renderer, controls, lights, grid, and objects
 */
function init() {
    const container = document.getElementById('viewport-container') || document.body;

    // --- SCENE ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    // --- CAMERA ---
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // --- RENDERER ---
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // --- ORBIT CONTROLS ---
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.target.set(0, 0.5, 0);

    // --- LIGHTS ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // --- GRID ---
    scene.add(new THREE.GridHelper(20, 20));

    // --- INITIAL OBJECT ---
    addObject('cube');

    // --- TRANSFORM CONTROLS ---
    if (TransformControls) {
        transformControls = new TransformControls(camera, renderer.domElement);
        transformControls.attach(activeObject);
        transformControls.addEventListener('dragging-changed', function (event) {
            orbitControls.enabled = !event.value;
        });
        scene.add(transformControls);
    } else {
        console.error('TransformControls module is missing!');
    }

    // --- UI HOOKS ---
    bindButton('exportGLTF', exportScene);
    bindButton('resetScene', resetScene);
    bindButton('newCube', () => switchObject('cube'));
    bindButton('newSphere', () => switchObject('sphere'));

    const modeSelect = document.getElementById('modeSelect');
    if (modeSelect && transformControls) {
        modeSelect.addEventListener('change', () => {
            transformControls.setMode(modeSelect.value);
        });
    }

    // --- RESIZE ---
    window.addEventListener('resize', onWindowResize);
}

/**
 * Safe button binder – never throws
 */
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

/**
 * Add an object to the scene (cube or sphere)
 */
function addObject(type) {
    if (activeObject) scene.remove(activeObject);

    if (type === 'cube') {
        activeObject = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x44aa88 })
        );
    } else if (type === 'sphere') {
        activeObject = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xaa4444 })
        );
    }

    activeObject.position.y = 0.5;
    scene.add(activeObject);

    if (transformControls) transformControls.attach(activeObject);
}

/**
 * Switch the displayed object
 */
function switchObject(type) {
    addObject(type);
}

/**
 * Export the current scene to glTF
 */
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

/**
 * Reset scene to initial state
 */
function resetScene() {
    if (!activeObject) return;
    activeObject.rotation.set(0, 0, 0);
    if (transformControls) transformControls.attach(activeObject);
    orbitControls.reset();
}

/**
 * Handle window resize
 */
function onWindowResize() {
    const container = document.getElementById('viewport-container') || document.body;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}