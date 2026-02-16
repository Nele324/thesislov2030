import React, { useState } from 'react';
import logo from '../logo.svg';
import '../css/App.css';
import NewPage from './Tone';

function App() {
  const [page, setPage] = useState<'home' | 'new'>('home');

  if (page === 'new') {
    return <NewPage onBack={() => setPage('home')} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Hello <code>src/App.tsx</code> world!.
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
          <button className="App-link" onClick={() => setPage('new')}>
            Ga naar nieuwe pagina
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
