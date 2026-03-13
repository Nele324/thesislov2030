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

    const [dynamicOffset, setDynamicOffset] = useState(0); // Default, maar wordt overschreven
    const [isMuziekGevonden, setIsMuziekGevonden] = useState(false);
    const [debugData, setDebugData] = useState({ rms: 0, centroid: 0 });
    const [videoSrc, setVideoSrc] = useState("");

    const [videoVolume] = useState(0.4); // 40%
    const [saxVolume] = useState(2.5);    // 250%

    // Refs voor de strakke tijdlijn
    const containerRef = useRef();
    const videoRef = useRef(null);
    const requestRef = useRef();
    const isKeyDown = useRef(false);
    const activeNoteEvent = useRef(null);
    const currentNoteIndexRef = useRef(0);
    const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());

    const essentiaRef = useRef(null);
    const audioSourceRef = useRef(null);
    const analyzerRef = useRef(null);

    const PIXELS_PER_SECOND = 200;
    const HIT_LINE_X = 100;

    const getSaxNootNaam = (midiNumber) => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
        const index = midiNumber % 12;
        return namen[index];
    };

    useEffect(() => {
        const initEssentia = async () => {
            if (window.EssentiaWASM && window.Essentia) {
                // Wacht op de backend module
                const essentiaWasm = await window.EssentiaWASM();
                // Maak de instantie aan en sla de WASM backend apart op in een ref
                essentiaRef.current = new window.Essentia(essentiaWasm);
                console.log("✅ Essentia.js is volledig geïnitialiseerd.");
            }
        };
        initEssentia();

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

    useEffect(() => {
        // Haal de video op als een blob om CORS volledig te omzeilen
        fetch("/Eine kleine Nachtmusik.mp4")
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                setVideoSrc(url);
            })
            .catch(err => console.error("Video laden mislukt:", err));
    }, []);

    //const TIME_OFFSET = 11.85;

    const setupAudioAnalysis = () => {
        if (!videoRef.current || audioSourceRef.current || !essentiaRef.current) return;

        const ctx = audioContext.current;
        if (ctx.state === 'suspended') ctx.resume();

        if (videoRef.current.src) {
            try {
                // Maak de bron aan
                const source = ctx.createMediaElementSource(videoRef.current);
                const analyzer = ctx.createAnalyser();
                analyzer.fftSize = 2048;

                source.connect(analyzer);
                analyzer.connect(ctx.destination);

                audioSourceRef.current = source;
                analyzerRef.current = analyzer;
                console.log("✅ Audio Analyzer gekoppeld aan de stream");
            } catch (err) {
                console.error("Audio koppelen mislukt:", err.message);
            }
        }
    };

    // De Game Loop: Loopt ALTIJD door als de video speelt
    const animate = useCallback(() => {
        if (analyzerRef.current) {
            const testArray = new Float32Array(analyzerRef.current.fftSize);
            analyzerRef.current.getFloatTimeDomainData(testArray);
            const hasSignal = testArray.some(sample => sample !== 0);
            if (Math.random() > 0.99) console.log("Heeft analyzer signaal?", hasSignal);
        }

        if (!videoRef.current || !isPlaying) return;

        // --- ESSENTIA LOGICA ---
        if (analyzerRef.current && essentiaRef.current && !isMuziekGevonden) {
            const bufferLength = analyzerRef.current.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            analyzerRef.current.getFloatTimeDomainData(dataArray);

            try {
                const vectorData = essentiaRef.current.arrayToVector(dataArray);

                // Gebruik de 'backend' eigenschap om de algoritmes direct aan te spreken
                // Dit omzeilt de "Cannot read properties of undefined (reading 'algorithms')" fout
                const rmsAlgorithm = essentiaRef.current.backend.RMS();
                const rmsResult = rmsAlgorithm.compute(vectorData);
                const rmsValue = rmsResult.rms; // Bij directe compute() is de output vaak een object {rms: ...}

                if (Math.random() > 0.98) {
                    setDebugData({ rms: rmsValue, centroid: 0 });
                }

                // TRIGGER: 0.010 is de drempel voor de start van de muziek
                if (rmsValue > 0.008) {
                    console.log("🎵 MUZIEK GEVONDEN! RMS:", rmsValue);
                    setDynamicOffset(videoRef.current.currentTime - 0.1);
                    setIsMuziekGevonden(true);
                }

                // Ruim direct op
                essentiaRef.current.deleteVector(vectorData);
                // Directe algoritme-instanties moeten ook opgeruimd worden in sommige versies
                if (rmsAlgorithm.delete) rmsAlgorithm.delete();

            } catch (err) {
                // Als de backend-methode ook faalt, probeer de simpelste JS fallback 
                // zodat je project in ieder geval werkt:
                const simpleRMS = Math.sqrt(dataArray.reduce((acc, val) => acc + val * val, 0) / dataArray.length);

                if (simpleRMS > 0.008) {
                    setDynamicOffset(videoRef.current.currentTime - 0.1);
                    setIsMuziekGevonden(true);
                    console.log("🎵 Muziek gevonden via fallback! RMS:", simpleRMS);
                }

                if (Math.random() > 0.98) setDebugData({ rms: simpleRMS, centroid: 0 });
            }
        }

        // We trekken de offset af van de videotijd voor de logica van de blokjes
        const videoTime = videoRef.current.currentTime;
        const currentTime = isMuziekGevonden ? (videoTime - dynamicOffset) : -1;

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
    }, [isPlaying, noteGroups, player, saxVolume, isMuziekGevonden, dynamicOffset]);

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
        if (videoRef.current) {
            videoRef.current.volume = videoVolume;
        }
    }, [videoVolume]);

    // Reset de sync-status als de video handmatig wordt teruggespoeld
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleSeeked = () => {
            // Als de gebruiker terugspoelt naar voor het punt waar muziek werd gevonden
            if (video.currentTime < dynamicOffset - 0.5) {
                setIsMuziekGevonden(false);
                setDynamicOffset(0);
                console.log("Sync gereset door terugspoelen.");
            }
        };

        video.addEventListener('seeked', handleSeeked);
        return () => video.removeEventListener('seeked', handleSeeked);
    }, [dynamicOffset]);

    //const onVideoReady = (event) => { videoPlayerRef.current = event.target; };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: '#111', minHeight: '100vh', color: 'white' }}>
            <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '1200px', justifyContent: 'center', alignItems: 'flex-start' }}>
                {/* LINKS: De Video */}
                <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '2px solid #333' }}>
                    {videoSrc && (
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            crossOrigin='anonymous'
                            style={{ width: '100%', display: 'block' }}
                            controls
                            onLoadedMetadata={setupAudioAnalysis}
                            onPlay={() => {
                                if (audioContext.current.state === 'suspended') {
                                    audioContext.current.resume();
                                }
                                setIsPlaying(true);
                            }}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                        />
                    )}
                </div>

                {/* RECHTS: De Tijdlijn en info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '15px', backgroundColor: '#222', borderRadius: '10px', border: '1px solid #444' }}>
                        <h3>Dashboard</h3>
                        <p style={{ margin: '5px 0' }}>
                            Sync: <span style={{ color: isMuziekGevonden ? '#2ecc71' : '#f1c40f' }}>
                                {isMuziekGevonden ? `✅ Gekoppeld op ${dynamicOffset.toFixed(2)}s` : "🔍 Zoekt naar inzet..."}
                            </span>
                        </p>
                        <p>Status: {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}</p>
                        <p style={{ fontSize: '1.2rem' }}>Volgende greep: <strong style={{ color: '#f1c40f' }}>{noteGroups[displayStep]?.weergaveNaam || "-"}</strong></p>
                        <p style={{ fontSize: '10px', color: '#666' }}>
                            Debug Audio - RMS: {debugData.rms.toFixed(3)} | Centroid: {debugData.centroid.toFixed(0)}
                        </p>
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

            <div style={{ marginTop: '40px', padding: '20px', border: `2px ${isMuziekGevonden ? 'solid' : 'dashed'} ${isMuziekGevonden ? '#2ecc71' : '#444'}`, borderRadius: '50%', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3 ease' }}>
                <span style={{ color: isPlaying ? '#2ecc71' : '#888', fontWeight: 'bold' }}>LIVE</span>
                {isMuziekGevonden && <small style={{ fontSize: '10px', color: '#2ecc71' }}>SYNCED</small>}
            </div>
        </div>
    );
};

export default FullScorePlayer;