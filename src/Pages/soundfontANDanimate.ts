import React, { useState, useEffect, useRef, useCallback } from 'react';
import Soundfont, { Player, InstrumentName } from 'soundfont-player';
import { Midi } from '@tonejs/midi';

export interface NoteGroup {
    time: number;
    duration: number;
    weergaveNaam: string;
    klinkendeNaam: string;
    velocity: number;
    id: string;
    firstBeat?: boolean;
}

interface UseMusicPlayerProps {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    ui: 1 | 2;
    tutorial?: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    audioRef: React.RefObject<HTMLAudioElement | null>;
    hitZonePercent?: number;
}

export const useMusicPlayer = ({ partij, forgiveness, ui, tutorial, videoRef, audioRef, hitZonePercent }: UseMusicPlayerProps) => {
    const [player, setPlayer] = useState<Player | null>(null);
    const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isMidiReady, setIsMidiReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
    const [buttonPresses, setButtonPresses] = useState<{ id: number }[]>([]);
    const [correctNoteId, setCorrectNoteId] = useState<string | null>(null);

    const requestRef = useRef<number | null>(null);
    const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isKeyDown = useRef(false);
    const activeNoteEvent = useRef<any>(null);
    const currentNoteIndexRef = useRef(-1);
    const audioContext = useRef<AudioContext | null>(null);
    const hasPlayedCurrentNote = useRef(false);
    const feedbackIdRef = useRef(0);
    const partijOffset = useRef(0);

    const PIXELS_PER_SECOND = ui === 1 ? 350 : 40;
    const HIT_ZONE_Y_PERCENT = hitZonePercent ?? 85;
    //const OFFSET = 4.8;
    const FORGIVENESS_MARGIN = 0.15;
    const PRE_HIT_MARGIN = 0.2;
    const START_TIJD_TUTORIAL = 25.8;

    const gain = partij === 'melodie' ? 1 : 0.5;

    const getSaxNootNaam = (midiNumber: number): string => {
        const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];
        return namen[midiNumber % 12];
    };

    const initAudio = () => {
        if (!audioContext.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext.current = new AudioContextClass();
        }
        if (audioContext.current.state === 'suspended') audioContext.current.resume();
    };

    useEffect(() => {
        setIsPlayerReady(false);
        setIsMidiReady(false);
        let link = partij === 'melodie' ? "/scores/How_to_train_your_dragon-soprano.mid" : "/scores/How_to_train_your_dragon-bariton.mid";
        let starttijdenLink = partij === 'melodie' ? "/Starttijden-soprano.txt" : "/Starttijden-bariton.txt";
        let durationsLink = partij === 'melodie' ? "/durations-soprano.txt" : "/durations-bariton.txt";
        let instName: InstrumentName = partij === 'melodie' ? 'soprano_sax' : 'baritone_sax';
        let transposition = partij === 'melodie' ? +2 : -3;

        initAudio();
        Soundfont.instrument(audioContext.current!, instName, { soundfont: 'MusyngKite' }).then(inst => {
            setPlayer(inst);
            setIsPlayerReady(true);
        });

        if (!tutorial) {
            Promise.all([
                Midi.fromUrl(link),
                fetch(starttijdenLink).then(res => res.text()),
                fetch(durationsLink).then(res => res.text())
            ]).then(([midi, starttijdenText, durationsText]) => {
                const handmatigeTijden = starttijdenText.trim().split('\n').map(regel => parseFloat(regel.replace(',', '.')));
                const durations = durationsText.trim().split('\n').map(regel => parseFloat(regel.replace(',', '.')));

                const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
                const rawNotes = track.notes.filter(n => n.duration > 0.05);

                if (handmatigeTijden.length !== rawNotes.length || durations.length !== rawNotes.length) {
                    console.error("Aantal handmatige tijden of duur komt niet overeen met aantal noten.");
                    setIsMidiReady(false);
                    return;
                }

                const firstNoteStartTime = rawNotes.length > 0 ? handmatigeTijden[0] : 0;
                partijOffset.current = firstNoteStartTime;

                const timeSignatures = [...midi.header.timeSignatures].sort((a, b) => a.ticks - b.ticks);

                setNoteGroups(rawNotes.filter(n => n.duration > 0.05).map((note, i) => {
                    const activeSig = timeSignatures.reduce((prev, curr) => {
                        return (curr.ticks <= note.ticks) ? curr : prev;
                    }, timeSignatures[0]);

                    const num: number = activeSig.timeSignature[0];
                    const den: number = activeSig.timeSignature[1];

                    // Bereken de maat-lengte voor deze specifieke maatsoort
                    const ticksPerMeasure: number = midi.header.ppq * ((num * 4) / den);

                    // Bereken of de noot op het begin van een maat valt ten opzichte van 
                    // de start-tick van de huidige maatsoort-sectie
                    const relativeTicks: number = note.ticks - activeSig.ticks;
                    const isFirst: boolean = (relativeTicks % ticksPerMeasure) < 10;
                    return {
                        time: handmatigeTijden[i] !== undefined ? handmatigeTijden[i] - firstNoteStartTime : 0,
                        duration: Math.max(durations[i], 0.03),
                        weergaveNaam: getSaxNootNaam(note.midi + transposition),
                        klinkendeNaam: note.name,
                        velocity: note.velocity,
                        id: `note-${i}-${partij}`,
                        firstBeat: isFirst
                    }
                }));
                setIsMidiReady(true);
                console.log("Testmodus");

            });

        } else {
            Midi.fromUrl(link).then(midi => {
                const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
                const rawNotes = track.notes.filter(n => n.duration > 0.05);
                const firstNoteStartTime = rawNotes.length > 0 ? rawNotes[0].time : 0;
                partijOffset.current = firstNoteStartTime;

                const timeSignatures = [...midi.header.timeSignatures].sort((a, b) => a.ticks - b.ticks);

                setNoteGroups(rawNotes.filter(n => n.duration > 0.05).map((note, i) => {
                    const activeSig = timeSignatures.reduce((prev, curr) => {
                        return (curr.ticks <= note.ticks) ? curr : prev;
                    }, timeSignatures[0]);

                    const num: number = activeSig.timeSignature[0];
                    const den: number = activeSig.timeSignature[1];

                    // Bereken de maat-lengte voor deze specifieke maatsoort
                    const ticksPerMeasure: number = midi.header.ppq * ((num * 4) / den);

                    // Bereken of de noot op het begin van een maat valt ten opzichte van 
                    // de start-tick van de huidige maatsoort-sectie
                    const relativeTicks: number = note.ticks - activeSig.ticks;
                    const isFirst: boolean = (relativeTicks % ticksPerMeasure) < 10;
                    return {
                        time: note.time - firstNoteStartTime,
                        duration: Math.max(note.duration, 0.03),
                        weergaveNaam: getSaxNootNaam(note.midi + transposition),
                        klinkendeNaam: note.name,
                        velocity: note.velocity,
                        id: `note-${i}-${partij}`,
                        firstBeat: isFirst
                    }
                }));
                setIsMidiReady(true);
                console.log("Tutorial modus");
                console.log("partijOffset:", partijOffset.current);
            });

        }
    }, [partij, tutorial]);

    const animate = useCallback(() => {
        const media = videoRef.current || audioRef.current;
        if (!media || !isPlaying || !player) return;
        const currentTime = media.currentTime - partijOffset.current /*- OFFSET*/;
        //console.log("videoTime:", media.currentTime);
        const hitZonePixelPos = window.innerHeight * (HIT_ZONE_Y_PERCENT / 100);

        if (ui === 1) {
            blockRefs.current.forEach((block, i) => {
                if (block) {
                    const noteTime = parseFloat(block.getAttribute('data-time') || "0");
                    const y = hitZonePixelPos - (noteTime - currentTime) * PIXELS_PER_SECOND;
                    block.style.transform = `translate(-50%, ${y}px)`;
                    block.style.display = (y < -2000 || y > window.innerHeight + 500) ? 'none' : 'flex';
                }
            });
        }

        // We zoeken alle noten die "nu" bezig zijn of "binnenkort" (PRE_HIT_MARGIN) beginnen
        const candidateIndices = noteGroups.reduce((acc, n, i) => {
            const isInside = currentTime >= n.time && currentTime <= (n.time + n.duration);
            const isUpcoming = currentTime < n.time && currentTime >= n.time - PRE_HIT_MARGIN;

            if (isInside || isUpcoming) acc.push(i);
            return acc;
        }, [] as number[]);

        let nowNoteIndex = -1;
        if (candidateIndices.length > 0) {
            // We pakken de noot waarvan de starttijd (n.time) het dichtst bij de huidige tijd ligt
            nowNoteIndex = candidateIndices.reduce((prev, curr) => {
                const prevDiff = Math.abs(noteGroups[prev].time - currentTime);
                const currDiff = Math.abs(noteGroups[curr].time - currentTime);
                return currDiff < prevDiff ? curr : prev;
            });
        }

        /* Oude logica voor het bepalen van de huidige noot
        const nowNoteIndex = noteGroups.findIndex(n =>
            (currentTime >= n.time && currentTime <= (n.time + n.duration)) ||
            (currentTime < n.time && currentTime >= n.time - PRE_HIT_MARGIN)
        );
        */

        if (isKeyDown.current && !hasPlayedCurrentNote.current && nowNoteIndex !== -1) {
            const note = noteGroups[nowNoteIndex];
            const canPlay = forgiveness === 'high' || Math.abs(currentTime - note.time) <= FORGIVENESS_MARGIN;
            if (canPlay && !hasPlayedCurrentNote.current) {
                if (activeNoteEvent.current) {
                    activeNoteEvent.current.stop();
                    activeNoteEvent.current = null;
                }
                activeNoteEvent.current = player.play(note.klinkendeNaam, audioContext.current!.currentTime, { gain: gain });
                currentNoteIndexRef.current = nowNoteIndex;
                hasPlayedCurrentNote.current = true;
                setCorrectNoteId(note.id);
            } else if (!canPlay && currentTime < note.time) {
                hasPlayedCurrentNote.current = true;
            }
        }

        if (activeNoteEvent.current) {
            const currentNote = noteGroups[currentNoteIndexRef.current];
            if (!currentNote || currentTime > (currentNote.time + currentNote.duration) || !isKeyDown.current || nowNoteIndex === -1) {
                activeNoteEvent.current.stop();
                activeNoteEvent.current = null;
                setCorrectNoteId(null);
            }
        }
        requestRef.current = requestAnimationFrame(animate);
    }, [videoRef, audioRef, isPlaying, noteGroups, player, forgiveness, ui, PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT, /*OFFSET,*/ partijOffset, gain]);

    const startTutorialMusic = (url: string) => {
        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setIsPlaying(false);
        }
        audioRef.current.volume = 0.30;
        initAudio();
        audioRef.current.currentTime = START_TIJD_TUTORIAL;

        audioRef.current.play().then(() => {
            setIsPlaying(true);
        }).catch(err => {
            console.error("Fout bij afspelen audio:", err);
        });
    };

    const resetPlayer = useCallback(() => {
        const media = videoRef.current || audioRef.current;
        if (media) {
            media.pause();
            if (audioRef.current) {
                media.currentTime = START_TIJD_TUTORIAL;
            } else {
                media.currentTime = 0;
            }
        }
        setIsPlaying(false);
        // Reset refs voor de animatie
        currentNoteIndexRef.current = -1;
        hasPlayedCurrentNote.current = false;
        if (activeNoteEvent.current) {
            activeNoteEvent.current.stop();
            activeNoteEvent.current = null;
        }
        setCorrectNoteId(null);
    }, [videoRef, audioRef]);

    useEffect(() => {
        if (isPlaying) requestRef.current = requestAnimationFrame(animate);
        else if (requestRef.current) cancelAnimationFrame(requestRef.current);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, animate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                initAudio();
                isKeyDown.current = true;
                setActiveKeys(new Set([0]));
                const pressId = feedbackIdRef.current++;
                setButtonPresses(prev => [...prev, { id: pressId }]);
                setTimeout(() => setButtonPresses(prev => prev.filter(p => p.id !== pressId)), 600);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                isKeyDown.current = false;
                hasPlayedCurrentNote.current = false;
                currentNoteIndexRef.current = -1;
                setActiveKeys(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    return {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, blockRefs, activeKeys, buttonPresses,
        PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT, correctNoteId,
        startTutorialMusic, resetPlayer,
        partijOffset: partijOffset.current, /*OFFSET*/
    };
};

export default useMusicPlayer;