import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicPlayer } from './soundfontANDanimate';

interface UI2Props {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    ui: 1 | 2;
    onBack?: () => void;
}

const UI2: React.FC<UI2Props> = ({ partij, forgiveness, ui, onBack }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [countdown, setCountdown] = React.useState<string | null>(null);
    const [screenWidth, setScreenWidth] = React.useState(window.innerWidth);
    const [playedCorrectly, setPlayedCorrectly] = React.useState<Set<string>>(new Set());

    const {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, activeKeys, buttonPresses,
        correctNoteId,
        partijOffset, /*OFFSET*/
    } = useMusicPlayer({ partij, forgiveness, ui, videoRef });

    React.useEffect(() => {
        let frameId: number;
        const update = () => {
            if (videoRef.current && isPlaying) {
                const currentTime = videoRef.current.currentTime;

                if (currentTime < partijOffset + /*OFFSET*/ - 4) setCountdown(null);
                else if (currentTime < partijOffset + /*OFFSET*/ - 3) setCountdown("3");
                else if (currentTime < partijOffset + /*OFFSET*/ - 2) setCountdown("2");
                else if (currentTime < partijOffset + /*OFFSET*/ - 1) setCountdown("1");
                else if (currentTime < partijOffset /*+ OFFSET*/) setCountdown("Start!");
                else setCountdown(null);
            }
            frameId = requestAnimationFrame(update);
        };
        if (isPlaying) frameId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying, partijOffset, /*OFFSET*/]);

    React.useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const dynamicPPS = React.useMemo(() => {
        if (noteGroups.length === 0) return 40;

        const lastNote = noteGroups[noteGroups.length - 1];
        const totalDuration = lastNote.time + lastNote.duration;

        // We laten een marge van 100px (25px links, 25px rechts)
        const availableWidth = screenWidth - 200;
        return availableWidth / totalDuration;
    }, [noteGroups, screenWidth]);

    React.useEffect(() => {
        if (correctNoteId) {
            setPlayedCorrectly(prev => new Set(prev).add(correctNoteId));
        }
    }, [correctNoteId]);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-black flex text-white">
            <div className="absolute inset-0 z-0">
                <video
                    ref={videoRef}
                    src="/HowToTrainYourDragon.mp4"
                    crossOrigin='anonymous'
                    className="w-full h-full object-cover opacity-80"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    controls
                />
            </div>

            <AnimatePresence>
                {!isPlaying && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-10 left-0 right-0 mx-auto w-max px-8 py-4 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/20 z-30 shadow-2xl text-center"
                    >
                        <span className={isPlayerReady && isMidiReady ? "text-green-400" : "text-red-400"}>
                            {isPlayerReady && isMidiReady ? "Video starten om te beginnen" : "Laden..."}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute top-6 right-6 z-20">
                <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-2xl">←</button>
            </div>

            {/* Countdown Overlay */}
            <AnimatePresence>
                {countdown && (
                    <motion.div
                        key={countdown}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1.2 }}
                        exit={{ opacity: 0, scale: 2 }}
                        className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                    >
                        <span className="text-9xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(212,175,55,0.8)]">
                            {countdown}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute bottom-10 left-0 w-full h-40 z-20 flex items-center px-6 gap-4">

                {/* DE BUTTON (Vast op de hit-line) */}
                <div className="flex-shrink-0">
                    <motion.div
                        className="relative"
                        style={{ width: '80px', height: '80px' }}
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
                                bottom: '10px',
                                right: '10px',

                                width: '35px',
                                height: '35px',

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

                {/* De Statische Partituur Container */}
                <div className="flex-1 h-20 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden relative">
                    <div
                        className="relative h-full"
                        style={{
                            width: `${screenWidth - 200}px`,
                            marginLeft: '25px'
                        }}
                    >
                        {noteGroups.map((note) => {
                            const isCorrect = note.id === correctNoteId;
                            const wasEverCorrect = playedCorrectly.has(note.id);
                            return (
                                <motion.div
                                    key={note.id}
                                    animate={{
                                        backgroundColor: isCorrect ? '#4ADE80' : wasEverCorrect ? '#3B82F6' : 'rgba(212, 175, 55, 0)',
                                        borderColor: isCorrect ? '#22C55E' : wasEverCorrect ? '#3B82F6' : 'rgba(251, 191, 36, 0.5)',
                                        scale: isCorrect ? 1.05 : 1, // Maak 'm net iets groter
                                        boxShadow: isCorrect ? '0 0 20px rgba(74, 222, 128, 0.7)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    }}
                                    transition={{ duration: 0.1 }} // Snelle reactie
                                    className="absolute top-1/4 -translate-y-1/2 h-12 rounded-md border border-amber-400/50 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                    style={{
                                        left: `${note.time * dynamicPPS}px`,
                                        width: `${(note.duration - 0.03) * dynamicPPS}px`,
                                        background: wasEverCorrect ? 'linear-gradient(180deg, #3B82F6 0%, #1E40AF 100%)' : `linear-gradient(180deg, #D4AF37 0%, #8B7355 100%)`,
                                    }}
                                >
                                </motion.div>
                            );

                        })}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default UI2;