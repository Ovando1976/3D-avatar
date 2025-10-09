import { useCallback, useState } from 'react';
import type { PoseSuggestion } from '@3d-avatar/ai-clients';
import { PoseGenerationClient } from '@3d-avatar/ai-clients';
import type { SessionDetail } from '@3d-avatar/collaboration-sdk';

interface PoseSuggestionState {
  pose: PoseSuggestion | null;
  loading: boolean;
  error: string | null;
}

const fallbackClient = new PoseGenerationClient();

export function usePoseSuggestion(): {
  pose: PoseSuggestion | null;
  loading: boolean;
  error: string | null;
  requestPose: (prompt: string, options?: { sessionId?: string }) => Promise<{
    pose: PoseSuggestion;
    session: SessionDetail | null;
  } | null>;
} {
  const [{ pose, loading, error }, setState] = useState<PoseSuggestionState>({
    pose: null,
    loading: false,
    error: null
  });

  const requestPose = useCallback(
    async (prompt: string, options?: { sessionId?: string }) => {
      setState(previous => ({ ...previous, loading: true, error: null }));

      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
        const response = await fetch(`${baseUrl}/poses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, sessionId: options?.sessionId })
        });

        if (!response.ok) {
          throw new Error(`Pose request failed (${response.status})`);
        }

        const data: { pose: PoseSuggestion; session: SessionDetail | null } = await response.json();
        setState({ pose: data.pose, loading: false, error: null });
        return data;
      } catch (networkError) {
        console.warn('[studio] pose generation request failed, using offline client', networkError);
      }

      try {
        const offlinePose = await fallbackClient.suggestPose(prompt);
        setState({ pose: offlinePose, loading: false, error: null });
        return { pose: offlinePose, session: null };
      } catch (fallbackError) {
        console.error('[studio] fallback pose generation failed', fallbackError);
        setState(previous => ({ ...previous, loading: false, error: 'Unable to generate pose' }));
        return null;
      }
    },
    []
  );

  return { pose, loading, error, requestPose };
}
