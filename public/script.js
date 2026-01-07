/*************************************************
 * JEOPARDY – HOST/BOARD MULTIPLAYER (WebSocket)
 *************************************************/

const ROLE = (document.body?.dataset?.role || "host").toLowerCase();
const isHost = ROLE === "host";

/* =========================
   WebSocket
========================= */
const WS_URL =
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host;

let ws = null;
let wsReady = false;
let wsQueue = [];
let syncHandlers = [];

function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    wsReady = true;
    wsQueue.forEach(m => ws.send(m));
    wsQueue = [];
    emitSync({ type: "request_state" });
  });

  ws.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    syncHandlers.forEach(fn => fn(msg));
  });

  ws.addEventListener("close", () => {
    wsReady = false;
    setTimeout(connectWS, 1000);
  });
}

function emitSync(obj) {
  const raw = JSON.stringify(obj);
  if (wsReady && ws.readyState === WebSocket.OPEN) ws.send(raw);
  else wsQueue.push(raw);
}

function onSync(fn) { syncHandlers.push(fn); }

connectWS();

/* =========================
   IDs
========================= */
const params = new URLSearchParams(location.search);
const tabParam = params.get("p");

const CLIENT_ID_KEY = "jeopardy_client_id_v1";
function getClientId() {
  if (tabParam) return "tab_" + tabParam;
  let id = sessionStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}
const clientId = getClientId();

/* =========================
   Timings
========================= */
const QUESTION_TIMER_MS = 30000;
const BUZZ_WINDOW_MS = 5000;
const TICK_MS = 100;

/* =========================
   Audio (HOST ONLY)
========================= */
let currentAudio = null;

function stopAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
}

function playAudio(src) {
  stopAudio();
  currentAudio = new Audio(src);
  currentAudio.play().catch(() => {});
}

/* =========================
   GAME DATA
========================= */
let gameData = window.gameData; // bleibt wie bei dir

/* =========================
   DOM
========================= */
const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const modalQuestion = document.getElementById("modalQuestion");
const modalCategory = document.getElementById("modalCategory");
const modalValue = document.getElementById("modalValue");
const modalAnswer = document.getElementById("modalAnswer");
const revealBtn = document.getElementById("revealBtn");
const rightBtn = document.getElementById("rightBtn");
const wrongBtn = document.getElementById("wrongBtn");
const closeBtn = document.getElementById("closeBtn");

/* =========================
   STATE
========================= */
const used = new Set();
let players = [];
let activePlayerIndex = 0;
let current = null;
let tickInterval = null;

/* =========================
   HELPERS
========================= */
function isSoundtrack(ci) {
  return gameData.categories[ci].name.toLowerCase().includes("soundtrack");
}

/* =========================
   OPEN QUESTION
========================= */
function openQuestion(ci, qi) {
  if (!isHost) return;

  const clue = gameData.categories[ci].clues[qi];
  const key = `${ci}-${qi}`;
  if (!clue || used.has(key)) return;

  stopAudio();

  current = {
    ci, qi, key,
    phase: "main",
    revealed: false,
    timerUntil: isSoundtrack(ci) ? null : Date.now() + QUESTION_TIMER_MS,
    ...clue
  };

  modalCategory.textContent = gameData.categories[ci].name;
  modalValue.textContent = clue.value;

  if (clue.img) {
    modalQuestion.innerHTML = `<img src="${clue.img}" class="whoImg">`;
  } else if (clue.audio) {
    modalQuestion.innerHTML = `<div>🎵 Soundtrack läuft…</div>`;

    // ✅ AUTO-PLAY BEIM ÖFFNEN
    playAudio(clue.audio);
  } else {
    modalQuestion.textContent = clue.q;
  }

  modalAnswer.textContent = "Antwort: " + (clue.a ?? "");
  modalAnswer.classList.remove("show");

  overlay.classList.add("show");
  startTick();
  syncSnapshot();
}

/* =========================
   TIMER
========================= */
function startTick() {
  stopTick();
  tickInterval = setInterval(() => {
    if (!current || !current.timerUntil) return;
    if (Date.now() >= current.timerUntil) {
      current.timerUntil = null;
    }
  }, TICK_MS);
}

function stopTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

/* =========================
   ANSWERS
========================= */
function revealAnswer() {
  if (!isHost || !current) return;
  modalAnswer.classList.add("show");
  syncSnapshot();
}

function closeModal() {
  if (!isHost || !current) return;
  used.add(current.key);
  stopAudio();
  stopTick();
  overlay.classList.remove("show");
  current = null;
  syncSnapshot();
}

/* =========================
   BUTTONS
========================= */
if (isHost) {
  revealBtn.onclick = revealAnswer;
  closeBtn.onclick = closeModal;
}

/* =========================
   SNAPSHOT SYNC
========================= */
function syncSnapshot() {
  emitSync({ type: "snapshot", payload: { used: [...used], current } });
}

onSync(msg => {
  if (msg.type !== "snapshot" || isHost) return;
  current = msg.payload.current;
  if (current) {
    overlay.classList.add("show");
    modalCategory.textContent = gameData.categories[current.ci].name;
    modalValue.textContent = current.value;
    modalQuestion.textContent = current.q || "";
    modalAnswer.textContent = "Antwort: " + (current.a ?? "");
    if (current.revealed) modalAnswer.classList.add("show");
  } else {
    overlay.classList.remove("show");
  }
});

/* =========================
   INIT
========================= */
buildBoard();
