const THREE = require('three');

function test(x, z, rotY) {
    const euler = new THREE.Euler(0, rotY, 0);
    const m = new THREE.Matrix4().makeRotationFromEuler(euler);
    const mInv = new THREE.Matrix4().copy(m).invert();

    const p = new THREE.Vector3(x, 0, z);
    p.applyMatrix4(mInv);
    
    const dx = x;
    const dz = z;
    const c = Math.cos(-rotY);
    const s = Math.sin(-rotY);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    
    console.log("THREE:", p.x, p.z);
    console.log("MANUAL:", lx, lz);
}

test(1, 0, Math.PI / 4);
