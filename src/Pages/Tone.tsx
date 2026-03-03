// Tone.tsx - This React component represents a page where users can play a musical note using the Tone.js library. It includes a button to trigger the note and displays information about the played note and instrument. The component also handles cleanup of the Tone.js synth when unmounted.
import React, { useState, useEffect } from 'react';
import '../css/App.css';

type Props = {
  onBack: () => void;
};

// @ts-ignore
const Tone = (window as any).Tone;

export default function NewPage({ onBack }: Props) {
  // Staat voor weergegeven informatie
  const [noteInfo, setNoteInfo] = useState<{ instrument: string; note: string } | null>(null);
  const [synth, setSynth] = useState<any>(null);

  // Kies hier een instrument (Synth) en een noot
  const instrumentName = 'Synth'; // Voorbeeld: Synth, MembraneSynth, etc.
  const note = 'C4'; // De noot die wordt afgespeeld

  // Cleanup bij unmount
  useEffect(() => {
    return () => {
      synth?.dispose();
    };
  }, [synth]);

  // Functie om de noot te spelen
  const playNote = async () => {
    await Tone.start(); // start audio context op klik

    if (!synth) {
      const newSynth = new Tone.Synth().toDestination();
      setSynth(newSynth);
      newSynth.triggerAttackRelease(note, '8n');
    } else {
      synth.triggerAttackRelease(note, '8n');
    }

    setNoteInfo({ instrument: instrumentName, note });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Music page</h1>
        <p>Play a note and see the information about the played note and instrument.</p>

        {/* Knop om de noot te spelen */}
        <button className="App-link" onClick={playNote}>
          Play note
        </button>

        {/* Toon informatie over de noot */}
        {noteInfo && (
          <p>
            Played instrument: <strong>{noteInfo.instrument}</strong> | Note: <strong>{noteInfo.note}</strong>
          </p>
        )}

        {/* Terugknop */}
        <button className="App-link" onClick={onBack}>
          Back
        </button>
      </header>
    </div>
  );
}