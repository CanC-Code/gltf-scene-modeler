import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './three/lil-gui.module.min.js'; // lil-gui for controls

let scene, camera, renderer, orbitControls;
let object;
let started = false;

// Sculpting variables
let brushSize = 0.1;
let brushIntensity = 0.05;
let sculptMode = 'inflate'; // 'inflate', 'deflate', 'drag'
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let isDragging = false;

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
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // --- RENDERER ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

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

    // --- GUI ---
    const gui = new GUI();
    gui.add(window, 'sculptMode', ['inflate', 'deflate', 'drag']).name('Tool');
    gui.add(window, 'brushSize', 0.01, 0.5).name('Brush Size');
    gui.add(window, 'brushIntensity', 0.01, 0.2).name('Intensity');

    // --- UI HOOKS ---
    bindButton('exportGLTF', exportScene);
    bindButton('resetScene', resetScene);
    bindButton('newCube', () => switchObject('cube'));
    bindButton('newSphere', () => switchObject('sphere'));

    // --- MOUSE EVENTS ---
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    window.addEventListener('resize', onWindowResize);
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element not found #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

function addObject(type) {
    if (object) scene.remove(object);

    if (type === 'cube') {
        object = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2, 20, 20, 20),
            new THREE.MeshStandardMaterial({ color: 0x44aa88, flatShading: true })
        );
    } else if (type === 'sphere') {
        object = new THREE.Mesh(
            new THREE.SphereGeometry(1, 40, 40),
            new THREE.MeshStandardMaterial({ color: 0xaa4444, flatShading: true })
        );
    }
    object.position.y = 1;
    scene.add(object);
}

function switchObject(type) {
    addObject(type);
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

function resetScene() {
    if (!object) return;
    object.rotation.set(0, 0, 0);
    orbitControls.reset();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function getIntersect(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObject(object);
}

function onPointerDown(event) {
    isDragging = true;
    sculpt(event);
}

function onPointerMove(event) {
    if (isDragging) sculpt(event);
}

function onPointerUp(event) {
    isDragging = false;
}

function sculpt(event) {
    if (!object) return;
    const intersects = getIntersect(event);
    if (intersects.length === 0) return;

    const geom = object.geometry;
    geom.attributes.position.needsUpdate = true;

    const point = intersects[0].point;
    const positions = geom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
        const dist = vertex.distanceTo(point);
        if (dist < brushSize) {
            const factor = (1 - dist / brushSize) * brushIntensity;
            if (sculptMode === 'inflate') vertex.add(new THREE.Vector3(0, factor, 0));
            if (sculptMode === 'deflate') vertex.add(new THREE.Vector3(0, -factor, 0));
            if (sculptMode === 'drag') vertex.add(new THREE.Vector3((point.x - vertex.x) * factor, (point.y - vertex.y) * factor, (point.z - vertex.z) * factor));
            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
    }
    geom.computeVertexNormals();
    positions.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}