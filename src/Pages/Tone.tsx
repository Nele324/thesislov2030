import React, { useState, useEffect } from 'react';
import '../css/App.css';

type Props = {
  onBack: () => void;
};

// @ts-ignore
const Tone = (window as any).Tone;

export default function NewPage({ onBack }: Props) {
  const [noteInfo, setNoteInfo] = useState<{ instrument: string; note: string } | null>(null);
  const [instrumentType, setInstrumentType] = useState<'synth' | 'piano' | 'sax'>('synth');
  const [isLoaded, setIsLoaded] = useState(false);

  const [synth, setSynth] = useState<any>(null);
  const [piano, setPiano] = useState<any>(null);
  const [altsax, setAltsax] = useState<any>(null);

  const note = 'C4';

  // 🔹 Laad ALLES bij mount
  useEffect(() => {
    if (!Tone) return;

    const newSynth = new Tone.Synth().toDestination();

    const pianoSampler = new Tone.Sampler({
      urls: {
        C4: 'C4.mp3',
      },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      onload: () => console.log('Piano loaded')
    }).toDestination();

    const saxSampler = new Tone.Sampler({
      urls: {
        C4: 'AltoSax.NoVib.ff.C4.stereo.mp3'
      },
      baseUrl: '/samples/altsax/',
      onload: () => console.log('Sax loaded')
    }).toDestination();

    setSynth(newSynth);
    setPiano(pianoSampler);
    setAltsax(saxSampler);

    // Wacht tot alle instrumenten geladen zijn
    const checkLoaded = setInterval(() => {
      if (pianoSampler.loaded && saxSampler.loaded) {
        setIsLoaded(true);
        clearInterval(checkLoaded);
        console.log('All instruments loaded');
      }
    }, 100);

    return () => {
      newSynth.dispose();
      pianoSampler.dispose();
      saxSampler.dispose();
      clearInterval(checkLoaded);
    };
  }, []);

  const playNote = async () => {
    await Tone.start();

    if (!isLoaded) return;

    let currentInstrument;
    if (instrumentType === 'synth') currentInstrument = synth;
    else if (instrumentType === 'piano') currentInstrument = piano;
    else if (instrumentType === 'sax') currentInstrument = altsax;

    currentInstrument.triggerAttackRelease(note, '8n');

    setNoteInfo({
      instrument:
        instrumentType === 'synth'
          ? 'Synth'
          : instrumentType === 'piano'
            ? 'Piano'
            : 'Alt Sax',
      note
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Music page</h1>

        <p>Select instrument and play a note.</p>

        <select
          value={instrumentType}
          onChange={(e) =>
            setInstrumentType(e.target.value as 'synth' | 'piano' | 'sax')
          }
        >
          <option value="synth">Synth</option>
          <option value="piano">Piano (Sampler)</option>
          <option value="sax">Alt Sax (Sampler)</option>
        </select>

        <br /><br />

        <button disabled={!isLoaded} onClick={playNote}>
          {isLoaded ? 'Play note' : 'Loading instruments...'}
        </button>

        {noteInfo && (
          <p>
            Played instrument: <strong>{noteInfo.instrument}</strong> | Note: <strong>{noteInfo.note}</strong>
          </p>
        )}

        <button onClick={onBack}>Back</button>
      </header>
    </div>
  );
}