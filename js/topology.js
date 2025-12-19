import * as THREE from "../three/three.module.js";

/**
 * Build a neighbor map for a BufferGeometry
 * @param {THREE.BufferGeometry} geometry
 * @returns {Object} neighbors { vertexIndex: Set of neighbor indices }
 */
export function getNeighbors(geometry) {
  const neighbors = {};
  const posCount = geometry.attributes.position.count;

  // Initialize sets
  for (let i = 0; i < posCount; i++) neighbors[i] = new Set();

  if (!geometry.index) return neighbors;

  const index = geometry.index.array;

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i],
      b = index[i + 1],
      c = index[i + 2];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }

  return neighbors;
}

/**
 * Update normals for a specific region of vertices
 * @param {THREE.BufferGeometry} geometry
 * @param {Array<number>} region
 */
export function updateNormals(geometry, region) {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;

  if (!geometry.index) {
    geometry.computeVertexNormals();
    return;
  }

  const index = geometry.index.array;

  // Reset normals
  for (const i of region) normal.setXYZ(i, 0, 0, 0);

  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3(),
    cb = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    n = new THREE.Vector3();

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i],
      b = index[i + 1],
      c = index[i + 2];

    // Only compute if at least one vertex is in the region
    if (!region.includes(a) && !region.includes(b) && !region.includes(c)) continue;

    vA.set(pos.getX(a), pos.getY(a), pos.getZ(a));
    vB.set(pos.getX(b), pos.getY(b), pos.getZ(b));
    vC.set(pos.getX(c), pos.getY(c), pos.getZ(c));

    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    n.crossVectors(cb, ab);

    normal.setXYZ(a, normal.getX(a) + n.x, normal.getY(a) + n.y, normal.getZ(a) + n.z);
    normal.setXYZ(b, normal.getX(b) + n.x, normal.getY(b) + n.y, normal.getZ(b) + n.z);
    normal.setXYZ(c, normal.getX(c) + n.x, normal.getY(c) + n.y, normal.getZ(c) + n.z);
  }

  // Normalize
  const tmp = new THREE.Vector3();
  for (const i of region) {
    tmp.set(normal.getX(i), normal.getY(i), normal.getZ(i)).normalize();
    normal.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }

  normal.needsUpdate = true;
}

/**
 * Quick helper to compute normals for the entire geometry
 * @param {THREE.BufferGeometry} geometry
 */
export function ensureTopology(geometry) {
  geometry.computeVertexNormals();
}