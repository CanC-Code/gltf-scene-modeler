import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { MeshBVH, acceleratedRaycast } from './lib/index.module.js';

// Enable BVH accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let currentModel = null;
let voxelGrid = {};
let voxelSize = 0.05;

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

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
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // DEBUG CUBE (guarantees visibility)
    const debugCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshNormalMaterial()
    );
    scene.add(debugCube);

    // OBJ Loader
    document.getElementById('objInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        status.innerText = 'Loading OBJ...';

        const reader = new FileReader();
        reader.onload = ev => {
            const loader = new OBJLoader();
            const object = loader.parse(ev.target.result);

            if (currentModel) {
                scene.remove(currentModel);
            }

            // Compute bounding box safely
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const scale = 2 / maxDim;

            object.scale.setScalar(scale);

            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center.multiplyScalar(scale));

            scene.add(object);
            currentModel = object;

            status.innerText = 'OBJ loaded!';
        };

        reader.readAsText(file);
    });

    // Resize handling
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});
