import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from './lib/index.module.js';

/* --------------------------
   BVH PATCH
--------------------------- */
THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

/* --------------------------
   GLOBALS
--------------------------- */
let scene, camera, renderer, controls;
let activeObject = null;

/* --------------------------
   INIT
--------------------------- */
function init() {
    const canvas = document.getElementById('canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    scene.add(new THREE.GridHelper(10, 10));
    scene.add(new THREE.AxesHelper(2));

    bindUI();
    createCube();

    window.addEventListener('resize', onResize);
}

/* --------------------------
   UI
--------------------------- */
function bindUI() {
    const cubeBtn = document.getElementById('newCube');
    if (cubeBtn) cubeBtn.onclick = createCube;

    const sphereBtn = document.getElementById('newSphere');
    if (sphereBtn) sphereBtn.onclick = createSphere;

    const objInput = document.getElementById('objInput');
    if (objInput) objInput.addEventListener('change', loadOBJ);

    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) convertBtn.onclick = () => alert('Voxelization not implemented yet');

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = () => alert('Export not implemented yet');
}

/* --------------------------
   ACTIVE OBJECT HANDLING
--------------------------- */
function setActiveObject(obj) {
    if (activeObject) {
        if (activeObject.geometry?.disposeBoundsTree) activeObject.geometry.disposeBoundsTree();
        scene.remove(activeObject);
    }
    activeObject = obj;
    scene.add(activeObject);
}

/* --------------------------
   PRIMITIVES
--------------------------- */
function createCube() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.computeBoundsTree();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    setActiveObject(new THREE.Mesh(geo, mat));
}

function createSphere() {
    const geo = new THREE.SphereGeometry(0.75, 32, 32);
    geo.computeBoundsTree();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2196f3 });
    setActiveObject(new THREE.Mesh(geo, mat));
}

/* --------------------------
   OBJ LOADER
--------------------------- */
function loadOBJ(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const loader = new OBJLoader();
            const obj = loader.parse(ev.target.result);

            const group = new THREE.Group();
            obj.traverse(child => {
                if (child.isMesh) {
                    if (!child.material) child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
                    child.geometry.computeBoundsTree();
                    group.add(child);
                }
            });

            if (group.children.length === 0) {
                console.warn('No meshes found in OBJ file.');
                return;
            }

            // Scale and center
            const box = new THREE.Box3().setFromObject(group);
            const size = box.getSize(new THREE.Vector3());
            const scale = 2 / Math.max(size.x, size.y, size.z, 1);
            group.scale.setScalar(scale);
            const center = box.getCenter(new THREE.Vector3());
            group.position.sub(center);

            setActiveObject(group);
            console.log('OBJ loaded:', group);
        } catch (err) {
            console.error('Failed to parse OBJ:', err);
        }
    };
    reader.readAsText(file);
}

/* --------------------------
   RESIZE + ANIMATE
--------------------------- */
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
