import React, { useState } from 'react';
import logo from '../logo.svg';
import '../css/App.css';

import Tone from './Tone';
import Broadcast from './Broadcast';
import Watch from './Watch';
import FullScorePlayer from './soundfont';

type Page = 'home' | 'tone' | 'broadcast' | 'watch' | 'sound-player';

function App() {
  const [page, setPage] = useState<Page>('home');

  if (page === 'tone') return <Tone onBack={() => setPage('home')} />;
  if (page === 'broadcast') return <Broadcast onBack={() => setPage('home')} />;
  if (page === 'watch') return <Watch onBack={() => setPage('home')} />;
  if (page === 'sound-player') return <FullScorePlayer />;

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

        <h2>Choose Mode</h2>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => setPage('broadcast')}>
            Start Streaming
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => setPage('watch')}>
            Watch Stream
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => setPage('sound-player')}>
            Ga naar sound player pagina
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
