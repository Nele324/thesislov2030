import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicPlayer } from '../soundfont&animate'; // Importeer de logica

interface UI1Props {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    ui: 1 | 2;
    onBack?: () => void;
}

const UI1: React.FC<UI1Props> = ({ partij, forgiveness, ui, onBack }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, blockRefs, activeKeys, buttonPresses,
        PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT
    } = useMusicPlayer({ partij, forgiveness, ui, videoRef });

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

            <div className="absolute left-12 bottom-0 w-48 h-full z-10 flex flex-col items-center">
                <div className="absolute inset-0 w-full bg-gradient-to-t from-amber-600/20 via-amber-900/5 to-transparent" />
                <div className="absolute w-full h-1 bg-amber-500/60 shadow-[0_0_20px_rgba(255,215,0,0.8)]" style={{ top: `${HIT_ZONE_Y_PERCENT}%` }} />

                <div className="relative w-full h-full overflow-hidden">
                    {noteGroups.map((note, index) => (
                        <div
                            key={note.id}
                            ref={el => { blockRefs.current[index] = el; }}
                            data-time={note.time}
                            className="absolute left-1/2 flex items-end justify-center rounded-full border-2 border-amber-300 shadow-[0_0_15px_rgba(232,196,104,0.4)]"
                            style={{
                                width: '97px',
                                height: `${Math.max((note.duration - 0.03) * PIXELS_PER_SECOND, 60)}px`,
                                marginTop: `-${Math.max(note.duration * PIXELS_PER_SECOND, 60)}px`,
                                background: `linear-gradient(to top, #E8C468 0%, #C9A961 40%, #8B7355 100%)`,
                                top: 0,
                                willChange: 'transform',
                                zIndex: 5,
                            }}
                        />
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

export default UI1;