import * as THREE from "../three/three.module.js";

export class SculptBrush {
  constructor(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;

    this.radius = 1;
    this.strength = 0.3;
    this.tool = "inflate";

    // Symmetry axes: x, y, z
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

  setSymmetry(axis, enabled) {
    if (["x", "y", "z"].includes(axis)) {
      this.symmetry[axis] = enabled;
    }
  }

  apply(point, viewDir = null) {
    const pos = this.position;
    const norm = this.normal;
    const center = point.clone();

    const tmp = new THREE.Vector3();
    const delta = new THREE.Vector3();
    const hit = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const dist = tmp.distanceTo(center);
      if (dist > this.radius) continue;

      const falloff = Math.pow(1 - dist / this.radius, 2);
      const influence = falloff * this.strength;

      const n = new THREE.Vector3(norm.getX(i), norm.getY(i), norm.getZ(i));
      delta.set(0, 0, 0);

      switch (this.tool) {
        case "inflate":
          delta.copy(n).multiplyScalar(influence);
          break;
        case "deflate":
          delta.copy(n).multiplyScalar(-influence);
          break;
        case "smooth":
          delta.copy(tmp).multiplyScalar(-0.2 * influence); // pull slightly toward local avg
          break;
        case "flatten":
          const planeNormal = n.clone();
          const planePoint = tmp.clone();
          delta.copy(planeNormal).multiplyScalar(-tmp.dot(planeNormal) * influence);
          break;
        case "pinch":
          delta.copy(center).sub(tmp).multiplyScalar(influence);
          break;
        case "grab":
          if (viewDir) delta.copy(viewDir).multiplyScalar(influence);
          break;
        case "clay":
          delta.copy(n).multiplyScalar(influence * 0.6);
          break;
        case "scrape":
          delta.copy(n).multiplyScalar(-influence * 0.8);
          break;
      }

      tmp.add(delta);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);

      // Apply symmetry
      this.applySymmetry(i, tmp);
    }

    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  applySymmetry(index, vec) {
    const pos = this.position;
    if (this.symmetry.x) pos.setXYZ(index, -vec.x, vec.y, vec.z);
    if (this.symmetry.y) pos.setXYZ(index, vec.x, -vec.y, vec.z);
    if (this.symmetry.z) pos.setXYZ(index, vec.x, vec.y, -vec.z);
  }
}