import React, { useRef, useState } from "react";
import io from "socket.io-client";

const socket = io(); // change later to ngrok URL

const Broadcast = ({ onBack }: { onBack: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
    const streamRef = useRef<MediaStream | null>(null);
    const [started, setStarted] = useState(false);

    const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    const handleStartStreaming = async () => {
        // 1️⃣ Create/resume AudioContext (fix Tone.js warning)
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        await audioCtx.resume();

        // 2️⃣ Capture camera + mic
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // 3️⃣ Notify server you are broadcaster
        socket.emit("broadcaster");

        // 4️⃣ Handle new viewers
        socket.on("watcher", async (id: string) => {
            const pc = new RTCPeerConnection(config);
            peerConnections.current[id] = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", id, pc.localDescription);

            pc.onicecandidate = event => {
                if (event.candidate) socket.emit("candidate", id, event.candidate);
            };
        });

        socket.on("answer", (id: string, description: any) => {
            peerConnections.current[id]?.setRemoteDescription(description);
        });

        socket.on("candidate", (id: string, candidate: any) => {
            peerConnections.current[id]?.addIceCandidate(new RTCIceCandidate(candidate));
        });

        setStarted(true);
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>Broadcast</h1>
            {!started && (
                <button onClick={handleStartStreaming}>Start Streaming (Camera + Audio)</button>
            )}
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ marginTop: 20, width: 600 }}
            />
            <br />
            <button onClick={onBack} style={{ marginTop: 20 }}>
                Back
            </button>
        </div>
    );
};

export default Broadcast;