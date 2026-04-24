import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicPlayer } from './soundfontANDanimate';

interface UI2Props {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    ui: 1 | 2;
    tutorial?: boolean;
    onBack?: () => void;
    onStartTest?: () => void;
}

const UI2: React.FC<UI2Props> = ({ partij, forgiveness, ui, tutorial, onBack, onStartTest }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [countdown, setCountdown] = React.useState<string | null>(null);
    const [screenWidth, setScreenWidth] = React.useState(window.innerWidth);
    const [controlsVisible, setControlsVisible] = React.useState(true);
    const sliderRef = useRef<HTMLDivElement | null>(null);
    const [currentSegment, setCurrentSegment] = React.useState(0);
    const hasSwitchedRef = React.useRef(false);
    const [activeMeasureTime, setActiveMeasureTime] = React.useState<number | null>(null);
    const LOOK_AHEAD = 0.5;

    const {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, activeKeys, buttonPresses,
        correctNoteId,
        resetPlayer, startTutorialMusic,
        partijOffset,
    } = useMusicPlayer({ partij, forgiveness, ui, tutorial, videoRef, audioRef });

    //const totalDuration =
    //    noteGroups.length > 0
    //        ? noteGroups[noteGroups.length - 1].time + noteGroups[noteGroups.length - 1].duration
    //        : 0;

    const handleTutorialAction = () => {
        if (isPlaying) {
            resetPlayer();
            setCurrentSegment(0);
        } else {
            if (partij === 'melodie') {
                startTutorialMusic("/How_to_train_your_dragon-piano-melodie.mp3");
            } else {
                startTutorialMusic("/How_to_train_your_dragon-piano-begeleiding.mp3");
            }
        }
    };

    const toggleFullscreen = async () => {
        const el = containerRef.current;
        if (!el) return;

        if (!document.fullscreenElement) {
            await el.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    };

    React.useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const videoEl = videoRef.current;

        const showControls = () => {
            setControlsVisible(true);
            clearTimeout(timeout);

            timeout = setTimeout(() => {
                setControlsVisible(false);
            }, 2000);
        };

        window.addEventListener('mousemove', showControls);
        window.addEventListener('touchstart', showControls);
        videoEl?.addEventListener('play', showControls);
        videoEl?.addEventListener('pause', showControls);

        return () => {
            window.removeEventListener('mousemove', showControls);
            window.removeEventListener('touchstart', showControls);
            videoEl?.removeEventListener('play', showControls);
            videoEl?.removeEventListener('pause', showControls);
            clearTimeout(timeout);
        };
    }, []);

    const segments = React.useMemo(() => {
        if (noteGroups.length === 0) return [[], []];

        const sorted = [...noteGroups].sort((a, b) => a.time - b.time);

        const minIndex = Math.floor(sorted.length * 0.35);
        const maxIndex = Math.floor(sorted.length * 0.75);

        let bestSplitIndex = Math.ceil(sorted.length / 2);
        let maxGap = 0;

        for (let i = minIndex; i < maxIndex; i++) {
            const currentNoteEnd = sorted[i].time + sorted[i].duration;
            const nextNoteStart = sorted[i + 1].time;
            const gap = nextNoteStart - currentNoteEnd;

            if (gap >= maxGap) {
                maxGap = gap;
                bestSplitIndex = i + 1;
            }
        }

        return [
            sorted.slice(0, bestSplitIndex),
            sorted.slice(bestSplitIndex)
        ];
    }, [noteGroups]);

    const dynamicPPS = React.useMemo(() => {
        const segmentNotes = segments[currentSegment];
        if (!segmentNotes || segmentNotes.length === 0) return 40;

        const firstNote = segmentNotes[0];
        const lastNote = segmentNotes[segmentNotes.length - 1];

        const segmentDuration = (lastNote.time + lastNote.duration) - firstNote.time;

        const availableWidth = screenWidth - 200;

        return availableWidth / segmentDuration;
    }, [segments, currentSegment, screenWidth]);


    React.useEffect(() => {
        let frameId: number;
        const media = videoRef.current || audioRef.current;

        const update = () => {
            if (media && media.readyState < 2) {
                frameId = requestAnimationFrame(update);
                return;
            }

            if (media && isPlaying) {
                const currentTime = media.currentTime;
                // Countdown logic
                if (currentTime < partijOffset - 3.5) setCountdown(null);
                else if (currentTime < partijOffset - 2.5) setCountdown("3");
                else if (currentTime < partijOffset - 1.5) setCountdown("2");
                else if (currentTime < partijOffset - 0.5) setCountdown("1");
                else if (currentTime <= partijOffset) setCountdown("Start!");
                else setCountdown(null);
                const adjustedTime = currentTime - partijOffset;

                // Binnen de update() functie, na het berekenen van adjustedTime:
                const UpcomingMeasureNote = [...noteGroups]
                    .filter(n => n.firstBeat && n.time <= (adjustedTime + LOOK_AHEAD))
                    .pop(); // Pak de laatste "firstBeat" die we gepasseerd zijn

                if (UpcomingMeasureNote && UpcomingMeasureNote.time !== activeMeasureTime) {
                    setActiveMeasureTime(UpcomingMeasureNote.time);
                }

                const segmentNotes = segments[currentSegment];
                if (!segmentNotes || segmentNotes.length === 0) return;

                const segmentStart = segmentNotes[0].time;
                const lastNote = segmentNotes[segmentNotes.length - 1];
                const segmentEnd = lastNote.time + lastNote.duration;


                // 👉 Move slider relative to segment
                if (sliderRef.current) {
                    const localTime = adjustedTime - segmentStart;
                    const x = Math.max(0, localTime * dynamicPPS);
                    sliderRef.current.style.transform = `translateX(${x}px)`;
                }

                // 👉 When segment finishes → go to next
                if (adjustedTime > segmentEnd && !hasSwitchedRef.current) {
                    hasSwitchedRef.current = true;
                    if (currentSegment < segments.length - 1) {
                        setCurrentSegment(prev => prev + 1);

                        // reset slider visually
                        //if (sliderRef.current) {
                        //    sliderRef.current.style.transform = `translateX(0px)`;
                        //}
                    }
                }
            }

            frameId = requestAnimationFrame(update);
        };

        if (isPlaying) {
            requestAnimationFrame(() => {
                frameId = requestAnimationFrame(update);
            });
        }
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying, partijOffset, dynamicPPS, segments, currentSegment]);

    React.useEffect(() => {
        hasSwitchedRef.current = false;
    }, [currentSegment]);

    React.useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        setCurrentSegment(0);
    }, [noteGroups]);

    React.useEffect(() => {
        if (isPlaying) {
            setCurrentSegment(0);
        }
    }, [isPlaying]);

    React.useEffect(() => {
        if (currentSegment >= segments.length) {
            setCurrentSegment(0);
        }
    }, [segments, currentSegment]);

    React.useEffect(() => {
        if (isPlaying) {
            setCurrentSegment(0);
            hasSwitchedRef.current = false;

            if (sliderRef.current) {
                sliderRef.current.style.transform = `translateX(0px)`;
            }
        }
    }, [isPlaying]);

    return (
        <div ref={containerRef} className="relative w-screen h-screen overflow-hidden bg-black flex text-white">
            {!tutorial ? (
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
            ) : (
                <div className="absolute top-6 left-6 z-50">
                    <button
                        onClick={handleTutorialAction}
                        className={`px-8 py-4 rounded-2xl font-black text-xl transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-3 ${isPlaying
                            ? "bg-red-600 hover:bg-red-700 text-white translate-y-1"
                            : "bg-amber-500 hover:bg-amber-600 text-black hover:-translate-y-1"
                            }`}
                    >
                        {isPlaying ? (
                            <>
                                <span className="text-2xl">↺</span> RESET TUTORIAL
                            </>
                        ) : (
                            <>
                                <span className="text-2xl">▶</span> START TUTORIAL
                            </>
                        )}
                    </button>
                </div>
            )}

            {!tutorial && (
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
            )}

            <div className="absolute top-6 right-6 z-20 flex gap-4 items-center">
                <button onClick={toggleFullscreen} className="text-gray-400 hover:text-white transition-colors text-2xl">⛶</button>
                <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-2xl">←</button>
            </div>

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

            <div className="flex-1 flex flex-col gap-2"> {/* Container om balk en dots te groeperen */}
                <div
                    className="absolute left-0 w-full h-40 z-20 flex items-center px-6 gap-4 transition-all duration-300"
                    style={{
                        bottom: tutorial ? '6rem' : ((!tutorial && controlsVisible) ? '2.5rem' : '0.5rem')
                    }}
                >
                    <div className="flex-shrink-0">
                        <motion.div
                            className="relative"
                            style={{ width: '80px', height: '80px' }}
                            animate={{
                                y: activeKeys.has(0) ? 8 : 0,
                                scale: activeKeys.has(0) ? 0.92 : 1
                            }}
                            transition={{ duration: 0.1 }}
                        >
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

                            <div className="absolute inset-0 rounded-full border border-[#5C4B26]/30 z-10 shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
                                style={{
                                    background: `radial-gradient(circle at 32% 35%, #f3e5abbd 0%, #D4AF37 15%, #927233 60%, #4A3718 85%, #31250f 100%)`,
                                }}>
                                <div className="absolute inset-0 rounded-full opacity-40 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1)]"
                                    style={{ background: 'radial-gradient(circle at 40% 40%, rgba(255, 248, 220, 0.2) 0%, transparent 60%)' }} />
                            </div>

                            <div className="absolute rounded-full z-20 overflow-hidden border border-[#D4AF37]/60"
                                style={{
                                    bottom: '10px',
                                    right: '10px',
                                    width: '35px',
                                    height: '35px',
                                    background: `radial-gradient(circle at 40% 40%, #FFFDF8 0%, #F5F1E1 50%, #E0DBCF 100%)`,
                                    boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
                                }}>
                                <div className="absolute inset-0 opacity-100"
                                    style={{
                                        backgroundImage: `
                                        radial-gradient(ellipse at 80% 80%, rgba(216,180,254, 0.4) 0%, transparent 40%),
                                        radial-gradient(ellipse at 20% 20%, rgba(147,197,253, 0.3) 0%, transparent 40%),
                                        conic-gradient(from 180deg, transparent, rgba(166,124,0, 0.1), transparent),
                                        conic-gradient(from 0deg, transparent, rgba(166,124,0, 0.1), transparent)
                                    `,
                                        filter: 'blur(1px)',
                                    }} />
                            </div>
                        </motion.div>
                    </div>

                    <div className="flex-1 h-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden relative opacity-80">
                        <div className="relative h-full"
                            style={{ width: `${screenWidth - 200}px`, marginLeft: '25px' }}>
                            <div
                                ref={sliderRef}
                                className="absolute top-0 bottom-0 w-[3px] bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_20px_rgba(255,215,0,0.8)] z-50 pointer-events-none"
                            />
                            {segments[currentSegment]?.map((note) => {
                                const isCorrect = note.id === correctNoteId;
                                const isCurrentMeasure = note.firstBeat && note.time === activeMeasureTime;
                                const segmentStart = segments[currentSegment]?.[0]?.time || 0;
                                const leftPos = (note.time - segmentStart) * dynamicPPS;
                                return (
                                    <React.Fragment key={note.id}>
                                        {note.firstBeat && (
                                            <motion.div
                                                initial={false}
                                                animate={{
                                                    backgroundColor: isCurrentMeasure ? '#fbbf24' : 'rgba(200,200,200,0.8)',
                                                    width: isCurrentMeasure ? '3px' : '1.5px',
                                                    opacity: isCurrentMeasure ? 1 : 0.9,
                                                    y: isCurrentMeasure ? -2 : 0
                                                }}
                                                className="absolute z-10"
                                                style={{
                                                    left: `${leftPos}px`,
                                                    top: '2px',
                                                    height: '10px',
                                                    boxShadow: isCurrentMeasure ? '0 0 15px rgba(251, 191, 36, 0.6)' : 'none',
                                                    originX: 0.5
                                                }}
                                            />
                                        )}

                                        <motion.div
                                            key={note.id}
                                            animate={{
                                                backgroundColor: isCorrect ? '#FFD36A' : 'rgba(212, 175, 55, 1)',
                                                borderColor: isCorrect ? '#FFFFF' : 'rgba(251, 191, 36, 0.5)',
                                                scale: isCorrect ? 1.05 : 1,
                                                boxShadow: isCorrect ? '0 0 20px rgba(255, 211, 106, 0.9), 0 0 8px rgba(255, 255, 255, 0.6)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute top-1/4 -translate-y-1/2 h-12 rounded-md border border-amber-300/60 flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                                            style={{
                                                left: `${(note.time - segmentStart) * dynamicPPS}px`,
                                                width: `${(note.duration - 0.03) * dynamicPPS}px`,
                                                background: `linear-gradient(180deg, #D4AF37 0%, #8B7355 100%)`,
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                                        </motion.div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {tutorial && (
                <div className="absolute bottom-10 right-10 z-50">
                    <button onClick={onStartTest}
                        className="group flex flex-col items-end px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all">
                        <span className="text-lg font-bold">
                            START ECHTE TEST →
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default UI2;