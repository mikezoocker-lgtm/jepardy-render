const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

// ✅ Statische Dateien aus /public ausliefern
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// optional: Root weiterleiten
app.get("/", (req, res) => {
  res.redirect("/host.html");
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ---- simple relay + last snapshot memory
let lastSnapshot = null;

function broadcast(obj) {
  const raw = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    // snapshot merken
    if (msg?.type === "snapshot") lastSnapshot = msg;

    // request_state -> snapshot zurück an den Anfragenden
    if (msg?.type === "request_state") {
      if (lastSnapshot) {
        try {
          socket.send(JSON.stringify(lastSnapshot));
        } catch {}
      }
      return;
    }

    // alle anderen Nachrichten relayn
    broadcast(msg);
  });

  // beim Connect sofort letzten Snapshot schicken (falls vorhanden)
  if (lastSnapshot) {
    try {
      socket.send(JSON.stringify(lastSnapshot));
    } catch {}
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
