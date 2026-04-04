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
}

interface UseMusicPlayerProps {
    partij: 'melodie' | 'achtergrond';
    forgiveness: 'low' | 'high';
    ui: 1 | 2;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const useMusicPlayer = ({ partij, forgiveness, ui, videoRef }: UseMusicPlayerProps) => {
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
    const HIT_ZONE_Y_PERCENT = 85;
    //const OFFSET = 4.8;
    const FORGIVENESS_MARGIN = 0.15;
    const PRE_HIT_MARGIN = 0.2;

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
        let instName: InstrumentName = partij === 'melodie' ? 'soprano_sax' : 'baritone_sax';
        let transposition = partij === 'melodie' ? +2 : -3;

        initAudio();
        Soundfont.instrument(audioContext.current!, instName, { soundfont: 'MusyngKite' }).then(inst => {
            setPlayer(inst);
            setIsPlayerReady(true);
        });

        Promise.all([
            Midi.fromUrl(link),
            fetch('/Starttijden.txt').then(res => res.text()),
            fetch('/durations.txt').then(res => res.text())
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

            setNoteGroups(rawNotes.filter(n => n.duration > 0.05).map((note, i) => ({
                time: handmatigeTijden[i] !== undefined ? handmatigeTijden[i] - firstNoteStartTime : 0,
                duration: Math.max(durations[i], 0.03),
                weergaveNaam: getSaxNootNaam(note.midi + transposition),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}-${partij}`
            })));
            setIsMidiReady(true);
        });

        /*
        Midi.fromUrl(link).then(midi => {
            const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
            const rawNotes = track.notes.filter(n => n.duration > 0.05);
            const firstNoteStartTime = rawNotes.length > 0 ? rawNotes[0].time : 0;
            partijOffset.current = firstNoteStartTime;
            setNoteGroups(rawNotes.filter(n => n.duration > 0.05).map((note, i) => ({
                time: note.time - firstNoteStartTime,
                duration: Math.max(note.duration, 0.03),
                weergaveNaam: getSaxNootNaam(note.midi + transposition),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}-${partij}`
            })));
            setIsMidiReady(true);
        });
        */
    }, [partij]);

    const animate = useCallback(() => {
        if (!videoRef.current || !isPlaying || !player) return;
        const currentTime = videoRef.current.currentTime - partijOffset.current /*- OFFSET*/;
        console.log("videoTime:", videoRef.current.currentTime);
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
            if (canPlay && currentNoteIndexRef.current !== nowNoteIndex) {
                activeNoteEvent.current = player.play(note.klinkendeNaam, audioContext.current!.currentTime, { gain: 0.5 });
                currentNoteIndexRef.current = nowNoteIndex;
                hasPlayedCurrentNote.current = true;
                setCorrectNoteId(note.id);
            } else if (!canPlay) {
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
    }, [videoRef, isPlaying, noteGroups, player, forgiveness, ui, PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT, /*OFFSET,*/ partijOffset]);

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
                setActiveKeys(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const exportToExcel = () => {
        // 1. Maak de headers
        const headers = "Nootnaam;Duur (s);Starttijd (s)";

        // 2. Map de data naar rijen (gebruik ; als scheidingsteken voor Europese Excel)
        const rows = noteGroups.map(n => {
            const name = n.weergaveNaam;
            const duration = n.duration.toFixed(3).replace('.', ',');
            const startTime = (n.time + partijOffset.current).toFixed(4).replace('.', ',');
            return `${name};${duration};${startTime}`;
        }).join("\n");

        // 3. Combineer en log naar de console
        const csvContent = `${headers}\n${rows}`;
        console.log("--- KOPIEER DE ONDERSTAANDE DATA NAAR EXCEL ---");
        console.log(csvContent);
        console.log("----------------------------------------------");
    };
    // Roep dit bijvoorbeeld eenmalig aan zodra de MIDI klaar is
    useEffect(() => {
        if (isMidiReady && noteGroups.length > 0) {
            exportToExcel();
        }
    }, [isMidiReady, noteGroups]);

    return {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, blockRefs, activeKeys, buttonPresses,
        PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT, correctNoteId,
        partijOffset: partijOffset.current, /*OFFSET*/
    };
};

export default useMusicPlayer;