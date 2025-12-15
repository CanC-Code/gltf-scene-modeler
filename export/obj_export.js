function exportVoxelsToOBJ(voxels){
    let obj = '';
    let vertCount = 1;
    voxels.forEach(v=>{
        const x=v.x, y=v.y, z=v.z;
        const s=1; // voxel cube size
        obj += `
v ${x} ${y} ${z}
v ${x+s} ${y} ${z}
v ${x+s} ${y+s} ${z}
v ${x} ${y+s} ${z}
v ${x} ${y} ${z+s}
v ${x+s} ${y} ${z+s}
v ${x+s} ${y+s} ${z+s}
v ${x} ${y+s} ${z+s}
`;
        obj += `
f ${vertCount} ${vertCount+1} ${vertCount+2} ${vertCount+3}
f ${vertCount+5} ${vertCount+6} ${vertCount+7} ${vertCount+8}
f ${vertCount} ${vertCount+1} ${vertCount+6} ${vertCount+5}
f ${vertCount+1} ${vertCount+2} ${vertCount+7} ${vertCount+6}
f ${vertCount+2} ${vertCount+3} ${vertCount+8} ${vertCount+7}
f ${vertCount+3} ${vertCount} ${vertCount+5} ${vertCount+8}
`;
        vertCount += 8;
    });
    return obj;
}

function downloadOBJ(text){
    const blob = new Blob([text], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download="voxels.obj";
    a.click();
}

// Expose globally
window.exportVoxelsToOBJ = exportVoxelsToOBJ;
window.downloadOBJ = downloadOBJ;
