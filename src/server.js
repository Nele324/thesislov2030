const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, "..", "build")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let broadcaster = null;

io.on("connection", socket => {

    console.log("user connected", socket.id);

    socket.on("broadcaster", () => {
        broadcaster = socket.id;
        socket.broadcast.emit("broadcaster");
    });

    socket.on("watcher", () => {
        if (broadcaster)
            io.to(broadcaster).emit("watcher", socket.id);
    });

    socket.on("offer", (id, message) => {
        io.to(id).emit("offer", socket.id, message);
    });

    socket.on("answer", (id, message) => {
        io.to(id).emit("answer", socket.id, message);
    });

    socket.on("candidate", (id, message) => {
        io.to(id).emit("candidate", socket.id, message);
    });

    socket.on("disconnect", () => {
        socket.broadcast.emit("disconnectPeer", socket.id);
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, "..", "build", "index.html"));
});

server.listen(3001, () => console.log("signaling server running"));
