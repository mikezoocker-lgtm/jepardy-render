import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** ✅ CSP FIX (nicht mehr default-src 'none') */
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "media-src 'self'",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; ")
  );
  next();
});

/** ✅ Static Files (host.html, board.html, script.js, style.css, logo.png, etc.) */
app.use(express.static(__dirname));

/** ✅ Root-URL: zeige Host als Startseite */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

/** Optional: kein Favicon -> 204 statt Fehlversuch */
app.get("/favicon.ico", (req, res) => res.status(204).end());

/** ✅ WS Snapshot */
let lastSnapshot = null;

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "snapshot") lastSnapshot = msg.payload || null;

    // Broadcast
    const out = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(out);
    });

    // State request
    if (msg.type === "request_state" && lastSnapshot) {
      socket.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
