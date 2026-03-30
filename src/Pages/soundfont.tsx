import React, { useState, useEffect, useRef, useCallback } from 'react';
import Soundfont, { Player, InstrumentName } from 'soundfont-player';
import { Midi } from '@tonejs/midi';
import { motion, AnimatePresence } from 'framer-motion';

interface NoteGroup {
    time: number;
    duration: number;
    weergaveNaam: string;
    klinkendeNaam: string;
    velocity: number;
    id: string;
}

interface FullScorePlayerProps {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    onBack?: () => void;
}

const FullScorePlayer: React.FC<FullScorePlayerProps> = ({ partij, forgiveness, onBack }) => {
    const [player, setPlayer] = useState<Player | null>(null);
    const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [videoVolume] = useState(0.75); // 75%
    const [saxVolume] = useState(0.5);    // 50%

    const [buttonPresses, setButtonPresses] = useState<{ id: number }[]>([]);
    const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const requestRef = useRef<number | null>(null);
    const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isKeyDown = useRef(false);
    const activeNoteEvent = useRef<any>(null);
    const currentNoteIndexRef = useRef(-1);
    const audioContext = useRef<AudioContext | null>(null);
    const hasPlayedCurrentNote = useRef(false);
    const instrumentNameRef = useRef<InstrumentName | null>(null);
    const feedbackIdRef = useRef(0);

    const PIXELS_PER_SECOND = 350;
    const HIT_ZONE_Y_PERCENT = 85;
    const OFFSET = 4.8;
    const FORGIVENESS_MARGIN = 0.15; // 150ms marge voor 'low' forgiveness

    const getSaxNootNaam = (midiNumber: number): string => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];
        const index = midiNumber % 12;
        return namen[index];
    };

    const initAudio = () => {
        if (!audioContext.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext.current = new AudioContextClass();
        }
        if (audioContext.current.state === 'suspended') {
            audioContext.current.resume();
        }
    };

    useEffect(() => {
        setIsPlayerReady(false);
        setIsMidiReady(false);
        blockRefs.current = [];

        let link = "";
        let transposition = 0;

        if (partij === 'melodie') {
            instrumentNameRef.current = 'soprano_sax';
            link = "/scores/How_to_train_your_dragon-soprano.mid"
            transposition = -2;
        } else {
            instrumentNameRef.current = 'baritone_sax';
            link = "/scores/How_to_train_your_dragon-bariton.mid"
            transposition = -3;
        }

        if (!audioContext.current) { initAudio(); }
        if (!audioContext.current || !instrumentNameRef.current) return;

        Soundfont.instrument(audioContext.current, instrumentNameRef.current, { soundfont: 'MusyngKite' })
            .then((inst) => {
                setPlayer(inst);
                setIsPlayerReady(true);
            });

        Midi.fromUrl(link).then((midi) => {
            const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
            const allNotes = track.notes.filter(n => n.duration > 0.05);
            const groups = allNotes.map((note, i) => ({
                time: note.time,
                duration: Math.max(note.duration - 0.03, 0.03),
                weergaveNaam: getSaxNootNaam(note.midi + transposition),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}-${partij}-${forgiveness}`
            }));
            setNoteGroups(groups);
            setIsMidiReady(true);
            //setDisplayStep(0);
            currentNoteIndexRef.current = -1;
        });
    }, [partij, forgiveness]);

    const updateBlockPositions = useCallback((time: number) => {
        const hitZonePixelPos = (window.innerHeight * (HIT_ZONE_Y_PERCENT / 100));

        for (let i = 0; i < blockRefs.current.length; i++) {
            const block = blockRefs.current[i];
            if (block) {
                const noteTimeStr = block.getAttribute('data-time');
                if (!noteTimeStr) continue;
                const noteTime = parseFloat(noteTimeStr);
                const y = hitZonePixelPos - (noteTime - time) * PIXELS_PER_SECOND;

                // BELANGRIJK: translate(-50%, -100%) zorgt dat de ONDERKANT van de balk 
                // het referentiepunt is voor de positie.
                block.style.transform = `translate(-50%, ${y}px)`;

                // Performance: verberg noten die al ver voorbij zijn of nog heel ver weg
                block.style.display = (y < -2000 || y > window.innerHeight + 500) ? 'none' : 'flex';
            }
        }
    }, [PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT]);

    const animate = useCallback(() => {
        if (!videoRef.current || !isPlaying || !player || !audioContext.current) return;

        const videoTime = videoRef.current.currentTime;
        const currentTime = videoTime - OFFSET;
        //console.log(`Video Time: ${videoTime.toFixed(3)}`);

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
            if (forgiveness === 'high') {
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
                //setDisplayStep(nowNoteIndex);
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
            if (!currentNote) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
            } else if (currentTime > (currentNote.time + currentNote.duration) || !isKeyDown.current || nowNoteIndex === -1) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
                // We resetten hasPlayedCurrentNote NIET, want de toets is mogelijk nog ingedrukt.
                // De KeyUp event zal dit later op false zetten voor de volgende noot.
            }
        }

        requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, noteGroups, player, saxVolume, forgiveness, updateBlockPositions]);

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else if (requestRef.current !== null) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
        return () => {
            if (requestRef.current !== null) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = null;
            }
        };
    }, [isPlaying, animate]);

    // Toetsenbord Events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                initAudio();
                isKeyDown.current = true;
                setActiveKeys(new Set([0]));
                // Visual ripple
                const pressId = feedbackIdRef.current++;
                setButtonPresses(prev => [...prev, { id: pressId }]);
                setTimeout(() => setButtonPresses(prev => prev.filter(p => p.id !== pressId)), 600);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                isKeyDown.current = false;
                hasPlayedCurrentNote.current = false;
                setActiveKeys(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = videoVolume;
        }
    }, [videoVolume, isPlaying]);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black flex text-white">
            {/* 1. ACHTERGROND: De Video (Vult het hele scherm) */}
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    src="/HowToTrainYourDragon.mp4"
                    crossOrigin='anonymous'
                    className="w-full h-full object-cover opacity-80"
                    controls
                    onPlay={() => { setIsPlaying(true) }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                />
            </div>

            {!isPlaying && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 p-4 bg-black/50 backdrop-blur-lg rounded-2xl border border-white/20 z-20 w-auto">
                    <span className={isPlayerReady && isMidiReady ? "text-green-400" : "text-red-400"}>
                        {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}
                    </span>
                </div >
            )}

            <div className="absolute top-6 right-6 z-20 w-auto">
                <button
                    onClick={onBack}
                    className="mb-4 text-xs uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                >
                    ←
                </button>
            </div >


            {/* 3. GAME AREA: Linksonder over de video */}
            < div className="absolute left-12 bottom-0 w-48 h-full z-10 flex flex-col items-center" >
                {/* De Lane Glow */}
                < div className="absolute inset-0 w-full bg-gradient-to-t from-amber-600/20 via-amber-900/5 to-transparent" />

                {/* Hit Line */}
                < div className="absolute w-full h-1 bg-amber-500/60 shadow-[0_0_20px_rgba(255,215,0,0.8)]" style={{ top: `${HIT_ZONE_Y_PERCENT}%` }} />

                {/* Vallende Noten */}
                <div className="relative w-full h-full overflow-hidden">
                    {noteGroups.map((note, index) => (
                        <div
                            key={note.id}
                            ref={el => { blockRefs.current[index] = el; }}
                            data-time={note.time}
                            className="absolute left-1/2 flex items-end justify-center rounded-full border-2 border-amber-300 shadow-[0_0_15px_rgba(232,196,104,0.4)]"
                            style={{
                                width: '97px',
                                height: `${Math.max(note.duration * PIXELS_PER_SECOND, 60)}px`,
                                marginTop: `-${Math.max(note.duration * PIXELS_PER_SECOND, 60)}px`, // Zorgt dat de noot 'boven' begint
                                background: `linear-gradient(to top, #E8C468 0%, #C9A961 40%, #8B7355 100%)`,
                                top: 0, // Wordt overschreven door transform in updateBlockPositions
                                willChange: 'transform',
                                zIndex: 5,
                                paddingTop: '12px',
                            }}>
                            {/*<span className="text-black font-black text-lg drop-shadow-md">{note.weergaveNaam}</span>*/}
                        </div>
                    ))}
                </div>

                {/* DE BUTTON (Vast op de hit-line) */}
                <div className="absolute z-40" style={{ top: `${HIT_ZONE_Y_PERCENT}%`, transform: 'translateY(-50%)' }}>

                    {/* AANGEPAST: De motion.div zit nu om de HELE knop heen */}
                    <motion.div
                        className="relative w-24 h-24"
                        animate={{
                            y: activeKeys.has(0) ? 8 : 0, // Hele knop gaat omlaag
                            scale: activeKeys.has(0) ? 0.92 : 1 // Hele knop krimpt iets
                        }}
                        transition={{ duration: 0.1 }} // Snelle reactie
                    >
                        {/* Ripple effect (blijft hetzelfde) */}
                        <AnimatePresence>
                            {buttonPresses.map(p => (
                                <motion.div
                                    key={p.id}
                                    initial={{ scale: 1, opacity: 0.6 }}
                                    animate={{ scale: 2.5, opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute inset-0 border-4 border-amber-400 rounded-full z-0"
                                />
                            ))}
                        </AnimatePresence>

                        {/* 2. De Gouden Cup Base (Verfijnd Antiek Goud) */}
                        <div
                            className="absolute inset-0 rounded-full border border-[#5C4B26]/30 z-10 shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
                            style={{
                                background: `
                                    radial-gradient(circle at 32% 35%, 
                                        #f3e5abbd 0%,    /* Zachte gele highlight (Meringue) */
                                        #D4AF37 15%,   /* Warm verzadigd goud */
                                        #927233 60%,   /* Overgang naar brons */
                                        #4A3718 85%,   /* Diepe schaduw */
                                        #31250f 100%   /* Donkere rand */
                                    )
                                `,
                            }}
                        >
                            {/* Interne zachte glanslaag voor die zijdezachte metaal-look */}
                            <div
                                className="absolute inset-0 rounded-full opacity-40 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1)]"
                                style={{
                                    background: 'radial-gradient(circle at 40% 40%, rgba(255, 248, 220, 0.2) 0%, transparent 60%)',
                                }}
                            />
                        </div>

                        {/* 2. De Kleine Witte Parelmoer Inleg (Gecentreerd) */}
                        <div
                            className="absolute rounded-full z-20 overflow-hidden border border-[#D4AF37]/60"
                            style={{
                                bottom: '12px',
                                right: '12px',

                                width: '45px',
                                height: '45px',

                                background: `radial-gradient(circle at 40% 40%, #FFFDF8 0%, #F5F1E1 50%, #E0DBCF 100%)`,
                                boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
                            }}
                        >
                            {/* De Realistische Parelmoer Swirl Textuur */}
                            <div
                                className="absolute inset-0 opacity-100"
                                style={{
                                    backgroundImage: `
                                        radial-gradient(ellipse at 80% 80%, rgba(216,180,254, 0.4) 0%, transparent 40%),
                                        radial-gradient(ellipse at 20% 20%, rgba(147,197,253, 0.3) 0%, transparent 40%),
                                        conic-gradient(from 180deg, transparent, rgba(166,124,0, 0.1), transparent),
                                        conic-gradient(from 0deg, transparent, rgba(166,124,0, 0.1), transparent)
                                    `,
                                    filter: 'blur(1px)', // Swirl textuur zachter maken
                                }}
                            />
                        </div>

                    </motion.div>
                </div>
            </div >
        </div >
    );
};

export default FullScorePlayer;