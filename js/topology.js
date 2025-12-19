import * as THREE from "../three/three.module.js";

/**
 * Ensure geometry has proper normals
 */
export function ensureTopology(geometry) {
  geometry.computeVertexNormals();
}

/**
 * Builds a neighbor map for each vertex in the geometry.
 * Returns an object mapping vertex index → Set of neighbor indices.
 */
export function getNeighbors(geometry) {
  const neighbors = {};
  const pos = geometry.attributes.position;
  const index = geometry.index ? geometry.index.array : null;

  for (let i = 0; i < pos.count; i++) {
    neighbors[i] = new Set();
  }

  if (!index) return neighbors;

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }

  return neighbors;
}

/**
 * Recomputes normals for a given geometry.
 * Optionally only updates normals for a set of vertex indices.
 */
export function updateNormals(geometry, vertices = null) {
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
    return;
  }

  if (!vertices || vertices.length === 0) {
    geometry.computeVertexNormals();
    return;
  }

  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const index = geometry.index ? geometry.index.array : null;

  if (!index) {
    geometry.computeVertexNormals();
    return;
  }

  for (const vi of vertices) normal.setXYZ(vi, 0, 0, 0);

  const tempVec = new THREE.Vector3();

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (!vertices.includes(a) && !vertices.includes(b) && !vertices.includes(c)) continue;

    const vA = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
    const vB = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
    const vC = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));

    const cb = new THREE.Vector3().subVectors(vC, vB);
    const ab = new THREE.Vector3().subVectors(vA, vB);
    const faceNormal = cb.cross(ab);

    normal.setXYZ(a,
      normal.getX(a) + faceNormal.x,
      normal.getY(a) + faceNormal.y,
      normal.getZ(a) + faceNormal.z
    );
    normal.setXYZ(b,
      normal.getX(b) + faceNormal.x,
      normal.getY(b) + faceNormal.y,
      normal.getZ(b) + faceNormal.z
    );
    normal.setXYZ(c,
      normal.getX(c) + faceNormal.x,
      normal.getY(c) + faceNormal.y,
      normal.getZ(c) + faceNormal.z
    );
  }

  for (const vi of vertices) {
    tempVec.set(normal.getX(vi), normal.getY(vi), normal.getZ(vi)).normalize();
    normal.setXYZ(vi, tempVec.x, tempVec.y, tempVec.z);
  }

  normal.needsUpdate = true;
}