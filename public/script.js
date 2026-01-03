/*************************************************
 * JEOPARDY – HOST/BOARD MULTIPLAYER (WebSocket)
 * - Host baut/steuert, Boards schauen & buzzern
 * - Timer: 30s pro Versuch (außer Soundtracks)
 * - Buzz Window: 5s zum Buzzern (visuell)
 * - Antwort wird NUR durch Host "Antwort zeigen" eingeblendet
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
    for (const msg of wsQueue) ws.send(msg);
    wsQueue = [];
    emitSync({ type: "request_state" });
  });

  ws.addEventListener("message", (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    syncHandlers.forEach((fn) => fn(msg));
  });

  ws.addEventListener("close", () => {
    wsReady = false;
    setTimeout(connectWS, 900);
  });
}

function emitSync(obj) {
  const raw = JSON.stringify(obj);
  if (wsReady && ws && ws.readyState === WebSocket.OPEN) ws.send(raw);
  else wsQueue.push(raw);
}

function onSync(cb) {
  syncHandlers.push(cb);
}

connectWS();

/* =========================
   Client ID (Boards)
========================= */
const urlParams = new URLSearchParams(location.search);
const tabParam = urlParams.get("p");

const CLIENT_ID_KEY = "jeopardy_client_id_tab_v4";
function getClientId() {
  if (tabParam) return `tab_${tabParam}`;
  let id = "";
  try {
    id = sessionStorage.getItem(CLIENT_ID_KEY) || "";
  } catch {}
  if (!id) {
    id =
      globalThis.crypto?.randomUUID?.() ||
      `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    try {
      sessionStorage.setItem(CLIENT_ID_KEY, id);
    } catch {}
  }
  return id;
}
const clientId = getClientId();

/* =========================
   Timings
========================= */
const QUESTION_TIMER_MS = 30000; // 30s pro Versuch (Main + ausgewählter Buzzer)
const BUZZ_WINDOW_MS = 5000; // 5s Buzz-Fenster
const TICK_MS = 100;

/* =========================
   GAME DATA (bleibt im Script)
========================= */
let gameData = {
  categories: [
    {
      name: "Gemink",
      clues: [
        {
          value: 100,
          q: "Wie heißt das Taschenmonster-Spiel, das 1999 in Deutschland erschien?",
          a: "Pokémon",
        },
        { value: 200, q: "Wie hieß das erste Battlefield?", a: "Battlefield 1942" },
        {
          value: 300,
          q: "Welches Rollenspiel begann 2004 und gilt als eines der erfolgreichsten MMOs aller Zeiten?",
          a: "World of Warcraft",
        },
        { value: 400, q: "Welches Tag ist semantisch für die Hauptüberschrift gedacht?", a: "<h1>" },
        {
          value: 500,
          q: "Wie heißt der Hexer mit den weißen Haaren aus einer polnischen RPG-Reihe?",
          a: "Geralt von Riva",
        },
      ],
    },
    {
      name: "Kennzeichen",
      clues: [
        { value: 100, q: "Stadt B?", a: "Berlin" },
        { value: 200, q: "Land: CZ?", a: "Tschechien" },
        { value: 300, q: "Stadt: FF?", a: "Frankfurt Oder" },
        { value: 400, q: "Stadt HGR?", a: "Hansestadt Greifswald" },
        { value: 500, q: "Land: CY?", a: "Zypern" },
      ],
    },
    {
      name: "Allgemein",
      clues: [
        { value: 100, q: "Wie oft wurde Deutschland Fußball-Weltmeister?", a: "4-mal" },
        { value: 200, q: "Wie heißt der erste Pickup-Truck vin Tesla?", a: "Cybertruck" },
        {
          value: 300,
          q: "Wie ist der Begriff für Geiseln, die Verständis für ihre Entführer haben?",
          a: "Stockholm-Syndrom",
        },
        { value: 400, q: "Was rief Archimedes, als er in der Badewanne den Auftrieb entdeckte", a: "Heureka" },
        { value: 500, q: "Was war das erste Gemüse, das im Weltall angepflanzt und geerntet wurde?", a: "Salat / roter Römersalat" },
      ],
    },
    {
      name: "Wer oder Was ist das?",
      clues: [
        { value: 100, img: "Bilder/1.jpg", a: "DuelDisk aus Yu-gi-Oh" },
        { value: 200, img: "Bilder/2.png", a: "Lux" },
        { value: 300, img: "Bilder/3.jpg", a: "Beyblade" },
        { value: 400, img: "Bilder/4.png", a: "Agumon (Digimon)" },
        { value: 500, img: "Bilder/5.jpg", a: "Zonk" },
      ],
    },
    {
      name: "Abkürzungen",
      clues: [
        { value: 100, q: "Was heißt GmbH?", a: "Gesellschaft mit beschränkter Haftung" },
        { value: 200, q: "Was heißt ROFL?", a: "Rolling on the Floor Laughing" },
        { value: 300, q: "Was heißt KFC?", a: "Kentucky Fried Chicken" },
        { value: 400, q: "Was heißt IGL?", a: "In Game Leader" },
        { value: 500, q: "Was bedeutet B.A.?", a: "Bachelor of Arts" },
      ],
    },
    {
      name: "Soundtracks",
      clues: [
        { value: 100, audio: "audio/1.mp3", a: "Pokemon" },
        { value: 200, audio: "audio/2.mp3", a: "Schloss Einstein" },
        { value: 300, audio: "audio/3.mp3", a: "Friends" },
        { value: 400, audio: "audio/4.mp3", a: "Finger Tips" },
        { value: 500, audio: "audio/5.mp3", a: "Hör mal wer da hämmert!" },
      ],
    },
    {
      name: "Morph",
      clues: [
        { value: 100, img: "morph/1.png", a1: "morph/1a.jpeg", a2: "morph/1b.jpg" },
        { value: 200, img: "morph/2.png", a1: "morph/2a.jpg", a2: "morph/2b.jpg" },
        { value: 300, img: "morph/3.png", a1: "morph/3a.jpg", a2: "morph/3b.jpeg" },
        { value: 400, img: "morph/4.png", a1: "morph/4a.jpeg", a2: "morph/4b.jpg" },
        { value: 500, img: "morph/5.png", a1: "morph/5a.jpg", a2: "morph/5b.png" },
      ],
    },
    {
      name: "Zurück in die Schule",
      clues: [
        { value: 100, q: "Mathe: Wie viel Grad hat ein gestreckter Winkel?", a: "180°" },
        { value: 200, q: "Chemie: Welche Abkürzung hat Eisen im Periodensystem?", a: "Fe" },
        { value: 300, q: "Deutsch: Wie nennt man die Grundform eines Verbs?", a: "Infinitiv" },
        { value: 400, q: "Biologie: Welcher Teil der Pflanze ist für die Photosynthese hauptverantwortlich?", a: "Die Blätter (und die darin enthaltenen Chloroplasten)" },
        { value: 500, q: "Englisch: Welche Zeitform drückt eine Handlung aus, die in der Zukunft abgeschlossen sein wird?", a: "Future Perfect" },
      ],
    },
  ],
};

/* =========================
   DOM
========================= */
const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const turnPill = document.getElementById("turnPill");

const playersEl = document.getElementById("players");
const resetBtn = document.getElementById("resetBtn");

const modalCategory = document.getElementById("modalCategory");
const modalValue = document.getElementById("modalValue");
const modalQuestion = document.getElementById("modalQuestion");
const modalAnswer = document.getElementById("modalAnswer");

const revealBtn = document.getElementById("revealBtn");
const rightBtn = document.getElementById("rightBtn");
const wrongBtn = document.getElementById("wrongBtn");
const closeBtn = document.getElementById("closeBtn");

// Endscreen
const endOverlay = document.getElementById("endOverlay");
const podiumEl = document.getElementById("podium");
const endCloseBtn = document.getElementById("endCloseBtn");
const endNewGameBtn = document.getElementById("endNewGameBtn");

// Join (Board)
const joinBtnEl = document.getElementById("joinBtn");
const joinNameEl = document.getElementById("joinName");

/* =========================
   State
========================= */
const used = new Set();
let players = []; // {id, name, score}
let activePlayerIndex = 0;

let current = null; // current question state

let currentAudio = null;

let tickInterval = null;

const TOTAL_CLUES = gameData.categories.reduce(
  (s, c) => s + (c.clues?.length || 0),
  0
);

/* =========================
   Helpers
========================= */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function halfPoints(v) {
  return Math.floor((v || 0) / 2);
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}
function getActivePlayer() {
  return players[activePlayerIndex] || null;
}
function getPlayerById(id) {
  return players.find((p) => p.id === id) || null;
}
function isSoundtracksCategory(ci) {
  const name = (gameData.categories?.[ci]?.name || "").toLowerCase();
  return name.includes("soundtrack");
}

function renderTurn() {
  if (!turnPill) return;
  const p = getActivePlayer();
  turnPill.textContent = p ? `${p.name} ist dran!` : "Warte auf Spieler…";
}

/* =========================
   Audio (Host local)
========================= */
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
   Snapshot Sync
========================= */
function getSnapshot() {
  return {
    used: Array.from(used),
    players,
    activePlayerIndex,
    current,
    overlays: {
      questionOpen: overlay?.classList?.contains("show") || false,
      endOpen: endOverlay?.classList?.contains("show") || false,
    },
  };
}

function syncSnapshot() {
  if (!isHost) return;
  emitSync({ type: "snapshot", payload: getSnapshot() });
}

function applySnapshot(s) {
  if (!s) return;

  used.clear();
  (s.used || []).forEach((k) => used.add(k));

  players = Array.isArray(s.players) ? s.players : [];
  activePlayerIndex = Number.isInteger(s.activePlayerIndex)
    ? s.activePlayerIndex
    : 0;

  current = s.current || null;

  renderPlayers();
  renderTurn();
  buildBoard();

  if (overlay) {
    if (s.overlays?.questionOpen && current) {
      const clue = gameData.categories[current.ci]?.clues?.[current.qi];
      if (clue) {
        fillModalFromClue(clue, gameData.categories[current.ci].name, clue.value);
        overlay.classList.add("show");

        setAnswerVisible(!!current.revealed);
        renderBuzzerUI();
        renderTimerUI();
        updateHostButtons();

        // ✅ wichtig: Board tick wieder starten
        startTickLoop();
      }
    } else {
      overlay.classList.remove("show");
      stopAudio();
      stopTick();
    }
  }

  if (endOverlay) {
    if (s.overlays?.endOpen) showEndScoreboard();
    else hideEndScoreboard();
  }
}

/* =========================
   Players UI
========================= */
function renderPlayers() {
  if (!playersEl) return;
  playersEl.innerHTML = "";

  players.forEach((p, idx) => {
    const card = document.createElement("div");
    card.className = "playerCard" + (idx === activePlayerIndex ? " active" : "");

    const top = document.createElement("div");
    top.className = "playerTop";

    if (isHost) {
      const nameInput = document.createElement("input");
      nameInput.value = p.name;
      nameInput.addEventListener("click", (e) => e.stopPropagation());
      nameInput.addEventListener("input", () => {
        p.name = nameInput.value.trim() || p.name || `Spieler ${idx + 1}`;
        renderTurn();
        syncSnapshot();
      });
      top.appendChild(nameInput);

      card.title = "Klicken: als aktiven Spieler setzen";
      card.addEventListener("click", () => {
        activePlayerIndex = clamp(idx, 0, players.length - 1);
        renderPlayers();
        renderTurn();
        syncSnapshot();
      });
    } else {
      const nameEl = document.createElement("div");
      nameEl.style.fontWeight = "900";
      nameEl.style.padding = "8px 10px";
      nameEl.style.border = "1px solid rgba(255,255,255,.14)";
      nameEl.style.borderRadius = "10px";
      nameEl.textContent = p.name + (p.id === clientId ? " (Du)" : "");
      top.appendChild(nameEl);
    }

    const scoreEl = document.createElement("div");
    scoreEl.className = "playerScore";
    scoreEl.textContent = p.score;

    top.appendChild(scoreEl);
    card.appendChild(top);
    playersEl.appendChild(card);
  });
}

/* =========================
   Board UI
========================= */
function buildBoard() {
  if (!board) return;
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${gameData.categories.length}, 1fr)`;

  gameData.categories.forEach((cat) => {
    const c = document.createElement("div");
    c.className = "cat";
    c.textContent = cat.name;
    board.appendChild(c);
  });

  const rows = Math.max(...gameData.categories.map((c) => c.clues.length));

  for (let i = 0; i < rows; i++) {
    gameData.categories.forEach((cat, ci) => {
      const tile = document.createElement("div");
      tile.className = "tile";
      const key = `${ci}-${i}`;
      const clue = cat.clues[i];

      if (!clue) {
        tile.classList.add("used");
        tile.textContent = "";
        tile.style.cursor = "default";
      } else if (used.has(key)) {
        tile.classList.add("used");
        tile.textContent = "—";
        tile.style.cursor = "default";
      } else {
        tile.textContent = clue.value;
        if (isHost) tile.onclick = () => openQuestion(ci, i);
        else tile.style.cursor = "default";
      }

      board.appendChild(tile);
    });
  }
}

/* =========================
   Modal layout helpers
========================= */
function ensureTimerElement() {
  if (!modalQuestion) return null;
  let el = document.getElementById("timerArea");
  if (el) return el;

  el = document.createElement("div");
  el.id = "timerArea";
  el.className = "timerArea";
  modalQuestion.parentElement?.appendChild(el);
  return el;
}

function ensureAnswerLayout() {
  if (!modalAnswer) return null;
  modalAnswer.innerHTML = `
    <div id="buzzerArea" class="buzzerArea"></div>
    <div id="answerContent" class="answerContent"></div>
  `;
  return {
    buzzerArea: document.getElementById("buzzerArea"),
    answerContent: document.getElementById("answerContent"),
  };
}

function setAnswerVisible(visible) {
  const content = document.getElementById("answerContent");
  if (!content) return;
  content.style.display = visible ? "block" : "none";

  if (!modalAnswer) return;
  if (visible || (current && current.phase === "buzzer")) modalAnswer.classList.add("show");
  else modalAnswer.classList.remove("show");
}

function fillModalFromClue(clue, categoryName, value) {
  if (modalCategory) modalCategory.textContent = categoryName || "Kategorie";
  if (modalValue) modalValue.textContent = value ?? clue.value ?? 0;

  if (modalQuestion) {
    if (clue.img) {
      modalQuestion.innerHTML = `<img src="${clue.img}" alt="Fragebild" class="whoImg">`;
    } else if (clue.audio) {
      modalQuestion.innerHTML = `
        <div class="questionText">🎵 Soundtrack</div>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="playTrackBtn">▶ Abspielen</button>
        </div>
      `;
    } else {
      modalQuestion.textContent = clue.q ?? "";
    }
  }

  ensureTimerElement();
  const layout = ensureAnswerLayout();
  if (!layout) return;

  const answerContent = layout.answerContent;

  if (clue.a1 && clue.a2) {
    answerContent.innerHTML = `
      <div class="morphAnswer">
        <img src="${clue.a1}" alt="Original 1">
        <img src="${clue.a2}" alt="Original 2">
      </div>
    `;
  } else {
    answerContent.textContent = "Antwort: " + (clue.a ?? "");
  }

  setAnswerVisible(false);

  // Play button (host/board local)
  const playBtn = document.getElementById("playTrackBtn");
  if (playBtn && clue.audio) {
    playBtn.onclick = () => playAudio(clue.audio);
  }
}

/* =========================
   Timer handling
========================= */
function startAttemptTimer() {
  if (!isHost || !current) return;
  if (isSoundtracksCategory(current.ci)) {
    current.timerUntil = null;
    return;
  }
  current.timerUntil = Date.now() + QUESTION_TIMER_MS;
}

function stopAttemptTimer() {
  if (!current) return;
  current.timerUntil = null;
}

function renderTimerUI() {
  const el = document.getElementById("timerArea");
  if (!el) return;

  if (!current) {
    el.textContent = "";
    return;
  }

  if (isSoundtracksCategory(current.ci)) {
    el.textContent = "";
    return;
  }

  if (!current.timerUntil || current.revealed) {
    el.textContent = "";
    return;
  }

  const left = Math.max(0, current.timerUntil - Date.now());
  el.textContent = `⏱️ ${(left / 1000).toFixed(1).replace(".", ",")}s`;
}

/* =========================
   Tick loop
========================= */
function startTickLoop() {
  stopTick();
  tickInterval = setInterval(() => {
    if (!current) return;

    renderTimerUI();
    renderBuzzCountdownUI();

    if (isHost) {
      // 30s Versuch abgelaufen -> zählt als falsch (Main oder Buzzer)
      if (current.timerUntil && Date.now() >= current.timerUntil && !current.revealed) {
        handleAttemptTimeout();
      }

      // Buzz-Window abgelaufen -> nur sperren (keine Antwort auto)
      if (
        current.phase === "buzzer" &&
        current.buzzWindowUntil &&
        Date.now() >= current.buzzWindowUntil &&
        !current.buzzWindowExpired &&
        !current.buzzLocked
      ) {
        expireBuzzWindowLockOnly();
      }
    }
  }, TICK_MS);
}

function stopTick() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

function handleAttemptTimeout() {
  if (!isHost || !current) return;

  if (current.phase === "main") {
    answerMain(false, true);
  } else if (current.phase === "buzzer") {
    answerBuzzer(false, true);
  }
}

/* =========================
   Buzz window
========================= */
function startBuzzWindow() {
  if (!isHost || !current) return;

  current.buzzLocked = false;       // Buzz erlaubt
  current.buzzWindowExpired = false;
  current.buzzWindowUntil = Date.now() + BUZZ_WINDOW_MS;

  // Wichtig: in Buzz-Phase läuft kein 30s Timer, solange niemand ausgewählt ist
  stopAttemptTimer();

  renderBuzzerUI();
  renderTimerUI();
  updateHostButtons();
  syncSnapshot();
}

function expireBuzzWindowLockOnly() {
  if (!isHost || !current) return;

  current.buzzWindowExpired = true;
  current.buzzWindowUntil = null;

  // Buzz sperren
  current.buzzLocked = true;
  current.buzzerActiveId = null;

  stopAttemptTimer();

  // Antwort bleibt verborgen
  current.revealed = false;
  setAnswerVisible(false);

  renderBuzzerUI();
  renderTimerUI();
  updateHostButtons();
  syncSnapshot();
}

/* =========================
   Host button state
========================= */
function updateHostButtons() {
  if (!isHost) return;

  if (!current) {
    if (revealBtn) revealBtn.disabled = true;
    if (rightBtn) rightBtn.disabled = true;
    if (wrongBtn) wrongBtn.disabled = true;
    return;
  }

  // Reveal immer möglich (aber du willst’s nur wenn nötig; trotzdem ok)
  if (revealBtn) revealBtn.disabled = false;

  if (current.phase === "main") {
    if (rightBtn) rightBtn.disabled = false;
    if (wrongBtn) wrongBtn.disabled = false;
    return;
  }

  // buzzer phase
  const hasActive = !!current.buzzerActiveId;
  if (rightBtn) rightBtn.disabled = !hasActive;
  if (wrongBtn) wrongBtn.disabled = !hasActive;
}

/* =========================
   Flow / Scoring
========================= */
function addScoreByPlayerId(pid, delta) {
  const p = getPlayerById(pid);
  if (!p) return;
  p.score += delta;
  renderPlayers();
}

function nextPlayer() {
  if (players.length === 0) return;
  activePlayerIndex = (activePlayerIndex + 1) % players.length;
  renderPlayers();
  renderTurn();
}

function endQuestionAndAdvance() {
  stopAudio();
  stopTick();

  if (overlay) overlay.classList.remove("show");

  current = null;
  buildBoard();

  if (used.size >= TOTAL_CLUES) {
    showEndScoreboard();
    syncSnapshot();
    return;
  }

  nextPlayer();
  syncSnapshot();
}

function openQuestion(ci, qi) {
  if (!isHost) return;

  const clue = gameData.categories[ci].clues[qi];
  const key = `${ci}-${qi}`;
  if (!clue || used.has(key)) return;

  const mainPlayerId = getActivePlayer()?.id || null;

  current = {
    ci,
    qi,
    key,
    phase: "main",
    revealed: false,

    // main player darf nicht buzzern
    mainPlayerId,

    // buzzer state
    buzzLocked: false,
    buzzed: {},          // {playerId:true}
    buzzQueue: [],       // Reihenfolge
    buzzerActiveId: null,

    // buzz window
    buzzWindowUntil: null,
    buzzWindowExpired: false,

    // attempt timer (30s)
    timerUntil: null,

    ...clue,
  };

  stopAudio(); // kein auto-play bei open

  fillModalFromClue(clue, gameData.categories[ci].name, clue.value);

  // 30s nur wenn nicht Soundtracks
  startAttemptTimer();

  renderTimerUI();
  renderBuzzerUI();
  updateHostButtons();

  if (overlay) overlay.classList.add("show");
  startTickLoop();
  syncSnapshot();
}

function closeModal() {
  if (!isHost) return;
  if (!current) return;

  // ✅ beim X schließen: Frage gilt als benutzt und wird vom Board genommen
  used.add(current.key);

  endQuestionAndAdvance();
}

function revealAnswer() {
  if (!isHost || !current) return;

  stopAttemptTimer();
  current.revealed = true;

  setAnswerVisible(true);
  renderTimerUI();
  renderBuzzerUI();
  updateHostButtons();

  syncSnapshot();
}

function answerMain(correct, fromTimeout = false) {
  if (!isHost || !current) return;

  const v = current.value || 0;
  const mainId = current.mainPlayerId;

  stopAttemptTimer();

  if (correct) {
    if (mainId) addScoreByPlayerId(mainId, v);

    // Antwort zeigen (host + boards)
    current.revealed = true;
    setAnswerVisible(true);
    syncSnapshot();

    // Frage als benutzt & weiter
    used.add(current.key);
    setTimeout(() => endQuestionAndAdvance(), 800);
    return;
  }

  // falsch: - halbe Punkte
  if (mainId) addScoreByPlayerId(mainId, -halfPoints(v));

  // Buzzer-Phase starten
  current.phase = "buzzer";
  current.revealed = false;

  current.buzzed = {};
  current.buzzQueue = [];
  current.buzzerActiveId = null;

  current.buzzWindowExpired = false;
  current.buzzWindowUntil = null;
  current.buzzLocked = false;

  setAnswerVisible(false);

  // Buzz Window (5s)
  startBuzzWindow();
}

function answerBuzzer(correct, fromTimeout = false) {
  if (!isHost || !current) return;

  const v = current.value || 0;
  const pid = current.buzzerActiveId;
  if (!pid) return;

  stopAttemptTimer();

  if (correct) {
    addScoreByPlayerId(pid, halfPoints(v));

    // Antwort zeigen (host + boards)
    current.revealed = true;
    setAnswerVisible(true);
    syncSnapshot();

    used.add(current.key);
    setTimeout(() => endQuestionAndAdvance(), 800);
    return;
  }

  // falsch: - halbe Punkte
  addScoreByPlayerId(pid, -halfPoints(v));

  // aktuellen aus Queue entfernen
  current.buzzQueue = (current.buzzQueue || []).filter((x) => x !== pid);

  // nächsten aus Queue automatisch auswählen
  const nextId = current.buzzQueue[0] || null;

  if (nextId) {
    current.buzzerActiveId = nextId;
    current.buzzLocked = true;       // gesperrt für andere, nur ausgewählter darf
    current.buzzWindowUntil = null;  // window beendet
    current.buzzWindowExpired = true; // kein erneutes Buzz-Window

    // neuer 30s Versuch für den nächsten (außer Soundtracks)
    startAttemptTimer();

    renderBuzzerUI();
    renderTimerUI();
    updateHostButtons();
    syncSnapshot();
    return;
  }

  // niemand mehr: Buzz endgültig sperren, Host kann nur noch "Antwort zeigen" oder X
  current.buzzerActiveId = null;
  current.buzzLocked = true;
  current.buzzWindowUntil = null;
  current.buzzWindowExpired = true;

  renderBuzzerUI();
  renderTimerUI();
  updateHostButtons();
  syncSnapshot();
}

/* =========================
   Buzzer UI
========================= */
function renderBuzzCountdownUI() {
  const el = document.getElementById("buzzCountdown");
  if (!el) return;

  if (
    !current ||
    current.phase !== "buzzer" ||
    current.buzzLocked ||
    current.buzzWindowExpired ||
    !current.buzzWindowUntil
  ) {
    el.textContent = "";
    return;
  }

  const left = Math.max(0, current.buzzWindowUntil - Date.now());
  el.textContent = `Buzz-Zeit: ${(left / 1000).toFixed(1).replace(".", ",")}s`;
}

function renderBuzzerUI() {
  if (!current) return;

  const area = document.getElementById("buzzerArea");
  if (!area) return;

  area.innerHTML = "";

  if (current.phase !== "buzzer") return;

  if (modalAnswer) modalAnswer.classList.add("show");

  // ===== HOST VIEW =====
  if (isHost) {
    const queue = current.buzzQueue || [];
    const activeId = current.buzzerActiveId;

    const listHtml = queue.length
      ? queue
          .map((pid, idx) => {
            const p = getPlayerById(pid);
            const name = p ? p.name : pid;
            const active = pid === activeId;
            return `
              <button class="buzzerPick ${active ? "active" : ""}" data-pid="${escapeHtml(pid)}">
                ${idx + 1}. ${escapeHtml(name)}
              </button>
            `;
          })
          .join("")
      : `<span class="buzzerEmpty">Noch niemand gebuzzert…</span>`;

    const statusLine = (() => {
      if (current.buzzLocked && activeId) {
        const name = getPlayerById(activeId)?.name || activeId;
        return `Aktiv: <b>${escapeHtml(name)}</b> (30s laufen)`;
      }
      if (!current.buzzLocked && current.buzzWindowUntil && !current.buzzWindowExpired) {
        return `Warte auf Buzz…`;
      }
      if (current.buzzWindowExpired && !activeId) {
        return `Buzz-Zeit vorbei. Du kannst jetzt „Antwort zeigen“.`;
      }
      return `—`;
    })();

    area.innerHTML = `
      <div class="buzzerHint">Buzz-Reihenfolge (klicken zum Auswählen)</div>
      <div class="buzzerCountdown" id="buzzCountdown"></div>
      <div class="buzzerList">${listHtml}</div>
      <div class="buzzerCurrent">${statusLine}</div>
    `;

    area.querySelectorAll(".buzzerPick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pid = btn.getAttribute("data-pid");
        if (!pid) return;

        // Auswählen -> sperren, 30s starten
        current.buzzerActiveId = pid;
        current.buzzLocked = true;
        current.buzzWindowUntil = null;
        current.buzzWindowExpired = true; // kein neues Window mehr

        startAttemptTimer();

        renderBuzzerUI();
        renderTimerUI();
        updateHostButtons();
        syncSnapshot();
      });
    });

    renderBuzzCountdownUI();
    return;
  }

  // ===== BOARD VIEW =====
  const myPlayer = getPlayerById(clientId);

  if (!myPlayer) {
    area.innerHTML = `
      <div class="buzzerHint">🔔 BUZZERN!</div>
      <div class="buzzerEmpty">Du musst erst beitreten.</div>
    `;
    return;
  }

  // aktiver main-player darf NICHT buzzern
  const isMainTurnPlayer = current.mainPlayerId && clientId === current.mainPlayerId;
  if (isMainTurnPlayer) {
    area.innerHTML = `
      <div class="buzzerHint">🚫 Du bist dran</div>
      <div class="buzzerLocked">Der aktive Spieler darf nicht buzzern.</div>
    `;
    return;
  }

  // wenn gesperrt und jemand aktiv
  if (current.buzzLocked && current.buzzerActiveId && clientId !== current.buzzerActiveId) {
    area.innerHTML = `
      <div class="buzzerHint">🔒 Gesperrt</div>
      <div class="buzzerLocked">
        ${escapeHtml(getPlayerById(current.buzzerActiveId)?.name || "Ein Spieler")} ist dran.
      </div>
    `;
    return;
  }

  // wenn ich aktiv
  if (current.buzzLocked && current.buzzerActiveId && clientId === current.buzzerActiveId) {
    area.innerHTML = `
      <div class="buzzerHint">✅ DU bist dran!</div>
      <div class="buzzerLocked">Warte auf Host (Richtig/Falsch)…</div>
    `;
    return;
  }

  // wenn buzz-window vorbei
  if (current.buzzWindowExpired || !current.buzzWindowUntil) {
    area.innerHTML = `
      <div class="buzzerHint">⏱️ Buzz-Zeit vorbei</div>
      <div class="buzzerLocked">Buzzern ist gesperrt.</div>
    `;
    return;
  }

  const already = !!current.buzzed?.[clientId];

  area.innerHTML = `
    <div class="buzzerHint">🔔 BUZZERN! (pro Frage nur 1×)</div>
    <div class="buzzerCountdown" id="buzzCountdown"></div>
    <button class="btn buzzerBtn" id="buzzBtn" ${already ? "disabled" : ""}>
      ${already ? "Schon gebuzzert" : "BUZZ!"}
    </button>
  `;

  const buzzBtn = document.getElementById("buzzBtn");
  if (buzzBtn && !already) {
    buzzBtn.addEventListener(
      "click",
      () => {
        emitSync({ type: "buzz", payload: { id: clientId } });
      },
      { once: true }
    );
  }

  renderBuzzCountdownUI();
}

