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

let lastSnapshot = null;

/** CSP (nicht zu streng, aber Render-/Browser-sicher) */
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
    ].join("; ")
  );
  next();
});

/** Static files: host.html, board.html, style.css, script.js, logo.png, audio/, Bilder/, morph/ ... */
app.use(express.static(__dirname));

/** Root = Host */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

/** kein Favicon = 204 */
app.get("/favicon.ico", (req, res) => res.status(204).end());

wss.on("connection", (socket) => {
  // Beim Connect: optional Snapshot sofort schicken (wenn vorhanden)
  if (lastSnapshot) {
    socket.send(JSON.stringify({ type: "snapshot", payload: lastSnapshot }));
  }

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "snapshot") lastSnapshot = msg.payload || null;

    const out = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(out);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server listening on", PORT));
