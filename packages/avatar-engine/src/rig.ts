import * as THREE from 'three';
import type { PoseData } from './renderer.js';

export interface AvatarRig {
  group: THREE.Group;
  pelvis: THREE.Object3D;
  applyPose(pose: PoseData | null): void;
}

const DEG2RAD = Math.PI / 180;

function createLimb({
  length,
  radius,
  color
}: {
  length: number;
  radius: number;
  color: number;
}): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16);
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.6 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createJoint(color: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.12, 24, 24);
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.5 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

export function createAvatarRig(): AvatarRig {
  const group = new THREE.Group();
  const accent = 0x38bdf8;
  const neutral = 0x0ea5e9;

  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.35, 0.5),
    new THREE.MeshStandardMaterial({ color: accent, metalness: 0.25, roughness: 0.4 })
  );
  pelvis.position.set(0, 1.05, 0);
  pelvis.castShadow = true;
  group.add(pelvis);

  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.25, 0);
  pelvis.add(spinePivot);

  const spine = createLimb({ length: 0.9, radius: 0.14, color: accent });
  spine.position.y = 0.45;
  spinePivot.add(spine);

  const headJoint = createJoint(accent);
  headJoint.position.set(0, 0.9, 0);
  spinePivot.add(headJoint);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 32, 32),
    new THREE.MeshStandardMaterial({ color: neutral, metalness: 0.15, roughness: 0.45 })
  );
  head.position.set(0, 0.35, 0.05);
  headJoint.add(head);

  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(0.4, 0.75, 0);
  spinePivot.add(leftShoulder);
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(-0.4, 0.75, 0);
  spinePivot.add(rightShoulder);

  const leftArm = createLimb({ length: 0.8, radius: 0.11, color: neutral });
  leftArm.position.y = -0.4;
  leftShoulder.add(leftArm);

  const rightArm = createLimb({ length: 0.8, radius: 0.11, color: neutral });
  rightArm.position.y = -0.4;
  rightShoulder.add(rightArm);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(0.25, -0.2, 0);
  pelvis.add(leftLegPivot);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(-0.25, -0.2, 0);
  pelvis.add(rightLegPivot);

  const leftLeg = createLimb({ length: 1.0, radius: 0.13, color: neutral });
  leftLeg.position.y = -0.5;
  leftLegPivot.add(leftLeg);

  const rightLeg = createLimb({ length: 1.0, radius: 0.13, color: neutral });
  rightLeg.position.y = -0.5;
  rightLegPivot.add(rightLeg);

  const bones: Record<string, THREE.Object3D> = {
    spine: spinePivot,
    head: headJoint,
    leftArm: leftShoulder,
    rightArm: rightShoulder,
    leftLeg: leftLegPivot,
    rightLeg: rightLegPivot,
    pelvis
  };

  const applyPose = (pose: PoseData | null): void => {
    if (!pose) {
      Object.values(bones).forEach(bone => {
        bone.rotation.set(0, 0, 0);
      });
      return;
    }

    for (const frame of pose.keyframes) {
      const node = bones[frame.bone];
      if (!node) continue;

      const [x, y, z] = frame.rotation;
      node.rotation.set(x * DEG2RAD, y * DEG2RAD, z * DEG2RAD);
    }
  };

  return {
    group,
    pelvis,
    applyPose
  };
}