/* =========================
   Endscreen
========================= */
function showEndScoreboard() {
  if (!endOverlay || !podiumEl) return;

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  while (top3.length < 3) top3.push({ id: "—", name: "—", score: 0 });

  const order = [
    { player: top3[1], rank: 2 },
    { player: top3[0], rank: 1 },
    { player: top3[2], rank: 3 },
  ];

  podiumEl.innerHTML = order
    .map(
      ({ player, rank }) => `
      <div class="podiumSlot rank${rank}">
        <div class="podiumRank">Platz ${rank}</div>
        <p class="podiumName">${escapeHtml(player.name)}</p>
        <div class="podiumScore">${player.score} Punkte</div>
      </div>
    `
    )
    .join("");

  endOverlay.classList.add("show");
  endOverlay.setAttribute("aria-hidden", "false");
}

function hideEndScoreboard() {
  if (!endOverlay) return;
  endOverlay.classList.remove("show");
  endOverlay.setAttribute("aria-hidden", "true");
}

function resetGame() {
  if (!isHost) return;

  hideEndScoreboard();
  used.clear();

  stopAudio();
  stopTick();

  if (overlay) overlay.classList.remove("show");
  current = null;

  players = players.map((p) => ({ ...p, score: 0 }));
  activePlayerIndex = 0;

  renderPlayers();
  renderTurn();
  buildBoard();
  syncSnapshot();
}

