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

const getSaxNootNaam = (midiNumber: number): string => {
    const namen = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];
    return namen[midiNumber % 12];
};

export const useMusicEngine = (partij: 'melodie' | 'achtergrond') => {
    const [player, setPlayer] = useState<Player | null>(null);
    const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);
    const [isReady, setIsReady] = useState(false);
    const audioContext = useRef<AudioContext | null>(null);

    const initAudio = () => {
        if (!audioContext.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContext.current = new AudioContextClass();
        }
        if (audioContext.current.state === 'suspended') audioContext.current.resume();
    };

    useEffect(() => {
        setIsReady(false);
        const link = partij === 'melodie' ? "/scores/How_to_train_your_dragon-soprano.mid" : "/scores/How_to_train_your_dragon-bariton.mid";
        const instName: InstrumentName = partij === 'melodie' ? 'soprano_sax' : 'baritone_sax';
        const transposition = partij === 'melodie' ? -2 : -3;

        initAudio();

        Promise.all([
            Soundfont.instrument(audioContext.current!, instName, { soundfont: 'MusyngKite' }),
            Midi.fromUrl(link)
        ]).then(([inst, midi]) => {
            const track = midi.tracks.find(t => t.notes.length > 0) || midi.tracks[0];
            const groups = track.notes.filter(n => n.duration > 0.05).map((note, i) => ({
                time: note.time,
                duration: Math.max(note.duration - 0.03, 0.03),
                weergaveNaam: getSaxNootNaam(note.midi + transposition),
                klinkendeNaam: note.name,
                velocity: note.velocity,
                id: `note-${i}-${partij}`
            }));

            setPlayer(inst);
            setNoteGroups(groups);
            setIsReady(true);
        });
    }, [partij]);

    return { player, noteGroups, isReady, audioContext: audioContext.current, initAudio };
};