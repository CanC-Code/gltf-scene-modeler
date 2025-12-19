import * as THREE from "../three/three.module.js";
import { mergeVertices } from "../three/BufferGeometryUtils.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;

    this.radius = 1;
    this.strength = 0.3;
    this.tool = "inflate";
    this.symmetry = { x: false, y: false, z: false };
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

  apply(point, viewDir = null) {
    const pos = this.position;
    const norm = this.normal;
    const center = point;

    const region = [];
    const avgNormal = new THREE.Vector3();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    // Phase 1: collect affected vertices
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (v.distanceTo(center) > this.radius) continue;
      region.push(i);
      n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
      avgNormal.add(n);
    }

    if (region.length === 0) return;
    avgNormal.normalize();

    // Phase 2: apply tool-specific displacement
    for (const i of region) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
      const dist = v.distanceTo(center);
      const falloff = Math.pow(1 - dist / this.radius, 2);
      const influence = falloff * this.strength;

      let displacement = new THREE.Vector3();

      switch (this.tool) {
        case "inflate":
          displacement.copy(n).multiplyScalar(influence);
          break;
        case "deflate":
          displacement.copy(n).multiplyScalar(-influence);
          break;
        case "smooth":
          displacement.copy(this.computeLaplacianDisplacement(i, region)).multiplyScalar(influence);
          break;
        case "flatten":
          const planeNormal = avgNormal;
          const toCenter = v.clone().sub(center);
          const proj = toCenter.projectOnVector(planeNormal);
          displacement.copy(proj).multiplyScalar(-influence);
          break;
        case "pinch":
          const dirToCenter = center.clone().sub(v).normalize();
          displacement.copy(dirToCenter).multiplyScalar(influence);
          break;
        case "grab":
          if (!viewDir) break;
          displacement.copy(viewDir).multiplyScalar(influence);
          break;
        case "clay":
          displacement.copy(n).multiplyScalar(influence * 0.6);
          break;
        case "scrape":
          displacement.copy(n).multiplyScalar(-influence * 0.8);
          break;
      }

      v.add(displacement);

      // Apply symmetry
      if (this.symmetry.x) v.x = -v.x;
      if (this.symmetry.y) v.y = -v.y;
      if (this.symmetry.z) v.z = -v.z;

      pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  computeLaplacianDisplacement(idx, region) {
    const geo = this.geometry;
    if (!geo.index) return new THREE.Vector3(0, 0, 0);

    const pos = geo.attributes.position;
    const index = geo.index.array;
    const neighbors = new Set();

    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
      if (a === idx) neighbors.add(b).add(c);
      else if (b === idx) neighbors.add(a).add(c);
      else if (c === idx) neighbors.add(a).add(b);
    }

    if (neighbors.size === 0) return new THREE.Vector3(0, 0, 0);

    const v = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
    const avg = new THREE.Vector3();
    neighbors.forEach(n => {
      avg.add(new THREE.Vector3(pos.getX(n), pos.getY(n), pos.getZ(n)));
    });
    avg.multiplyScalar(1 / neighbors.size);

    return avg.sub(v); // displacement toward neighbors (smooth)
  }

  ensureTopology() {
    if (!this.geometry.index) {
      this.geometry = mergeVertices(this.geometry);
      this.position = this.geometry.attributes.position;
      this.normal = this.geometry.attributes.normal;
    }
  }
}