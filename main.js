import * as THREE from './three/three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';
import { GLTFExporter } from './GLTFExporter.js';

/* ---------------- DOM ELEMENTS ---------------- */
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');

function setStatus(msg) {
    statusEl.textContent = msg;
    console.log('Status:', msg);
}

/* ---------------- SCENE ---------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);
scene.add(new THREE.AxesHelper(3));

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 15, 10);
dirLight.castShadow = true;
scene.add(dirLight);

/* ---------------- BASE MODEL ---------------- */
let baseObject = null;

function removeBaseObject() {
    if (baseObject) {
        scene.remove(baseObject);
        disposeHierarchy(baseObject);
        baseObject = null;
    }
}

function disposeHierarchy(node) {
    node.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

function setupBaseObject(object) {
    removeBaseObject();

    // Center
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);

    // Scale to fit view
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    object.scale.setScalar(scale);

    // Apply material & shadows
    object.traverse(child => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x7799ff,
                metalness: 0.1,
                roughness: 0.8,
                side: THREE.DoubleSide
            });
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(object);
    baseObject = object;
    controls.target.set(0, 0, 0);
    controls.reset();
    controls.update();

    const verts = object.isMesh
        ? object.geometry.attributes.position.count
        : object.children.reduce((sum, c) => sum + (c.geometry?.attributes.position.count || 0), 0);

    setStatus(`Base model ready: ${verts} vertices`);
}

/* ---------------- PRIMITIVES ---------------- */
function createCube() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    setupBaseObject(new THREE.Mesh(geo));
}

function createSphere() {
    const geo = new THREE.SphereGeometry(0.8, 32, 24);
    setupBaseObject(new THREE.Mesh(geo));
}

/* ---------------- TOUCH SCULPTING ---------------- */
let isSculpting = false;
let lastTouch = null;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isSculpting = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        controls.enabled = false;
    } else if (e.touches.length === 2) {
        isSculpting = false;
        controls.enabled = true;
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isSculpting && e.touches.length === 1) {
        const touch = e.touches[0];
        const dy = touch.clientY - lastTouch.y;
        sculptBase(dy);
        lastTouch = { x: touch.clientX, y: touch.clientY };
    }
});

canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        isSculpting = false;
        controls.enabled = true;
    }
});

function sculptBase(dy) {
    if (!baseObject) return;
    const scaleAmount = 1 + dy * -0.002; // swipe up inflate, down deflate
    baseObject.scale.multiplyScalar(scaleAmount);
}

/* ---------------- MODEL LOADING ---------------- */
document.getElementById('objInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('Loading model...');
    const url = URL.createObjectURL(file);
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'glb' || ext === 'gltf') {
        const loader = new GLTFLoader();
        loader.load(
            url,
            gltf => {
                setupBaseObject(gltf.scene);
                URL.revokeObjectURL(url);
            },
            undefined,
            err => {
                setStatus('Failed to load model');
                console.error(err);
                URL.revokeObjectURL(url);
            }
        );
    } else {
        setStatus('Unsupported format. Use .glb or .gltf');
        URL.revokeObjectURL(url);
    }
});

/* ---------------- UI BUTTONS ---------------- */
document.getElementById('newCube')?.addEventListener('click', createCube);
document.getElementById('newSphere')?.addEventListener('click', createSphere);

document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (!baseObject) return setStatus('No object to export');
    setStatus('Exporting GLB...');
    const exporter = new GLTFExporter();
    exporter.parse(
        baseObject,
        gltf => {
            const blob = new Blob([gltf], { type: 'model/gltf-binary' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'model.glb';
            link.click();
            setStatus('Exported GLB');
        },
        { binary: true }
    );
});

document.getElementById('convertBtn')?.addEventListener('click', () => setStatus('Voxelize: Not implemented'));
document.getElementById('paintBtn')?.addEventListener('click', () => setStatus('Paint: Coming soon'));
document.getElementById('scaleBtn')?.addEventListener('click', () => setStatus('Scale: Coming soon'));
document.getElementById('moveBtn')?.addEventListener('click', () => setStatus('Move: Coming soon'));

/* ---------------- ANIMATION ---------------- */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

/* ---------------- RESIZE ---------------- */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------------- INITIALIZE ---------------- */
createCube();
setStatus('Ready – Touch screen to sculpt, pinch to orbit/zoom');