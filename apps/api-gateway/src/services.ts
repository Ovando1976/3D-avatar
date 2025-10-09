import { CollaborationSessionService } from '@3d-avatar/collaboration-sdk';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';

export const sessionService = new CollaborationSessionService();
export const poseClient = new PoseGenerationClient();
