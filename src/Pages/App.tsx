import React, { useState } from 'react';
import logo from '../logo.svg';
import '../css/App.css';
import FullScorePlayer from './soundfont';

function App() {
  const [page, setPage] = useState<'home' | 'tone' | 'sound-player'>('home');

  if (page === 'sound-player') {
    return <FullScorePlayer />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Hello<code>src/App.tsx</code> world!.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          React yey
        </a>
        <div style={{ marginTop: 16 }}>
          <button className="App-link" onClick={() => setPage('sound-player')}>
            Ga naar sound player page
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
