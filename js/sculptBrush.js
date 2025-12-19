import * as THREE from "../three/three.module.js";
import { getNeighbors, updateNormals } from "./topology.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;

    // Ensure indexed geometry for neighbor calculations
    if (!this.geometry.index) {
      this.geometry = THREE.BufferGeometryUtils.mergeVertices(this.geometry);
    }

    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;

    this.radius = 1;
    this.strength = 0.3;
    this.tool = "inflate";
    this.symmetry = null; // 'x', 'y', 'z' or null

    // Build neighbor map once
    this.neighbors = getNeighbors(this.geometry);
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

  setSymmetry(axis) {
    this.symmetry = axis; // e.g., 'x', 'y', 'z'
  }

  apply(point, viewDir = null) {
    const pos = this.position;
    const norm = this.normal;
    const center = point;

    const temp = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const affected = [];

    for (let i = 0; i < pos.count; i++) {
      temp.set(pos.getX(i), pos.getY(i), pos.getZ(i));

      // Symmetry check
      if (this.symmetry) {
        const coord = temp[this.symmetry];
        const mirrored = 2 * center[this.symmetry] - coord;
        if (Math.abs(coord - center[this.symmetry]) > this.radius &&
            Math.abs(mirrored - center[this.symmetry]) > this.radius) continue;
      } else if (temp.distanceTo(center) > this.radius) continue;

      affected.push(i);
    }

    for (const i of affected) {
      temp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      tempNormal.set(norm.getX(i), norm.getY(i), norm.getZ(i));

      const dist = temp.distanceTo(center);
      const falloff = Math.pow(1 - dist / this.radius, 2);
      const influence = falloff * this.strength;

      let offset = new THREE.Vector3();

      switch (this.tool) {
        case "inflate":
          offset.copy(tempNormal).multiplyScalar(influence);
          break;
        case "deflate":
          offset.copy(tempNormal).multiplyScalar(-influence);
          break;
        case "smooth":
          offset.set(0, 0, 0);
          const neigh = this.neighbors[i];
          if (neigh) {
            for (const n of neigh) {
              offset.add(
                new THREE.Vector3(pos.getX(n), pos.getY(n), pos.getZ(n))
              );
            }
            offset.multiplyScalar(1 / neigh.size);
            offset.sub(temp).multiplyScalar(influence);
          }
          break;
        case "grab":
          if (viewDir) offset.copy(viewDir).multiplyScalar(influence);
          break;
        case "flatten":
          offset.copy(tempNormal).multiplyScalar(-dist * influence);
          break;
        case "pinch":
          offset.subVectors(center, temp).multiplyScalar(influence);
          break;
        case "clay":
          offset.copy(tempNormal).multiplyScalar(influence * 0.6);
          break;
        case "scrape":
          offset.copy(tempNormal).multiplyScalar(-influence * 0.8);
          break;
      }

      temp.add(offset);
      pos.setXYZ(i, temp.x, temp.y, temp.z);

      // Apply symmetry
      if (this.symmetry) {
        const mirrored = new THREE.Vector3().copy(temp);
        mirrored[this.symmetry] =
          2 * center[this.symmetry] - mirrored[this.symmetry];
        pos.setXYZ(i, mirrored.x, mirrored.y, mirrored.z);
      }
    }

    updateNormals(this.geometry, this.neighbors, affected);
    pos.needsUpdate = true;
  }
}