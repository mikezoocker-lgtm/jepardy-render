// server.js (ESM)
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// =======================
// STATIC: alles aus /public
// =======================
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// optional (aber hilfreich): Root zeigt direkt host.html
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "host.html"));
});

// optional: explizite Routen (nicht nötig, aber klar)
app.get("/host.html", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "host.html")));
app.get("/board.html", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "board.html")));

// =======================
// WebSocket Relay + Snapshot
// =======================
let lastSnapshot = null;

wss.on("connection", (socket) => {
  // beim Connect: aktuellen Stand schicken (falls vorhanden)
  if (lastSnapshot) {
    try {
      socket.send(JSON.stringify(lastSnapshot));
    } catch {}
  }

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Snapshot merken (damit neue Boards sofort syncen)
    if (msg?.type === "snapshot") {
      lastSnapshot = msg;
    }

    // an alle Clients broadcasten
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(JSON.stringify(msg));
        } catch {}
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
