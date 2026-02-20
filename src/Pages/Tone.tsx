import React, { useState, useEffect } from 'react';
import '../css/App.css';
import { piratesMelody } from '../music/piratesMelody';
import { altsaxNotes } from '../music/altsaxNotes';

type Props = {
  onBack: () => void;
};

// @ts-ignore
const Tone = (window as any).Tone;

export default function NewPage({ onBack }: Props) {
  const [noteInfo, setNoteInfo] = useState<{ instrument: string } | null>(null);
  const [instrumentType, setInstrumentType] = useState<'piano' | 'sax'>('piano');
  const [isLoaded, setIsLoaded] = useState(false);

  const [piano, setPiano] = useState<any>(null);
  const [altsax, setAltsax] = useState<any>(null);

  const [currentMelody] = useState(piratesMelody);

  // 🔹 Laad ALLES bij mount
  useEffect(() => {
    if (!Tone || !currentMelody) return;

    const pianoSampler = new Tone.Sampler({
      urls: {
        C4: 'C4.mp3',
      },
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      onload: () => console.log('Piano loaded')
    }).toDestination();

    const saxSampler = new Tone.Sampler({
      urls: altsaxNotes,
      baseUrl: '/samples/altsax/',
      onload: () => console.log('Sax loaded')
    }).toDestination();
    saxSampler.volume.value = 6;

    // ✅ Check currentMelody voor BPM
    if (currentMelody && currentMelody.bpm) {
      Tone.Transport.bpm.value = currentMelody.bpm;
    }

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
      pianoSampler.dispose();
      saxSampler.dispose();
      clearInterval(checkLoaded);
    };
  }, [currentMelody]);

  const playSound = async () => {
    await Tone.start();
    if (!isLoaded) return;

    let currentInstrument: any = instrumentType === 'piano' ? piano : altsax;
    if (!currentInstrument) return;

    currentInstrument.releaseAll();

    if (!currentMelody || !currentMelody.notes) return;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;

    Tone.Transport.bpm.value = currentMelody.bpm;

    let cumulativeTime = 0;
    const events = currentMelody.notes.map(n => {
      const event = [cumulativeTime, n];
      cumulativeTime += Tone.Time(n.duration).toSeconds(); // tijd optellen
      return event;
    });

    // Part maken
    const part = new Tone.Part(
      (time: number, note: { note: string; duration: string }) => {
        if (note.note !== 'rest') {
          currentInstrument.triggerAttackRelease(note.note, note.duration, time);
        }
      },
      events
    );

    // Start de Transport op de juiste tijd
    part.start(0);
    Tone.Transport.start();

    setNoteInfo({
      instrument:
        instrumentType === 'piano'
          ? 'Piano'
          : 'Alt Sax',
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Music page</h1>

        <p>Select</p>

        <select
          value={instrumentType}
          onChange={(e) =>
            setInstrumentType(e.target.value as 'piano' | 'sax')
          }
        >
          <option value="piano">Piano (Sampler)</option>
          <option value="sax">Alt Sax (Sampler)</option>
        </select>

        <br /><br />

        <button disabled={!isLoaded} onClick={playSound}>
          {isLoaded ? 'Play note' : 'Loading instruments...'}
        </button>

        {noteInfo && (
          <p>
            Played instrument: <strong>{noteInfo.instrument}</strong>
          </p>
        )}

        <button onClick={onBack}>Back</button>
      </header>
    </div>
  );
}