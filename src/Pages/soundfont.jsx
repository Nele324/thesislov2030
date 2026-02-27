import React, { useState, useEffect, useRef, useCallback } from 'react';
import Soundfont from 'soundfont-player';
import { Midi } from '@tonejs/midi';
import YouTube from 'react-youtube'; // Installeer via: npm install react-youtube

const FullScorePlayer = () => {
    const [player, setPlayer] = useState(null);
    const [noteGroups, setNoteGroups] = useState([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);
    const [displayStep, setDisplayStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const [videoVolume] = useState(40); // 40%
    const [saxVolume] = useState(2.5);    // 250%

    // Refs voor de strakke tijdlijn
    const containerRef = useRef();
    const videoPlayerRef = useRef(null);
    const requestRef = useRef();
    const isKeyDown = useRef(false);
    const activeNoteEvent = useRef(null);
    const currentNoteIndexRef = useRef(0);
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());

    const PIXELS_PER_SECOND = 200;
    const HIT_LINE_X = 100; // Positie van de rode lijn

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
            const groups = allNotes.map((note, i) => ({
                time: note.time,
                duration: note.duration,
                weergaveNaam: getSaxNootNaam(note.midi - 3),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}`
            }));
            setNoteGroups(groups);
            setIsMidiReady(true);
        });
    }, []);

    const TIME_OFFSET = 11.85;

    // De Game Loop: Loopt ALTIJD door als de video speelt
    const animate = useCallback(() => {
        if (!videoPlayerRef.current || !isPlaying) return;

        // We trekken de offset af van de videotijd voor de logica van de blokjes
        const videoTime = videoPlayerRef.current.getCurrentTime();
        const currentTime = videoTime - TIME_OFFSET;

        // Update visuele blokjes
        updateBlockPositions(currentTime);

        // Check welke noot er NU bij de rode lijn zou moeten zijn
        const nowNoteIndex = noteGroups.findIndex(n =>
            currentTime >= n.time && currentTime <= (n.time + n.duration)
        );

        // LOGICA: Speel alleen geluid als de toets is ingedrukt EN we in een noot-zone zitten
        if (isKeyDown.current && nowNoteIndex !== -1) {
            if (!activeNoteEvent.current || currentNoteIndexRef.current !== nowNoteIndex) {
                // Stop vorige noot als die er nog was
                if (activeNoteEvent.current) activeNoteEvent.current.stop();

                // Start nieuwe noot
                const note = noteGroups[nowNoteIndex];
                activeNoteEvent.current = player.play(note.klinkendeNaam, audioContext.current.currentTime, { gain: saxVolume });
                currentNoteIndexRef.current = nowNoteIndex;
                setDisplayStep(nowNoteIndex);
            }
        } else {
            // Geen toets ingedrukt of geen noot onder de lijn -> Stilte
            if (activeNoteEvent.current) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
                currentNoteIndexRef.current = -1;
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, noteGroups, player]);

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
        const handleKeyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); isKeyDown.current = false; } };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    useEffect(() => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.setVolume(videoVolume);
        }
    }, [videoVolume, isPlaying]);

    const onVideoReady = (event) => { videoPlayerRef.current = event.target; };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>

            <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '1200px', justifyContent: 'center', alignItems: 'flex-start' }}>

                {/* LINKS: De Video */}
                <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '2px solid #333' }}>
                    <YouTube
                        videoId="SENQbJY5U60" // Pirate track (pas aan indien nodig)
                        opts={{ width: '100%', height: '360', playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, origin: window.location.origin } }}
                        onReady={onVideoReady}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnd={() => setIsPlaying(false)}
                    />
                </div>

                {/* RECHTS: De Tijdlijn en info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '15px', backgroundColor: '#222', borderRadius: '10px', border: '1px solid #444' }}>
                        <h3>Dashboard</h3>
                        <p>Status: {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}</p>
                        <p style={{ fontSize: '1.2rem' }}>Volgende greep: <strong style={{ color: '#f1c40f' }}>{noteGroups[displayStep]?.weergaveNaam || "-"}</strong></p>
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