import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { TransformControls } from './three/TransformControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import GUI from './three/lil-gui.esm.min.js';

let scene, camera, renderer, orbitControls, transformControls;
let mesh, gui, viewCube;
let cameraLocked = false;

init();
animate();

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('viewport'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Orbit Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.target.set(0, 0.5, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Grid
    scene.add(new THREE.GridHelper(20, 20));

    // Initial Cube
    mesh = createCube();
    scene.add(mesh);

    // Transform Controls
    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.attach(mesh);
    transformControls.addEventListener('dragging-changed', function(event){
        orbitControls.enabled = !event.value;
    });
    scene.add(transformControls);

    // GUI
    gui = new GUI({ container: document.getElementById('gui-container') });
    setupGUI();

    // View Cube
    viewCube = createViewCube();
    document.body.appendChild(viewCube.dom);

    // Camera Lock Button
    document.getElementById('cameraLock').addEventListener('click', () => {
        cameraLocked = !cameraLocked;
        orbitControls.enabled = !cameraLocked;
    });

    window.addEventListener('resize', onWindowResize);
}

function setupGUI() {
    const tabs = gui.addFolder('Sculpt Tools');
    const sculptParams = {
        brushSize: 0.2,
        intensity: 0.1,
        inflate: () => applyBrush('inflate'),
        deflate: () => applyBrush('deflate'),
        smooth: () => applyBrush('smooth'),
        flatten: () => applyBrush('flatten'),
    };
    tabs.add(sculptParams, 'brushSize', 0.05, 1);
    tabs.add(sculptParams, 'intensity', 0.01, 1);
    tabs.add(sculptParams, 'inflate');
    tabs.add(sculptParams, 'deflate');
    tabs.add(sculptParams, 'smooth');
    tabs.add(sculptParams, 'flatten');

    const objectTab = gui.addFolder('Objects');
    objectTab.add({ addCube: addCube }, 'addCube');
    objectTab.add({ addSphere: addSphere }, 'addSphere');
    objectTab.add({ toggleGizmo: toggleGizmo }, 'toggleGizmo');

    const exportTab = gui.addFolder('Export/Load');
    exportTab.add({ exportGLTF: exportGLTF }, 'exportGLTF');
}

function createCube() {
    const geom = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x44aa88, flatShading: false });
    return new THREE.Mesh(geom, mat);
}

function createSphere() {
    const geom = new THREE.SphereGeometry(0.5, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaa4444 });
    return new THREE.Mesh(geom, mat);
}

function addCube() {
    if(mesh) scene.remove(mesh);
    mesh = createCube();
    scene.add(mesh);
    transformControls.attach(mesh);
}

function addSphere() {
    if(mesh) scene.remove(mesh);
    mesh = createSphere();
    scene.add(mesh);
    transformControls.attach(mesh);
}

function toggleGizmo() {
    transformControls.visible = !transformControls.visible;
}

function applyBrush(type) {
    if(!mesh) return;
    // Placeholder: Implement sculpting logic per vertex
    console.log(`Applying brush ${type}`);
}

function exportGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(scene, (gltf) => {
        const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.gltf';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function createViewCube() {
    const dom = document.createElement('div');
    dom.style.position = 'absolute';
    dom.style.top = '50px';
    dom.style.right = '10px';
    dom.style.width = '80px';
    dom.style.height = '80px';
    dom.style.background = 'rgba(40,40,40,0.7)';
    dom.style.zIndex = '20';
    dom.style.borderRadius = '8px';
    dom.innerText = 'View Cube';
    return { dom };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}