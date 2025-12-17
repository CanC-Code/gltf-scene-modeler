// main.js
// MC Voxel Builder – stable bootstrap

import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

let scene, camera, renderer, controls;
let cube, sphere;

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

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

    // --- CONTROLS ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);

    // --- LIGHTS ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // --- GRID ---
    const grid = new THREE.GridHelper(20, 20);
    scene.add(grid);

    // --- TEST OBJECTS ---
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
    cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(0, 0.5, 0);
    scene.add(cube);

    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xaa4444 });
    sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(2, 0.5, 0);
    scene.add(sphere);

    // --- OPTIONAL UI HOOKS (SAFE) ---
    hookButton('exportGLTF', exportScene);
    hookButton('resetScene', resetScene);

    // --- RESIZE ---
    window.addEventListener('resize', onWindowResize);
}

function hookButton(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`UI element #${id} not found (skipped)`);
        return;
    }
    el.onclick = handler;
}

function exportScene() {
    const exporter = new GLTFExporter();
    exporter.parse(
        scene,
        (gltf) => {
            const blob = new Blob([JSON.stringify(gltf, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scene.gltf';
            a.click();
            URL.revokeObjectURL(url);
        },
        (error) => {
            console.error('GLTF export error:', error);
        }
    );
}

function resetScene() {
    cube.rotation.set(0, 0, 0);
    sphere.rotation.set(0, 0, 0);
    controls.reset();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    cube.rotation.y += 0.01;
    sphere.rotation.x += 0.01;

    controls.update();
    renderer.render(scene, camera);
}