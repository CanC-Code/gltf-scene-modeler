import * as THREE from "../three/three.module.js";
import { updateNormals, SpatialHash, buildAdjacencyMap } from "./topology.js";

export class SculptBrush {
  constructor(mesh) {
    this.setMesh(mesh);
    this.radius = 0.2;
    this.strength = 0.5;
    this.tool = "inflate";
    this.paintColor = new THREE.Color("#ff0000");
  }

  setMesh(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;
    this.spatialHash = new SpatialHash(this.geometry, 0.5);
    this.adjacencyMap = buildAdjacencyMap(this.geometry);
  }

  updateMesh(mesh) {
    this.setMesh(mesh);
  }

  rebuildGrid() {
    this.spatialHash.build(this.geometry);
  }

  setTool(tool) { this.tool = tool; }
  setRadius(r) { this.radius = r; }
  setStrength(s) { this.strength = s; }
  setPaintColor(color) { this.paintColor.copy(color); }

  apply(localPoint, symmetry = false) {
    const pos = this.position;
    const norm = this.normal;
    
    const centers = [localPoint.clone()];
    if (symmetry) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));

    const affectedVertices = new Set();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();
    const avgPos = new THREE.Vector3();

    for (const c of centers) {
      const region = this.spatialHash.query(c, this.radius);
      if (region.length === 0) continue;
      
      avgNormal.set(0,0,0);
      for (const i of region) {
        n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
        avgNormal.add(n);
      }
      avgNormal.normalize();

      for (const i of region) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
        if (dist > this.radius) continue;

        affectedVertices.add(i);
        const falloff = Math.pow(1 - dist / this.radius, 2);
        const influence = falloff * this.strength;

        let ox = 0, oy = 0, oz = 0;
        switch (this.tool) {
          case "inflate": ox = avgNormal.x * influence; oy = avgNormal.y * influence; oz = avgNormal.z * influence; break;
          case "deflate": ox = -avgNormal.x * influence; oy = -avgNormal.y * influence; oz = -avgNormal.z * influence; break;
          case "smooth": 
            // True Laplacian Smoothing: Move towards average neighbor position
            avgPos.set(0,0,0);
            let neighbors = 0;
            if (this.adjacencyMap[i] && this.geometry.index) {
              this.adjacencyMap[i].forEach(faceIndex => {
                for (let j = 0; j < 3; j++) {
                  const neighborIdx = this.geometry.index.array[faceIndex * 3 + j];
                  if (neighborIdx !== i) {
                    avgPos.x += pos.getX(neighborIdx);
                    avgPos.y += pos.getY(neighborIdx);
                    avgPos.z += pos.getZ(neighborIdx);
                    neighbors++;
                  }
                }
              });
            }
            if (neighbors > 0) {
              avgPos.divideScalar(neighbors);
              ox = (avgPos.x - v.x) * influence;
              oy = (avgPos.y - v.y) * influence;
              oz = (avgPos.z - v.z) * influence;
            }
            break;
          case "flatten": ox = -avgNormal.x * dist * influence; oy = -avgNormal.y * dist * influence; oz = -avgNormal.z * dist * influence; break;
          case "pinch": ox = -(v.x - c.x) * influence; oy = -(v.y - c.y) * influence; oz = -(v.z - c.z) * influence; break;
        }
        pos.setXYZ(i, v.x + ox, v.y + oy, v.z + oz);
      }
    }
    pos.needsUpdate = true;
    if (affectedVertices.size > 0) updateNormals(this.geometry, Array.from(affectedVertices), this.adjacencyMap);
  }

  paint(localPoint, symmetry = false) {
    const geometry = this.mesh.geometry;
    const pos = geometry.attributes.position;
    if (!geometry.attributes.color) {
      const colors = new Float32Array(pos.count * 3);
      colors.fill(1.0);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      this.mesh.material.vertexColors = true;
      this.mesh.material.needsUpdate = true;
    }
    const colorAttr = geometry.attributes.color;
    
    const centers = [localPoint.clone()];
    if (symmetry) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));

    const v = new THREE.Vector3();
    for (const c of centers) {
      const region = this.spatialHash.query(c, this.radius);
      for (const i of region) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
        if (dist <= this.radius) {
          const falloff = Math.pow(1 - dist / this.radius, 2) * this.strength;
          const r = colorAttr.getX(i), g = colorAttr.getY(i), b = colorAttr.getZ(i);
          colorAttr.setXYZ(i,
            THREE.MathUtils.lerp(r, this.paintColor.r, falloff),
            THREE.MathUtils.lerp(g, this.paintColor.g, falloff),
            THREE.MathUtils.lerp(b, this.paintColor.b, falloff)
          );
        }
      }
    }
    colorAttr.needsUpdate = true;
  }
}
