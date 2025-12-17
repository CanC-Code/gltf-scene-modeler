import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './three/lil-gui.esm.min.js';

let scene, camera, renderer, orbitControls;
let sculptMode = true;
let currentMesh;
let gui;
let brushSettings = {
    size: 0.2,
    strength: 0.5,
    color: '#44aa88'
};
let orbitEnabled = true;

/** App start */
function startApp() {
    init();
    animate();
}

/** DOM-ready */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function init() {
    // --- Scene ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x888888);

    // --- Camera ---
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // --- Renderer ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // --- Orbit Controls ---
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.target.set(0, 0.5, 0);

    // --- Lights ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // --- Initial Mesh ---
    addObject('cube');

    // --- GUI ---
    gui = new GUI();
    const brushFolder = gui.addFolder('Brush');
    brushFolder.add(brushSettings, 'size', 0.05, 1, 0.01).name('Size');
    brushFolder.add(brushSettings, 'strength', 0.01, 1, 0.01).name('Strength');
    brushFolder.addColor(brushSettings, 'color').name('Color');
    brushFolder.open();

    // --- UI hooks ---
    bindButton('newCube', () => addObject('cube'));
    bindButton('newSphere', () => addObject('sphere'));
    bindButton('exportGLTF', exportGLTF);
    bindButton('toggleOrbit', () => {
        orbitEnabled = !orbitEnabled;
        orbitControls.enabled = orbitEnabled;
    });

    bindTabs();

    window.addEventListener('resize', onWindowResize);
}

/** Bind UI button safely */
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', handler);
}

/** Tabs */
function bindTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');
    tabs.forEach((tab, idx) => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panels.forEach(p => p.style.display = 'none');
            panels[idx].style.display = 'block';
        });
    });
}

/** Add object */
function addObject(type) {
    if (currentMesh) scene.remove(currentMesh);
    let mat = new THREE.MeshStandardMaterial({ color: brushSettings.color });
    if (type === 'cube') {
        currentMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    } else if (type === 'sphere') {
        currentMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), mat);
    }
    currentMesh.position.y = 0.5;
    scene.add(currentMesh);
}

/** Export GLTF */
function exportGLTF() {
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

/** Window resize */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/** Animation loop */
function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}