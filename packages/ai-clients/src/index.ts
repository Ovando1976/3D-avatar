export interface PoseSuggestion {
  id: string;
  data: {
    keyframes: Array<{
      bone: string;
      rotation: [number, number, number];
    }>;
  };
}

function normalisePrompt(prompt: string): number {
  return prompt
    .trim()
    .split('')
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function wrapRotation(value: number): number {
  return ((value % 45) + 45) % 45 - 22.5;
}

const BONES = ['spine', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'pelvis'] as const;

export class PoseGenerationClient {
  async suggestPose(prompt: string): Promise<PoseSuggestion> {
    const seed = normalisePrompt(prompt || 'neutral');
    const rotations = BONES.map((bone, index) => {
      const offset = (seed >> (index * 3)) & 0xff;
      return {
        bone,
        rotation: [wrapRotation(offset), wrapRotation(offset / 2), wrapRotation(offset / 3)] as [number, number, number]
      };
    });

    await new Promise(resolve => setTimeout(resolve, 120));

    return {
      id: `pose_${seed.toString(36)}`,
      data: {
        keyframes: rotations
      }
    };
  }
}

export class MeshGenerationClient {
  async generateMesh(description: string): Promise<{ url: string }> {
    await new Promise(resolve => setTimeout(resolve, 180));
    return { url: `https://cdn.3d-avatar.local/meshes/${encodeURIComponent(description)}.glb` };
  }
}
