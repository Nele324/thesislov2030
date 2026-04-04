import React, { useState } from 'react';
import logo from '../logo.svg';
import '../css/App.css';

import Tone from './Tone';
import Broadcast from './Broadcast';
import Watch from './Watch';
import UI1 from './UI1';
import UI2 from './UI2';

type Page = 'home' | 'tone' | 'broadcast' | 'watch' | 'sound-player' | 'ui1' | 'ui2';

interface TestConfig {
  partij: 'melodie' | 'achtergrond';
  forgiveness: 'low' | 'high';
  UI: 1 | 2;
}

const TEST_CONFIGS: Record<number, TestConfig> = {
  1: { partij: 'melodie', forgiveness: 'high', UI: 1 },
  2: { partij: 'achtergrond', forgiveness: 'high', UI: 1 },
  3: { partij: 'melodie', forgiveness: 'high', UI: 2 },
  4: { partij: 'achtergrond', forgiveness: 'high', UI: 2 }
};

function App() {
  const [page, setPage] = useState<Page>('home');
  const [selectedTest, setSelectedTest] = useState<number>(1);
  const [isTutorial, setIsTutorial] = useState<boolean>(true);

  const handleBack = () => {
    setPage('home');
    setIsTutorial(true); // Reset naar tutorial voor de volgende keer
  };

  const handleStartTest = () => {
    setIsTutorial(true); // Altijd beginnen met de tutorial
    const config = TEST_CONFIGS[selectedTest];
    setPage(config.UI === 1 ? 'ui1' : 'ui2');
  };

  if (page === 'tone') return <Tone onBack={() => setPage('home')} />;
  if (page === 'broadcast') return <Broadcast onBack={() => setPage('home')} />;
  if (page === 'watch') return <Watch onBack={() => setPage('home')} />;
  if (page === 'ui1') {
    console.log(`Selected Test ${selectedTest}: Partij = ${TEST_CONFIGS[selectedTest].partij}, Vergevingsgezindheid = ${TEST_CONFIGS[selectedTest].forgiveness}, UI = ${TEST_CONFIGS[selectedTest].UI}`);
    return (
      <UI1
        partij={TEST_CONFIGS[selectedTest].partij}
        forgiveness={TEST_CONFIGS[selectedTest].forgiveness}
        ui={TEST_CONFIGS[selectedTest].UI}
        tutorial={isTutorial}
        onBack={() => { handleBack(); }}
        onStartTest={() => setIsTutorial(false)}
      />
    );
  }
  if (page === 'ui2') {
    console.log(`Selected Test ${selectedTest}: Partij = ${TEST_CONFIGS[selectedTest].partij}, Vergevingsgezindheid = ${TEST_CONFIGS[selectedTest].forgiveness}, UI = ${TEST_CONFIGS[selectedTest].UI}`);
    return (
      <UI2
        partij={TEST_CONFIGS[selectedTest].partij}
        forgiveness={TEST_CONFIGS[selectedTest].forgiveness}
        ui={TEST_CONFIGS[selectedTest].UI}
        tutorial={isTutorial}
        onBack={() => { handleBack(); }}
        onStartTest={() => setIsTutorial(false)}
      />
    );
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
              <option value="1">Test 1: Melodiepartij, Hoge Vergevingsgezindheid, UI 1</option>
              <option value="2">Test 2: Achtergrondpartij, Hoge Vergevingsgezindheid, UI 1</option>
              <option value="3">Test 3: Melodiepartij, Hoge Vergevingsgezindheid, UI 2</option>
              <option value="4">Test 4: Achtergrondpartij, Hoge Vergevingsgezindheid, UI 2</option>
            </select>

          </div>
          <button onClick={handleStartTest}> Start video met test {selectedTest} </button>
        </div>
      </header>
    </div>
  );
}

export default App;
