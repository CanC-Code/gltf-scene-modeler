import * as THREE from "../three/three.module.js";
import { mergeVertices } from "../three/BufferGeometryUtils.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;
    this.index = this.geometry.index;

    this.radius = 1.0;
    this.strength = 0.3;
    this.tool = "inflate";
    this.symmetry = { x: false, y: false, z: false };

    this.neighbors = this.buildNeighborMap();
    mergeVertices(this.geometry); // remove duplicates to stabilize
  }

  setTool(tool) {
    this.tool = tool;
  }

  setRadius(r) {
    this.radius = r;
  }

  setStrength(s) {
    this.strength = s;
  }

  setSymmetry({ x = false, y = false, z = false }) {
    this.symmetry = { x, y, z };
  }

  buildNeighborMap() {
    const neighbors = {};
    const index = this.geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i], b = index[i + 1], c = index[i + 2];
      if (!neighbors[a]) neighbors[a] = new Set();
      if (!neighbors[b]) neighbors[b] = new Set();
      if (!neighbors[c]) neighbors[c] = new Set();
      neighbors[a].add(b).add(c);
      neighbors[b].add(a).add(c);
      neighbors[c].add(a).add(b);
    }
    return neighbors;
  }

  apply(point, viewDir = null) {
    const pos = this.position;
    const norm = this.normal;
    const center = point;

    const region = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();

    // Phase 1: collect region
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const dist = v.distanceTo(center);
      if (dist > this.radius) continue;

      region.push(i);
      n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
      avgNormal.add(n);
    }
    if (region.length === 0) return;
    avgNormal.normalize();

    // Phase 2: neighbor-aware displacement
    for (const i of region) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(norm.getX(i), norm.getY(i), norm.getZ(i));

      const dist = v.distanceTo(center);
      const falloff = Math.exp(-(dist * dist) / (this.radius * this.radius));
      const influence = this.strength * falloff;

      let ox = 0, oy = 0, oz = 0;

      switch (this.tool) {
        case "inflate":
          ox = n.x * influence;
          oy = n.y * influence;
          oz = n.z * influence;
          break;

        case "deflate":
          ox = -n.x * influence;
          oy = -n.y * influence;
          oz = -n.z * influence;
          break;

        case "smooth":
          // neighbor average
          const neigh = this.neighbors[i];
          if (neigh && neigh.size > 0) {
            const avg = new THREE.Vector3();
            neigh.forEach(nIdx =>
              avg.add(new THREE.Vector3(pos.getX(nIdx), pos.getY(nIdx), pos.getZ(nIdx)))
            );
            avg.multiplyScalar(1 / neigh.size);
            ox = (avg.x - v.x) * influence;
            oy = (avg.y - v.y) * influence;
            oz = (avg.z - v.z) * influence;
          }
          break;

        case "flatten":
          ox = -n.x * dist * influence;
          oy = -n.y * dist * influence;
          oz = -n.z * dist * influence;
          break;

        case "pinch":
          ox = - (v.x - center.x) * influence;
          oy = - (v.y - center.y) * influence;
          oz = - (v.z - center.z) * influence;
          break;
      }

      v.add(new THREE.Vector3(ox, oy, oz));
      pos.setXYZ(i, v.x, v.y, v.z);

      // Phase 3: symmetry
      if (this.symmetry.x) pos.setXYZ(i, -v.x, v.y, v.z);
      if (this.symmetry.y) pos.setXYZ(i, v.x, -v.y, v.z);
      if (this.symmetry.z) pos.setXYZ(i, v.x, v.y, -v.z);
    }

    // Phase 4: Laplacian smoothing for local relaxation
    this.laplacianSmooth(region, 0.45);

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  laplacianSmooth(region, factor) {
    if (!this.geometry.index) return;
    const pos = this.position;
    const index = this.geometry.index.array;
    const neighbors = this.neighbors;

    const original = {};
    const v = new THREE.Vector3();
    const avg = new THREE.Vector3();

    for (const i of region) {
      original[i] = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    }

    for (const i of region) {
      const neigh = neighbors[i];
      if (!neigh || neigh.size === 0) continue;

      avg.set(0, 0, 0);
      neigh.forEach(n => avg.add(new THREE.Vector3(pos.getX(n), pos.getY(n), pos.getZ(n))));
      avg.multiplyScalar(1 / neigh.size);

      v.copy(original[i]).lerp(avg, factor);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
}