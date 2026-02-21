import React, { useState, useEffect, useRef } from 'react';
import Soundfont from 'soundfont-player';
import { Midi } from '@tonejs/midi';

const FullScorePlayer = () => {
    const [player, setPlayer] = useState(null);
    const [midiData, setMidiData] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // We gebruiken deze booleans voor de status-tekst
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);

    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const scheduledEvents = useRef([]);

    useEffect(() => {
        Soundfont.instrument(audioContext.current, 'voice_oohs', { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl("/scores/He's_a_pirate.mid").then((midi) => {
            setMidiData(midi);
            setIsMidiReady(true);
        });
    }, []);

    const getStatusText = () => {
        // Als het aan het spelen is, tonen we dat eerst
        if (isPlaying) return "Bezig met afspelen...";

        // Anders tonen we de laad-status
        if (isPlayerReady && isMidiReady) return "Alles is klaar om te spelen";
        if (isPlayerReady) return "Instrument geladen, bezig met MIDI...";
        if (isMidiReady) return "MIDI geladen, bezig met instrument...";
        return "Laden...";
    };

    const stopAllNotes = () => {
        if (player) {
            player.stop();
        }
        scheduledEvents.current.forEach(event => {
            if (event && event.stop) event.stop();
        });
        scheduledEvents.current = [];
    };

    const playFullScore = async () => {
        if (!player || !midiData) return;

        stopAllNotes();

        if (audioContext.current.state === 'suspended') {
            await audioContext.current.resume();
        }

        const startTime = audioContext.current.currentTime + 0.1;

        setIsPlaying(true);

        midiData.tracks.forEach((track) => {
            track.notes.forEach((note) => {
                const event = player.play(note.name, startTime + note.time, {
                    duration: note.duration,
                    gain: note.velocity
                });
                scheduledEvents.current.push(event);
            });
        });

        // Gebruik midiData.duration om te weten wanneer we klaar zijn
        setTimeout(() => {
            setIsPlaying(false);
        }, midiData.duration * 1000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '20px' }}>
            <h2>Musescore MIDI Player</h2>
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                <p>Status: <strong>{getStatusText()}</strong></p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    onClick={playFullScore}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#2ecc71',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {isPlaying ? "OPNIEUW STARTEN" : "START PARTITUUR"}
                </button>

                {isPlaying && (
                    <button
                        onClick={() => { stopAllNotes(); setIsPlaying(false); }}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        STOP
                    </button>
                )}
            </div>
        </div>
    );
};

export default FullScorePlayer;