import * as THREE from "../three/three.module.js";
import { OrbitControls } from "../three/OrbitControls.js";

/* =========================
   Renderer / Scene
========================= */

const canvas = document.querySelector("#viewport");

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
);
camera.position.set(3, 3, 6);

/* =========================
   Controls
========================= */

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

/* =========================
   Lighting
========================= */

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

/* =========================
   Example Editable Object
========================= */

const modelGroup = new THREE.Group();
scene.add(modelGroup);

const baseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6699ff })
);
modelGroup.add(baseMesh);

/* =========================
   View Gizmo Scene
========================= */

const gizmoScene = new THREE.Scene();

const gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
gizmoCamera.position.set(0, 0, 6);

const gizmoLight = new THREE.DirectionalLight(0xffffff, 1);
gizmoLight.position.set(2, 3, 4);
gizmoScene.add(gizmoLight);
gizmoScene.add(new THREE.AmbientLight(0xffffff, 0.5));

/* =========================
   View Cube (True 3D)
========================= */

const cubeSize = 1;
const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

const cubeMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xff5555 }), // +X
    new THREE.MeshStandardMaterial({ color: 0x55ff55 }), // -X
    new THREE.MeshStandardMaterial({ color: 0x5555ff }), // +Y
    new THREE.MeshStandardMaterial({ color: 0xffff55 }), // -Y
    new THREE.MeshStandardMaterial({ color: 0xff55ff }), // +Z
    new THREE.MeshStandardMaterial({ color: 0x55ffff })  // -Z
];

const viewCube = new THREE.Mesh(cubeGeo, cubeMaterials);
gizmoScene.add(viewCube);

/* =========================
   Cardinal Labels
========================= */

function createDirectionSprite(text) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.9, 0.9, 1);
    return sprite;
}

const north = createDirectionSprite("N");
north.position.set(0, 0.01, -1.2);

const south = createDirectionSprite("S");
south.position.set(0, 0.01, 1.2);

const east = createDirectionSprite("E");
east.position.set(1.2, 0.01, 0);

const west = createDirectionSprite("W");
west.position.set(-1.2, 0.01, 0);

gizmoScene.add(north, south, east, west);

/* =========================
   Dynamic Gizmo Scaling
========================= */

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();

function updateGizmoScale() {
    tempBox.setFromObject(modelGroup);
    tempBox.getSize(tempSize);

    const maxAxis = Math.max(tempSize.x, tempSize.y, tempSize.z);
    const scale = THREE.MathUtils.clamp(1 / (maxAxis || 1), 0.25, 1);

    viewCube.scale.lerp(
        new THREE.Vector3(scale, scale, scale),
        0.15
    );
}

/* =========================
   Resize Handling
========================= */

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================
   Render Loop
========================= */

function animate() {
    requestAnimationFrame(animate);

    controls.update();
    updateGizmoScale();

    // Match gizmo orientation to camera
    viewCube.quaternion.copy(camera.quaternion).invert();

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // Gizmo viewport (bottom-right)
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.18;
    renderer.setViewport(
        window.innerWidth - size - 12,
        12,
        size,
        size
    );
    renderer.setScissor(
        window.innerWidth - size - 12,
        12,
        size,
        size
    );
    renderer.setScissorTest(true);
    renderer.render(gizmoScene, gizmoCamera);
}

animate();
