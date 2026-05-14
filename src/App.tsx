import React, { useRef, useMemo, Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Html, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import './index.css';

export const hills = (() => {
  const list = [];
  for(let i=0; i<40; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      if (Math.sqrt(x * x + z * z) < 25) continue;
      list.push({
          x, 
          z, 
          scaleX: 5 + Math.random() * 15,
          scaleY: 1 + Math.random() * 3,
          scaleZ: 5 + Math.random() * 15,
          rotY: Math.random() * Math.PI,
      });
  }
  return list;
})();

export function getTerrainY(x: number, z: number, r: number = 0) {
  let targetY = 0;
  
  const checkPoints: [number, number][] = [[0, 0]];
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

  const v = new THREE.Vector3();
  const e = new THREE.Euler();

  for (const [ox, oz] of checkPoints) {
    const cx = x + ox;
    const cz = z + oz;
    for (const h of hills) {
      v.set(cx - h.x, 0, cz - h.z);
      e.set(0, -h.rotY, 0); // reverse rotation
      v.applyEuler(e);
      
      const sx = v.x / h.scaleX;
      const sz = v.z / h.scaleZ;
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

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 bg-red-500 text-white p-8 overflow-auto z-50">
          <h1 className="text-2xl font-bold">Something went wrong.</h1>
          <pre className="mt-4">{this.state.error?.message}</pre>
          <pre className="mt-4 text-sm opacity-80">{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Provide basic instructions over the game
function UI({ focused }: { focused: boolean }) {
  return (
    <div className="absolute top-0 left-0 p-6 pointer-events-none z-10 font-sans text-white drop-shadow-md w-full h-full flex flex-col justify-between">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-shadow">3D Knight Adventure</h1>
        <p className="bg-black/60 p-2 rounded-md inline-block">W A S D or Arrows to move</p>
      </div>
    </div>
  );
}

function Player() {
  const group = useRef<THREE.Group>(null);
  const character = useRef<THREE.Group>(null);

  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const lowerLeftLeg = useRef<THREE.Group>(null);
  const lowerRightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const lowerLeftArm = useRef<THREE.Group>(null);
  const lowerRightArm = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);

  const [, get] = useKeyboardControls();
  
  const moveSpeed = 8;
  const targetRotation = useRef(0);
  const PLAYER_HEIGHT_OFFSET = 0.1;

  const { camera } = useThree();

  const [frameError, setFrameError] = useState<string | null>(null);

  useFrame((state, delta) => {
    try {
      if (!group.current || !character.current) return;
      
      // Safety clamp delta
      const cappedDelta = Math.min(delta, 0.1);

      const { forward, backward, left, right } = get();

      const moveDir = new THREE.Vector3(0, 0, 0);

      if (forward) moveDir.z -= 1;
      if (backward) moveDir.z += 1;
      if (left) moveDir.x -= 1;
      if (right) moveDir.x += 1;

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        
        // Calculate target rotation
        targetRotation.current = Math.atan2(moveDir.x, moveDir.z);
        
        // Attempt movement with collision detection
        const playerRadius = 0.4; // Slightly increased for stability
        let collidedObs: any = null;
        const attemptMove = (dir: THREE.Vector3) => {
          const nextXZ = group.current!.position.clone().addScaledVector(dir, moveSpeed * cappedDelta);
          // Map bounds
          if (Math.abs(nextXZ.x) > 98 || Math.abs(nextXZ.z) > 98) return false;
          
          const terrainYAtNext = getTerrainY(nextXZ.x, nextXZ.z, 0.35);
          const nextY = terrainYAtNext + PLAYER_HEIGHT_OFFSET;
          
          let collisionDetected = false;
          for (const obs of obstacles as any[]) {
            const dx = obs.x - nextXZ.x;
            const dz = obs.z - nextXZ.z;
            const distanceXZ = Math.sqrt(dx * dx + dz * dz);
            if (distanceXZ < obs.r + playerRadius) {
              // Realistic collision height check: prevent walking through if elevation is similar
              if (nextY < obs.y + 2.0 && nextY + 1.0 > obs.y) {
                collidedObs = obs;
                collisionDetected = true;
                break;
              }
            }
          }
          if (collisionDetected) return false;

          // Apply movement
          group.current!.position.x = nextXZ.x;
          group.current!.position.z = nextXZ.z;
          
          // Instant snap up to prevent sinking, but allow gravity to pull down elsewhere
          if (nextY > group.current!.position.y) {
              group.current!.position.y = nextY;
          }

          return true;
        };

        if (!attemptMove(moveDir)) {
          if (collidedObs) {
            // Compute normal from obstacle to player
            const px = group.current!.position.x;
            const pz = group.current!.position.z;
            const nx = px - collidedObs.x;
            const nz = pz - collidedObs.z;
            const len = Math.sqrt(nx * nx + nz * nz);
            
            if (len > 0) {
              const normal = new THREE.Vector3(nx / len, 0, nz / len);
              const dot = moveDir.x * normal.x + moveDir.z * normal.z;
              
              if (dot < 0) {
                 // Player is moving into the obstacle, subtract the normal component
                 const slideDir = moveDir.clone().sub(normal.multiplyScalar(dot));
                 if (slideDir.lengthSq() > 0.01) {
                    slideDir.normalize();
                    // Attempt to move along the tangent
                    if (!attemptMove(slideDir)) {
                        // Fallback to axis-sliding
                        const moveX = new THREE.Vector3(slideDir.x, 0, 0);
                        const moveZ = new THREE.Vector3(0, 0, slideDir.z);
                        if (Math.abs(slideDir.x) > 0.01) attemptMove(moveX);
                        if (Math.abs(slideDir.z) > 0.01) attemptMove(moveZ);
                    }
                 }
              }
            }
          } else {
             // Slide along axes independently
             const moveX = new THREE.Vector3(moveDir.x, 0, 0);
             const moveZ = new THREE.Vector3(0, 0, moveDir.z);
             
             if (Math.abs(moveDir.x) > 0.01) attemptMove(moveX);
             if (Math.abs(moveDir.z) > 0.01) attemptMove(moveZ);
          }
        }
      }
      
      // Smoothly rotate character
      const currentRotation = character.current.rotation.y;
      let angleDiff = targetRotation.current - currentRotation;
      // Handle wrap-around for smooth rotation
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      character.current.rotation.y += angleDiff * 10 * cappedDelta;

      // Adjust height based on hills
      if (group.current) {
        // 0.35 player radius for sensing hill slopes so edges don't clip in
        const terrainHeight = getTerrainY(group.current.position.x, group.current.position.z, 0.35);
        const targetY = terrainHeight + PLAYER_HEIGHT_OFFSET;
        
        if (group.current.position.y < targetY) {
          // Enforce floor: instant snap up if below terrain
          group.current.position.y = targetY;
        } else if (group.current.position.y > targetY) {
          // Smooth fall if above terrain
          group.current.position.y = THREE.MathUtils.lerp(
            group.current.position.y, 
            targetY, 
            1 - Math.exp(-15 * cappedDelta)
          );
        }
      }

      // Walking animation
      const time = state.clock.elapsedTime;
      const walkSpeed = 10;
      if (moveDir.lengthSq() > 0) {
          // Bobbing
          character.current.position.y = Math.abs(Math.sin(time * walkSpeed)) * 0.08;
          
          // Swaying chest
          if (chest.current) {
            chest.current.rotation.y = Math.sin(time * walkSpeed) * 0.1;
            chest.current.rotation.z = Math.cos(time * walkSpeed) * 0.03;
          }

          // Arm swing
          if (leftArm.current && rightArm.current) {
             leftArm.current.rotation.x = -Math.sin(time * walkSpeed) * 0.5;
             rightArm.current.rotation.x = Math.sin(time * walkSpeed) * 0.3; // Right arm holds sword, swings less
          }

          if (lowerLeftArm.current && lowerRightArm.current) {
             lowerLeftArm.current.rotation.x = -0.2 - Math.max(0, Math.sin(time * walkSpeed)) * 0.4;
             lowerRightArm.current.rotation.x = -Math.PI / 4 + Math.sin(time * walkSpeed) * 0.1;
          }

          // Leg swing
          if (leftLeg.current && rightLeg.current) {
             leftLeg.current.rotation.x = Math.sin(time * walkSpeed) * 0.6;
             rightLeg.current.rotation.x = -Math.sin(time * walkSpeed) * 0.6;
          }

          if (lowerLeftLeg.current && lowerRightLeg.current) {
             lowerLeftLeg.current.rotation.x = Math.max(0, Math.sin(time * walkSpeed - 0.5)) * 0.8;
             lowerRightLeg.current.rotation.x = Math.max(0, -Math.sin(time * walkSpeed - 0.5)) * 0.8;
          }
      } else {
          // Idle animation
          character.current.position.y = THREE.MathUtils.lerp(character.current.position.y, Math.sin(time * 2) * 0.02, 5 * cappedDelta);
          
          if (chest.current) {
            chest.current.rotation.y = THREE.MathUtils.lerp(chest.current.rotation.y, 0, 5 * cappedDelta);
            chest.current.rotation.z = THREE.MathUtils.lerp(chest.current.rotation.z, Math.sin(time * 2) * 0.01, 5 * cappedDelta);
          }

          if (leftArm.current && rightArm.current) {
             leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 5 * cappedDelta);
             rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 5 * cappedDelta);
          }

          if (lowerLeftArm.current && lowerRightArm.current) {
             lowerLeftArm.current.rotation.x = THREE.MathUtils.lerp(lowerLeftArm.current.rotation.x, -0.1, 5 * cappedDelta);
             lowerRightArm.current.rotation.x = THREE.MathUtils.lerp(lowerRightArm.current.rotation.x, -Math.PI / 4, 5 * cappedDelta);
          }

          if (leftLeg.current && rightLeg.current) {
             leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 10 * cappedDelta);
             rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 10 * cappedDelta);
          }

          if (lowerLeftLeg.current && lowerRightLeg.current) {
             lowerLeftLeg.current.rotation.x = THREE.MathUtils.lerp(lowerLeftLeg.current.rotation.x, 0, 10 * cappedDelta);
             lowerRightLeg.current.rotation.x = THREE.MathUtils.lerp(lowerRightLeg.current.rotation.x, 0, 10 * cappedDelta);
          }
      }

      // Camera follow (smooth)
      const idealCameraPos = new THREE.Vector3(0, 8, 12);
      idealCameraPos.add(group.current.position);

      const idealLookAt = new THREE.Vector3(0, 1.5, 0);
      idealLookAt.add(group.current.position);

      if (isNaN(idealCameraPos.x) || isNaN(idealCameraPos.y) || isNaN(idealCameraPos.z)) {
         if (!frameError) setFrameError("idealCameraPos is NaN! group=" + group.current.position.toArray().join(","));
         return;
      }
      if (isNaN(idealLookAt.x) || isNaN(idealLookAt.y) || isNaN(idealLookAt.z)) {
         if (!frameError) setFrameError("idealLookAt is NaN! group=" + group.current.position.toArray().join(","));
         return;
      }

      camera.position.lerp(idealCameraPos, 5 * cappedDelta);
      camera.lookAt(idealLookAt);
    } catch(e: any) {
      if (!frameError) setFrameError(e.message + " | " + e.stack);
    }
  });

  return (
    <group>
      {frameError && (
        <Html center>
          <div style={{color:'red', background:'white', padding:10, width: 600, zIndex: 1000}}>
             ERROR: {frameError}
          </div>
        </Html>
      )}
      <group ref={group} position={[0, 0, 0]}>
        <group ref={character} position={[0, 0, 0]}>
        <group position={[0, 1.23, 0]}>
          <group ref={chest} position={[0, 0.1, 0]}>
            {/* Main Chest Plate / Cuirass */}
            <group position={[0, 0.35, 0]}>
              {/* Back Plate */}
              <mesh position={[0, 0, -0.05]} castShadow receiveShadow>
                <cylinderGeometry args={[0.26, 0.24, 0.45, 12, 1, false, 0, Math.PI]} />
                <meshToonMaterial color="#cbd5e1" />
              </mesh>
              {/* Front Plate (Breastplate) */}
              <mesh position={[0, 0, 0.05]} castShadow receiveShadow>
                <cylinderGeometry args={[0.27, 0.22, 0.45, 12, 1, false, Math.PI, Math.PI]} />
                <meshToonMaterial color="#e2e8f0" />
              </mesh>
              {/* Central Chest Ridge (Plackart accent) */}
              <mesh position={[0, 0, 0.28]} rotation={[0.05, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.06, 0.46, 0.04]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
              {/* Gold Trim Top */}
              <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.27, 0.27, 0.03, 16]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
            </group>

            {/* Abdomen / Faulds (Articulated plates) */}
            <group position={[0, 0.05, 0]}>
              <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.24, 0.25, 0.1, 12]} />
                <meshToonMaterial color="#cbd5e1" />
              </mesh>
              <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.25, 0.26, 0.1, 12]} />
                <meshToonMaterial color="#94a3b8" />
              </mesh>
              <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.26, 0.27, 0.1, 12]} />
                <meshToonMaterial color="#cbd5e1" />
              </mesh>
              <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.27, 0.28, 0.1, 12]} />
                <meshToonMaterial color="#94a3b8" />
              </mesh>
            </group>

            {/* Belt and Buckle */}
            <group position={[0, 0.12, 0]}>
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[0.26, 0.26, 0.08, 16]} />
                <meshToonMaterial color="#1f1209" />
              </mesh>
              {/* Buckle Base */}
              <mesh position={[0, 0, 0.26]} castShadow>
                <boxGeometry args={[0.12, 0.12, 0.02]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
              {/* Buckle Inner (Hole) */}
              <mesh position={[0, 0, 0.27]} castShadow>
                <boxGeometry args={[0.08, 0.08, 0.02]} />
                <meshToonMaterial color="#1f1209" />
              </mesh>
              {/* Buckle Pin */}
              <mesh position={[-0.03, 0, 0.275]} rotation={[0, 0, Math.PI/2]} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.08]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
              
              {/* Tassets (Thigh Guards hanging from belt) */}
              <mesh position={[-0.12, -0.15, 0.22]} rotation={[0.2, 0, 0.1]} castShadow receiveShadow>
                <boxGeometry args={[0.15, 0.25, 0.03]} />
                <meshToonMaterial color="#e2e8f0" />
              </mesh>
              <mesh position={[0.12, -0.15, 0.22]} rotation={[0.2, 0, -0.1]} castShadow receiveShadow>
                <boxGeometry args={[0.15, 0.25, 0.03]} />
                <meshToonMaterial color="#e2e8f0" />
              </mesh>
              {/* Tasset Trim */}
              <mesh position={[-0.12, -0.27, 0.225]} rotation={[0.2, 0, 0.1]} castShadow receiveShadow>
                <boxGeometry args={[0.15, 0.03, 0.03]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
              <mesh position={[0.12, -0.27, 0.225]} rotation={[0.2, 0, -0.1]} castShadow receiveShadow>
                <boxGeometry args={[0.15, 0.03, 0.03]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>
            </group>
            
            <group position={[0, 0.85, 0]} scale={[2.2, 2.2, 2.2]}>
              {/* Gorget (Neck guard) */}
              <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.18, 0.22, 0.1, 16]} />
                <meshToonMaterial color="#475569" />
              </mesh>

              {/* Inner Neck */}
              <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.1, 0.12, 0.15, 16]} />
                <meshToonMaterial color="#1e293b" />
              </mesh>
              
              {/* Main Helmet Bowl */}
              <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshToonMaterial color="#e2e8f0" />
              </mesh>
              
              {/* Back of Helmet (slight elongation) */}
              <mesh castShadow receiveShadow position={[0, 0.08, -0.04]} rotation={[0.2, 0, 0]}>
                <cylinderGeometry args={[0.17, 0.15, 0.25, 16]} />
                <meshToonMaterial color="#cbd5e1" />
              </mesh>

              {/* Visor (Face Plate) */}
              <group position={[0, 0.1, 0.1]}>
                {/* Upper Visor / Brow */}
                <mesh position={[0, 0.05, 0.05]} rotation={[-0.2, 0, 0]} castShadow>
                  <boxGeometry args={[0.3, 0.12, 0.1]} />
                  <meshToonMaterial color="#94a3b8" />
                </mesh>
                
                {/* Lower Visor / Snout */}
                <mesh position={[0, -0.05, 0.07]} rotation={[0.3, 0, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.18, 0.1]} />
                  <meshToonMaterial color="#94a3b8" />
                </mesh>

                {/* Eye Slits (Dark void inside) */}
                <mesh position={[0, 0.02, 0.09]} castShadow>
                  <boxGeometry args={[0.28, 0.03, 0.02]} />
                  <meshToonMaterial color="#000000" />
                </mesh>
                
                {/* Gold Trim around eye slit */}
                <mesh position={[0, 0.04, 0.1]} castShadow>
                  <boxGeometry args={[0.29, 0.01, 0.01]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>
                <mesh position={[0, 0.0, 0.1]} castShadow>
                  <boxGeometry args={[0.29, 0.01, 0.01]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>

                {/* Breathing holes */}
                <mesh position={[-0.05, -0.06, 0.12]} rotation={[Math.PI/2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
                  <meshToonMaterial color="#000000" />
                </mesh>
                <mesh position={[0.05, -0.06, 0.12]} rotation={[Math.PI/2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
                  <meshToonMaterial color="#000000" />
                </mesh>
                <mesh position={[-0.03, -0.09, 0.11]} rotation={[Math.PI/2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
                  <meshToonMaterial color="#000000" />
                </mesh>
                <mesh position={[0.03, -0.09, 0.11]} rotation={[Math.PI/2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
                  <meshToonMaterial color="#000000" />
                </mesh>
              </group>
              
              {/* Helmet Crest (Mohawk style ridge) */}
              <mesh position={[0, 0.26, 0]} castShadow>
                <boxGeometry args={[0.04, 0.08, 0.35]} />
                <meshToonMaterial color="#fbbf24" />
              </mesh>

              {/* Plume Base */}
              <mesh position={[0, 0.28, -0.1]} castShadow>
                <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
                <meshToonMaterial color="#475569" />
              </mesh>

              {/* Plume (Curved/More organic looking) */}
              <group position={[0, 0.3, -0.12]} rotation={[-0.2, 0, 0]}>
                <mesh position={[0, 0.05, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.06, 0.2, 8]} />
                  <meshToonMaterial color="#9f1239" />
                </mesh>
                <mesh position={[0, 0.12, -0.05]} rotation={[-0.4, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.02, 0.05, 0.2, 8]} />
                  <meshToonMaterial color="#9f1239" />
                </mesh>
                <mesh position={[0, 0.15, -0.12]} rotation={[-0.8, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.01, 0.04, 0.2, 8]} />
                  <meshToonMaterial color="#9f1239" />
                </mesh>
              </group>
            </group>

            <group ref={leftArm} position={[-0.45, 0.5, 0]} scale={[1.6, 0.9, 1.6]}>
              {/* Pauldron - Left */}
              <group position={[0, 0, 0]} rotation={[0, 0, -0.2]}>
                <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.16, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshToonMaterial color="#cbd5e1" />
                </mesh>
                <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>
                {/* Pauldron plates */}
                <mesh position={[0.1, -0.05, 0]} rotation={[0, 0, 0.4]} castShadow receiveShadow>
                  <boxGeometry args={[0.04, 0.15, 0.28]} />
                  <meshToonMaterial color="#94a3b8" />
                </mesh>
              </group>

              {/* Upper Arm Component */}
              <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.09, 0.08, 0.4, 12]} />
                <meshToonMaterial color="#1e293b" />
              </mesh>
              <mesh position={[0, -0.2, 0.02]} castShadow receiveShadow>
                <cylinderGeometry args={[0.1, 0.09, 0.35, 12]} />
                <meshToonMaterial color="#cbd5e1" />
              </mesh>

              <group ref={lowerLeftArm} position={[0, -0.4, 0]}>
                {/* Elbow Joint */}
                <mesh position={[0, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshToonMaterial color="#1e293b" />
                </mesh>
                <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>

                {/* Forearm / Vambrace */}
                <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.08, 0.07, 0.35, 12]} />
                  <meshToonMaterial color="#1e293b" />
                </mesh>
                <mesh position={[0, -0.15, 0.02]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.1, 0.08, 0.3, 12]} />
                  <meshToonMaterial color="#94a3b8" />
                </mesh>
                {/* Vambrace trim */}
                <mesh position={[0, -0.05, 0.02]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.11, 0.11, 0.04, 12]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>
                <mesh position={[0, -0.28, 0.02]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.09, 0.09, 0.04, 12]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>

                {/* Hand / Gauntlet */}
                <group position={[0, -0.38, 0]}>
                  {/* Inner hand */}
                  <mesh castShadow receiveShadow>
                     <boxGeometry args={[0.12, 0.18, 0.12]} />
                     <meshToonMaterial color="#1e293b" />
                  </mesh>
                  {/* Gauntlet plates */}
                  <mesh position={[0, 0.02, 0.05]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
                     <boxGeometry args={[0.14, 0.14, 0.06]} />
                     <meshToonMaterial color="#cbd5e1" />
                  </mesh>
                  <mesh position={[0, -0.04, 0.04]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
                     <boxGeometry args={[0.14, 0.12, 0.06]} />
                     <meshToonMaterial color="#cbd5e1" />
                  </mesh>
                </group>

                {/* Shield */}
                <group position={[-0.05, -0.15, 0.05]} rotation={[0, -Math.PI / 4, 0]}>
                   <mesh position={[0, 0, 0.1]} castShadow receiveShadow>
                     <boxGeometry args={[0.35, 0.5, 0.04]} />
                     <meshToonMaterial color="#334155" />
                   </mesh>
                   <mesh position={[0, 0, 0.12]} castShadow receiveShadow>
                     <boxGeometry args={[0.31, 0.46, 0.02]} />
                     <meshToonMaterial color="#0f172a" />
                   </mesh>
                   <mesh position={[0, 0, 0.13]} castShadow receiveShadow>
                     <boxGeometry args={[0.04, 0.5, 0.02]} />
                     <meshToonMaterial color="#fbbf24" />
                   </mesh>
                   <mesh position={[0, 0, 0.13]} castShadow receiveShadow>
                     <boxGeometry args={[0.35, 0.04, 0.02]} />
                     <meshToonMaterial color="#fbbf24" />
                   </mesh>
                </group>
              </group>
            </group>
            
            <group ref={rightArm} position={[0.45, 0.5, 0]} scale={[1.6, 0.9, 1.6]}>
              {/* Pauldron - Right */}
              <group position={[0, 0, 0]} rotation={[0, 0, 0.2]}>
                <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.16, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshToonMaterial color="#cbd5e1" />
                </mesh>
                <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
                  <meshToonMaterial color="#fbbf24" />
                </mesh>
                {/* Pauldron plates */}
                <mesh position={[-0.1, -0.05, 0]} rotation={[0, 0, -0.4]} castShadow receiveShadow>
                  <boxGeometry args={[0.04, 0.15, 0.28]} />
                  <meshToonMaterial color="#94a3b8" />
                </mesh>
              </group>
              <group rotation={[-Math.PI / 5, 0, 0]}>
                  {/* Upper Arm Component */}
                  <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.09, 0.08, 0.4, 12]} />
                    <meshToonMaterial color="#1e293b" />
                  </mesh>
                  <mesh position={[0, -0.2, 0.02]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.1, 0.09, 0.35, 12]} />
                    <meshToonMaterial color="#cbd5e1" />
                  </mesh>

                  <group ref={lowerRightArm} position={[0, -0.4, 0]}>
                      {/* Elbow Joint */}
                      <mesh position={[0, 0, 0]} castShadow receiveShadow>
                        <sphereGeometry args={[0.08, 16, 16]} />
                        <meshToonMaterial color="#1e293b" />
                      </mesh>
                      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                        <sphereGeometry args={[0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                        <meshToonMaterial color="#fbbf24" />
                      </mesh>

                      {/* Forearm / Vambrace */}
                      <mesh position={[0, -0.15, 0]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.08, 0.07, 0.35, 12]} />
                        <meshToonMaterial color="#1e293b" />
                      </mesh>
                      <mesh position={[0, -0.15, 0.02]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.1, 0.08, 0.3, 12]} />
                        <meshToonMaterial color="#94a3b8" />
                      </mesh>
                      {/* Vambrace trim */}
                      <mesh position={[0, -0.05, 0.02]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.11, 0.11, 0.04, 12]} />
                        <meshToonMaterial color="#fbbf24" />
                      </mesh>
                      <mesh position={[0, -0.28, 0.02]} castShadow receiveShadow>
                        <cylinderGeometry args={[0.09, 0.09, 0.04, 12]} />
                        <meshToonMaterial color="#fbbf24" />
                      </mesh>
                      
                      {/* Hand / Gauntlet */}
                      <group position={[0, -0.38, 0]}>
                        {/* Inner hand */}
                        <mesh castShadow receiveShadow>
                           <boxGeometry args={[0.12, 0.18, 0.12]} />
                           <meshToonMaterial color="#1e293b" />
                        </mesh>
                        {/* Gauntlet plates */}
                        <mesh position={[0, 0.02, 0.05]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
                           <boxGeometry args={[0.14, 0.14, 0.06]} />
                           <meshToonMaterial color="#cbd5e1" />
                        </mesh>
                        <mesh position={[0, -0.04, 0.04]} rotation={[0.1, 0, 0]} castShadow receiveShadow>
                           <boxGeometry args={[0.14, 0.12, 0.06]} />
                           <meshToonMaterial color="#cbd5e1" />
                        </mesh>
                      </group>

                      {/* Realistic Sword */}
                      <group position={[0, -0.38, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
                        <mesh position={[0, -0.2, 0]} castShadow>
                            <cylinderGeometry args={[0.02, 0.02, 0.2]} />
                            <meshToonMaterial color="#1f1209" />
                        </mesh>
                        <mesh position={[0, -0.3, 0]} castShadow>
                            <sphereGeometry args={[0.04]} />
                            <meshToonMaterial color="#fbbf24" />
                        </mesh>
                        <mesh position={[0, -0.05, 0]} castShadow>
                            <boxGeometry args={[0.3, 0.04, 0.04]} />
                            <meshToonMaterial color="#fbbf24" />
                        </mesh>
                        <mesh position={[0, 0.55, 0]} castShadow>
                            <boxGeometry args={[0.06, 1.2, 0.02]} />
                            <meshToonMaterial color="#e2e8f0" />
                        </mesh>
                        <mesh position={[0, 1.2, 0]} castShadow>
                            <cylinderGeometry args={[0.0, 0.04, 0.1]} />
                            <meshToonMaterial color="#e2e8f0" />
                        </mesh>
                      </group>
                  </group>
              </group>
            </group>
          </group>
          
          <group ref={leftLeg} position={[-0.2, -0.2, 0]} scale={[1.6, 0.9, 1.6]}>
             <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.13, 0.11, 0.5, 12]} />
                <meshToonMaterial color="#1e293b" />
             </mesh>
             <mesh position={[0, -0.25, 0.02]} castShadow receiveShadow>
                <cylinderGeometry args={[0.15, 0.13, 0.45, 12]} />
                <meshToonMaterial color="#64748b" />
             </mesh>
             <mesh position={[0, -0.45, 0.02]} castShadow receiveShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.05, 12]} />
                <meshToonMaterial color="#fbbf24" />
             </mesh>

             <group ref={lowerLeftLeg} position={[0, -0.5, 0]}>
               <mesh position={[0, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshToonMaterial color="#1e293b" />
               </mesh>
               <mesh position={[0, 0.02, 0.08]} rotation={[Math.PI / 4, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>
               <mesh position={[0, 0.02, 0.08]} castShadow receiveShadow>
                  <boxGeometry args={[0.12, 0.12, 0.06]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>
               <mesh position={[-0.08, 0.02, 0.08]} rotation={[0, 0, Math.PI / 4]} castShadow receiveShadow>
                  <boxGeometry args={[0.08, 0.02, 0.06]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>

               <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.08, 0.06, 0.5, 12]} />
                  <meshToonMaterial color="#1e293b" />
               </mesh>
               <mesh position={[0, -0.25, 0.03]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.1, 0.08, 0.45, 12]} />
                  <meshToonMaterial color="#94a3b8" />
               </mesh>
               
               <group position={[0, -0.55, 0.05]}>
                 <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.18, 0.18, 0.26]} />
                    <meshToonMaterial color="#475569" />
                 </mesh>
                 <mesh position={[0, -0.02, 0.12]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.16, 0.12, 0.18]} />
                    <meshToonMaterial color="#94a3b8" />
                 </mesh>
                 <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
                    <meshToonMaterial color="#fbbf24" />
                 </mesh>
                 <mesh position={[0, -0.06, 0.0]} castShadow receiveShadow>
                    <boxGeometry args={[0.2, 0.06, 0.3]} />
                    <meshToonMaterial color="#0f172a" />
                 </mesh>
               </group>
             </group>
          </group>

          <group ref={rightLeg} position={[0.2, -0.2, 0]} scale={[1.6, 0.9, 1.6]}>
             <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.13, 0.11, 0.5, 12]} />
                <meshToonMaterial color="#1e293b" />
             </mesh>
             <mesh position={[0, -0.25, 0.02]} castShadow receiveShadow>
                <cylinderGeometry args={[0.15, 0.13, 0.45, 12]} />
                <meshToonMaterial color="#64748b" />
             </mesh>
             <mesh position={[0, -0.45, 0.02]} castShadow receiveShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.05, 12]} />
                <meshToonMaterial color="#fbbf24" />
             </mesh>

             <group ref={lowerRightLeg} position={[0, -0.5, 0]}>
               <mesh position={[0, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshToonMaterial color="#1e293b" />
               </mesh>
               <mesh position={[0, 0.02, 0.08]} rotation={[Math.PI / 4, 0, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[0.09, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>
               <mesh position={[0, 0.02, 0.08]} castShadow receiveShadow>
                  <boxGeometry args={[0.12, 0.12, 0.06]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>
               <mesh position={[0.08, 0.02, 0.08]} rotation={[0, 0, -Math.PI / 4]} castShadow receiveShadow>
                  <boxGeometry args={[0.08, 0.02, 0.06]} />
                  <meshToonMaterial color="#cbd5e1" />
               </mesh>

               <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.08, 0.06, 0.5, 12]} />
                  <meshToonMaterial color="#1e293b" />
               </mesh>
               <mesh position={[0, -0.25, 0.03]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.1, 0.08, 0.45, 12]} />
                  <meshToonMaterial color="#94a3b8" />
               </mesh>
               
               <group position={[0, -0.55, 0.05]}>
                 <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.18, 0.18, 0.26]} />
                    <meshToonMaterial color="#475569" />
                 </mesh>
                 <mesh position={[0, -0.02, 0.12]} rotation={[0.2, 0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.16, 0.12, 0.18]} />
                    <meshToonMaterial color="#94a3b8" />
                 </mesh>
                 <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
                    <meshToonMaterial color="#fbbf24" />
                 </mesh>
                 <mesh position={[0, -0.06, 0.0]} castShadow receiveShadow>
                    <boxGeometry args={[0.2, 0.06, 0.3]} />
                    <meshToonMaterial color="#0f172a" />
                 </mesh>
               </group>
             </group>
          </group>
        </group>
      </group>
    </group>
    </group>
  );
}


  const trees = (() => {
    const list = [];
    for(let i=0; i<60; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        // avoid center spawn area
        if (Math.sqrt(x * x + z * z) < 10) continue;
        list.push({x, z, y: getTerrainY(x, z), scale: 0.8 + Math.random() * 0.8});
    }
    return list;
})();

  const rocks = (() => {
    const list = [];
    for(let i=0; i<80; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        if (Math.sqrt(x * x + z * z) < 8) continue;
        list.push({
            x, 
            z, 
            y: getTerrainY(x, z),
            scale: 0.3 + Math.random() * 0.7,
            rotY: Math.random() * Math.PI,
            rotX: Math.random() * 0.2,
            rotZ: Math.random() * 0.2,
        });
    }
    return list;
})();

  const bushes = (() => {
    const list = [];
    for(let i=0; i<100; i++) {
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        if (Math.sqrt(x * x + z * z) < 8) continue;
        list.push({x, z, y: getTerrainY(x, z), scale: 0.5 + Math.random() * 0.5});
    }
    return list;
})();



  const clouds = (() => {
    const list = [];
    for(let i=0; i<30; i++) {
        list.push({
            x: (Math.random() - 0.5) * 200,
            y: 15 + Math.random() * 10,
            z: (Math.random() - 0.5) * 200,
            scale: 2 + Math.random() * 3,
            rotY: Math.random() * Math.PI,
        });
    }
    return list;
})();

  const flowers = (() => {
    const list = [];
    const colors = ["#f87171", "#fbbf24", "#60a5fa", "#c084fc", "#f472b6"];
    for(let i=0; i<150; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
        list.push({
            x, 
            z, 
            y: getTerrainY(x, z),
            scale: 0.3 + Math.random() * 0.4,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    return list;
})();

  

export const obstacles = [
  ...trees.map(t => ({x: t.x, z: t.z, y: t.y, r: 0.35 * t.scale})),
  ...rocks.map(t => ({x: t.x, z: t.z, y: t.y, r: 0.4 * t.scale}))
];

function Scenery() {
return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshToonMaterial color="#a3e635" />
      </mesh>
      
      {hills.map((h, i) => (
        <mesh key={`hill-${i}`} position={[h.x, 0, h.z]} scale={[h.scaleX, h.scaleY, h.scaleZ]} rotation={[0, h.rotY, 0]} receiveShadow castShadow>
          <sphereGeometry args={[1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshToonMaterial color="#84cc16" />
        </mesh>
      ))}

      {trees.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]} scale={[t.scale, t.scale, t.scale]}>
            {/* Trunk */}
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.2, 0.4, 2]} />
                <meshToonMaterial color="#78350f" />
            </mesh>
            {/* Anime style puffy layers */}
            {/* Main canopy */}
            <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshToonMaterial color="#22c55e" />
            </mesh>
            {/* Highlights/bumps */}
            <mesh position={[0.8, 2.8, 0.8]} castShadow>
                <sphereGeometry args={[0.8, 12, 12]} />
                <meshToonMaterial color="#4ade80" />
            </mesh>
            <mesh position={[-0.9, 2.6, 0.5]} castShadow>
                <sphereGeometry args={[1, 12, 12]} />
                <meshToonMaterial color="#22c55e" />
            </mesh>
            <mesh position={[0.5, 2.9, -0.8]} castShadow>
                <sphereGeometry args={[0.9, 12, 12]} />
                <meshToonMaterial color="#4ade80" />
            </mesh>
            {/* Shadows/lower bumps */}
            <mesh position={[-0.5, 1.8, -0.6]} castShadow receiveShadow>
                <sphereGeometry args={[0.8, 12, 12]} />
                <meshToonMaterial color="#16a34a" />
            </mesh>
            <mesh position={[0.7, 1.9, -0.3]} castShadow receiveShadow>
                <sphereGeometry args={[0.9, 12, 12]} />
                <meshToonMaterial color="#15803d" />
            </mesh>
            <mesh position={[-0.2, 1.7, 0.7]} castShadow receiveShadow>
                <sphereGeometry args={[0.7, 12, 12]} />
                <meshToonMaterial color="#16a34a" />
            </mesh>
        </group>
      ))}

      {rocks.map((r, i) => (
        <mesh key={`rock-${i}`} position={[r.x, r.y, r.z]} scale={[r.scale, r.scale, r.scale]} rotation={[r.rotX, r.rotY, r.rotZ]} castShadow receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshToonMaterial color="#94a3b8" />
        </mesh>
      ))}

      {bushes.map((b, i) => (
        <group key={`bush-${i}`} position={[b.x, b.y, b.z]} scale={[b.scale, b.scale, b.scale]}>
          <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshToonMaterial color="#22c55e" />
          </mesh>
          <mesh position={[0.3, 0.3, 0.2]} castShadow receiveShadow>
            <sphereGeometry args={[0.4, 10, 10]} />
            <meshToonMaterial color="#4ade80" />
          </mesh>
          <mesh position={[-0.3, 0.2, 0.3]} castShadow receiveShadow>
            <sphereGeometry args={[0.3, 10, 10]} />
            <meshToonMaterial color="#16a34a" />
          </mesh>
        </group>
      ))}

      {flowers.map((f, i) => (
        <group key={`flower-${i}`} position={[f.x, f.y, f.z]} scale={[f.scale, f.scale, f.scale]}>
          {/* Stem */}
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.4]} />
            <meshToonMaterial color="#16a34a" />
          </mesh>
          {/* Petals */}
          <group position={[0, 0.4, 0]} rotation={[0.4, 0, 0]}>
             <mesh position={[0, 0, 0]} castShadow>
               <sphereGeometry args={[0.1, 8, 8]} />
               <meshToonMaterial color="#fbbf24" />
             </mesh>
             <mesh position={[0.1, 0, 0]} castShadow>
               <sphereGeometry args={[0.08, 8, 8]} />
               <meshToonMaterial color={f.color} />
             </mesh>
             <mesh position={[-0.1, 0, 0]} castShadow>
               <sphereGeometry args={[0.08, 8, 8]} />
               <meshToonMaterial color={f.color} />
             </mesh>
             <mesh position={[0, 0.1, 0]} castShadow>
               <sphereGeometry args={[0.08, 8, 8]} />
               <meshToonMaterial color={f.color} />
             </mesh>
             <mesh position={[0, -0.1, 0]} castShadow>
               <sphereGeometry args={[0.08, 8, 8]} />
               <meshToonMaterial color={f.color} />
             </mesh>
          </group>
        </group>
      ))}

      {clouds.map((c, i) => (
        <group key={`cloud-${i}`} position={[c.x, c.y, c.z]} scale={[c.scale, c.scale, c.scale]} rotation={[0, c.rotY, 0]}>
          <mesh position={[0, 0, 0]} castShadow>
            <sphereGeometry args={[1, 16, 16]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.8, -0.2, 0.2]} castShadow>
            <sphereGeometry args={[0.7, 12, 12]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.8, -0.3, 0.4]} castShadow>
            <sphereGeometry args={[0.8, 12, 12]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.3, 0.5, -0.4]} castShadow>
            <sphereGeometry args={[0.9, 12, 12]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.3, 0.2, -0.6]} castShadow>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

    </>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // Attempt to focus on mount
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  return (
    <ErrorBoundary>
      <div 
        ref={containerRef}
        className="w-full h-screen bg-sky-200 overflow-hidden relative outline-none cursor-pointer"
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.focus();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <UI focused={focused} />
        {/* We can expose frameError to UI somehow? Or just console.log it... wait we can't easily hoist it. */ }
        <KeyboardControls
          map={[
            { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
            { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
            { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
          ]}
        >
          <Canvas shadows camera={{ position: [0, 10, 14], fov: 50 }}>
            <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
            <ambientLight intensity={0.4} />
            <directionalLight
              castShadow
              position={[50, 50, 50]}
              intensity={1.2}
              shadow-mapSize={[4096, 4096]}
              shadow-camera-left={-80}
              shadow-camera-right={80}
              shadow-camera-top={80}
              shadow-camera-bottom={-80}
              shadow-camera-near={0.1}
              shadow-camera-far={200}
              shadow-bias={-0.001}
            />
            
            <Player />
            <Scenery />
          </Canvas>
        </KeyboardControls>
      </div>
    </ErrorBoundary>
  );
}
