import * as THREE from 'three';

const hills = [
  {x: 10, z: 10, scaleX: 10, scaleZ: 10, scaleY: 10, rotY: 0}
];

export function getTerrainY(x, z, r = 0) {
  let targetY = 0;
  
  const checkPoints = [[0, 0]];
  if (r > 0) {
    const steps = 3;
    for (let u = -steps; u <= steps; u++) {
        for (let v = -steps; v <= steps; v++) {
            const ox = (u / steps) * r;
            const oz = (v / steps) * r;
            if (ox * ox + oz * oz <= r * r) {
                checkPoints.push([ox, oz]);
            }
        }
    }
  }

  for (const [ox, oz] of checkPoints) {
    const cx = x + ox;
    const cz = z + oz;
    for (const h of hills) {
      const dx = cx - h.x;
      const dz = cz - h.z;
      const c = Math.cos(-h.rotY);
      const s = Math.sin(-h.rotY);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const sx = lx / h.scaleX;
      const sz = lz / h.scaleZ;
      const distSq = sx * sx + sz * sz;
      if (distSq < 1) {
        const sy = Math.sqrt(1 - distSq);
        const worldY = sy * h.scaleY;
        if (worldY > targetY) targetY = worldY;
      }
    }
  }
  return targetY;
}

const pos = new THREE.Vector3(0, 0, 0);

for(let i=0; i<10; i++) {
   const ty = getTerrainY(pos.x, pos.z, 0.35);
   console.log("ty:", ty, "pos.y before:", pos.y);
   if (pos.y < ty) {
       pos.y = ty;
   } else {
       pos.y = THREE.MathUtils.lerp(pos.y, ty, 1 - Math.exp(-15 * 0.016));
   }
   console.log("pos:", pos);
}
