import * as THREE from './three/three.module.js';
import { OrbitControls } from './three/OrbitControls.js';
import { OBJLoader } from './three/OBJLoader.js';
import { MeshBVH, acceleratedRaycast } from './lib/index.module.js';

// Enable BVH accelerated raycasting
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let currentModel = null;
let voxelGrid = {};
let voxelSize = 0.05;
let skeleton = {};

function init() {
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(3,3,3);

    // Renderer
    renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Lights
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10,10,10);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // OBJ input
    document.getElementById('objInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(ev){
            status.innerText = 'Loading OBJ...';
            const loader = new OBJLoader();
            const object = loader.parse(ev.target.result);

            if(currentModel) scene.remove(currentModel);

            // Normalize scale & center
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

    // Convert button
    document.getElementById('convertBtn').addEventListener('click', async () => {
        if(!currentModel){ status.innerText='No model loaded!'; return; }
        status.innerText='Building BVH...';
        voxelGrid={};
        skeleton={};

        const meshes = [];
        currentModel.traverse(child=>{
            if(child.isMesh) meshes.push(child);
        });
        meshes.forEach(m=>MeshBVH.computeBoundsTree(m.geometry));

        status.innerText='Voxelizing (SDF)...';
        await sdfVoxelize(meshes, voxelSize, status);
        assignSkeleton();
        status.innerText=`Voxelization complete. Voxels: ${Object.keys(voxelGrid).length}`;
    });

    // Export JSON
    document.getElementById('exportBtn').addEventListener('click', ()=>{
        const voxelsData = Object.keys(voxelGrid).map(k=>{
            const v = voxelGrid[k].position;
            const mat = voxelGrid[k].material;
            const color = mat.color? mat.color.getHex():0x00ff00;
            const bone = voxelGrid[k].bone || 'none';
            return {x:parseFloat(v.x.toFixed(3)), y:parseFloat(v.y.toFixed(3)), z:parseFloat(v.z.toFixed(3)), color, bone};
        });
        const blob = new Blob([JSON.stringify({voxels: voxelsData, skeleton}, null, 2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download='voxels_skeleton.json';
        a.click();
    });

    window.addEventListener('resize', ()=>{
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// SDF voxelization
async function sdfVoxelize(meshes, step, status){
    const bbox = new THREE.Box3();
    meshes.forEach(m=>bbox.expandByObject(m));
    const min = bbox.min.clone(), max = bbox.max.clone();

    const nx = Math.ceil((max.x-min.x)/step);
    const ny = Math.ceil((max.y-min.y)/step);
    const nz = Math.ceil((max.z-min.z)/step);
    let processed = 0, total = nx*ny*nz;

    for(let i=0;i<nx;i++){
        for(let j=0;j<ny;j++){
            for(let k=0;k<nz;k++){
                const px = min.x + (i+0.5)*step;
                const py = min.y + (j+0.5)*step;
                const pz = min.z + (k+0.5)*step;
                const point = new THREE.Vector3(px,py,pz);

                let inside = false;
                for(const m of meshes){
                    const dist = m.geometry.boundsTree.closestPointToPoint(point, {closestPoint:new THREE.Vector3()});
                    if(point.distanceTo(dist.closestPoint) <= step/2){ inside=true; break; }
                }

                if(inside){
                    const key=`${px.toFixed(3)}_${py.toFixed(3)}_${pz.toFixed(3)}`;
                    const voxel=new THREE.Mesh(new THREE.BoxGeometry(step,step,step), new THREE.MeshStandardMaterial({color:0x00ff00}));
                    voxel.position.copy(point);
                    scene.add(voxel);
                    voxelGrid[key]=voxel;
                }

                processed++;
                if(processed%500===0){
                    status.innerText=`Voxelizing SDF... ${Math.floor(processed/total*100)}%`;
                    await new Promise(r=>setTimeout(r,0));
                }
            }
        }
    }
}

// Assign basic skeleton
function assignSkeleton(){
    if(Object.keys(voxelGrid).length===0) return;
    const bbox = new THREE.Box3();
    Object.values(voxelGrid).forEach(v=>bbox.expandByPoint(v.position));
    const min=bbox.min, max=bbox.max;
    const h = max.y-min.y;

    skeleton={
        head:{position:[0,max.y-0.15*h,0], children:['torso']},
        torso:{position:[0,min.y+0.5*h,0], children:['left_arm','right_arm','left_leg','right_leg']},
        left_arm:{position:[min.x+0.1*(max.x-min.x), min.y+0.65*h,0], children:[]},
        right_arm:{position:[max.x-0.1*(max.x-min.x), min.y+0.65*h,0], children:[]},
        left_leg:{position:[min.x+0.15*(max.x-min.x), min.y+0.25*h,0], children:[]},
        right_leg:{position:[max.x-0.15*(max.x-min.x), min.y+0.25*h,0], children:[]}
    };

    for(const key in voxelGrid){
        const v = voxelGrid[key];
        const y = v.position.y;
        if(y>min.y+0.85*h) v.bone='head';
        else if(y>min.y+0.65*h) v.bone='torso';
        else if(y<min.y+0.35*h) v.bone='legs';
        else v.bone='torso';
    }
}

function animate(){ requestAnimationFrame(animate); renderer.render(scene,camera); }

document.addEventListener('DOMContentLoaded',()=>{ init(); animate(); });
