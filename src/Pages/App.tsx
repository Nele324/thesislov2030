import React, { useState } from 'react';
import logo from '../logo.svg';
import '../css/App.css';

import Tone from './Tone';
import Broadcast from './Broadcast';
import Watch from './Watch';
import FullScorePlayer from './soundfont';

type Page = 'home' | 'tone' | 'broadcast' | 'watch' | 'sound-player';

interface TestConfig {
  partij: 'melodie' | 'achtergrond';
  forgiveness: 'low' | 'high';
}

const TEST_CONFIGS: Record<number, TestConfig> = {
  1: { partij: 'melodie', forgiveness: 'low' },
  2: { partij: 'achtergrond', forgiveness: 'high' },
  3: { partij: 'melodie', forgiveness: 'high' },
  4: { partij: 'achtergrond', forgiveness: 'high' }
};

function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedTest, setSelectedTest] = useState<number>(1);

  if (page === 'tone') return <Tone onBack={() => setPage('home')} />;
  if (page === 'broadcast') return <Broadcast onBack={() => setPage('home')} />;
  if (page === 'watch') return <Watch onBack={() => setPage('home')} />;
  if (page === 'sound-player') {
    console.log(`Selected Test ${selectedTest}: Partij = ${TEST_CONFIGS[selectedTest].partij}, Vergevingsgezindheid = ${TEST_CONFIGS[selectedTest].forgiveness}`);
    return <FullScorePlayer partij={TEST_CONFIGS[selectedTest].partij} forgiveness={TEST_CONFIGS[selectedTest].forgiveness} onBack={() => setPage('home')} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

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
          <div className='flex gap-10'>
            <h2>Kies een Test Scenario</h2>
            <select
              value={selectedTest}
              onChange={(e) => setSelectedTest(parseInt(e.target.value))}
              style={{ color: 'black', fontSize: '16px', borderRadius: '5px' }}
            >
              <option value="1">Test 1</option>
              <option value="2">Test 2</option>
              <option value="3">Test 3</option>
              <option value="4">Test 4</option>
            </select>
          </div>
          <button onClick={() => setPage('sound-player')}>
            Start video met test {selectedTest}
          </button>
        </div>
      </header>
    </div>
  );
}

export default App;
