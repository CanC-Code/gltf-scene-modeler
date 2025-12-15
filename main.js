import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from './three/examples/jsm/loaders/OBJLoader.js';

let scene, camera, renderer, controls;
let currentModel = null;
let voxelGrid = {};
const voxelSize = 0.1; // size of each voxel

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    if (!canvas) throw new Error('Canvas element not found.');

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
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

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

                // Remove previous model
                if (currentModel) scene.remove(currentModel);

                // Scale and center
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3()).length();
                const scale = 2 / size;
                object.scale.set(scale, scale, scale);
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

    // Convert to Voxels button
    const convertBtn = document.createElement('button');
    convertBtn.innerText = 'Convert to Voxels';
    document.getElementById('toolbar').appendChild(convertBtn);

    convertBtn.addEventListener('click', () => {
        if (!currentModel) {
            status.innerText = 'No model loaded!';
            return;
        }
        status.innerText = 'Converting to voxels...';
        voxelGrid = {}; // clear previous voxels

        const bbox = new THREE.Box3().setFromObject(currentModel);
        const min = bbox.min.clone();
        const max = bbox.max.clone();

        const step = voxelSize;

        for (let x = min.x; x <= max.x; x += step) {
            for (let y = min.y; y <= max.y; y += step) {
                for (let z = min.z; z <= max.z; z += step) {
                    const point = new THREE.Vector3(x + step/2, y + step/2, z + step/2);
                    if (pointInsideMesh(point, currentModel)) {
                        const key = `${x.toFixed(2)}_${y.toFixed(2)}_${z.toFixed(2)}`;
                        const voxel = new THREE.Mesh(
                            new THREE.BoxGeometry(step, step, step),
                            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
                        );
                        voxel.position.copy(point);
                        scene.add(voxel);
                        voxelGrid[key] = voxel;
                    }
                }
            }
        }

        status.innerText = `Conversion complete! Voxels: ${Object.keys(voxelGrid).length}`;
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Export JSON
    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = Object.keys(voxelGrid).map(k => {
            const v = voxelGrid[k].position;
            return { x: parseFloat(v.x.toFixed(2)), y: parseFloat(v.y.toFixed(2)), z: parseFloat(v.z.toFixed(2)) };
        });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "voxels.json";
        a.click();
    });
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Very simple point-inside-mesh check
function pointInsideMesh(point, mesh) {
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(1, 0, 0);
    raycaster.set(point, direction);
    const intersects = raycaster.intersectObject(mesh, true);
    return intersects.length % 2 === 1; // odd intersections = inside
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});