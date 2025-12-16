import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { GLTFExporter } from './three/GLTFExporter.js';

/* ---------------- DOM ---------------- */
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
controls.enablePan = false; // mobile, disable panning with two fingers
controls.enableZoom = true;
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

    // Center and scale
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center);
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

/* ---------------- MODEL LOADING ---------------- */
document.getElementById('modelInput').addEventListener('change', e => {
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

/* ---------------- BUTTONS ---------------- */
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('newCube').onclick = createCube;
    document.getElementById('newSphere').onclick = createSphere;

    document.getElementById('exportBtn').onclick = () => {
        if (!baseObject) return setStatus('No object to export');
        setStatus('Exporting GLB...');
        const exporter = new GLTFExporter();
        exporter.parse(baseObject, gltf => {
            const blob = new Blob([gltf], { type: 'model/gltf-binary' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'model.glb';
            link.click();
            setStatus('Exported GLB');
        }, { binary: true });
    };

    document.getElementById('convertBtn').onclick = () => {
        if (!baseObject) return setStatus('No object to voxelize');
        setStatus('Voxelize and export: Not implemented yet');
    };

    document.getElementById('paintBtn').onclick = () => setStatus('Paint mode: Coming soon');
    document.getElementById('scaleBtn').onclick = () => setStatus('Scale tool: Coming soon');
    document.getElementById('moveBtn').onclick = () => setStatus('Move tool: Coming soon');
});

/* ---------------- TOUCH SCULPT ---------------- */
let isSculpting = false;

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        isSculpting = true;
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (isSculpting && baseObject) {
        const touch = e.touches[0];
        // Simple inflate/deflate based on vertical drag
        const delta = touch.movementY || (touch.pageY - (touch.prevY || touch.pageY));
        const scaleFactor = 1 - delta * 0.005;
        baseObject.scale.multiplyScalar(scaleFactor);
        touch.prevY = touch.pageY;
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
        isSculpting = false;
    }
}, { passive: false });

/* ---------------- ANIMATE ---------------- */
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
setStatus('Ready – Tap to sculpt, use two fingers to orbit camera');