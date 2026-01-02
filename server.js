// server.js
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ CSP: erlaubt deine lokalen Dateien + WebSocket + Bilder + Audio
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",                 // kein inline script nötig
      "style-src 'self' 'unsafe-inline'",  // CSS ok (unsafe-inline nur für style)
      "img-src 'self' data:",
      "font-src 'self' data:",
      "media-src 'self'",                  // mp3
      "connect-src 'self' ws: wss:",       // WebSocket
    ].join("; ")
  );
  next();
});

// ✅ Static files (host.html/board.html/style.css/script.js usw.)
// Wenn du alles im Root liegen hast: __dirname
app.use(express.static(__dirname));

// Fallback: Root -> host.html (optional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ server });

// ✅ letzer Snapshot wird gespeichert
let lastSnapshot = null;

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // snapshot speichern
    if (msg.type === "snapshot") {
      lastSnapshot = msg;
    }

    // request_state beantworten
    if (msg.type === "request_state" && lastSnapshot) {
      try {
        socket.send(JSON.stringify(lastSnapshot));
      } catch {}
      return;
    }

    // an alle broadcasten
    const payload = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch {}
      }
    });
  });

  // Bei Connect: snapshot schicken, falls vorhanden
  if (lastSnapshot) {
    try {
      socket.send(JSON.stringify(lastSnapshot));
    } catch {}
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
