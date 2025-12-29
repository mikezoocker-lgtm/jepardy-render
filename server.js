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

/* ===== GAME STATE (SERVER IST WAHRHEIT) ===== */
let game = {
  players: [],           // {id, name, score}
  currentQuestion: null, // {value, phase, buzzedIds, activeBuzzer}
};

/* ===== HELPERS ===== */
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
}

/* ===== WS ===== */
wss.on("connection", (ws) => {

  // Beim Verbinden kompletten State schicken
  ws.send(JSON.stringify({ type: "state", payload: game }));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    /* JOIN */
    if (msg.type === "join") {
      if (!game.players.find(p => p.id === msg.id)) {
        game.players.push({ id: msg.id, name: msg.name, score: 0 });
        broadcast("state", game);
      }
    }

    /* HOST ÖFFNET FRAGE */
    if (msg.type === "open_question") {
      game.currentQuestion = {
        value: msg.value,
        phase: "main",
        buzzedIds: [],
        activeBuzzer: null
      };
      broadcast("state", game);
    }

    /* HOST: HAUPTFRAGE RICHTIG/FALSCH */
    if (msg.type === "main_answer") {
      const player = game.players.find(p => p.id === msg.playerId);
      if (player) {
        player.score += msg.correct ? msg.value : -Math.floor(msg.value / 2);
      }
      game.currentQuestion.phase = msg.correct ? "done" : "buzzer";
      broadcast("state", game);
    }

    /* BUZZER */
    if (msg.type === "buzz") {
      const q = game.currentQuestion;
      if (!q || q.phase !== "buzzer") return;
      if (!q.buzzedIds.includes(msg.playerId)) {
        q.buzzedIds.push(msg.playerId);
        q.activeBuzzer = msg.playerId;
        broadcast("state", game);
      }
    }

    /* BUZZER ANTWORT */
    if (msg.type === "buzzer_answer") {
      const p = game.players.find(p => p.id === msg.playerId);
      if (!p) return;

      p.score += msg.correct
        ? Math.floor(game.currentQuestion.value / 2)
        : -Math.floor(game.currentQuestion.value / 2);

      game.currentQuestion.activeBuzzer = null;
      broadcast("state", game);
    }
  });
});

server.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});