/* =========================
   Sync Listener
========================= */
onSync((msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === "snapshot") {
    if (!isHost) applySnapshot(msg.payload);
    return;
  }

  if (msg.type === "request_state") {
    if (isHost) syncSnapshot();
    return;
  }

  // Host verarbeitet join/buzz
  if (!isHost) return;

  if (msg.type === "join") {
    const { id, name } = msg.payload || {};
    if (!id) return;

    const safeName = String(name || "").trim() || `Spieler ${players.length + 1}`;
    const existing = getPlayerById(id);

    if (existing) existing.name = safeName;
    else players.push({ id, name: safeName, score: 0 });

    if (players.length === 1) activePlayerIndex = 0;

    renderPlayers();
    renderTurn();
    syncSnapshot();
    return;
  }

  if (msg.type === "buzz") {
    if (!current || current.phase !== "buzzer") return;

    // nur während Buzz-Window & nicht gesperrt
    if (current.buzzLocked) return;
    if (current.buzzWindowExpired) return;
    if (!current.buzzWindowUntil) return;
    if (Date.now() > current.buzzWindowUntil) return;

    const pid = msg.payload?.id;
    if (!pid) return;
    if (!getPlayerById(pid)) return;

    // main player darf nicht buzzern
    if (current.mainPlayerId && pid === current.mainPlayerId) return;

    // pro frage nur 1x
    if (current.buzzed?.[pid]) return;

    current.buzzed[pid] = true;
    current.buzzQueue.push(pid);

    renderBuzzerUI();
    syncSnapshot();
    return;
  }
});

