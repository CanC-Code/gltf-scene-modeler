import { buildBedrockGeometry } from "./export/bedrock_geometry.js";
import { generateTextureAtlas, downloadTexture } from "./export/texture_export.js";
import {
    generateResourceEntity,
    generateBehaviorEntity,
    downloadJSON
} from "./export/entity_export.js";

let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let voxelSize = 1;
let voxelGrid = new Map(); // key -> mesh

const canvas = document.getElementById("canvas");
const objInput = document.getElementById("objInput");
const voxelSizeInput = document.getElementById("voxelSizeInput");
const clearBtn = document.getElementById("clearBtn");
const exportGeoBtn = document.getElementById("exportGeoBtn");

init();
animate();

/* ---------------- INIT ---------------- */

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(
        70,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );
    camera.position.set(12, 12, 12);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light);

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);

    voxelSizeInput.addEventListener("change", () => {
        voxelSize = parseFloat(voxelSizeInput.value);
    });

    clearBtn.addEventListener("click", clearVoxels);
    objInput.addEventListener("change", loadOBJ);

    addVoxel(0, 0, 0);
}

/* ---------------- RENDER ---------------- */

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
}

/* ---------------- GRID ---------------- */

function key(x, y, z) {
    return `${x},${y},${z}`;
}

function addVoxel(x, y, z, color = "#55ff55") {
    const k = key(x, y, z);
    if (voxelGrid.has(k)) return;

    const geo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
        x * voxelSize + voxelSize / 2,
        y * voxelSize + voxelSize / 2,
        z * voxelSize + voxelSize / 2
    );

    mesh.userData = { x, y, z, color };

    voxelGrid.set(k, mesh);
    scene.add(mesh);
}

function removeVoxel(x, y, z) {
    const k = key(x, y, z);
    const mesh = voxelGrid.get(k);
    if (!mesh) return;
    scene.remove(mesh);
    voxelGrid.delete(k);
}

function clearVoxels() {
    voxelGrid.forEach(v => scene.remove(v));
    voxelGrid.clear();
}

/* ---------------- INTERACTION ---------------- */

function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...voxelGrid.values()]);
    if (!hits.length) return;

    const hit = hits[0];
    const v = hit.object.userData;
    const n = hit.face.normal;

    if (event.shiftKey) {
        removeVoxel(v.x, v.y, v.z);
    } else {
        addVoxel(
            v.x + Math.round(n.x),
            v.y + Math.round(n.y),
            v.z + Math.round(n.z),
            v.color
        );
    }
}

/* ---------------- OBJ IMPORT ---------------- */

function loadOBJ(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        const loader = new THREE.OBJLoader();
        const obj = loader.parse(e.target.result);
        voxelizeMesh(obj);
    };
    reader.readAsText(file);
}

/* ---------------- VOXELIZATION ---------------- */

function voxelizeMesh(object) {
    clearVoxels();
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const min = box.min;
    const max = box.max;

    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    const ray = new THREE.Raycaster();

    for (let x = min.x; x <= max.x; x += voxelSize) {
        for (let y = min.y; y <= max.y; y += voxelSize) {
            for (let z = min.z; z <= max.z; z += voxelSize) {
                const p = new THREE.Vector3(
                    x + voxelSize / 2,
                    y + voxelSize / 2,
                    z + voxelSize / 2
                ).applyMatrix4(inv);

                ray.set(p, new THREE.Vector3(1, 0, 0));
                const hits = ray.intersectObject(object, true);

                if (hits.length % 2 === 1) {
                    addVoxel(
                        Math.floor(x / voxelSize),
                        Math.floor(y / voxelSize),
                        Math.floor(z / voxelSize)
                    );
                }
            }
        }
    }
}

/* ---------------- EXPORTS ---------------- */

exportGeoBtn.addEventListener("click", () => {
    const voxels = [...voxelGrid.values()].map(v => ({
        x: v.userData.x,
        y: v.userData.y,
        z: v.userData.z,
        color: v.userData.color
    }));

    // Geometry
    const geometry = buildBedrockGeometry(voxels, {
        name: "geometry.voxel_model"
    });
    downloadJSON(geometry, "voxel.geo.json");

    // Texture
    const atlas = generateTextureAtlas(voxels);
    downloadTexture(atlas.canvas, "voxel.png");

    // Entities
    const res = generateResourceEntity();
    const beh = generateBehaviorEntity();

    downloadJSON(res, "voxel.entity.json");
    downloadJSON(beh, "voxel.behavior.json");
});