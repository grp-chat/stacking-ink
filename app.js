require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { createDrawSession } = require("./drawsession");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const drawSession = createDrawSession(io);

app.use(express.static(path.join(__dirname, "client")));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  drawSession.registerSocket(socket);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`stacking-ink listening on http://localhost:${PORT}`);
});