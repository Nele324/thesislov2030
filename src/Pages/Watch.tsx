import React, { useEffect, useRef } from "react";
import io from "socket.io-client";
import "../css/App.css"; // 👈 same styling as App

const socket = io();

const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const Watch = ({ onBack }: { onBack: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const pc = useRef<RTCPeerConnection | null>(null);


    useEffect(() => {
        socket.emit("watcher");

        const handleOffer = async (id: string, description: any) => {
            pc.current = new RTCPeerConnection(config);

            pc.current.ontrack = event => {
                if (videoRef.current) {
                    videoRef.current.srcObject = event.streams[0];
                }
            };

            await pc.current.setRemoteDescription(description);

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            socket.emit("answer", id, pc.current.localDescription);

            pc.current.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit("candidate", id, event.candidate);
                }
            };
        };

        const handleCandidate = (_id: string, candidate: any) => {
            if (candidate) {
                pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
            }
        };

        socket.on("offer", handleOffer);
        socket.on("candidate", handleCandidate);

        return () => {
            // cleanup: remove listeners, close peer connection, disconnect socket
            socket.off("offer", handleOffer);
            socket.off("candidate", handleCandidate);
            pc.current?.close();
            pc.current = null;
            socket.disconnect();
        };
    }, []);

    return (
        <div className="App">
            <header className="App-header">

                <h2>Watch Stream</h2>

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    controls
                    style={{ width: 600, marginTop: 30 }}
                />

                <div style={{ marginTop: 30 }}>
                    <button onClick={onBack}>
                        Back
                    </button>
                </div>

            </header>
        </div>
    );
};

export default Watch;