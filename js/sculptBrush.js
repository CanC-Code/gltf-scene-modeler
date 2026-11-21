import * as THREE from "../three/three.module.js";
import { updateNormals, SpatialHash, buildAdjacencyMap, splitLongEdgesScoped } from "./topology.js?v=23";

export class SculptBrush {
  constructor(mesh) {
    this.setMesh(mesh);
    this.radius = 0.2;
    this.strength = 0.5;
    this.tool = "inflate";
    this.paintColor = new THREE.Color("#ff0000");
    this.activeBoneIndex = 0;
    this.lastGrabPoint = null; // Required for Grab tool
    this.dynamicGrowth = true;
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

  syncGeometryArrays() {
    if (!this.geometry) return;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;
  }

  rebuildTopologyCaches() {
    if (!this.geometry) return;
    this.position = this.geometry.attributes.position;
    this.normal = this.geometry.attributes.normal;
    if (this.spatialHash) this.spatialHash.build(this.geometry);
    else this.spatialHash = new SpatialHash(this.geometry, 0.5);
    this.adjacencyMap = buildAdjacencyMap(this.geometry);
  }


  growMeshInScope(localPoint, sym = { x: false, y: false, z: false }, deferRebuild = false) {
    if (!this.dynamicGrowth || !this.geometry || !this.geometry.index) return false;
    if (this.tool === "paint" || this.tool === "weight") return false;

    const centers = [localPoint.clone()];
    if (sym.x) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
    if (sym.y) {
      const yBatch = centers.map(pt => new THREE.Vector3(pt.x, -pt.y, pt.z));
      centers.push(...yBatch);
    }
    if (sym.z) {
      const zBatch = centers.map(pt => new THREE.Vector3(pt.x, pt.y, -pt.z));
      centers.push(...zBatch);
    }

    const faceMats = this.mesh && this.mesh.userData ? this.mesh.userData.faceMaterialIndices : null;
    const res = splitLongEdgesScoped(this.geometry, centers, this.radius, {
      scopeMultiplier: 1.15,
      edgeRatio: 0.45,
      maxSplits: 36,
      faceMaterialIndices: faceMats,
      deferRebuild,
    });

    if (res.changed && this.geometry) {
      this.rebuildTopologyCaches();
    }
    return res.changed;
  }

  rebuildGrid() { this.spatialHash.build(this.geometry); }
  setTool(tool) { this.tool = tool; }
  setRadius(r) { this.radius = r; }
  setStrength(s) { this.strength = s; }
  setPaintColor(color) { this.paintColor.copy(color); }
  setActiveBone(index) { this.activeBoneIndex = index; }

  apply(localPoint, sym = { x: false, y: false, z: false }) {
    const pos = this.position;
    const norm = this.normal;
    if (!pos || !norm) return;

    const sx = Boolean(sym.x);
    const sy = Boolean(sym.y);
    const sz = Boolean(sym.z);

    const baseCenters = [localPoint.clone()];
    if (sx) baseCenters.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
    if (sy) {
      const yBatch = baseCenters.map(pt => new THREE.Vector3(pt.x, -pt.y, pt.z));
      baseCenters.push(...yBatch);
    }
    if (sz) {
      const zBatch = baseCenters.map(pt => new THREE.Vector3(pt.x, pt.y, -pt.z));
      baseCenters.push(...zBatch);
    }

    let primaryGrabDelta = null;
    if (this.tool === "grab" || this.tool === "elastic") {
      if (!this.lastGrabPoint) {
        this.lastGrabPoint = localPoint.clone();
      }
      primaryGrabDelta = localPoint.clone().sub(this.lastGrabPoint);
    }

    const affectedVertices = new Set();
    const neighborSet = new Set();
      const visitedThisApply = new Set();
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const avgNormal = new THREE.Vector3();
    const avgPos = new THREE.Vector3();
    const radiusSafe = Math.max(this.radius || 0.2, 1e-4);
    const idxArray = this.geometry.index ? this.geometry.index.array : null;

    for (let cIdx = 0; cIdx < baseCenters.length; cIdx++) {
      const c = baseCenters[cIdx];
      const region = this.spatialHash.query(c, radiusSafe);
      if (region.length === 0) continue;

      avgNormal.set(0, 0, 0);
      for (let r = 0; r < region.length; r++) {
        const i = region[r];
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (v.distanceTo(c) <= radiusSafe) {
          n.set(norm.getX(i), norm.getY(i), norm.getZ(i));
          avgNormal.add(n);
        }
      }
      if (avgNormal.lengthSq() > 1e-10) {
        avgNormal.normalize();
      } else {
        avgNormal.set(0, 1, 0);
      }

      // Mirror grab delta accurately for each symmetric center
      let gx = 0, gy = 0, gz = 0;
      if ((this.tool === "grab" || this.tool === "elastic") && primaryGrabDelta) {
        let signX = 1, signY = 1, signZ = 1;
        if (sx && Math.abs(c.x + localPoint.x) < 1e-5 && localPoint.x !== 0) signX = -1;
        if (sy && Math.abs(c.y + localPoint.y) < 1e-5 && localPoint.y !== 0) signY = -1;
        if (sz && Math.abs(c.z + localPoint.z) < 1e-5 && localPoint.z !== 0) signZ = -1;
        gx = primaryGrabDelta.x * signX;
        gy = primaryGrabDelta.y * signY;
        gz = primaryGrabDelta.z * signZ;
      }

      for (let r = 0; r < region.length; r++) {
        const i = region[r];
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
        if (dist > radiusSafe) continue;

      if (visitedThisApply.has(i)) continue;
      visitedThisApply.add(i);
        affectedVertices.add(i);
        const t = 1 - dist / radiusSafe;
        const falloff = t * t;
        const influence = THREE.MathUtils.clamp(falloff * this.strength, 0, 1);

        let ox = 0, oy = 0, oz = 0;
        switch (this.tool) {
          case "inflate":
            ox = avgNormal.x * influence * radiusSafe * 0.25;
            oy = avgNormal.y * influence * radiusSafe * 0.25;
            oz = avgNormal.z * influence * radiusSafe * 0.25;
            break;
          case "deflate":
            ox = -avgNormal.x * influence * radiusSafe * 0.25;
            oy = -avgNormal.y * influence * radiusSafe * 0.25;
            oz = -avgNormal.z * influence * radiusSafe * 0.25;
            break;
          case "grab":
            ox = gx * influence;
            oy = gy * influence;
            oz = gz * influence;
            break;
          case "clay": {
            const distToPlaneClay =
              (v.x - c.x) * avgNormal.x +
              (v.y - c.y) * avgNormal.y +
              (v.z - c.z) * avgNormal.z;
            const buildAmt = influence * radiusSafe * 0.22;
            const planePull = THREE.MathUtils.clamp(influence * 0.5, 0, 0.85);
            ox = avgNormal.x * buildAmt - avgNormal.x * distToPlaneClay * planePull;
            oy = avgNormal.y * buildAmt - avgNormal.y * distToPlaneClay * planePull;
            oz = avgNormal.z * buildAmt - avgNormal.z * distToPlaneClay * planePull;
            break;
          }
          case "crease": {
            const pinchK = THREE.MathUtils.clamp(influence * 0.5, 0, 0.75);
            const pushIn = influence * radiusSafe * 0.24;
            ox = (c.x - v.x) * pinchK - avgNormal.x * pushIn;
            oy = (c.y - v.y) * pinchK - avgNormal.y * pushIn;
            oz = (c.z - v.z) * pinchK - avgNormal.z * pushIn;
            break;
          }
          case "smooth": {
            const faceList = this.adjacencyMap[i];
            if (faceList && idxArray && faceList.length > 0) {
              neighborSet.clear();
              for (let f = 0; f < faceList.length; f++) {
                const baseTri = faceList[f] * 3;
                for (let j = 0; j < 3; j++) {
                  const nIdx = idxArray[baseTri + j];
                  if (nIdx !== i) neighborSet.add(nIdx);
                }
              }
              if (neighborSet.size > 0) {
                avgPos.set(0, 0, 0);
                neighborSet.forEach(nIdx => {
                  avgPos.x += pos.getX(nIdx);
                  avgPos.y += pos.getY(nIdx);
                  avgPos.z += pos.getZ(nIdx);
                });
                avgPos.divideScalar(neighborSet.size);
                const smoothK = THREE.MathUtils.clamp(influence, 0, 0.9);
                ox = (avgPos.x - v.x) * smoothK;
                oy = (avgPos.y - v.y) * smoothK;
                oz = (avgPos.z - v.z) * smoothK;
              }
            }
            break;
          }
          case "flatten": {
            const distToPlane =
              (v.x - c.x) * avgNormal.x +
              (v.y - c.y) * avgNormal.y +
              (v.z - c.z) * avgNormal.z;
            const flatK = THREE.MathUtils.clamp(influence, 0, 0.95);
            ox = -avgNormal.x * distToPlane * flatK;
            oy = -avgNormal.y * distToPlane * flatK;
            oz = -avgNormal.z * distToPlane * flatK;
            break;
          }
          case "pinch": {
            const pinchFactor = THREE.MathUtils.clamp(influence, 0, 0.85);
            ox = -(v.x - c.x) * pinchFactor;
            oy = -(v.y - c.y) * pinchFactor;
            oz = -(v.z - c.z) * pinchFactor;
            break;
          }
          case "scrape": {
            const distToPlane =
              (v.x - c.x) * avgNormal.x +
              (v.y - c.y) * avgNormal.y +
              (v.z - c.z) * avgNormal.z;
            if (distToPlane > 0) {
              const scrapeK = THREE.MathUtils.clamp(influence, 0, 0.95);
              ox = -avgNormal.x * distToPlane * scrapeK;
              oy = -avgNormal.y * distToPlane * scrapeK;
              oz = -avgNormal.z * distToPlane * scrapeK;
            }
            break;
          }
          case "fill": {
            const distToPlane =
              (v.x - c.x) * avgNormal.x +
              (v.y - c.y) * avgNormal.y +
              (v.z - c.z) * avgNormal.z;
            if (distToPlane < 0) {
              const fillK = THREE.MathUtils.clamp(influence, 0, 0.95);
              ox = -avgNormal.x * distToPlane * fillK;
              oy = -avgNormal.y * distToPlane * fillK;
              oz = -avgNormal.z * distToPlane * fillK;
            }
            break;
          }
          case "elastic": {
            const normDist = dist / radiusSafe;
            const gaussianFalloff = Math.exp(-3.2 * normDist * normDist);
            const elasticK = THREE.MathUtils.clamp(gaussianFalloff * this.strength, 0, 1);
            ox = gx * elasticK;
            oy = gy * elasticK;
            oz = gz * elasticK;
            break;
          }
        }
        const nxPos = v.x + ox;
        const nyPos = v.y + oy;
        const nzPos = v.z + oz;
        if (Number.isFinite(nxPos) && Number.isFinite(nyPos) && Number.isFinite(nzPos)) {
          pos.setXYZ(i, nxPos, nyPos, nzPos);
        }
      }
    }

    if (affectedVertices.size > 0) {
      pos.needsUpdate = true;
      updateNormals(this.geometry, Array.from(affectedVertices), this.adjacencyMap);
    }

    // Update grab/elastic anchor point for next frame
    if (this.tool === "grab" || this.tool === "elastic") {
      this.lastGrabPoint = localPoint.clone();
    }
  }

  paint(localPoint, sym = { x: false, y: false }) {
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
    if (sym.x) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
    if (sym.y) {
      const yBatch = centers.map(pt => new THREE.Vector3(pt.x, -pt.y, pt.z));
      centers.push(...yBatch);
    }
    if (sym.z) {
      const zBatch = centers.map(pt => new THREE.Vector3(pt.x, pt.y, -pt.z));
      centers.push(...zBatch);
    }

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

  paintTexture(localPoint, sym = { x: false, y: false }) {
    if (!this.geometry.attributes.uv) {
      // Fallback to vertex colors if no UVs exist
      return this.paint(localPoint, sym);
    }
    const canvas = this.mesh.userData.paintCanvas;
    const texture = this.mesh.userData.paintTexture;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d');
    const pos = this.geometry.attributes.position;
    const uv = this.geometry.attributes.uv;
    const centers = [localPoint.clone()];
    if (sym.x) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
    if (sym.y) {
      const yBatch = centers.map(pt => new THREE.Vector3(pt.x, -pt.y, pt.z));
      centers.push(...yBatch);
    }
    if (sym.z) {
      const zBatch = centers.map(pt => new THREE.Vector3(pt.x, pt.y, -pt.z));
      centers.push(...zBatch);
    }

    const v = new THREE.Vector3();
    const colorHex = '#' + this.paintColor.getHexString();
    ctx.fillStyle = colorHex;

    // We estimate brush size in pixels based on mesh scale.
    // A real UV unwrap would require a 2D spatial hash, but for typical
    // game meshes, drawing at the vertex UVs with a fixed pixel radius
    // creates a smooth stroke.
    const radiusPx = (this.radius * canvas.width) * 0.05;

    for (const c of centers) {
      const region = this.spatialHash.query(c, this.radius);
      for (const i of region) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
        if (dist <= this.radius) {
          const falloff = Math.pow(1 - dist / this.radius, 2) * this.strength;
          
          const u = uv.getX(i);
          const v_uv = uv.getY(i);
          
          // Map UV (0..1) to Canvas (0..width). flipY=false means V=0 is top.
          const px = u * canvas.width;
          const py = (1 - v_uv) * canvas.height;

          ctx.globalAlpha = falloff;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2, falloff * radiusPx), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1.0;
    texture.needsUpdate = true;
  }

  paintWeight(localPoint, sym = { x: false, y: false, z: false }) {
    if (!this.geometry.attributes.skinWeight || !this.geometry.attributes.skinIndex) return;

    const pos = this.position;
    const weightAttr = this.geometry.attributes.skinWeight;
    const indexAttr = this.geometry.attributes.skinIndex;
    const centers = [localPoint.clone()];
    if (sym.x) centers.push(new THREE.Vector3(-localPoint.x, localPoint.y, localPoint.z));
    if (sym.y) {
      const yBatch = centers.map(pt => new THREE.Vector3(pt.x, -pt.y, pt.z));
      centers.push(...yBatch);
    }
    if (sym.z) {
      const zBatch = centers.map(pt => new THREE.Vector3(pt.x, pt.y, -pt.z));
      centers.push(...zBatch);
    }

    const v = new THREE.Vector3();
    const visited = new Set();
    for (const c of centers) {
      const region = this.spatialHash.query(c, this.radius);
      for (const i of region) {
        if (visited.has(i)) continue;
        visited.add(i);
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const dist = v.distanceTo(c);
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
    }
    weightAttr.needsUpdate = true;
    indexAttr.needsUpdate = true;
  }
}
