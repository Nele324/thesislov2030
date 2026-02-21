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

    // Refs voor animatie (om state-renders te vermijden)
    const containerRef = useRef();
    const requestRef = useRef();
    const startTimeRef = useRef(null);
    const pausedTimeRef = useRef(0);
    const isPaused = useRef(false);
    const currentIndex = useRef(0);
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
                name: note.name,
                velocity: note.velocity,
                id: `note-${i}`
            }));
            setNoteGroups(groups);
            setIsMidiReady(true);
        });

        return () => cancelAnimationFrame(requestRef.current);
    }, []);

    const animate = (time) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = (time - startTimeRef.current) / 1000 + pausedTimeRef.current;
        const nextNote = noteGroups[currentIndex.current];

        // Check voor pauze
        if (nextNote && elapsed >= nextNote.time) {
            isPaused.current = true;
            pausedTimeRef.current = nextNote.time;
            updateBlockPositions(nextNote.time); // Zet visuals exact stil
            return;
        }

        updateBlockPositions(elapsed);
        requestRef.current = requestAnimationFrame(animate);
    };

    // DE FIX: Update de blokjes direct in de DOM zonder React state
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
        isPaused.current = false;
        startTimeRef.current = null;
        pausedTimeRef.current = 0;
        currentIndex.current = 0;
        setDisplayStep(0);
        requestRef.current = requestAnimationFrame(animate);
    };

    const playNextStep = async () => {
        if (!player || noteGroups.length === 0 || currentIndex.current >= noteGroups.length) return;

        const currentGroup = noteGroups[currentIndex.current];
        if (audioContext.current.state === 'suspended') await audioContext.current.resume();

        player.play(currentGroup.name, audioContext.current.currentTime, {
            duration: currentGroup.duration,
            gain: currentGroup.velocity
        });

        currentIndex.current += 1;
        setDisplayStep(currentIndex.current);

        if (isPaused.current) {
            isPaused.current = false;
            startTimeRef.current = null;
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>
            <div style={{ padding: '10px', backgroundColor: '#333', borderRadius: '8px', marginBottom: '20px' }}>
                <p>Status: {isPlayerReady && isMidiReady ? "Klaar voor start" : "Laden..."}</p>
            </div>

            {/* De Container met containerRef */}
            <div ref={containerRef} style={{ width: '800px', height: '150px', backgroundColor: '#000', position: 'relative', overflow: 'hidden', border: '2px solid #444' }}>
                <div style={{ position: 'absolute', left: '100px', top: 0, bottom: 0, width: '3px', backgroundColor: 'red', zIndex: 10 }} />

                {noteGroups.map((note, index) => (
                    <div
                        key={note.id}
                        className="note-block"
                        data-time={note.time}
                        style={{
                            position: 'absolute',
                            left: 0, // We gebruiken transform voor de positie
                            top: '40px',
                            width: `${Math.max(note.duration * PIXELS_PER_SECOND, 20)}px`,
                            height: '60px',
                            backgroundColor: index < displayStep ? '#333' : (index === displayStep ? '#f1c40f' : '#2ecc71'),
                            border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            willChange: 'transform' // Optimaliseert voor de videokaart
                        }}
                    >
                        {index + 1}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '30px' }}>
                {!isPlayingVisuals ? (
                    <button onClick={startVisuals} style={{ padding: '20px 40px', cursor: 'pointer', borderRadius: '50px', border: 'none', backgroundColor: '#3498db', color: 'white' }}>START</button>
                ) : (
                    <button onMouseDown={playNextStep} style={{ width: '120px', height: '120px', borderRadius: '50%', border: 'none', backgroundColor: '#2ecc71', fontSize: '1.5rem', cursor: 'pointer' }}>TIK!</button>
                )}
            </div>
            <p>Stap: {displayStep} / {noteGroups.length}</p>
        </div>
    );
};

export default FullScorePlayer;