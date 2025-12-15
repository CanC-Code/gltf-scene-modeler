import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from './three/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls;
let currentModel = null;
let voxelGrid = {}; // Placeholder for voxel conversion later

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    if (!canvas) {
        throw new Error('Canvas element not found in DOM.');
    }

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(5, 5, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Base cube as placeholder
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    scene.add(cube);

    // OBJ Input
    const objInput = document.getElementById('objInput');
    objInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            status.innerText = 'Loading OBJ...';
            const contents = e.target.result;

            try {
                const loader = new OBJLoader();
                const object = loader.parse(contents);

                // Remove previous model if exists
                if (currentModel) scene.remove(currentModel);

                // Compute bounding box for scaling and centering
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3()).length();
                const scale = 2 / size; // normalize to roughly 2 units
                object.scale.set(scale, scale, scale);

                // Center the object
                const center = box.getCenter(new THREE.Vector3());
                object.position.sub(center.multiplyScalar(scale));

                scene.add(object);
                currentModel = object;

                status.innerText = 'OBJ loaded!';
            } catch (err) {
                console.error('OBJ load error:', err);
                status.innerText = 'Error loading OBJ';
            }
        };
        reader.readAsText(file);
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Export JSON placeholder
    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = Object.keys(voxelGrid).map(k => {
            const v = voxelGrid[k].position;
            return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "scene.json";
        a.click();
    });
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});