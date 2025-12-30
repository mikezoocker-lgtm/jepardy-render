// server.js
// Minimaler Express + WebSocket Server (Render/GitHub geeignet)

const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(express.static(path.join(__dirname))); // served host.html, board.html, style.css, script.js, assets

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// letzter Snapshot (vom Host)
let lastSnapshot = null;

function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  });
}

wss.on("connection", (socket) => {
  socket.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    // Host sendet Snapshot -> speichern + broadcast
    if (msg?.type === "snapshot") {
      lastSnapshot = msg.payload || null;
      broadcast(msg);
      return;
    }

    // Client fragt State an -> antworten nur an diesen Client
    if (msg?.type === "request_state") {
      if (lastSnapshot) {
        socket.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
      }
      return;
    }

    // Alles andere einfach broadcasten (join, buzz, etc.)
    broadcast(msg);
  });
});

// Render nutzt PORT env
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
