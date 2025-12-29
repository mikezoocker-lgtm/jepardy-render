const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_, res) => res.redirect("/host.html"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Wir merken uns den letzten Snapshot (vom Host)
let lastSnapshot = null;

function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(raw);
  });
}

wss.on("connection", (ws) => {
  // Wenn ein Client verbindet und wir haben schon einen Snapshot -> direkt schicken
  if (lastSnapshot) {
    ws.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
  }

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // 1) Host schickt Snapshot -> speichern + an alle broadcasten
    if (msg.type === "snapshot") {
      lastSnapshot = msg.payload || null;
      broadcast({ type: "snapshot", payload: lastSnapshot });
      return;
    }

    // 2) Jeder Client kann aktuellen State anfordern -> zurückschicken
    if (msg.type === "request_state") {
      if (lastSnapshot) {
        ws.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
      }
      return;
    }

    // 3) ALLE anderen Messages (join, buzz, etc.) an alle weiterleiten
    //    => Host kann sie verarbeiten und danach Snapshot senden
    broadcast(msg);
  });
});

server.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});
