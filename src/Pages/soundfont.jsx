import React, { useState, useEffect, useRef, useCallback } from 'react';
import Soundfont from 'soundfont-player';
import { Midi } from '@tonejs/midi';

const FullScorePlayer = () => {
    const [player, setPlayer] = useState(null);
    const [noteGroups, setNoteGroups] = useState([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);
    const [displayStep, setDisplayStep] = useState(0);
    const [isPlayingVisuals, setIsPlayingVisuals] = useState(false);

    const containerRef = useRef();
    const requestRef = useRef();
    const startTimeRef = useRef(null);
    const pausedTimeRef = useRef(0);
    const isPaused = useRef(true);
    const currentIndex = useRef(0);
    const activeNoteEvent = useRef(null);
    const isKeyDown = useRef(false); // Houdt bij of de spatiebalk al ingedrukt is
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());

    const PIXELS_PER_SECOND = 200;

    const getSaxNootNaam = (midiNumber) => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
        const index = midiNumber % 12;
        return namen[index];
    };

    useEffect(() => {
        Soundfont.instrument(audioContext.current, 'alto_sax', { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl("/scores/He's_a_pirate.mid").then((midi) => {
            const allNotes = midi.tracks[0].notes.filter(n => n.duration > 0.05);
            const groups = allNotes.map((note, i) => {
                const geschrevenMidiNummer = note.midi - 3;
                const geschrevenNaam = getSaxNootNaam(geschrevenMidiNummer);

                return {
                    time: note.time,
                    duration: note.duration,
                    weergaveNaam: geschrevenNaam,
                    klinkendeNaam: note.name,
                    velocity: note.velocity,
                    id: `note-${i}`,
                    midi: note.midi
                };
            });
            setNoteGroups(groups);
            setIsMidiReady(true);
        });

        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    const resetPlayer = () => {
        if (activeNoteEvent.current) {
            activeNoteEvent.current.stop();
            activeNoteEvent.current = null;
        }
        cancelAnimationFrame(requestRef.current);
        startTimeRef.current = null;
        pausedTimeRef.current = 0;
        isPaused.current = true;
        currentIndex.current = 0;
        setDisplayStep(0);
        setIsPlayingVisuals(false);
        updateBlockPositions(0);
    };

    const animate = useCallback((time) => {
        if (isPaused.current) return;
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = (time - startTimeRef.current) / 1000 + pausedTimeRef.current;
        const currentNote = noteGroups[currentIndex.current];

        if (!activeNoteEvent.current && currentNote && elapsed >= currentNote.time) {
            isPaused.current = true;
            pausedTimeRef.current = currentNote.time;
            updateBlockPositions(currentNote.time);
            return;
        }

        if (activeNoteEvent.current && currentNote && elapsed >= (currentNote.time + currentNote.duration)) {
            if (activeNoteEvent.current) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
            }
            currentIndex.current += 1;
            setDisplayStep(currentIndex.current);
            startTimeRef.current = time;
            pausedTimeRef.current = elapsed;
        }

        updateBlockPositions(elapsed);
        requestRef.current = requestAnimationFrame(animate);
    }, [noteGroups]);

    const updateBlockPositions = (time) => {
        if (!containerRef.current) return;
        const blocks = containerRef.current.querySelectorAll('.note-block');
        blocks.forEach((block) => {
            const noteTime = parseFloat(block.getAttribute('data-time'));
            const x = (noteTime - time) * PIXELS_PER_SECOND + 100;
            block.style.transform = `translateX(${x}px)`;
        });
    };

    const startVisuals = () => {
        setIsPlayingVisuals(true);
        currentIndex.current = 0;
        setDisplayStep(0);
        pausedTimeRef.current = 0;
        isPaused.current = false;
        startTimeRef.current = null;
        requestRef.current = requestAnimationFrame(animate);
    };

    const startStep = useCallback(async () => {
        if (!player || currentIndex.current >= noteGroups.length) return;
        const currentNote = noteGroups[currentIndex.current];
        if (audioContext.current.state === 'suspended') await audioContext.current.resume();

        activeNoteEvent.current = player.play(currentNote.klinkendeNaam, audioContext.current.currentTime, {
            gain: currentNote.velocity
        });

        isPaused.current = false;
        startTimeRef.current = null;
        requestRef.current = requestAnimationFrame(animate);
    }, [player, noteGroups, animate]);

    const stopStep = useCallback(() => {
        if (activeNoteEvent.current) {
            activeNoteEvent.current.stop();
            activeNoteEvent.current = null;
            isPaused.current = true;
            const now = performance.now();
            if (startTimeRef.current) {
                const elapsedAtRelease = (now - startTimeRef.current) / 1000 + pausedTimeRef.current;
                pausedTimeRef.current = elapsedAtRelease;
            }
            cancelAnimationFrame(requestRef.current);
        }
    }, []);

    // --- TOETSENBORD LOGICA ---
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === 'Space') {
                event.preventDefault(); // Voorkom scrollen
                if (!isKeyDown.current && isPlayingVisuals) {
                    isKeyDown.current = true;
                    startStep();
                }
            }
        };

        const handleKeyUp = (event) => {
            if (event.code === 'Space') {
                event.preventDefault();
                isKeyDown.current = false;
                stopStep();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPlayingVisuals, startStep, stopStep]); // Reageer op veranderingen in status

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', backgroundColor: '#111', minHeight: '100vh', color: 'white', userSelect: 'none' }}>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '8px' }}>
                    <p style={{ margin: 0 }}>Status: {isPlayerReady && isMidiReady ? "Gebruik SPATIEBALK om te spelen" : "Laden..."}</p>
                </div>
                <button
                    onClick={resetPlayer}
                    style={{ padding: '10px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    RESET / HERBEGIN
                </button>
            </div>

            <div ref={containerRef} style={{ width: '800px', height: '150px', backgroundColor: '#000', position: 'relative', overflow: 'hidden', border: '2px solid #444', borderRadius: '10px' }}>
                <div style={{ position: 'absolute', left: '100px', top: 0, bottom: 0, width: '3px', backgroundColor: 'red', zIndex: 10, boxShadow: '0 0 15px red' }} />

                {noteGroups.map((note, index) => (
                    <div
                        key={note.id}
                        className="note-block"
                        data-time={note.time}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: '40px',
                            width: `${Math.max(note.duration * PIXELS_PER_SECOND, 40)}px`,
                            height: '60px',
                            backgroundColor: index < displayStep ? '#333' : (index === displayStep ? '#f1c40f' : '#2ecc71'),
                            border: '1px solid rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            willChange: 'transform'
                        }}
                    >
                        <span style={{ color: index === displayStep ? 'black' : 'white', fontWeight: 'bold' }}>
                            {note.weergaveNaam}
                        </span>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '50px', textAlign: 'center' }}>
                {!isPlayingVisuals ? (
                    <button onClick={startVisuals} style={{ padding: '20px 40px', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '50px', border: 'none', backgroundColor: '#3498db', color: 'white', fontWeight: 'bold' }}>
                        START PARTITUUR
                    </button>
                ) : (
                    <div style={{
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isPaused.current ? '#2ecc71' : '#f1c40f',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: 'black',
                        boxShadow: isPaused.current ? '0 10px 20px rgba(0,0,0,0.3)' : 'inset 0 5px 10px rgba(0,0,0,0.5)',
                        transition: 'background-color 0.1s'
                    }}>
                        SPATIE
                    </div>
                )}
                <p style={{ marginTop: '15px', color: '#888' }}>Tip: Houd de spatiebalk ingedrukt</p>
            </div>

            <p style={{ marginTop: '20px', fontSize: '1.2rem' }}>
                Noot op partituur: <strong style={{ color: '#f1c40f' }}>{noteGroups[displayStep]?.weergaveNaam || "-"}</strong>
            </p>
        </div>
    );
};

export default FullScorePlayer;