
let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let voxelSize = 1;
let voxelGrid = {}; // store voxels by "x_y_z"
let cubeMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00});

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(10,10,10);

    renderer = new THREE.WebGLRenderer({canvas: document.getElementById('canvas'), antialias: true});
    renderer.setSize(window.innerWidth*0.9, window.innerHeight*0.6);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10,10,10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);

    // Event listeners
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth*0.9, window.innerHeight*0.6);
    });

    // Add base cube
    addVoxel(0,0,0);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function key(x,y,z){ return `${x}_${y}_${z}`; }

function addVoxel(x,y,z){
    if(voxelGrid[key(x,y,z)]) return;
    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const voxel = new THREE.Mesh(geometry, cubeMaterial.clone());
    voxel.position.set(x + voxelSize/2, y + voxelSize/2, z + voxelSize/2);
    scene.add(voxel);
    voxelGrid[key(x,y,z)] = voxel;
}

function removeVoxel(x,y,z){
    const k = key(x,y,z);
    if(voxelGrid[k]){
        scene.remove(voxelGrid[k]);
        delete voxelGrid[k];
    }
}

function onPointerDown(event){
    event.preventDefault();

    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Object.values(voxelGrid));

    if(intersects.length > 0){
        const face = intersects[0].face;
        const voxel = intersects[0].object;
        const pos = voxel.position.clone();
        const normal = face.normal;

        // Shift by voxel size along normal
        const target = pos.add(normal.multiplyScalar(voxelSize));
        const x = Math.floor(target.x);
        const y = Math.floor(target.y);
        const z = Math.floor(target.z);

        if(event.shiftKey){
            removeVoxel(Math.floor(voxel.position.x), Math.floor(voxel.position.y), Math.floor(voxel.position.z));
        } else {
            addVoxel(x,y,z);
        }
    }
}

// Export JSON
document.getElementById('exportBtn').addEventListener('click', ()=>{
    const data = Object.keys(voxelGrid).map(k=>{
        const v = voxelGrid[k].position;
        return {x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z)};
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "scene.json";
    a.click();
});
