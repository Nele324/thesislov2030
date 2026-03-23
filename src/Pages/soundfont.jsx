import React, { useState, useEffect, useRef, useCallback } from 'react';
import Soundfont from 'soundfont-player';
import { Midi } from '@tonejs/midi';

const FullScorePlayer = () => {
    const [player, setPlayer] = useState(null);
    const [noteGroups, setNoteGroups] = useState([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);
    const [displayStep, setDisplayStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeTestId, setActiveTestId] = useState(1);

    const [videoVolume] = useState(0.75); // 75%
    const [saxVolume] = useState(0.5);    // 50%

    // Refs voor de strakke tijdlijn
    const containerRef = useRef();
    const videoRef = useRef(null);
    const requestRef = useRef();
    const isKeyDown = useRef(false);
    const activeNoteEvent = useRef(null);
    const currentNoteIndexRef = useRef(-1);
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const hasPlayedCurrentNote = useRef(false);

    const PIXELS_PER_SECOND = 200;
    const HIT_LINE_X = 100;

    const TEST_CONFIGS = {
        1: { partij: 'achtergrond', forgiveness: 'high' },
        2: { partij: 'melodie', forgiveness: 'low' },
        3: { partij: 'achtergrond', forgiveness: 'low' },
        4: { partij: 'melodie', forgiveness: 'high' }
    };

    const FORGIVENESS_MARGIN = 0.15; // 150ms marge voor 'low' forgiveness

    const getSaxNootNaam = (midiNumber) => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];
        const index = midiNumber % 12;
        return namen[index];
    };

    useEffect(() => {
        Soundfont.instrument(audioContext.current, 'soprano_sax', { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl("/scores/How_to_train_your_dragon.mid").then((midi) => {
            const allNotes = midi.tracks[0].notes.filter(n => n.duration > 0.05);
            const groups = allNotes.map((note, i) => ({
                time: note.time,
                duration: Math.max(note.duration - 0.05, 0.05),
                weergaveNaam: getSaxNootNaam(note.midi + 2),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}`
            }));
            setNoteGroups(groups);
            setIsMidiReady(true);
        });
    }, []);

    const OFFSET = 4.8;

    // Pas je animate functie aan in soundfont.jsx:

    const animate = useCallback(() => {
        if (!videoRef.current || !isPlaying) return;

        const config = TEST_CONFIGS[activeTestId];
        const videoTime = videoRef.current.currentTime;
        const currentTime = videoTime - OFFSET;
        console.log(`Video Time: ${videoTime.toFixed(3)}`);

        updateBlockPositions(currentTime);

        const nowNoteIndex = noteGroups.findIndex(n =>
            currentTime >= n.time && currentTime <= (n.time + n.duration)
        );

        // 1. START LOGICA
        // Je moet de toets indrukken EN de noot mag nog niet gespeeld zijn met de huidige toetsaanslag
        if (isKeyDown.current && !hasPlayedCurrentNote.current && nowNoteIndex !== -1) {
            const note = noteGroups[nowNoteIndex];

            // Check voor Vergevingsgezindheid
            let canPlay = false;
            if (config.forgiveness === 'high') {
                // Hoog: Altijd spelen als je binnen de noot-tijd duwt
                canPlay = true;
            } else {
                // Laag: Alleen spelen als je dicht bij het beginpunt (time) duwt
                const timingError = Math.abs(currentTime - note.time);
                if (timingError <= FORGIVENESS_MARGIN) {
                    canPlay = true;
                }
            }

            if (canPlay && currentNoteIndexRef.current !== nowNoteIndex) {
                activeNoteEvent.current = player.play(note.klinkendeNaam, audioContext.current.currentTime, { gain: saxVolume });
                currentNoteIndexRef.current = nowNoteIndex;
                hasPlayedCurrentNote.current = true;
                setDisplayStep(nowNoteIndex);
            } else if (!canPlay) {
                // Als men te laat is bij 'low', markeren we de noot als 'gemist' voor deze toetsaanslag
                hasPlayedCurrentNote.current = true;
            }
        }

        // 2. STOP LOGICA
        // Stop als de tijd van de noot voorbij is (ongeacht of de toets nog in is)
        // OF als de gebruiker de toets loslaat
        if (activeNoteEvent.current) {
            const currentNote = noteGroups[currentNoteIndexRef.current];

            // Stop de noot in drie scenario's:
            // 1. De tijdlijn is voorbij de duur van de noot (currentTime > start + duration)
            // 2. De gebruiker laat de spatiebalk los (!isKeyDown.current)
            // 3. Er is geen actieve noot-zone meer (nowNoteIndex === -1)
            if (currentTime > (currentNote.time + currentNote.duration) || !isKeyDown.current || nowNoteIndex === -1) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
                // We resetten hasPlayedCurrentNote NIET, want de toets is mogelijk nog ingedrukt.
                // De KeyUp event zal dit later op false zetten voor de volgende noot.
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, noteGroups, player, saxVolume, activeTestId]);

    const updateBlockPositions = (time) => {
        if (!containerRef.current) return;
        const blocks = containerRef.current.querySelectorAll('.note-block');
        blocks.forEach((block) => {
            const noteTime = parseFloat(block.getAttribute('data-time'));
            const x = (noteTime - time) * PIXELS_PER_SECOND + HIT_LINE_X;
            block.style.transform = `translateX(${x}px)`;
        });
    };

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(requestRef.current);
        }
        return () => cancelAnimationFrame(requestRef.current);
    }, [isPlaying, animate]);

    // Toetsenbord Events
    useEffect(() => {
        const handleKeyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); isKeyDown.current = true; } };
        const handleKeyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); isKeyDown.current = false; hasPlayedCurrentNote.current = false; } };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = videoVolume;
        }
    }, [videoVolume, isPlaying]);

    //const onVideoReady = (event) => { videoPlayerRef.current = event.target; };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>
            <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '1200px', justifyContent: 'center', alignItems: 'flex-start' }}>
                {/* LINKS: De Video */}
                <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '2px solid #333' }}>

                    <video
                        ref={videoRef}
                        src="/HowToTrainYourDragon.mp4"
                        crossOrigin='anonymous'
                        style={{ width: '100%', display: 'block' }}
                        controls
                        onPlay={() => { setIsPlaying(true) }}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                    />

                </div>

                {/* RECHTS: De Tijdlijn en info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '15px', backgroundColor: '#222', borderRadius: '10px', border: '1px solid #444' }}>
                        <h3>Dashboard</h3>
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor="test-select" style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#888' }}>
                                Selecteer Test Scenario:
                            </label>
                            <select
                                id="test-select"
                                value={activeTestId}
                                onChange={(e) => setActiveTestId(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    backgroundColor: '#333',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="1">Test 1</option>
                                <option value="2">Test 2</option>
                                <option value="3">Test 3</option>
                                <option value="4">Test 4</option>
                            </select>
                        </div>
                        <p>Status: {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}</p>
                        <p style={{ fontSize: '1.2rem' }}>Volgende greep: <strong style={{ color: '#f1c40f' }}>{noteGroups[displayStep]?.weergaveNaam || "-"}</strong></p>
                        <p style={{ fontSize: '0.9rem', color: '#888' }}>Test Config: Partij = <strong>{TEST_CONFIGS[activeTestId].partij}</strong>, Vergevingsgezindheid = <strong>{TEST_CONFIGS[activeTestId].forgiveness}</strong></p>
                    </div>

                    <div ref={containerRef} style={{ width: '100%', height: '120px', backgroundColor: '#000', position: 'relative', overflow: 'hidden', border: '2px solid #ff4757', borderRadius: '8px' }}>
                        <div style={{ position: 'absolute', left: `${HIT_LINE_X}px`, top: 0, bottom: 0, width: '4px', backgroundColor: '#ff4757', zIndex: 10, boxShadow: '0 0 15px #ff4757' }} />
                        {noteGroups.map((note, index) => (
                            <div key={note.id} className="note-block" data-time={note.time} style={{
                                position: 'absolute', left: 0, top: '30px', width: `${Math.max(note.duration * PIXELS_PER_SECOND, 40)}px`, height: '60px',
                                backgroundColor: index < displayStep ? '#333' : (index === displayStep ? '#f1c40f' : '#2ecc71'),
                                border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', willChange: 'transform'
                            }}>
                                <span style={{ color: index === displayStep ? 'black' : 'white', fontWeight: 'bold' }}>{note.weergaveNaam}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '40px', padding: '20px', border: '2px dashed #444', borderRadius: '50%', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: isPlaying ? '#2ecc71' : '#888', fontWeight: 'bold' }}>LIVE</span>
            </div>
        </div>
    );
};

export default FullScorePlayer;