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

// ✅ Static-Folder (STANDARD)
const PUBLIC_DIR = path.join(__dirname, "public");

/** ✅ CSP (nicht zu streng, aber sicher) */
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

// ✅ Statische Dateien aus /public ausliefern
app.use(express.static(PUBLIC_DIR));

/** ✅ Root -> Host */
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "host.html"));
});

/** ✅ Optional: Shortcuts */
app.get("/host", (req, res) => res.redirect("/host.html"));
app.get("/board", (req, res) => res.redirect("/board.html"));

/** ✅ Favicon nicht erzwingen */
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

    // Broadcast an alle
    const out = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(out);
    });

    // State request (nur an den Anfragenden)
    if (msg.type === "request_state" && lastSnapshot) {
      socket.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
