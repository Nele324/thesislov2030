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
    const OFFSET = 4.8;
    const FORGIVENESS_MARGIN = 0.15;

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
        let transposition = partij === 'melodie' ? -2 : -3;

        initAudio();
        Soundfont.instrument(audioContext.current!, instName, { soundfont: 'MusyngKite' }).then(inst => {
            setPlayer(inst);
            setIsPlayerReady(true);
        });

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
    }, [partij]);

    const animate = useCallback(() => {
        if (!videoRef.current || !isPlaying || !player) return;
        const currentTime = videoRef.current.currentTime - partijOffset.current - OFFSET;
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

        const nowNoteIndex = noteGroups.findIndex(n => currentTime >= n.time && currentTime <= (n.time + n.duration));

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
    }, [isPlaying, noteGroups, player, forgiveness, ui]);

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

    return {
        isPlayerReady, isMidiReady, isPlaying, setIsPlaying,
        noteGroups, blockRefs, activeKeys, buttonPresses,
        PIXELS_PER_SECOND, HIT_ZONE_Y_PERCENT, correctNoteId,
        partijOffset: partijOffset.current, OFFSET
    };
};