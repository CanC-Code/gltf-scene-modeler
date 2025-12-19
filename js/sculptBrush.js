import * as THREE from "../three/three.module.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;

    // Preserve original positions to prevent edge separation
    this.originalPositions = new Float32Array(this.position.array.length);
    this.position.array.forEach((v, i) => this.originalPositions[i] = v);

    this.radius = 1;
    this.strength = 0.3;
    this.tool = "inflate";
    this.mirror = { x: false, y: false, z: false }; // Optional symmetry
  }

  setTool(tool) { this.tool = tool; }
  setRadius(r) { this.radius = r; }
  setStrength(s) { this.strength = s; }
  setMirror(axis, enabled) { this.mirror[axis] = enabled; }

  apply(point, viewDir = null) {
    const pos = this.position;
    const norm = this.normal;
    const center = point;

    const affectedVertices = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();

    // Phase 1: collect affected vertices
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const dist = v.distanceTo(center);
      if (dist > this.radius) continue;

      affectedVertices.push({ index: i, dist });
      n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
      avgNormal.add(n);
    }

    if (affectedVertices.length === 0) return;

    avgNormal.normalize();

    // Phase 2: apply tool-specific displacement
    for (const { index, dist } of affectedVertices) {
      v.set(pos.getX(index), pos.getY(index), pos.getZ(index));
      n.set(norm.getX(index), norm.getY(index), norm.getZ(index));

      const falloff = Math.pow(1 - dist / this.radius, 2);
      const influence = falloff * this.strength;
      let ox = 0, oy = 0, oz = 0;

      switch (this.tool) {
        case "inflate":
          ox = n.x * influence; oy = n.y * influence; oz = n.z * influence; break;
        case "deflate":
          ox = -n.x * influence; oy = -n.y * influence; oz = -n.z * influence; break;
        case "smooth":
          ox = - (v.x - this.originalPositions[index*3]) * influence;
          oy = - (v.y - this.originalPositions[index*3+1]) * influence;
          oz = - (v.z - this.originalPositions[index*3+2]) * influence;
          break;
        case "flatten":
          ox = -n.x * dist * influence; oy = -n.y * dist * influence; oz = -n.z * dist * influence; break;
        case "grab":
          if (!viewDir) break;
          ox = viewDir.x * influence; oy = viewDir.y * influence; oz = viewDir.z * influence; break;
        case "pinch":
          ox = - (v.x - center.x) * influence;
          oy = - (v.y - center.y) * influence;
          oz = - (v.z - center.z) * influence;
          break;
        case "clay":
          ox = n.x * influence * 0.6; oy = n.y * influence * 0.6; oz = n.z * influence * 0.6; break;
        case "scrape":
          ox = -n.x * influence * 0.8; oy = -n.y * influence * 0.8; oz = -n.z * influence * 0.8; break;
      }

      // Apply displacement
      pos.setXYZ(index, v.x + ox, v.y + oy, v.z + oz);

      // Optional mirroring
      for (const axis of ["x","y","z"]) {
        if (this.mirror[axis]) {
          const mirrored = v.clone();
          mirrored[axis] = center[axis] - (mirrored[axis] - center[axis]);
          pos.setXYZ(index, mirrored.x, mirrored.y, mirrored.z);
        }
      }
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}