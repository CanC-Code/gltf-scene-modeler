import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { TransformControls } from './three/TransformControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { MeshBVH, acceleratedRaycast } from './lib/index.module.js';

// Enable BVH accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer;
let orbitControls, transformControls;

let sourceGroup, voxelGroup;
let activeMesh = null;

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(3, 3, 3);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;

    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('dragging-changed', e => {
        orbitControls.enabled = !e.value;
    });
    scene.add(transformControls);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // Groups
    sourceGroup = new THREE.Group();
    voxelGroup = new THREE.Group();
    scene.add(sourceGroup);
    scene.add(voxelGroup);

    // Helpers
    scene.add(new THREE.GridHelper(10, 10));
    scene.add(new THREE.AxesHelper(2));

    // Default primitive
    createCube();

    // UI bindings
    document.getElementById('newCube').onclick = createCube;
    document.getElementById('newSphere').onclick = createSphere;

    document.getElementById('objInput').addEventListener('change', loadOBJ);

    window.addEventListener('resize', onResize);
}

function setActiveMesh(mesh) {
    if (activeMesh) {
        transformControls.detach();
        sourceGroup.remove(activeMesh);
    }

    activeMesh = mesh;
    sourceGroup.add(activeMesh);
    transformControls.attach(activeMesh);
}

function createCube() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.geometry.computeBoundsTree();

    setActiveMesh(mesh);
}

function createSphere() {
    const geo = new THREE.SphereGeometry(0.75, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2196f3 });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.geometry.computeBoundsTree();

    setActiveMesh(mesh);
}

function loadOBJ(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        const loader = new OBJLoader();
        const object = loader.parse(ev.target.result);

        let mesh = null;
        object.traverse(child => {
            if (child.isMesh) {
                mesh = child;
            }
        });

        if (!mesh) return;

        // Normalize size
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3()).length();
        const scale = 2 / size;

        mesh.scale.setScalar(scale);
        box.setFromObject(mesh);

        const center = box.getCenter(new THREE.Vector3());
        mesh.position.sub(center);

        mesh.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        mesh.geometry.computeBoundsTree();

        setActiveMesh(mesh);
    };

    reader.readAsText(file);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    orbitControls.update();
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});
