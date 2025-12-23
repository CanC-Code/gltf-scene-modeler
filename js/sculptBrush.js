// js/sculptBrush.js
// Author: CCVO
// Purpose: Applies sculpting operations (inflate, deflate, smooth, flatten, pinch, clay, scrape) to the active mesh in GLTF Scene Modeler, supporting symmetry and touch/desktop input

import * as THREE from "../three/three.module.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;

    this.radius = 1;       // Brush radius
    this.strength = 0.3;   // Sculpting influence
    this.tool = "inflate"; // Active tool
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

  apply(point, symmetry = false) {
    const pos = this.position;
    const norm = this.normal;
    const center = point;

    // Support mirrored center for symmetry
    const centers = [center.clone()];
    if (symmetry) centers.push(new THREE.Vector3(-center.x, center.y, center.z));

    for (const c of centers) {
      const region = [];
      const avgNormal = new THREE.Vector3();
      const v = new THREE.Vector3();
      const n = new THREE.Vector3();

      // Collect vertices within brush radius
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (v.distanceTo(c) > this.radius) continue;
        region.push(i);
        n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
        avgNormal.add(n);
      }

      if (region.length === 0) continue;
      avgNormal.normalize();

      // Apply tool-specific displacement
      for (const i of region) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
        const falloff = Math.pow(1 - dist / this.radius, 2); // Smooth falloff
        const influence = falloff * this.strength;

        let ox = 0, oy = 0, oz = 0;

        switch (this.tool) {
          case "inflate":
            ox = avgNormal.x * influence;
            oy = avgNormal.y * influence;
            oz = avgNormal.z * influence;
            break;
          case "deflate":
            ox = -avgNormal.x * influence;
            oy = -avgNormal.y * influence;
            oz = -avgNormal.z * influence;
            break;
          case "smooth":
            ox = (avgNormal.x - v.x) * influence * 0.5;
            oy = (avgNormal.y - v.y) * influence * 0.5;
            oz = (avgNormal.z - v.z) * influence * 0.5;
            break;
          case "flatten":
            ox = -avgNormal.x * dist * influence;
            oy = -avgNormal.y * dist * influence;
            oz = -avgNormal.z * dist * influence;
            break;
          case "pinch":
            ox = -(v.x - c.x) * influence;
            oy = -(v.y - c.y) * influence;
            oz = -(v.z - c.z) * influence;
            break;
          case "clay":
            ox = avgNormal.x * influence * 0.6;
            oy = avgNormal.y * influence * 0.6;
            oz = avgNormal.z * influence * 0.6;
            break;
          case "scrape":
            ox = -avgNormal.x * influence * 0.8;
            oy = -avgNormal.y * influence * 0.8;
            oz = -avgNormal.z * influence * 0.8;
            break;
        }

        pos.setXYZ(i, v.x + ox, v.y + oy, v.z + oz);
      }
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}
