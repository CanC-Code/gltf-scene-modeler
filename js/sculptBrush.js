import * as THREE from "../three/three.module.js";

export class SculptBrush {
  constructor() {
    this.strength = 0.25;
  }

  clay(mesh, point, normal, radius) {
    const pos = mesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    const falloff = (d) => Math.max(0, 1 - d * d);

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const dist = v.distanceTo(point);

      if (dist > radius) continue;

      const f = falloff(dist / radius) * this.strength;
      v.addScaledVector(normal, f);
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
}
