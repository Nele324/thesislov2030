import React, { useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io();

const Watch = ({ onBack }: { onBack: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pc = useRef<RTCPeerConnection | null>(null);

    const config = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };

    useEffect(() => {
        socket.emit("watcher");

        socket.on("offer", async (id: string, description: any) => {
            pc.current = new RTCPeerConnection(config);

            pc.current.ontrack = event => {
                if (videoRef.current) videoRef.current.srcObject = event.streams[0];
            };

            await pc.current.setRemoteDescription(description);

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            socket.emit("answer", id, pc.current.localDescription);

            pc.current.onicecandidate = event => {
                if (event.candidate) socket.emit("candidate", id, event.candidate);
            };
        });

        socket.on("candidate", (_id: string, candidate: any) => {
            pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <div>
            <h1>Watching Stream</h1>
            <video ref={videoRef} autoPlay playsInline controls width={600} />
            <br />
            <button onClick={onBack}>Back</button>
        </div>
    );
};

export default Watch;
