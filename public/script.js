/*************************************************
 * JEOPARDY – MULTIPLAYER SCRIPT (SERVER-BASED)
 * Host + Board über WebSocket
 *************************************************/

const isHost = document.body.dataset.role === "host";

/* =======================
   WebSocket Verbindung
======================= */
const WS_URL =
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host;

let ws;
let state = null;

function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "state") {
      state = msg.payload;
      render();
    }
  };

  ws.onclose = () => {
    setTimeout(connectWS, 1000);
  };
}

connectWS();

function send(type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

/* =======================
   Client / Spieler
======================= */
const clientId = crypto.randomUUID();
let clientName = "";

/* =======================
   JOIN (Board)
======================= */
const joinBtn = document.getElementById("joinBtn");
if (joinBtn) {
  joinBtn.onclick = () => {
    const input = document.getElementById("nameInput");
    if (!input) return;

    clientName = input.value.trim();
    if (!clientName) return;

    send("join", {
      id: clientId,
      name: clientName,
    });

    joinBtn.disabled = true;
    input.disabled = true;
  };
}

/* =======================
   HOST – Frage öffnen
======================= */
window.openQuestion = function (value) {
  if (!isHost) return;
  send("open_question", { value });
};

/* =======================
   HOST – Hauptfrage bewerten
======================= */
window.answerMain = function (correct, playerId, value) {
  if (!isHost) return;
  send("main_answer", {
    playerId,
    correct,
    value,
  });
};

/* =======================
   BUZZER
======================= */
window.buzz = function () {
  if (!state || !state.currentQuestion) return;
  if (state.currentQuestion.phase !== "buzzer") return;

  send("buzz", {
    playerId: clientId,
  });
};

/* =======================
   HOST – Buzzer Antwort
======================= */
window.answerBuzzer = function (correct) {
  if (!isHost) return;
  const q = state.currentQuestion;
  if (!q || !q.activeBuzzer) return;

  send("buzzer_answer", {
    playerId: q.activeBuzzer,
    correct,
  });
};

/* =======================
   RENDER
======================= */
function render() {
  if (!state) return;

  renderPlayers();
  renderBuzzer();
}

/* =======================
   Spieler anzeigen
======================= */
function renderPlayers() {
  const el = document.getElementById("players");
  if (!el) return;

  el.innerHTML = "";

  state.players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "playerRow";
    div.textContent = `${p.name} – ${p.score}`;
    el.appendChild(div);
  });
}

/* =======================
   Buzzer UI
======================= */
function renderBuzzer() {
  const area = document.getElementById("buzzerArea");
  if (!area) return;

  area.innerHTML = "";

  const q = state.currentQuestion;
  if (!q) return;

  /* Board */
  if (!isHost) {
    if (q.phase !== "buzzer") {
      area.innerHTML = `<div class="buzzerHint">⏳ Warten…</div>`;
      return;
    }

    if (q.activeBuzzer && q.activeBuzzer !== clientId) {
      const active = state.players.find(p => p.id === q.activeBuzzer);
      area.innerHTML = `<div class="buzzerLocked">🔒 ${active?.name || "Ein Spieler"} ist dran</div>`;
      return;
    }

    if (q.activeBuzzer === clientId) {
      area.innerHTML = `<div class="buzzerActive">🔥 DU bist dran!</div>`;
      return;
    }

    const btn = document.createElement("button");
    btn.className = "btn btnPrimary";
    btn.textContent = "BUZZ!";
    btn.onclick = buzz;
    area.appendChild(btn);
  }

  /* Host */
  if (isHost && q.phase === "buzzer") {
    const info = document.createElement("div");
    info.textContent = q.activeBuzzer
      ? "Buzzer gewählt"
      : "Warte auf Buzz…";
    area.appendChild(info);
  }
}