/* =========================
   Buttons (Host)
========================= */
if (isHost) {
  if (revealBtn) revealBtn.onclick = revealAnswer;

  if (rightBtn)
    rightBtn.onclick = () => {
      if (!current) return;
      if (current.phase === "main") answerMain(true);
      else answerBuzzer(true);
    };

  if (wrongBtn)
    wrongBtn.onclick = () => {
      if (!current) return;
      if (current.phase === "main") answerMain(false);
      else answerBuzzer(false);
    };

  if (closeBtn) closeBtn.onclick = closeModal;

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  if (resetBtn) resetBtn.onclick = resetGame;

  if (endCloseBtn)
    endCloseBtn.onclick = () => {
      hideEndScoreboard();
      syncSnapshot();
    };

  if (endNewGameBtn) endNewGameBtn.onclick = resetGame;

  if (endOverlay) {
    endOverlay.addEventListener("click", (e) => {
      if (e.target === endOverlay) {
        hideEndScoreboard();
        syncSnapshot();
      }
    });
  }
}

/* =========================
   Join UI (Board)
========================= */
if (!isHost) {
  function doJoin() {
    const name = (joinNameEl?.value || "").trim();
    if (!name) return;

    emitSync({ type: "join", payload: { id: clientId, name } });

    if (joinBtnEl) joinBtnEl.disabled = true;
    if (joinNameEl) joinNameEl.disabled = true;
  }

  if (joinBtnEl) joinBtnEl.addEventListener("click", doJoin);

  if (joinNameEl) {
    joinNameEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doJoin();
    });

    joinNameEl.addEventListener("input", () => {
      if (joinBtnEl) joinBtnEl.disabled = false;
      if (joinNameEl) joinNameEl.disabled = false;
    });
  }
}

/* =========================
   Start
========================= */
renderPlayers();
renderTurn();
buildBoard();
startTickLoop();
if (isHost) syncSnapshot();
