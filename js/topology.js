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
  const index = geometry.index.array;

  // 1. Calculate average normal for region extrusion
  const avgNormal = new THREE.Vector3();
  faceIndices.forEach(faceIdx => {
    const a = index[faceIdx * 3], b = index[faceIdx * 3 + 1], c = index[faceIdx * 3 + 2];
    const va = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
    const vb = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
    const vc = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
    const fn = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).normalize();
    avgNormal.add(fn);
  });
  avgNormal.normalize();

  // 2. Map unique vertices to avoid duplicating shared edges twice
  const vertexMap = new Map();
  let nextIdx = pos.count;

  faceIndices.forEach(faceIdx => {
    const a = index[faceIdx * 3], b = index[faceIdx * 3 + 1], c = index[faceIdx * 3 + 2];
    [a, b, c].forEach(v => {
      if (!vertexMap.has(v)) vertexMap.set(v, nextIdx++);
    });
  });

  const totalNewVerts = nextIdx - pos.count;
  const newCount = nextIdx;

  // 3. Snapshot and extend every attribute buffer
  const attrSpecs = {};
  for (const name of Object.keys(geometry.attributes)) {
    const src = geometry.attributes[name];
    const arr = new src.array.constructor(newCount * src.itemSize);
    for (let i = 0; i < src.array.length; i++) arr[i] = src.array[i];
    attrSpecs[name] = { itemSize: src.itemSize, normalized: src.normalized, arr, src };
  }

  // 4. Populate new vertices
  const offset = 0.5;
  vertexMap.forEach((newIdx, oldIdx) => {
    // Copy all attributes from source vertex
    for (const name of Object.keys(attrSpecs)) {
      const { itemSize, arr, src } = attrSpecs[name];
      for (let k = 0; k < itemSize; k++) {
        arr[newIdx * itemSize + k] = src.array[oldIdx * itemSize + k];
      }
    }
    // Override position and normal
    attrSpecs.position.arr[newIdx * 3 + 0] = pos.getX(oldIdx) + avgNormal.x * offset;
    attrSpecs.position.arr[newIdx * 3 + 1] = pos.getY(oldIdx) + avgNormal.y * offset;
    attrSpecs.position.arr[newIdx * 3 + 2] = pos.getZ(oldIdx) + avgNormal.z * offset;
    attrSpecs.normal.arr[newIdx * 3 + 0] = avgNormal.x;
    attrSpecs.normal.arr[newIdx * 3 + 1] = avgNormal.y;
    attrSpecs.normal.arr[newIdx * 3 + 2] = avgNormal.z;
  });

  // 5. Build new index buffer with boundary walls
  const newIndices = [];
  const edges = new Set();

  faceIndices.forEach(faceIdx => {
    const a = index[faceIdx * 3], b = index[faceIdx * 3 + 1], c = index[faceIdx * 3 + 2];
    const na = vertexMap.get(a), nb = vertexMap.get(b), nc = vertexMap.get(c);

    // Top cap
    newIndices.push(na, nb, nc);

    // Side walls (only if the edge isn't shared by another extruded face)
    const addWall = (v1, v2, nv1, nv2) => {
      const edgeKey = v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
      if (!edges.has(edgeKey)) {
        edges.add(edgeKey);
        newIndices.push(v1, v2, nv2);
        newIndices.push(v1, nv2, nv1);
      }
    };
    addWall(a, b, na, nb);
    addWall(b, c, nb, nc);
    addWall(c, a, nc, na);
  });

  // 6. Copy non-extruded triangles verbatim
  const selectedFacesSet = new Set(faceIndices);
  for (let i = 0; i < index.length; i += 3) {
    if (!selectedFacesSet.has(i / 3)) {
      newIndices.push(index[i], index[i + 1], index[i + 2]);
    }
  }

  // 7. Write back
  for (const name of Object.keys(attrSpecs)) {
    const { itemSize, normalized, arr } = attrSpecs[name];
    geometry.setAttribute(name, new THREE.BufferAttribute(arr, itemSize, normalized));
  }
  geometry.setIndex(newIndices);

  return geometry;
}

export function applyUVProjection(geometry, type) {
  if (!geometry || !geometry.attributes.position) return;
  const pos = geometry.attributes.position;
  const count = pos.count;
  const uv = new Float32Array(count * 2);

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const sx = Math.max(1e-6, bb.max.x - bb.min.x);
  const sy = Math.max(1e-6, bb.max.y - bb.min.y);
  const sz = Math.max(1e-6, bb.max.z - bb.min.z);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i) - cx;
    const y = pos.getY(i) - cy;
    const z = pos.getZ(i) - cz;
    
    let u = 0, v = 0;
    if (type === 'planar') {
      // Top-down view (X and Z)
      u = (x + sx / 2) / sx;
      v = (z + sz / 2) / sz;
    } else if (type === 'cylindrical') {
      // Wrap around Y axis
      u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
      v = (y + sy / 2) / sy;
    } else if (type === 'spherical') {
      // Lat/Long map
      const r = Math.sqrt(x * x + y * y + z * z);
      u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
      v = 0.5 + Math.asin(y / Math.max(1e-6, r)) / Math.PI;
    }
    
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
