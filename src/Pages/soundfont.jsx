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
    const pressedKeys = useRef(new Set());
    const activeNoteEvent = useRef(null);
    const currentNoteIndexRef = useRef(-1);
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
    const hasPlayedCurrentNote = useRef(false);
    const instrumentNameRef = useRef(null);

    const PIXELS_PER_SECOND = 200;
    const HIT_LINE_X = 100;

    const KEY_MAPS = {
        1: ['Space'], // 1 toets
        2: ['KeyF', 'KeyJ'], // 2 toetsen (Links/Rechts)
        4: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'] // 4 toetsen
    };

    const TEST_CONFIGS = {
        1: { partij: 'melodie', forgiveness: 'high', keys: 1 },
        2: { partij: 'achtergrond', forgiveness: 'high', keys: 1 },
        3: { partij: 'melodie', forgiveness: 'low', keys: 2 },
        4: { partij: 'achtergrond', forgiveness: 'low', keys: 2 },
        5: { partij: 'melodie', forgiveness: 'high', keys: 4 },
        6: { partij: 'achtergrond', forgiveness: 'high', keys: 4 },
    };

    const FORGIVENESS_MARGIN = 0.15; // 150ms marge voor 'low' forgiveness

    const getSaxNootNaam = (midiNumber) => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];
        const index = midiNumber % 12;
        return namen[index];
    };

    useEffect(() => {
        setIsPlayerReady(false);
        setIsMidiReady(false);

        let link = "";
        let transposition = 0;

        if (activeTestId === 1 || activeTestId === 3 || activeTestId === 5) {
            instrumentNameRef.current = 'soprano_sax';
            link = "/scores/How_to_train_your_dragon-soprano.mid"
            transposition = -2;
        } else {
            instrumentNameRef.current = 'baritone_sax';
            link = "/scores/How_to_train_your_dragon-bariton.mid"
            transposition = -3;
        }
        Soundfont.instrument(audioContext.current, instrumentNameRef.current, { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl(link).then((midi) => {
            const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
            const config = TEST_CONFIGS[activeTestId];
            const allNotes = track.notes.filter(n => n.duration > 0.05);

            // Zoek het bereik van het liedje
            const midiNumbers = allNotes.map(n => n.midi);
            const minMidi = Math.min(...midiNumbers);
            const maxMidi = Math.max(...midiNumbers);
            const range = maxMidi - minMidi;

            const groups = allNotes.map((note, i) => {
                let laneIndex;
                if (config.keys > 1) {
                    const normalized = (note.midi - minMidi) / range; // Getal tussen 0 en 1
                    // Invert: we willen hoge noten meestal bovenin (index 0)
                    laneIndex = (config.keys - 1) - Math.floor(normalized * config.keys);
                    // Zorg dat het binnen de grenzen blijft
                    laneIndex = Math.max(0, Math.min(config.keys - 1, laneIndex));
                } else {
                    laneIndex = 0;
                }

                return {
                    time: note.time,
                    duration: Math.max(note.duration - 0.05, 0.05),
                    weergaveNaam: getSaxNootNaam(note.midi + transposition),
                    klinkendeNaam: note.name,
                    velocity: note.velocity,
                    id: `note-${i}-${activeTestId}`,
                    midiOriginal: note.midi,
                    lane: laneIndex
                };
            });
            setNoteGroups(groups);
            setIsMidiReady(true);
            setDisplayStep(0);
            currentNoteIndexRef.current = -1;
        });
    }, [activeTestId]);

    const OFFSET = 4.8;

    const getRequiredKey = (laneIndex, numKeys) => {
        const keys = KEY_MAPS[numKeys];
        return keys && keys[laneIndex] ? keys[laneIndex] : "";
    };

    const animate = useCallback(() => {
        if (!videoRef.current || !isPlaying || !player) return;

        const config = TEST_CONFIGS[activeTestId];
        const videoTime = videoRef.current.currentTime;
        const currentTime = videoTime - OFFSET;

        updateBlockPositions(currentTime);

        // Zoek de noot die nu op de HIT_LINE staat
        const nowNoteIndex = noteGroups.findIndex(n =>
            currentTime >= n.time && currentTime <= (n.time + n.duration)
        );

        // --- 1. START LOGICA (TRIGGER) ---
        if (nowNoteIndex !== -1 && !hasPlayedCurrentNote.current) {
            const note = noteGroups[nowNoteIndex];

            // Bepaal welke specifieke toets nodig is voor deze noot (op basis van aantal toetsen in de test)
            const requiredKey = getRequiredKey(note.lane, config.keys);

            // Check of de juiste toets op dit moment is ingedrukt
            const isCorrectKeyDown = pressedKeys.current.has(requiredKey);

            if (isCorrectKeyDown) {
                let canPlay = false;

                if (config.forgiveness === 'high') {
                    // Hoog: Spelen zolang je ergens binnen de noot-tijd de juiste toets indrukt
                    canPlay = true;
                } else {
                    // Laag: Alleen spelen als de toetsaanslag dicht bij de starttijd ligt
                    const timingError = Math.abs(currentTime - note.time);
                    canPlay = timingError <= FORGIVENESS_MARGIN;
                }

                if (canPlay && currentNoteIndexRef.current !== nowNoteIndex) {
                    // Start het geluid
                    activeNoteEvent.current = player.play(
                        note.klinkendeNaam,
                        audioContext.current.currentTime,
                        { gain: saxVolume }
                    );

                    currentNoteIndexRef.current = nowNoteIndex;
                    hasPlayedCurrentNote.current = true; // Lock: Gebruiker moet toets loslaten voor volgende noot
                    setDisplayStep(nowNoteIndex);
                } else if (!canPlay) {
                    // Gebruiker was te laat/vroeg bij 'low' forgiveness: blokkeer deze noot voor deze aanslag
                    hasPlayedCurrentNote.current = true;
                }
            }
        }

        // --- 2. STOP LOGICA ---
        if (activeNoteEvent.current) {
            const currentNote = noteGroups[currentNoteIndexRef.current];
            const requiredKey = getRequiredKey(currentNote.lane, config.keys);
            const isCorrectKeyUp = !pressedKeys.current.has(requiredKey);

            // Stop het geluid in drie gevallen:
            // 1. De tijdlijn is voorbij de duur van de noot (harde stop)
            // 2. De juiste toets voor deze noot is losgelaten
            // 3. De noot is uit de actieve zone geschoven
            if (
                currentTime > (currentNote.time + currentNote.duration) ||
                isCorrectKeyUp ||
                nowNoteIndex === -1
            ) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, noteGroups, player, saxVolume, activeTestId, OFFSET]);

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
        const handleKeyDown = (e) => {
            if (['Space', 'KeyF', 'KeyD', 'KeyJ', 'KeyK'].includes(e.code)) {
                e.preventDefault();
                pressedKeys.current.add(e.code);
            }
        };

        const handleKeyUp = (e) => {
            if (['Space', 'KeyF', 'KeyD', 'KeyJ', 'KeyK'].includes(e.code)) {
                e.preventDefault();
                pressedKeys.current.delete(e.code);
                hasPlayedCurrentNote.current = false; // Reset de lock bij loslaten
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
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
                                onChange={(e) => { setActiveTestId(parseInt(e.target.value)); console.log(`Test scenario gewijzigd naar: ${e.target.value}`); console.log(instrumentNameRef.current) }}
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
                                <option value="1">Test</option>
                                <option value="2">Test 1</option>
                                <option value="3">Test 2</option>
                                <option value="4">Test 3</option>
                                <option value="5">Test 4</option>
                                <option value="6">Test 5</option>
                            </select>
                        </div>
                        <p>Status: {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}</p>
                        <p style={{ fontSize: '1.2rem' }}>Volgende greep: <strong style={{ color: '#f1c40f' }}>{noteGroups[displayStep]?.weergaveNaam || "-"}</strong></p>
                        <p style={{ fontSize: '0.9rem', color: '#888' }}>Test Config: Partij = <strong>{TEST_CONFIGS[activeTestId].partij}</strong>, Vergevingsgezindheid = <strong>{TEST_CONFIGS[activeTestId].forgiveness}</strong></p>
                    </div>

                    <div ref={containerRef} style={{
                        width: '100%',
                        height: '300px', // Iets hoger voor meer banen
                        backgroundColor: '#000',
                        position: 'relative',
                        overflow: 'hidden',
                        border: '2px solid #ff4757',
                        borderRadius: '8px'
                    }}>
                        {/* De rode HIT-lijn */}
                        <div style={{ position: 'absolute', left: `${HIT_LINE_X}px`, top: 0, bottom: 0, width: '4px', backgroundColor: '#ff4757', zIndex: 10, boxShadow: '0 0 15px #ff4757' }} />

                        {/* Baan-indicatoren (horizontale lijntjes) */}
                        {[...Array(TEST_CONFIGS[activeTestId].keys)].map((_, i) => (
                            <div key={`lane-${i}`} style={{
                                position: 'absolute',
                                top: `${(300 / TEST_CONFIGS[activeTestId].keys) * i}px`,
                                width: '100%',
                                height: '1px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                zIndex: 1
                            }} />
                        ))}

                        {/* Vaste toets-labels aan de linkerkant van de banen */}
                        {[...Array(TEST_CONFIGS[activeTestId].keys)].map((_, i) => (
                            <div key={`label-${i}`} style={{
                                position: 'absolute',
                                left: '10px',
                                top: `${(300 / TEST_CONFIGS[activeTestId].keys) * i + 10}px`,
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                zIndex: 5
                            }}>
                                {KEY_MAPS[TEST_CONFIGS[activeTestId].keys][i].replace('Key', '').replace('Space', 'SPATIE')}
                            </div>
                        ))}

                        {/* De Noten */}
                        {noteGroups.map((note, index) => {
                            const numKeys = TEST_CONFIGS[activeTestId].keys;
                            const laneHeight = 300 / numKeys;
                            const blockHeight = laneHeight - 10; // 5px marge boven en onder

                            return (
                                <div
                                    key={note.id}
                                    className="note-block"
                                    data-time={note.time}
                                    style={{
                                        position: 'absolute',
                                        left: 0,
                                        // Bereken top op basis van de lane
                                        top: `${(note.lane * laneHeight) + 5}px`,
                                        width: `${Math.max(note.duration * PIXELS_PER_SECOND, 40)}px`,
                                        height: `${blockHeight}px`,
                                        backgroundColor: index < displayStep ? '#333' : (index === displayStep ? '#f1c40f' : '#2ecc71'),
                                        border: '1px solid rgba(255,255,255,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px',
                                        willChange: 'transform',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    <span style={{
                                        color: index === displayStep ? 'black' : 'white',
                                        fontSize: numKeys > 2 ? '0.7rem' : '0.9rem', // Kleiner bij 4 banen
                                        fontWeight: 'bold',
                                        textAlign: 'center'
                                    }}>
                                        {note.weergaveNaam}
                                        <br />
                                        <small style={{ opacity: 0.7 }}>
                                            {/* Toon de toetsnaam (bijv. 'F') in het blokje */}
                                            ({getRequiredKey(note.midiOriginal, numKeys).replace('Key', '').replace('Space', 'Spatie')})
                                        </small>
                                    </span>
                                </div>
                            );
                        })}
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