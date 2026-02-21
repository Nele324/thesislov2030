import React, { useState, useEffect, useRef } from 'react';
import Soundfont from 'soundfont-player';
import { Midi } from '@tonejs/midi';

const FullScorePlayer = () => {
    const [player, setPlayer] = useState(null);
    const [noteGroups, setNoteGroups] = useState([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);

    // 1. VOEG DEZE STATE TOE VOOR DE WEERGAVE
    const [displayStep, setDisplayStep] = useState(0);

    const currentIndex = useRef(0);
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());

    useEffect(() => {
        Soundfont.instrument(audioContext.current, 'alto_sax', { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl("/scores/He's_a_pirate.mid").then((midi) => {
            const allNotes = midi.tracks[0].notes;
            const groups = [];
            allNotes.forEach(note => {
                const lastGroup = groups[groups.length - 1];
                if (lastGroup && Math.abs(lastGroup.time - note.time) < 0.01) {
                    lastGroup.notes.push(note);
                } else {
                    groups.push({ time: note.time, notes: [note] });
                }
            });
            setNoteGroups(groups);
            setIsMidiReady(true);
        });
    }, []);

    const playNextStep = async () => {
        if (!player || noteGroups.length === 0) return;

        if (currentIndex.current >= noteGroups.length) {
            currentIndex.current = 0;
            setDisplayStep(0); // Reset weergave
        }

        if (audioContext.current.state === 'suspended') {
            await audioContext.current.resume();
        }

        const currentGroup = noteGroups[currentIndex.current];
        const now = audioContext.current.currentTime;

        currentGroup.notes.forEach(note => {
            player.play(note.name, now, {
                duration: note.duration,
                gain: note.velocity
            });
        });

        // 2. VERHOOG DE REF VOOR DE LOGICA
        currentIndex.current += 1;

        // 3. UPDATE DE STATE VOOR DE VISUELE TEKST
        setDisplayStep(currentIndex.current);
    };

    const getStatusText = () => {
        // Gebruik hier displayStep in plaats van currentIndex.current
        if (isPlayerReady && isMidiReady) return `Klaar! Stap ${displayStep} van ${noteGroups.length}`;
        return "Laden...";
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '20px' }}>
            <h2>Interactieve Saxofoon Player</h2>
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                <p>Status: <strong>{getStatusText()}</strong></p>
            </div>

            <button
                onMouseDown={playNextStep}
                style={{
                    width: '150px',
                    height: '150px',
                    backgroundColor: '#2ecc71',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    fontSize: '1.2rem'
                }}
            >
                TIK!
            </button>

            <button
                onClick={() => {
                    currentIndex.current = 0;
                    setDisplayStep(0); // Reset weergave
                }}
                style={{ marginTop: '10px', background: 'none', border: '1px solid #ccc', cursor: 'pointer', padding: '5px 10px' }}
            >
                Reset naar begin
            </button>
        </div>
    );
};

export default FullScorePlayer;