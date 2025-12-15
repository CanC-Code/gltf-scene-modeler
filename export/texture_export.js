function generateTextureAtlas(voxels){
    const size = 16; // size per color
    const uniqueColors = [...new Set(voxels.map(v=>v.color))];
    const cols = Math.ceil(Math.sqrt(uniqueColors.length));
    const canvas = document.createElement('canvas');
    canvas.width = cols*size;
    canvas.height = cols*size;
    const ctx = canvas.getContext('2d');
    uniqueColors.forEach((c,i)=>{
        const x = (i%cols)*size;
        const y = Math.floor(i/cols)*size;
        ctx.fillStyle = c;
        ctx.fillRect(x,y,size,size);
    });
    return {canvas, uniqueColors};
}

function downloadTexture(canvas){
    canvas.toBlob(blob=>{
        const url = URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download="texture_atlas.png";
        a.click();
    });
}

// Expose globally
window.generateTextureAtlas = generateTextureAtlas;
window.downloadTexture = downloadTexture;
