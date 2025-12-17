import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let selectedObject = null;
let started = false;

/** Entry point */
function startApp() {
    if (started) return;
    started = true;

    init();
    animate();
}

/** DOM-ready handling */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('canvas') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Grid
    scene.add(new THREE.GridHelper(20, 20));

    // UI Bindings
    bindButton('newCube', () => addPrimitive('cube'));
    bindButton('newSphere', () => addPrimitive('sphere'));
    bindButton('rotateBtn', () => setTool('rotate'));
    bindButton('scaleBtn', () => setTool('scale'));
    bindButton('inflateBtn', () => setTool('inflate'));
    bindButton('deflateBtn', () => setTool('deflate'));
    bindButton('smoothBtn', () => setTool('smooth'));
    bindButton('resetScene', resetScene);
    bindButton('exportGLTF', exportScene);

    window.addEventListener('resize', onWindowResize);
}

// --- UI Helpers ---
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

// --- Tools ---
let currentTool = null;
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('#toolbar button').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(tool + 'Btn');
    if (btn) btn.classList.add('active');
}

// --- Primitive creation ---
function addPrimitive(type) {
    if (selectedObject) scene.remove(selectedObject);

    if (type === 'cube') {
        selectedObject = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0x44aa88 })
        );
    } else if (type === 'sphere') {
        selectedObject = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0xaa4444 })
        );
    }

    selectedObject.position.y = 0.5;
    scene.add(selectedObject);
}

// --- Scene Controls ---
function resetScene() {
    selectedObject = null;
    while(scene.children.length > 4) scene.remove(scene.children[4]); // Remove extra objects
    controls.reset();
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

// --- Resize ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (selectedObject) {
        // Simple demo rotation if rotate tool is active
        if (currentTool === 'rotate') selectedObject.rotation.y += 0.01;
    }

    controls.update();
    renderer.render(scene, camera);
}