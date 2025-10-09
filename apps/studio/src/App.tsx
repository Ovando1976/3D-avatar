import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvatarViewport } from '@3d-avatar/avatar-engine';
import type { PoseSuggestion } from '@3d-avatar/ai-clients';
import type { PoseSnapshot, SessionDetail, SessionSummary } from '@3d-avatar/collaboration-sdk';
import { Button, Panel, Stack, TextField } from '@3d-avatar/design-system';
import { usePoseSuggestion } from './hooks/usePoseSuggestion';
import './app.css';

const DEFAULT_PROMPT = 'dynamic hero landing pose';
const MAX_HISTORY = 5;

function toSnapshot(pose: PoseSuggestion, prompt: string): PoseSnapshot {
  return {
    id: pose.id,
    keyframeCount: pose.data.keyframes.length,
    createdAt: Date.now(),
    source: 'ai',
    prompt
  };
}

function limitHistory(history: PoseSnapshot[]): PoseSnapshot[] {
  return history.slice(0, MAX_HISTORY);
}

export function App(): JSX.Element {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const { pose, loading, error, requestPose } = usePoseSuggestion();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [history, setHistory] = useState<PoseSnapshot[]>([]);

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
    const response = await fetch(`${baseUrl}/sessions/${sessionId}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Unable to load session (${response.status})`);
    }

    const data: { session: SessionDetail } = await response.json();
    setSessionDetail(data.session);
    setHistory(limitHistory(data.session.poses));
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/sessions`, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        throw new Error(`Unable to load sessions (${response.status})`);
      }

      const data: { sessions: SessionSummary[] } = await response.json();
      setSessions(data.sessions);
      setSessionError(null);

      if (data.sessions.length === 0) {
        setSelectedSessionId(null);
        setSessionDetail(null);
        setHistory([]);
        return;
      }

      const targetId = data.sessions.some(session => session.id === selectedSessionId)
        ? selectedSessionId!
        : data.sessions[0]?.id;

      if (targetId) {
        setSelectedSessionId(targetId);
        await loadSessionDetail(targetId);
      }
    } catch (fetchError) {
      console.warn('[studio] Unable to fetch sessions, falling back to offline mode', fetchError);
      const limitedHistory = limitHistory(history);
      const offlineSession: SessionDetail = {
        id: 'local-preview',
        participants: ['you'],
        lastUpdated: Date.now(),
        poseCount: limitedHistory.length,
        poses: limitedHistory
      };
      setSessions([
        {
          id: offlineSession.id,
          participants: offlineSession.participants,
          lastUpdated: offlineSession.lastUpdated,
          poseCount: offlineSession.poseCount
        }
      ]);
      setSelectedSessionId(offlineSession.id);
      setHistory(limitedHistory);
      setSessionDetail(offlineSession);
      setSessionError('Connected in offline preview mode');
    }
  }, [history, loadSessionDetail, selectedSessionId]);

  useEffect(() => {
    refreshSessions().catch(() => {
      /* error handled above */
    });
  }, [refreshSessions]);

  useEffect(() => {
    if (!pose || !sessionDetail) {
      return;
    }

    const updatedAt = new Date().getTime();
    setSessionDetail(current =>
      current
        ? { ...current, lastUpdated: updatedAt }
        : null
    );
  }, [pose, sessionDetail]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!prompt.trim()) {
        return;
      }

      const result = await requestPose(prompt.trim(), { sessionId: selectedSessionId ?? undefined });

      if (result?.session) {
        setSessionDetail(result.session);
        setHistory(limitHistory(result.session.poses));
        setSessionError(null);
        setSessions(current =>
          current.map(summary =>
            summary.id === result.session.id
              ? {
                  ...summary,
                  poseCount: result.session.poseCount,
                  lastUpdated: result.session.lastUpdated
                }
              : summary
          )
        );
      } else if (result?.pose) {
        const snapshot = toSnapshot(result.pose, prompt);
        setHistory(previous => limitHistory([snapshot, ...previous]));
        setSessionDetail(current => {
          const base =
            current ?? {
              id: 'local-preview',
              participants: ['you'],
              lastUpdated: Date.now(),
              poseCount: 0,
              poses: []
            };
          const updatedPoses = limitHistory([snapshot, ...base.poses]);
          return {
            ...base,
            poses: updatedPoses,
            poseCount: updatedPoses.length,
            lastUpdated: Date.now()
          };
        });
        if (selectedSessionId) {
          setSessions(current =>
            current.map(summary =>
              summary.id === selectedSessionId
                ? {
                    ...summary,
                    poseCount: Math.min(summary.poseCount + 1, MAX_HISTORY),
                    lastUpdated: Date.now()
                  }
                : summary
            )
          );
        }
      }
    },
    [prompt, requestPose, selectedSessionId]
  );

  const activePoseDetails = useMemo(() => {
    if (!pose) {
      return null;
    }

    return {
      keyframes: pose.data.keyframes.length,
      identifier: pose.id
    };
  }, [pose]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Panel
          title="Active Sessions"
          subtitle={sessionError ?? 'Collaborating in real time'}
          tone={sessionError ? 'warning' : 'default'}
          footer={
            <Button
              label="Refresh"
              variant="ghost"
              onClick={() => {
                void refreshSessions();
              }}
            />
          }
        >
          {sessions.length > 0 ? (
            <ul className="session-list">
              {sessions.map(session => {
                const isActive = session.id === selectedSessionId;
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      className={`session-item${isActive ? ' session-item--active' : ''}`}
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        if (!sessionError) {
                          void loadSessionDetail(session.id).catch(() => {
                            /* handled via sessionError */
                          });
                        }
                      }}
                    >
                      <div className="session-meta">
                        <span className="session-id">{session.id}</span>
                        <span className="session-participants">{session.participants.join(', ')}</span>
                      </div>
                      <div className="session-timestamp">
                        <span>{new Date(session.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="session-poses">{session.poseCount} poses</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No live sessions yet. Start one from the automation worker or invite a collaborator.</p>
          )}
        </Panel>

        <Panel title="Pose History" subtitle="Latest AI-assisted suggestions">
          {history.length === 0 ? (
            <p className="muted">Pose suggestions will appear here once generated.</p>
          ) : (
            <ul className="history-list">
              {history.map(item => (
                <li key={item.id}>
                  <span className="history-id">{item.id}</span>
                  <span className="history-meta">{item.keyframeCount} keyframes</span>
                  <span className="history-time">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <div>
            <h1>3D Avatar Studio</h1>
            <p>
              Design expressive avatars with AI-assisted posing, real-time collaboration, and production-ready
              pipelines.
            </p>
          </div>
          <Button
            variant="secondary"
            label="Start guided tutorial"
            onClick={() => alert('Guided tutorials launch with our next milestone!')}
          />
        </header>

        <section className="viewport-section">
          <AvatarViewport pose={pose?.data ?? null} />
          {activePoseDetails && (
            <div className="pose-meta">
              <span>Pose ID: {activePoseDetails.identifier}</span>
              <span>{activePoseDetails.keyframes} keyframes applied</span>
            </div>
          )}
          {sessionDetail && (
            <div className="session-summary">
              <span>Participants: {sessionDetail.participants.join(', ')}</span>
              <span>Stored poses: {sessionDetail.poseCount}</span>
            </div>
          )}
        </section>

        <Panel
          title="Generate a new pose"
          subtitle="Describe the mood or movement you want and we will stage the avatar for you"
          footer={
            <Stack direction="row" spacing={12} align="center" justify="between">
              <span className="muted">Prompts work best when they describe action, emotion, and camera angle.</span>
              <Button type="submit" label={loading ? 'Generating…' : 'Generate pose'} loading={loading} form="pose-generator" />
            </Stack>
          }
        >
          <form id="pose-generator" onSubmit={handleSubmit} className="pose-form">
            <TextField
              label="Pose prompt"
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              placeholder="e.g. confident hero landing with left arm extended"
              hint="Supports natural language descriptions"
              error={error ?? undefined}
              autoFocus
            />
          </form>
        </Panel>
      </main>
    </div>
  );
}

export default App;
