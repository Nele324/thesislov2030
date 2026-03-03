import React, { useRef, useState } from "react";
import { io } from "socket.io-client";
import "../css/App.css"; // 👈 add this

const socket = io();

interface BroadcastProps {
    onBack: () => void;
}

const Broadcast: React.FC<BroadcastProps> = ({ onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileVideoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
    const [streaming, setStreaming] = useState(false);
    const [animationFrame, setAnimationFrame] = useState<number | null>(null);

    const startBroadcast = async () => {
        if (!fileVideoRef.current || !videoRef.current || !canvasRef.current) return;

        const videoEl = fileVideoRef.current;
        const canvas = canvasRef.current;

        const audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaElementSource(videoEl);
        const destination = audioContext.createMediaStreamDestination();

        source.connect(destination);

        await videoEl.play();

        const ctx = canvas.getContext("2d")!;
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;

        const draw = () => {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const id = requestAnimationFrame(draw);
            setAnimationFrame(id);
        };
        draw();

        const stream = (canvas as any).captureStream(30) as MediaStream;

        destination.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
            stream.addTrack(track);
        });

        if (videoRef.current) videoRef.current.srcObject = stream;

        socket.emit("broadcaster");

        socket.on("watcher", async (id: string) => {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            peerConnections.current[id] = pc;

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit("offer", id, offer);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("candidate", id, event.candidate);
                }
            };
        });

        socket.on("answer", (id: string, description: any) => {
            peerConnections.current[id]?.setRemoteDescription(description);
        });

        socket.on("candidate", (id: string, candidate: any) => {
            peerConnections.current[id]?.addIceCandidate(new RTCIceCandidate(candidate));
        });

        setStreaming(true);
    };

    const stopBroadcast = () => {
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};
        socket.connect();
        setStreaming(false);

        if (animationFrame) cancelAnimationFrame(animationFrame);

        if (fileVideoRef.current) {
            fileVideoRef.current.pause();
            fileVideoRef.current.currentTime = 0;
        }
    };

    return (
        <div className="App">
            <header className="App-header">

                <h2>Broadcast Mode</h2>

                {!streaming && (
                    <div style={{ marginTop: 20 }}>
                        <button onClick={startBroadcast}>
                            Start Broadcasting MP4
                        </button>
                    </div>
                )}

                {streaming && (
                    <div style={{ marginTop: 20 }}>
                        <button onClick={stopBroadcast}>
                            Stop Broadcast
                        </button>
                    </div>
                )}

                {/* Preview video */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: 600, marginTop: 30 }}
                />

                <div style={{ marginTop: 30 }}>
                    <button onClick={onBack}>
                        Back
                    </button>
                </div>

                {/* Offscreen MP4 video */}
                <video
                    ref={fileVideoRef}
                    src="/sample.mp4"
                    muted={false}
                    playsInline
                    style={{
                        position: "absolute",
                        top: "-9999px",
                        left: "-9999px",
                    }}
                />

                {/* Canvas for capturing video */}
                <canvas ref={canvasRef} style={{ display: "none" }} />

            </header>
        </div>
    );
};

export default Broadcast;