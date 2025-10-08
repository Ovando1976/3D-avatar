import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvatarViewport } from '@3d-avatar/avatar-engine';
import type { PoseSuggestion } from '@3d-avatar/ai-clients';
import type { SessionState } from '@3d-avatar/collaboration-sdk';
import { Button, Panel, Stack, TextField } from '@3d-avatar/design-system';
import { usePoseSuggestion } from './hooks/usePoseSuggestion';
import './app.css';

const DEFAULT_PROMPT = 'dynamic hero landing pose';
const MAX_HISTORY = 5;

export function App(): JSX.Element {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const { pose, loading, error, requestPose } = usePoseSuggestion();
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [history, setHistory] = useState<PoseSuggestion[]>([]);

  useEffect(() => {
    requestPose(DEFAULT_PROMPT).catch(() => {
      /* handled inside hook */
    });
  }, [requestPose]);

  useEffect(() => {
    if (!pose) {
      return;
    }

    setHistory(previous => {
      const next = [pose, ...previous.filter(item => item.id !== pose.id)];
      return next.slice(0, MAX_HISTORY);
    });
  }, [pose]);

  const refreshSessions = useCallback(async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/sessions`, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        throw new Error(`Unable to load sessions (${response.status})`);
      }

      const data: { sessions: SessionState[] } = await response.json();
      setSessions(data.sessions);
      setSessionError(null);
    } catch (fetchError) {
      console.warn('[studio] Unable to fetch sessions, falling back to offline mode', fetchError);
      setSessions([
        { id: 'local-preview', participants: ['you'], lastUpdated: Date.now() }
      ]);
      setSessionError('Connected in offline preview mode');
    }
  }, []);

  useEffect(() => {
    refreshSessions().catch(() => {
      /* error handled inside */
    });
  }, [refreshSessions]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!prompt.trim()) {
        return;
      }

      await requestPose(prompt.trim());
    },
    [prompt, requestPose]
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
              {sessions.map(session => (
                <li key={session.id}>
                  <div className="session-meta">
                    <span className="session-id">{session.id}</span>
                    <span className="session-participants">{session.participants.join(', ')}</span>
                  </div>
                  <span className="session-timestamp">
                    {new Date(session.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
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
                  <span className="history-meta">{item.data.keyframes.length} keyframes</span>
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
            <p>Design expressive avatars with AI-assisted posing, real-time collaboration, and production-ready pipelines.</p>
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
