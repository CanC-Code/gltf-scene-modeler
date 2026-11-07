import * as THREE from "../three/three.module.js";
import { updateNormals, SpatialHash, buildAdjacencyMap } from "./topology.js";

export class SculptBrush {
  constructor(mesh) {
    this.setMesh(mesh);
    this.radius = 0.2;
    this.strength = 0.5;
    this.tool = "inflate";
    this.paintColor = new THREE.Color("#ff0000");
    this.activeBoneIndex = 0;
  }

  setMesh(mesh) {
    this.mesh = mesh;
    this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;
    this.spatialHash = new SpatialHash(this.geometry, 0.5);
    this.adjacencyMap = buildAdjacencyMap(this.geometry);
  }

  updateMesh(mesh) { this.setMesh(mesh); }
  rebuildGrid() { this.spatialHash.build(this.geometry); }
  setTool(tool) { this.tool = tool; }
  setRadius(r) { this.radius = r; }
  setStrength(s) { this.strength = s; }
  setPaintColor(color) { this.paintColor.copy(color); }
  setActiveBone(index) { this.activeBoneIndex = index; }

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
              const maxDist = this.radius * 0.3;
              let dx = (avgPos.x - v.x) * influence;
              let dy = (avgPos.y - v.y) * influence;
              let dz = (avgPos.z - v.z) * influence;
              const moveDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
              if (moveDist > maxDist) {
                const scale = maxDist / moveDist;
                dx *= scale; dy *= scale; dz *= scale;
              }
              ox = dx; oy = dy; oz = dz;
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

  paintWeight(localPoint) {
    if (!this.geometry.attributes.skinWeight || !this.geometry.attributes.skinIndex) return;
    
    const pos = this.position;
    const weightAttr = this.geometry.attributes.skinWeight;
    const indexAttr = this.geometry.attributes.skinIndex;
    const v = new THREE.Vector3();
    
    const region = this.spatialHash.query(localPoint, this.radius);
    for (const i of region) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const dist = v.distanceTo(localPoint);
      if (dist <= this.radius) {
        const falloff = Math.pow(1 - dist / this.radius, 2) * this.strength;
        
        // Read existing 4 influences
        let w = [
          weightAttr.getX(i), weightAttr.getY(i),
          weightAttr.getZ(i), weightAttr.getW(i)
        ];
        let idx = [
          indexAttr.getX(i), indexAttr.getY(i),
          indexAttr.getZ(i), indexAttr.getW(i)
        ];

        // Find if the active bone is already in the top 4
        let targetSlot = idx.indexOf(this.activeBoneIndex);
        
        if (targetSlot === -1) {
          // Not present: replace the smallest weight slot
          targetSlot = 0;
          for (let k = 1; k < 4; k++) {
            if (w[k] < w[targetSlot]) targetSlot = k;
          }
          idx[targetSlot] = this.activeBoneIndex;
          w[targetSlot] = 0; // Start blending from 0
        }

        // Lerp the target bone's weight towards 1.0 based on brush falloff
        w[targetSlot] = THREE.MathUtils.lerp(w[targetSlot], 1.0, falloff);

        // Normalize the 4 weights
        const total = w[0] + w[1] + w[2] + w[3];
        if (total > 0) {
          for (let k = 0; k < 4; k++) w[k] /= total;
        }

        // Sort descending (standard for glTF and game engines)
        const influences = [
          { weight: w[0], index: idx[0] },
          { weight: w[1], index: idx[1] },
          { weight: w[2], index: idx[2] },
          { weight: w[3], index: idx[3] }
        ];
        influences.sort((a, b) => b.weight - a.weight);

        // Write back
        weightAttr.setXYZW(i, influences[0].weight, influences[1].weight, influences[2].weight, influences[3].weight);
        indexAttr.setXYZW(i, influences[0].index, influences[1].index, influences[2].index, influences[3].index);
      }
    }
    weightAttr.needsUpdate = true;
    indexAttr.needsUpdate = true;
  }
}
