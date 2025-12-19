// js/topology.js
import * as THREE from "../three/three.module.js";

/**
 * Ensures the geometry is safe for sculpting:
 * - Converts to non-indexed
 * - Builds vertex adjacency map
 * - Computes normals
 */
export function ensureTopology(geometry) {
  // Convert to non-indexed if necessary
  if (geometry.index) {
    geometry = geometry.toNonIndexed();
  }

  // Build adjacency map: vertex index -> Set of neighboring vertex indices
  const pos = geometry.attributes.position;
  const neighbors = {};
  for (let i = 0; i < pos.count; i++) {
    neighbors[i] = new Set();
  }

  const indices = geometry.index ? geometry.index.array : null;
  if (indices) {
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      neighbors[a].add(b).add(c);
      neighbors[b].add(a).add(c);
      neighbors[c].add(a).add(b);
    }
  } else {
    // Non-indexed, each triangle is sequential
    for (let i = 0; i < pos.count; i += 3) {
      neighbors[i].add(i + 1).add(i + 2);
      neighbors[i + 1].add(i).add(i + 2);
      neighbors[i + 2].add(i).add(i + 1);
    }
  }

  geometry.userData = geometry.userData || {};
  geometry.userData.neighbors = neighbors;

  // Recompute normals
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Returns the neighbors map for a geometry
 */
export function getNeighbors(geometry) {
  return geometry.userData?.neighbors || {};
}

/**
 * Updates normals for a geometry
 */
export function updateNormals(geometry) {
  geometry.computeVertexNormals();
}