import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';

// ---------------- DOM ----------------
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
    console.log('Status:', msg);
}

// ---------------- SCENE SETUP ----------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);
scene.add(new THREE.AxesHelper(2)); // Debug axes

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// ---------------- CONTROLS ----------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

// ---------------- LIGHTING ----------------
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// ---------------- CURRENT OBJECT ----------------
let currentObject = null;

function removeCurrentObject() {
    if (currentObject) {
        scene.remove(currentObject);
        currentObject = null;
    }
}

// Collect all meshes recursively
function collectMeshes(object) {
    const meshes = [];
    object.traverse(child => {
        if (child.isMesh) meshes.push(child);
    });
    return meshes;
}

// Place object, center and scale
function placeObject(object) {
    removeCurrentObject();

    const meshes = collectMeshes(object);
    if (meshes.length === 0) {
        setStatus('Error: No meshes found in model');
        return;
    }

    let totalVertices = 0;
    meshes.forEach(mesh => {
        const pos = mesh.geometry.attributes.position;
        totalVertices += pos ? pos.count : 0;

        // Compute geometry
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeVertexNormals();

        // Preserve original material if exists
        if (!mesh.material) {
            mesh.material = new THREE.MeshStandardMaterial({
                color: 0x6688ff,
                metalness: 0.1,
                roughness: 0.9,
                side: THREE.DoubleSide
            });
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
    });

    if (totalVertices === 0) {
        setStatus('Error: Model has no vertices');
        return;
    }

    // Center and scale
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center); // center in scene

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 3;
    const scale = targetSize / maxDim;
    object.scale.setScalar(scale);

    scene.add(object);
    currentObject = object;

    controls.reset(); // recenter view
    controls.update();

    setStatus(`Loaded: ${meshes.length} mesh(es), ${totalVertices} vertices`);

    // Optional: debug bounding boxes
    // meshes.forEach(m => scene.add(new THREE.BoxHelper(m, 0xff0000)));
}

// ---------------- PRIMITIVES ----------------
function createCube() {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x44aa88 })
    );
    placeObject(mesh);
}

function createSphere() {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xaa8844 })
    );
    placeObject(mesh);
}

// ---------------- OBJ LOADING ----------------
document.getElementById('objInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('Loading OBJ...');

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const loader = new OBJLoader();
            const object = loader.parse(event.target.result);

            if (!object || object.children.length === 0) {
                setStatus('Error: Empty OBJ file');
                return;
            }

            placeObject(object);
        } catch (err) {
            setStatus('Failed to parse OBJ');
            console.error(err);
        }
    };

    reader.onerror = () => setStatus('File read error');
    reader.readAsText(file);
});

// ---------------- UI BUTTONS ----------------
document.getElementById('newCube').onclick = createCube;
document.getElementById('newSphere').onclick = createSphere;

// ---------------- ANIMATION LOOP ----------------
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// ---------------- RESIZE HANDLER ----------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- INITIALIZE ----------------
createCube();
setStatus('Ready – Load an OBJ or create a primitive');