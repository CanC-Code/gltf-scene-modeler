import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';

let scene, camera, renderer, controls;
let activeObject;

let gizmoScene, gizmoCamera, gizmoCube;

const GIZMO_SIZE = 80;
const GIZMO_MARGIN = 10;

init();
animate();

function init() {
    const canvas = document.getElementById('canvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(5, 5, 5);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClear = false;

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    scene.add(new THREE.GridHelper(20, 20));

    setActiveObject(createCube());

    // ---------- Gizmo ----------
    gizmoScene = new THREE.Scene();

    gizmoCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    gizmoCamera.position.set(3, 3, 3);
    gizmoCamera.lookAt(0, 0, 0);

    gizmoCube = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        [
            new THREE.MeshBasicMaterial({ color: 0xff5555 }),
            new THREE.MeshBasicMaterial({ color: 0xaa0000 }),
            new THREE.MeshBasicMaterial({ color: 0x55ff55 }),
            new THREE.MeshBasicMaterial({ color: 0x00aa00 }),
            new THREE.MeshBasicMaterial({ color: 0x5555ff }),
            new THREE.MeshBasicMaterial({ color: 0x0000aa })
        ]
    );

    gizmoScene.add(gizmoCube);

    canvas.addEventListener('pointerdown', onPointerDown);

    document.getElementById('newCube').onclick = () => setActiveObject(createCube());
    document.getElementById('newSphere').onclick = () => setActiveObject(createSphere());
    document.getElementById('resetScene').onclick = resetView;

    onResize();
    window.addEventListener('resize', onResize);
}

function createCube() {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x44aa88 })
    );
    m.position.y = 0.5;
    return m;
}

function createSphere() {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xaa4444 })
    );
    m.position.y = 0.5;
    return m;
}

function setActiveObject(obj) {
    if (activeObject) scene.remove(activeObject);
    activeObject = obj;
    scene.add(activeObject);
}

function resetView() {
    camera.position.set(5, 5, 5);
    camera.lookAt(controls.target);
    controls.update();
}

function onPointerDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio;

    const x = (e.clientX - rect.left) * dpr;
    const y = (rect.bottom - e.clientY) * dpr;

    const size = GIZMO_SIZE * dpr;

    const buffer = new THREE.Vector2();
    renderer.getDrawingBufferSize(buffer);

    const gx = buffer.x - size - GIZMO_MARGIN * dpr;
    const gy = size + GIZMO_MARGIN * dpr;

    if (x < gx || y > gy) return;

    resetView();
}

function animate() {
    requestAnimationFrame(animate);

    controls.update();
    renderer.clear();

    const buffer = new THREE.Vector2();
    renderer.getDrawingBufferSize(buffer);

    renderer.setViewport(0, 0, buffer.x, buffer.y);
    renderer.render(scene, camera);

    gizmoCube.quaternion.copy(camera.quaternion).invert();
    renderer.clearDepth();

    const dpr = window.devicePixelRatio;
    const size = GIZMO_SIZE * dpr;

    renderer.setViewport(
        buffer.x - size - GIZMO_MARGIN * dpr,
        GIZMO_MARGIN * dpr,
        size,
        size
    );

    renderer.render(gizmoScene, gizmoCamera);
}

function onResize() {
    const canvas = renderer.domElement;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
}