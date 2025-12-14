let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let voxelSize = 1;
let voxelGrid = {};
let cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x22ff55 });

let loadedOBJ = null;

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(12, 12, 12);

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true
    });
    renderer.setSize(window.innerWidth * 0.9, window.innerHeight * 0.6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 15, 10);
    scene.add(light);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth * 0.9, window.innerHeight * 0.6);
    });
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function key(x, y, z) {
    return `${x}_${y}_${z}`;
}

function clearVoxels() {
    Object.values(voxelGrid).forEach(v => scene.remove(v));
    voxelGrid = {};
}

function addVoxel(x, y, z) {
    const k = key(x, y, z);
    if (voxelGrid[k]) return;

    const geo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const cube = new THREE.Mesh(geo, cubeMaterial.clone());
    cube.position.set(x + 0.5, y + 0.5, z + 0.5);

    scene.add(cube);
    voxelGrid[k] = cube;
}

function onPointerDown(event) {
    mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(Object.values(voxelGrid));

    if (!hits.length) return;

    const hit = hits[0];
    const normal = hit.face.normal.clone();
    const pos = hit.object.position.clone().add(normal);

    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    const z = Math.floor(pos.z);

    if (event.shiftKey) {
        const p = hit.object.position;
        removeVoxel(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    } else {
        addVoxel(x, y, z);
    }
}

function removeVoxel(x, y, z) {
    const k = key(x, y, z);
    if (!voxelGrid[k]) return;
    scene.remove(voxelGrid[k]);
    delete voxelGrid[k];
}

/* ===================== OBJ LOADING ===================== */

document.getElementById("objInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const loader = new THREE.OBJLoader();
        if (loadedOBJ) scene.remove(loadedOBJ);
        loadedOBJ = loader.parse(reader.result);
        scene.add(loadedOBJ);
    };
    reader.readAsText(file);
});

document.getElementById("voxelizeBtn").addEventListener("click", () => {
    if (!loadedOBJ) {
        alert("Load an OBJ first");
        return;
    }
    voxelizeOBJ(loadedOBJ);
});

/* ===================== VOXELIZATION ===================== */

function voxelizeOBJ(obj) {
    clearVoxels();

    const bbox = new THREE.Box3().setFromObject(obj);
    const min = bbox.min;
    const max = bbox.max;

    const testGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);

    for (let x = Math.floor(min.x); x <= Math.ceil(max.x); x++) {
        for (let y = Math.floor(min.y); y <= Math.ceil(max.y); y++) {
            for (let z = Math.floor(min.z); z <= Math.ceil(max.z); z++) {

                const probe = new THREE.Mesh(testGeo);
                probe.position.set(x + 0.5, y + 0.5, z + 0.5);

                if (intersectsOBJ(probe, obj)) {
                    addVoxel(x, y, z);
                }
            }
        }
    }

    alert(`Voxelized: ${Object.keys(voxelGrid).length} cubes`);
}

function intersectsOBJ(voxel, obj) {
    const voxelBox = new THREE.Box3().setFromObject(voxel);
    let hit = false;

    obj.traverse(c => {
        if (!c.isMesh || hit) return;
        const meshBox = new THREE.Box3().setFromObject(c);
        if (voxelBox.intersectsBox(meshBox)) hit = true;
    });

    return hit;
}

/* ===================== BEDROCK EXPORT ===================== */

document.getElementById("exportGeoBtn").addEventListener("click", () => {
    const cubes = Object.values(voxelGrid).map(v => ({
        origin: [
            v.position.x - 0.5,
            v.position.y - 0.5,
            v.position.z - 0.5
        ],
        size: [1, 1, 1],
        uv: [0, 0]
    }));

    const geo = {
        format_version: "1.12.0",
        "minecraft:geometry": [{
            description: {
                identifier: "geometry.voxel_model",
                texture_width: 128,
                texture_height: 128
            },
            bones: [{
                name: "body",
                pivot: [0, 0, 0],
                cubes
            }]
        }]
    };

    download(JSON.stringify(geo, null, 2), "geometry.voxel_model.json");
});

document.getElementById("exportPngBtn").addEventListener("click", () => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#22ff55";
    ctx.fillRect(0, 0, size, size);

    canvas.toBlob(b => {
        downloadBlob(b, "voxel_texture.png");
    });
});

function download(text, name) {
    const blob = new Blob([text], { type: "application/json" });
    downloadBlob(blob, name);
}

function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}