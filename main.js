import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { MeshBVH, acceleratedRaycast } from './lib/index.module.js';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let currentModel = null;
let voxelGrid = {};
let voxelSize = 0.05;

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(3,3,3);

    renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10,10,10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Load OBJ
    document.getElementById('objInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(ev){
            status.innerText = 'Loading OBJ...';
            const loader = new OBJLoader();
            const object = loader.parse(ev.target.result);

            if(currentModel) scene.remove(currentModel);

            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3()).length();
            const scale = 2 / size;
            object.scale.set(scale, scale, scale);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center.multiplyScalar(scale));

            scene.add(object);
            currentModel = object;
            status.innerText = 'OBJ loaded!';
        };
        reader.readAsText(file);
    });

    window.addEventListener('resize', ()=>{
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate(){
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded',()=>{ init(); animate(); });