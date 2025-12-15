function exportVoxelsToFBX(voxels){
    let fbx = `; FBX 7.4.0 project file
Objects:  {
`;
    let id = 1000;
    voxels.forEach(v=>{
        fbx += `    Model: ${id}, "Model::Voxel", "Mesh" {}\n`;
        id++;
    });
    fbx += `}
Connections:  {
`;
    id = 1000;
    voxels.forEach(v=>{
        fbx += `    C: "OO",${id},0\n`;
        id++;
    });
    fbx += `}`;
    const enc = new TextEncoder();
    return enc.encode(fbx).buffer;
}

function downloadFBX(buffer){
    const blob = new Blob([buffer], {type:"application/octet-stream"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;
    a.download="voxels.fbx";
    a.click();
}

// Expose globally
window.exportVoxelsToFBX = exportVoxelsToFBX;
window.downloadFBX = downloadFBX;
