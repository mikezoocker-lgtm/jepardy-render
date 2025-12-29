const path = require("path");
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();

// Render: PORT kommt aus env (default 10000). :contentReference[oaicite:2]{index=2}
const PORT = process.env.PORT || 10000;

// 1) Statische Dateien aus /public serven
app.use(express.static(path.join(__dirname, "public")));

// Optional: Root weiterleiten
app.get("/", (req, res) => res.redirect("/host.html"));

const server = http.createServer(app);

// 2) WebSocket auf dem gleichen HTTP-Server (gleicher Port!)
const wss = new WebSocketServer({ server });

// Einfacher In-Memory-State (für 1 Spiel)
let snapshot = null;

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg?.type) return;

    // Board fragt State an
    if (msg.type === "request_state") {
      if (snapshot) ws.send(JSON.stringify({ type: "snapshot", payload: snapshot }));
      return;
    }

    // Host sendet neuen Snapshot -> speichern + an alle broadcasten
    if (msg.type === "snapshot") {
      snapshot = msg.payload || null;
      broadcast({ type: "snapshot", payload: snapshot });
      return;
    }

    // Alles andere (join/rename/buzz/whatever) -> an alle weiterleiten
    broadcast(msg);
  });

  // Beim Connect direkt Snapshot senden (falls vorhanden)
  if (snapshot) {
    ws.send(JSON.stringify({ type: "snapshot", payload: snapshot }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});