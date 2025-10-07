import AvatarScene from './components/AvatarScene.jsx';
import InterfacePanel from './components/InterfacePanel.jsx';
import './styles/app.css';

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>3D Avatar Playground</h1>
        <p>Create your own vibe by tweaking the avatar&apos;s colours and lighting.</p>
      </header>
      <main className="app-main">
        <section className="canvas-wrapper" aria-label="3D Avatar preview">
          <AvatarScene />
        </section>
        <InterfacePanel />
      </main>
      <footer className="app-footer">
        <small>Built with React, Vite and react-three-fiber.</small>
      </footer>
    </div>
  );
}

export default App;
