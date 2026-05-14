import * as THREE from 'three';

export const hills = [
  { position: new THREE.Vector3(10, 0, 10), radius: 20, height: 5 },
  { position: new THREE.Vector3(-20, 0, -15), radius: 30, height: 8 },
  { position: new THREE.Vector3(30, 0, -25), radius: 15, height: 4 },
  { position: new THREE.Vector3(-10, 0, 35), radius: 25, height: 6 },
  { position: new THREE.Vector3(0, 0, 0), radius: 10, height: 1 },
];

export function getTerrainY(x, z) {
  let y = 0;
  for (const hill of hills) {
    const dx = x - hill.position.x;
    const dz = z - hill.position.z;
    const distSq = dx * dx + dz * dz;
    const radiusSq = hill.radius * hill.radius;
    
    if (distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      const h = hill.height * Math.cos((dist / hill.radius) * Math.PI / 2);
      y = Math.max(y, h);
    }
  }
  
  y += Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.5;
  y += Math.sin(x * 0.05 + z * 0.05) * 1.0;
  
  const sx = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, -Math.PI / 4, 0)).x * x;
  const sz = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, -Math.PI / 4, 0)).z * z;
  y += Math.sin(sx * 0.02) * Math.cos(sz * 0.02) * 2.0;

  return y;
}

const trees = (() => {
  const list = [];
  for(let i=0; i<60; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      const t = {
          x,
          z,
          y: getTerrainY(x, z),
          scale: 0.5 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
      };
      if (Math.abs(x) > 5 || Math.abs(z) > 5) {
          list.push(t);
      }
  }
  return list;
})();

const rocks = (() => {
  const list = [];
  for(let i=0; i<40; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      const t = {
          x,
          z,
          y: getTerrainY(x, z) - 0.2, // slightly buried
          scale: 0.2 + Math.random() * 0.6,
          rotation: Math.random() * Math.PI * 2,
      };
      if (Math.abs(x) > 5 || Math.abs(z) > 5) {
          list.push(t);
      }
  }
  return list;
})();

console.log("Trees NaN count:", trees.filter(t => isNaN(t.y)).length);
console.log("Rocks NaN count:", rocks.filter(t => isNaN(t.y)).length);
