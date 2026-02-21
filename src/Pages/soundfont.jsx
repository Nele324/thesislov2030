import React, { useState, useEffect, useRef } from 'react';
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
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());

    const PIXELS_PER_SECOND = 200;

    useEffect(() => {
        Soundfont.instrument(audioContext.current, 'alto_sax', { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl("/scores/He's_a_pirate.mid").then((midi) => {
            const allNotes = midi.tracks[0].notes.filter(n => n.duration > 0.05);
            const groups = allNotes.map((note, i) => ({
                time: note.time,
                duration: note.duration,
                name: note.name, // Dit bevat de naam van de noot (bijv. "G4")
                velocity: note.velocity,
                id: `note-${i}`
            }));
            setNoteGroups(groups);
            setIsMidiReady(true);
        });

        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    const animate = (time) => {
        if (isPaused.current) return;

        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = (time - startTimeRef.current) / 1000 + pausedTimeRef.current;

        const currentNote = noteGroups[currentIndex.current];

        // 1. Rust-logica: Check of we het BEGIN van de volgende noot hebben bereikt
        if (!activeNoteEvent.current && currentNote && elapsed >= currentNote.time) {
            isPaused.current = true;
            pausedTimeRef.current = currentNote.time;
            updateBlockPositions(currentNote.time);
            return;
        }

        // 2. Speel-logica: Check of de huidige noot klaar is
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
    };

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

    const startStep = async () => {
        if (!player || currentIndex.current >= noteGroups.length) return;
        const currentNote = noteGroups[currentIndex.current];
        if (audioContext.current.state === 'suspended') await audioContext.current.resume();

        activeNoteEvent.current = player.play(currentNote.name, audioContext.current.currentTime, {
            gain: currentNote.velocity
        });

        isPaused.current = false;
        startTimeRef.current = null;
        requestRef.current = requestAnimationFrame(animate);
    };

    const stopStep = () => {
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
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', backgroundColor: '#111', minHeight: '100vh', color: 'white', userSelect: 'none' }}>
            <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '8px', marginBottom: '20px' }}>
                <p>Status: {isPlayerReady && isMidiReady ? "Houd de knop ingedrukt om te spelen" : "Laden..."}</p>
            </div>

            <div ref={containerRef} style={{ width: '800px', height: '150px', backgroundColor: '#000', position: 'relative', overflow: 'hidden', border: '2px solid #444' }}>
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
                            width: `${Math.max(note.duration * PIXELS_PER_SECOND, 20)}px`,
                            height: '60px',
                            backgroundColor: index < displayStep ? '#333' : (index === displayStep ? '#f1c40f' : '#2ecc71'),
                            border: '1px solid rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            willChange: 'transform'
                        }}
                    >
                        {/* HIER WORDT DE NOOTNAAM GETOOND IN PLAATS VAN HET NUMMER */}
                        <span style={{
                            color: index === displayStep ? 'black' : 'white',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            textShadow: index === displayStep ? 'none' : '1px 1px 2px black'
                        }}>
                            {note.name}
                        </span>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '50px' }}>
                {!isPlayingVisuals ? (
                    <button onClick={startVisuals} style={{ padding: '20px 40px', cursor: 'pointer', borderRadius: '50px', border: 'none', backgroundColor: '#3498db', color: 'white', fontWeight: 'bold' }}>START PARTITUUR</button>
                ) : (
                    <button
                        onMouseDown={startStep}
                        onMouseUp={stopStep}
                        onMouseLeave={stopStep}
                        style={{
                            width: '150px',
                            height: '150px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: isPaused.current ? '#2ecc71' : '#f1c40f',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: isPaused.current ? '0 10px 20px rgba(0,0,0,0.3)' : 'inset 0 5px 10px rgba(0,0,0,0.5)'
                        }}
                    >
                        {isPaused.current ? "HOUD VAST" : "BLAAS!"}
                    </button>
                )}
            </div>
            <p style={{ marginTop: '20px' }}>Volgende noot: {noteGroups[displayStep]?.name || "Einde"}</p>
        </div>
    );
};

export default FullScorePlayer;