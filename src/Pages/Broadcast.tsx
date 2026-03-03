import React, { useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io(); // change to ngrok URL if needed

interface BroadcastProps {
    onBack: () => void;
}

const Broadcast: React.FC<BroadcastProps> = ({ onBack }) => {
    const videoRef = useRef<HTMLVideoElement>(null);       // preview video
    const fileVideoRef = useRef<HTMLVideoElement | null>(null); // MP4 video
    const canvasRef = useRef<HTMLCanvasElement>(null);     // canvas for capture
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
        source.connect(audioContext.destination);

        await videoEl.play(); // must play first

        const ctx = canvas.getContext("2d")!;
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;

        // Draw video to canvas continuously
        const draw = () => {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const id = requestAnimationFrame(draw);
            setAnimationFrame(id);
        };
        draw();

        // Capture MediaStream from canvas
        // Capture stream from canvas (30 fps)
        const stream = (canvas as any).captureStream(30) as MediaStream;

        // Add audio track from video (if supported)


        destination.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
            stream.addTrack(track);
        });

        console.log(stream.getTracks());

        // Set preview video
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
        <div style={{ padding: 20 }}>
            <h1>Broadcast</h1>

            {!streaming && (
                <button onClick={startBroadcast}>Start Broadcasting MP4</button>
            )}
            {streaming && (
                <button onClick={stopBroadcast}>Stop Broadcast</button>
            )}

            {/* Offscreen MP4 video */}
            <video

                ref={fileVideoRef}
                src="/sample.mp4"
                muted={false}       // must be unmuted to capture audio
                playsInline
                style={{
                    position: "absolute",
                    top: "-9999px",
                    left: "-9999px",
                }}

            />

            {/* Canvas for capturing video */}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Preview video */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: 600, marginTop: 20 }}
            />

            <br />
            <button onClick={onBack} style={{ marginTop: 20 }}>
                Back
            </button>
        </div>
    );
};

export default Broadcast;