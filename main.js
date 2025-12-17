// main.js – MC Voxel Builder (Sculpting Enabled)

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './lil-gui.esm.min.js';

let scene, camera, renderer, orbitControls;
let activeMesh = null;
let raycaster, mouse;
let gui, brushSettings;
let started = false;

/**
 * Entry point
 */
function startApp() {
    if (started) return;
    started = true;
    init();
    animate();
}

/**
 * DOM-ready handling
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function init() {
    // --- SCENE ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    // --- CAMERA ---
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // --- RENDERER ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

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

    // --- RAYCASTER & MOUSE ---
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // --- GUI ---
    brushSettings = {
        brushSize: 0.5,
        brushIntensity: 0.2,
        brushMode: 'add', // add, remove, inflate, deflate, smooth
    };
    gui = new GUI();
    gui.add(brushSettings, 'brushSize', 0.1, 2).name('Brush Size');
    gui.add(brushSettings, 'brushIntensity', 0.01, 1).name('Brush Intensity');
    gui.add(brushSettings, 'brushMode', ['add', 'remove', 'inflate', 'deflate', 'smooth']).name('Brush Mode');

    // --- UI HOOKS ---
    bindButton('exportGLTF', exportScene);
    bindButton('resetScene', resetScene);
    bindButton('newCube', () => addObject('cube'));
    bindButton('newSphere', () => addObject('sphere'));

    // --- MOUSE / TOUCH EVENTS ---
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // --- RESIZE ---
    window.addEventListener('resize', onWindowResize);
}

// Safe button binder
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

// Add or switch the active object
function addObject(type) {
    if (activeMesh) {
        scene.remove(activeMesh);
        activeMesh.geometry.dispose();
        activeMesh.material.dispose();
    }
    if (type === 'cube') {
        activeMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1, 16, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0x44aa88, flatShading: true })
        );
    } else if (type === 'sphere') {
        activeMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xaa4444, flatShading: true })
        );
    }
    activeMesh.position.y = 0.5;
    scene.add(activeMesh);
}

// Export scene to GLTF
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

// Reset object rotation and camera
function resetScene() {
    if (!activeMesh) return;
    activeMesh.rotation.set(0, 0, 0);
    orbitControls.reset();
}

// Window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Pointer events
let isDragging = false;

function onPointerDown(event) {
    isDragging = true;
    applyBrush(event);
}

function onPointerMove(event) {
    if (!isDragging) return;
    applyBrush(event);
}

// Apply brush effect
function applyBrush(event) {
    if (!activeMesh) return;

    // normalize pointer
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(activeMesh);
    if (!intersects.length) return;

    const point = intersects[0].point;
    const geometry = activeMesh.geometry;
    geometry.computeBoundingSphere();
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const vx = position.getX(i);
        const vy = position.getY(i);
        const vz = position.getZ(i);
        const v = new THREE.Vector3(vx, vy, vz);
        const worldV = v.clone().applyMatrix4(activeMesh.matrixWorld);
        const dist = worldV.distanceTo(point);

        if (dist <= brushSettings.brushSize) {
            // Simple add/remove along normal
            const delta = brushSettings.brushIntensity;
            if (brushSettings.brushMode === 'add') {
                position.setY(i, vy + delta);
            } else if (brushSettings.brushMode === 'remove') {
                position.setY(i, vy - delta);
            } else if (brushSettings.brushMode === 'inflate') {
                const dir = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(delta);
                position.setXYZ(i, vx + dir.x, vy + dir.y, vz + dir.z);
            } else if (brushSettings.brushMode === 'deflate') {
                const dir = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(-delta);
                position.setXYZ(i, vx + dir.x, vy + dir.y, vz + dir.z);
            } else if (brushSettings.brushMode === 'smooth') {
                position.setY(i, vy * 0.9 + intersects[0].point.y * 0.1);
            }
        }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}