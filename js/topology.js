import * as THREE from "../three/three.module.js";

export class SpatialHash {
  constructor(geometry, cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.build(geometry);
  }
  build(geometry) {
    this.grid.clear();
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const cx = Math.floor(x / this.cellSize);
      const cy = Math.floor(y / this.cellSize);
      const cz = Math.floor(z / this.cellSize);
      const key = `${cx},${cy},${cz}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    }
  }
  query(center, radius) {
    const r = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(center.x / this.cellSize);
    const cy = Math.floor(center.y / this.cellSize);
    const cz = Math.floor(center.z / this.cellSize);
    const result = [];
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let z = cz - r; z <= cz + r; z++) {
          const key = `${x},${y},${z}`;
          if (this.grid.has(key)) {
            result.push(...this.grid.get(key));
          }
        }
      }
    }
    return result;
  }
}

export function buildAdjacencyMap(geometry) {
  const map = {};
  const index = geometry.index ? geometry.index.array : null;
  const count = geometry.attributes.position.count;
  if (!index) {
    for (let i = 0; i < count; i += 3) {
      const faceIndex = i / 3;
      for (let j = 0; j < 3; j++) {
        const v = i + j;
        if (!map[v]) map[v] = [];
        map[v].push(faceIndex);
      }
    }
  } else {
    for (let i = 0; i < index.length; i += 3) {
      const faceIndex = i / 3;
      for (let j = 0; j < 3; j++) {
        const v = index[i + j];
        if (!map[v]) map[v] = [];
        map[v].push(faceIndex);
      }
    }
  }
  return map;
}

export function updateNormals(geometry, region, adjacencyMap) {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  if (!geometry.index) { geometry.computeVertexNormals(); return; }
  const index = geometry.index.array;
  for (const i of region) normal.setXYZ(i, 0, 0, 0);
  const affectedFaces = new Set();
  for (const v of region) {
    if (adjacencyMap[v]) {
      adjacencyMap[v].forEach(f => affectedFaces.add(f));
    }
  }
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), cb = new THREE.Vector3(), ab = new THREE.Vector3(), n = new THREE.Vector3();
  for (const faceIndex of affectedFaces) {
    const a = index[faceIndex * 3], b = index[faceIndex * 3 + 1], c = index[faceIndex * 3 + 2];
    vA.set(pos.getX(a), pos.getY(a), pos.getZ(a));
    vB.set(pos.getX(b), pos.getY(b), pos.getZ(b));
    vC.set(pos.getX(c), pos.getY(c), pos.getZ(c));
    cb.subVectors(vC, vB); ab.subVectors(vA, vB); n.crossVectors(cb, ab);
    normal.setXYZ(a, normal.getX(a) + n.x, normal.getY(a) + n.y, normal.getZ(a) + n.z);
    normal.setXYZ(b, normal.getX(b) + n.x, normal.getY(b) + n.y, normal.getZ(b) + n.z);
    normal.setXYZ(c, normal.getX(c) + n.x, normal.getY(c) + n.y, normal.getZ(c) + n.z);
  }
  const tmp = new THREE.Vector3();
  for (const i of region) {
    tmp.set(normal.getX(i), normal.getY(i), normal.getZ(i)).normalize();
    normal.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  normal.needsUpdate = true;
}

export function extrudeFaces(geometry, faceIndices) {
  if (!geometry.index) return geometry;
  const pos = geometry.attributes.position;
  const norm = geometry.attributes.normal;
  const index = geometry.index.array;
  
  const newPositions = [];
  const newNormals = [];
  const newIndices = [];
  
  for (let i = 0; i < pos.count; i++) {
    newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    newNormals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
  }
  
  faceIndices.forEach(faceIdx => {
    const a = index[faceIdx * 3];
    const b = index[faceIdx * 3 + 1];
    const c = index[faceIdx * 3 + 2];
    
    // Duplicate vertices
    const va = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
    const vb = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
    const vc = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
    const fn = new THREE.Vector3().subVectors(vb, va)
                                  .cross(new THREE.Vector3().subVectors(vc, va))
                                  .normalize();

    const na = newPositions.length / 3;
    newPositions.push(pos.getX(a), pos.getY(a), pos.getZ(a));
    newNormals.push(fn.x, fn.y, fn.z);
    
    const nb = newPositions.length / 3;
    newPositions.push(pos.getX(b), pos.getY(b), pos.getZ(b));
    newNormals.push(fn.x, fn.y, fn.z);
    
    const nc = newPositions.length / 3;
    newPositions.push(pos.getX(c), pos.getY(c), pos.getZ(c));
    newNormals.push(fn.x, fn.y, fn.z);
    
    // Move along FACE normal
    const offset = 0.5;
    const nx = fn.x, ny = fn.y, nz = fn.z;
    
    newPositions[na*3] += nx * offset; newPositions[na*3+1] += ny * offset; newPositions[na*3+2] += nz * offset;
    newPositions[nb*3] += nx * offset; newPositions[nb*3+1] += ny * offset; newPositions[nb*3+2] += nz * offset;
    newPositions[nc*3] += nx * offset; newPositions[nc*3+1] += ny * offset; newPositions[nc*3+2] += nz * offset;
    
    // Top face
    newIndices.push(na, nb, nc);
    
    // Sides
    newIndices.push(a, b, nb); newIndices.push(a, nb, na);
    newIndices.push(b, c, nc); newIndices.push(b, nc, nb);
    newIndices.push(c, a, na); newIndices.push(c, na, nc);
  });
  
  for (let i = 0; i < index.length; i += 3) {
    const faceIdx = i / 3;
    if (!faceIndices.includes(faceIdx)) {
      newIndices.push(index[i], index[i+1], index[i+2]);
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
  geometry.setIndex(newIndices);
  
  return geometry;
}
