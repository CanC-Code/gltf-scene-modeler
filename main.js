// main.js – MC Voxel Builder (THREE global, ES modules for extras)
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let currentObject = null;
let started = false;

/** Entry point – guaranteed single execution */
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
    const canvas = document.getElementById('canvas');
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
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

    // --- DEFAULT OBJECT (cube) ---
    addCube();

    // --- UI HOOKS ---
    bindButton('newCube', addCube);
    bindButton('newSphere', addSphere);
    bindButton('exportBtn', exportScene);
    bindButton('resetScene', resetScene);

    // --- RESIZE ---
    window.addEventListener('resize', onWindowResize);
}

/** Safe button binder – never throws */
function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

/** Add cube (replaces existing object) */
function addCube() {
    if (currentObject) scene.remove(currentObject);
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x44aa88 })
    );
    cube.position.y = 0.5;
    scene.add(cube);
    currentObject = cube;
    updateStatus('Cube added');
}

/** Add sphere (replaces existing object) */
function addSphere() {
    if (currentObject) scene.remove(currentObject);
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xaa4444 })
    );
    sphere.position.y = 0.5;
    scene.add(sphere);
    currentObject = sphere;
    updateStatus('Sphere added');
}

function exportScene() {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
        const blob = new Blob(
            [JSON.stringify(gltf, null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function resetScene() {
    if (currentObject) currentObject.rotation.set(0, 0, 0);
    controls.reset();
}

function updateStatus(msg) {
    const status = document.getElementById('status');
    if (status) status.textContent = msg;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(
        document.getElementById('canvasContainer').clientWidth,
        document.getElementById('canvasContainer').clientHeight
    );
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}