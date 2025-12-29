// ============================
// Host / Board Modus
// ============================
const ROLE = (document.body?.dataset?.role || "host").toLowerCase();
const isHost = ROLE === "host";

// ============================
// Sync (Host -> Board) über BroadcastChannel + localStorage Fallback
// (WICHTIG: funktioniert nur innerhalb desselben Browsers/Profils)
// ============================
const SYNC_KEY = "jeopardy_sync_v5";
let bc = null;
try { bc = new BroadcastChannel("jeopardy-sync"); } catch (_) {}

function emitSync(msg) {
  if (bc) bc.postMessage(msg);
  try { localStorage.setItem(SYNC_KEY, JSON.stringify({ ...msg, _ts: Date.now() })); } catch (_) {}
}

function onSync(cb) {
  if (bc) bc.addEventListener("message", (e) => cb(e.data));
  window.addEventListener("storage", (e) => {
    if (e.key !== SYNC_KEY || !e.newValue) return;
    try { cb(JSON.parse(e.newValue)); } catch (_) {}
  });
}

// ============================
// Client-ID & Name (TAB-unique) + URL Override (?p=1)
// Damit kannst du mehrere board-Tabs simulieren:
// board.html?p=1  / board.html?p=2  / board.html?p=3 ...
// ============================
const CLIENT_ID_KEY = "jeopardy_client_id_tab_v1";
const CLIENT_NAME_KEY = "jeopardy_client_name_tab_v1";

const urlParams = new URLSearchParams(location.search);
const tabParam = urlParams.get("p");

function getOrCreateClientIdTab() {
  if (tabParam) return `tab_${tabParam}`;

  let id = null;
  try { id = sessionStorage.getItem(CLIENT_ID_KEY); } catch (_) {}

  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() || `c_${Math.random().toString(16).slice(2)}_${Date.now()}`);
    try { sessionStorage.setItem(CLIENT_ID_KEY, id); } catch (_) {}
  }
  return id;
}

const clientId = getOrCreateClientIdTab();

let clientName = "";
try { clientName = sessionStorage.getItem(CLIENT_NAME_KEY) || ""; } catch (_) { clientName = ""; }

// ============================
// Game Data (dein Set)
// ============================
let gameData = {
  categories: [
    {
      name: "Gemink",
      clues: [
        { value: 100, q: "Wie heißt das Taschenmonster-Spiel, das 1999 in Deutschland erschien?", a: "Pokémon" },
        { value: 200, q: "Wie hieß das erste Battlefield?", a: "Battlefield 1942" },
        { value: 300, q: "Welches Rollenspiel begann 2004 und gilt als eines der erfolgreichsten MMOs aller Zeiten?", a: "World of Warcraft" },
        { value: 400, q: "Welches Tag ist semantisch für die Hauptüberschrift gedacht?", a: "<h1>" },
        { value: 500, q: "Wie heißt der Hexer mit den weißen Haaren aus einer polnischen RPG-Reihe?", a: "Geralt von Riva" },
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
        { value: 300, q: "Wie ist der Begriff für Geiseln, die Verständis für ihre Entführer haben?", a: "Stockholm-Syndrom" },
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
        { value: 200, q: "Was heißt ROFL", a: "Rolling on the Floor Laughing" },
        { value: 300, q: "Was heißt KFC", a: "Kentucky Fried Chicken" },
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
        { value: 100, q: "Mathe: Wie viel Grad hat ein gesteckter Winkel?", a: "180°" },
        { value: 200, q: "Chemie: Welche Abkürzung hat Eisen im Periodensystem ?", a: "Fe" },
        { value: 300, q: "Deutsch: Wie nennt man die Grundform eines Verbs?", a: "Infinitiv" },
        { value: 400, q: "Biologie: Welcher Teil der Pflanze ist für die Photosynthese hauptverantwortlich?", a: "Die Blätter (und die darin enthaltenen Chloroplasten)" },
        { value: 500, q: "Englisch: Welche Zeitform drückt eine Handlung aus, die in der Zukunft abgeschlossen sein wird?", a: "Future Perfect" },
      ],
    },
  ],
};

// ============================
// DOM
// ============================
const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const turnPill = document.getElementById("turnPill");

const playersEl = document.getElementById("players");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const removePlayerBtn = document.getElementById("removePlayerBtn");
const resetBtn = document.getElementById("resetBtn");

const modalCategory = document.getElementById("modalCategory");
const modalValue = document.getElementById("modalValue");
const modalQuestion = document.getElementById("modalQuestion");
const modalAnswer = document.getElementById("modalAnswer");

const revealBtn = document.getElementById("revealBtn");
const rightBtn = document.getElementById("rightBtn");
const wrongBtn = document.getElementById("wrongBtn");
const closeBtn = document.getElementById("closeBtn");

const endOverlay = document.getElementById("endOverlay");
const podiumEl = document.getElementById("podium");
const endCloseBtn = document.getElementById("endCloseBtn");
const endNewGameBtn = document.getElementById("endNewGameBtn");

const joinNameInput = document.getElementById("joinName");
const joinBtn = document.getElementById("joinBtn");

// ============================
// State
// ============================
const used = new Set();
let current = null;
let currentAudio = null;

let players = [];
let activePlayerIndex = 0;

const TOTAL_CLUES = gameData.categories.reduce((sum, c) => sum + (c.clues?.length || 0), 0);

// ============================
// Helpers
// ============================
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function getActivePlayer() { return players[activePlayerIndex] || null; }
function getPlayerById(id) { return players.find(p => p.id === id) || null; }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));
}
function halfPoints(v) { return Math.floor((v || 0) / 2); }

// ============================
// Audio
// ============================
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

// ============================
// Turn Anzeige
// ============================
function renderTurn() {
  if (!turnPill) return;
  const p = getActivePlayer();
  turnPill.textContent = p ? `${p.name} ist dran!` : "Warte auf Spieler…";
}

// ============================
// Modal Answer Layout (Buzzer + Answer getrennt)
// ============================
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
  const el = document.getElementById("answerContent");
  if (!el) return;
  el.style.display = visible ? "block" : "none";
}
function prepareAnswerContent(clue) {
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
}

// ============================
// Buzzer UI (mit Sperre nach Host-Auswahl)
// ============================
function renderBuzzerUI() {
  if (!current || !overlay?.classList?.contains("show")) return;

  const area = document.getElementById("buzzerArea");
  if (!area) return;

  area.innerHTML = "";

  if (current.phase !== "buzzer") return;

  // Buzzer-Phase zeigt die Answer-Box (damit Buzz-Bereich sichtbar ist)
  if (modalAnswer) modalAnswer.classList.add("show");

  // Board: Buzz Button / Lock Anzeige
  if (!isHost) {
    const myPlayer = getPlayerById(clientId);

    if (!myPlayer) {
      area.innerHTML = `
        <div class="buzzerHint">🔔 BUZZERN!</div>
        <div class="buzzerEmpty">Du musst erst beitreten, um buzzern zu können.</div>
      `;
      return;
    }

    // ✅ NEU: Wenn Host jemanden ausgewählt hat -> alle anderen sind gesperrt
    if (current.buzzLocked && current.buzzerActiveId && clientId !== current.buzzerActiveId) {
      area.innerHTML = `
        <div class="buzzerHint">🔒 Gesperrt</div>
        <div class="buzzerLocked">
          ${escapeHtml(getPlayerById(current.buzzerActiveId)?.name || "Ein Spieler")} ist dran.
        </div>
      `;
      return;
    }

    // ✅ NEU: ausgewählter Spieler bekommt "Du bist dran!"
    if (current.buzzLocked && current.buzzerActiveId && clientId === current.buzzerActiveId) {
      area.innerHTML = `
        <div class="buzzerHint">✅ DU bist dran!</div>
        <div class="buzzerLocked">Warte auf Host (Richtig/Falsch)…</div>
      `;
      return;
    }

    const already = !!current.buzzed?.[clientId];
    area.innerHTML = `
      <div class="buzzerHint">🔔 BUZZERN! (pro Frage nur 1×)</div>
      <button class="btn buzzerBtn" id="buzzBtn" ${already ? "disabled" : ""}>
        ${already ? "Schon gebuzzert" : "BUZZ!"}
      </button>
    `;

    const buzzBtn = document.getElementById("buzzBtn");
    if (buzzBtn && !already) {
      buzzBtn.addEventListener("click", () => {
        emitSync({ type: "buzz", payload: { id: clientId } });
      }, { once: true });
    }
    return;
  }

  // Host: Buzz Liste + Auswahl
  const queue = current.buzzQueue || [];
  const activeId = current.buzzerActiveId || null;

  const items = queue.map(pid => {
    const p = getPlayerById(pid);
    const name = p ? p.name : pid;
    const active = pid === activeId;
    return `<button class="buzzerPick ${active ? "active" : ""}" data-pid="${escapeHtml(pid)}">${escapeHtml(name)}</button>`;
  }).join("");

  area.innerHTML = `
    <div class="buzzerHint">Buzz-Reihenfolge (klicken zum Auswählen)</div>
    <div class="buzzerList">${items || `<span class="buzzerEmpty">Noch niemand gebuzzert…</span>`}</div>
    <div class="buzzerCurrent">
      Aktiv: <b>${activeId ? escapeHtml(getPlayerById(activeId)?.name || activeId) : "—"}</b>
      <span class="buzzerSmall">(Richtig/Falsch = ± halbe Punkte)</span>
    </div>
  `;

  area.querySelectorAll(".buzzerPick").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-pid");
      if (!pid) return;

      current.buzzerActiveId = pid;

      // ✅ NEU: Lock-in nach Auswahl
      current.buzzLocked = true;

      updateHostButtonsForPhase();
      syncSnapshot();
      renderBuzzerUI();
    });
  });
}

function updateHostButtonsForPhase() {
  if (!isHost) return;
  if (!current) return;

  if (revealBtn) revealBtn.disabled = false;

  if (current.phase === "main") {
    if (rightBtn) rightBtn.disabled = false;
    if (wrongBtn) wrongBtn.disabled = false;
    return;
  }

  if (current.phase === "buzzer") {
    const hasActive = !!current.buzzerActiveId;
    if (rightBtn) rightBtn.disabled = !hasActive;
    if (wrongBtn) wrongBtn.disabled = !hasActive;
  }
}

// ============================
// Spieler Rendering
// ============================
function setActivePlayer(index) {
  if (players.length === 0) { activePlayerIndex = 0; return; }
  activePlayerIndex = clamp(index, 0, players.length - 1);
  renderPlayers();
  renderTurn();
  syncSnapshot();
}

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

    if (isHost) {
      card.title = "Klicken: als aktiven Spieler setzen";
      card.addEventListener("click", () => setActivePlayer(idx));
    }

    playersEl.appendChild(card);
  });

  if (addPlayerBtn) addPlayerBtn.disabled = !isHost;
  if (removePlayerBtn) removePlayerBtn.disabled = !isHost || players.length <= 0;
}

// ============================
// Board Rendering
// ============================
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
      } else {
        tile.textContent = clue.value;
        if (isHost) tile.onclick = () => openQuestion(ci, i);
        else tile.style.cursor = "default";
      }
      board.appendChild(tile);
    });
  }
}

// ============================
// Question Modal
// ============================
function openQuestion(ci, qi) {
  const clue = gameData.categories[ci].clues[qi];
  const key = `${ci}-${qi}`;
  if (!clue || used.has(key)) return;

  const mainPlayerId = getActivePlayer()?.id || null;

  current = {
    ci, qi, key,
    phase: "main",
    revealed: false,

    // ✅ NEU: Lock-Flag
    buzzLocked: false,

    buzzed: {},
    buzzQueue: [],
    buzzerActiveId: null,
    mainPlayerId,
    ...clue
  };

  if (modalCategory) modalCategory.textContent = gameData.categories[ci].name;
  if (modalValue) modalValue.textContent = clue.value;

  if (clue.audio) playAudio(clue.audio);
  else stopAudio();

  if (modalQuestion) {
    if (clue.img) modalQuestion.innerHTML = `<img src="${clue.img}" alt="Fragebild" class="whoImg">`;
    else modalQuestion.textContent = clue.q ?? "";
  }

  if (modalAnswer) {
    modalAnswer.classList.remove("show");
    prepareAnswerContent(clue);
    setAnswerVisible(false);
  }

  if (overlay) overlay.classList.add("show");

  updateHostButtonsForPhase();
  renderBuzzerUI();
  syncSnapshot();
}

function closeModal() {
  if (overlay) overlay.classList.remove("show");
  current = null;
  stopAudio();
  syncSnapshot();
}

function revealAnswer() {
  if (!current || !modalAnswer) return;
  modalAnswer.classList.add("show");
  setAnswerVisible(true);
  current.revealed = true;
  syncSnapshot();
}

// ============================
// Scoring / Turn Flow
// ============================
function addScoreByPlayerId(playerId, delta) {
  const p = getPlayerById(playerId);
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
  closeModal();
  buildBoard();

  if (used.size >= TOTAL_CLUES) {
    showEndScoreboard();
    syncSnapshot();
    return;
  }

  nextPlayer();
  syncSnapshot();
}

function answerMain(correct) {
  if (!current) return;

  const v = current.value || 0;
  const mainId = current.mainPlayerId;

  if (correct) {
    used.add(current.key);
    if (mainId) addScoreByPlayerId(mainId, v);
    endQuestionAndAdvance();
    return;
  }

  if (mainId) addScoreByPlayerId(mainId, -halfPoints(v));

  current.phase = "buzzer";

  // ✅ NEU: Buzzphase startet UNLOCKED
  current.buzzLocked = false;
  current.buzzerActiveId = null;

  current.revealed = false;

  if (modalAnswer) {
    modalAnswer.classList.add("show");
    setAnswerVisible(false);
  }

  renderBuzzerUI();
  updateHostButtonsForPhase();
  syncSnapshot();
}

function answerBuzzer(correct) {
  if (!current) return;

  const v = current.value || 0;
  const pid = current.buzzerActiveId;
  if (!pid) return;

  if (correct) {
    addScoreByPlayerId(pid, halfPoints(v));
    used.add(current.key);
    endQuestionAndAdvance();
    return;
  }

  addScoreByPlayerId(pid, -halfPoints(v));

  current.buzzQueue = (current.buzzQueue || []).filter(x => x !== pid);
  current.buzzerActiveId = current.buzzQueue[0] || null;

  // ✅ Lock bleibt aktiv, aber aktiver Spieler wechselt automatisch
  if (!current.buzzerActiveId) {
    used.add(current.key);
    endQuestionAndAdvance();
    return;
  }

  renderBuzzerUI();
  updateHostButtonsForPhase();
  syncSnapshot();
}

// ============================
// Endscreen / Podium
// ============================
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

  podiumEl.innerHTML = order.map(({ player, rank }) => `
    <div class="podiumSlot rank${rank}">
      <div class="podiumRank">Platz ${rank}</div>
      <p class="podiumName">${escapeHtml(player.name)}</p>
      <div class="podiumScore">${player.score} Punkte</div>
    </div>
  `).join("");

  endOverlay.classList.add("show");
  endOverlay.setAttribute("aria-hidden", "false");
}

function hideEndScoreboard() {
  if (!endOverlay) return;
  endOverlay.classList.remove("show");
  endOverlay.setAttribute("aria-hidden", "true");
}

function resetGame() {
  hideEndScoreboard();
  used.clear();
  closeModal();

  players = players.map(p => ({ ...p, score: 0 }));
  activePlayerIndex = 0;

  renderPlayers();
  renderTurn();
  buildBoard();
  syncSnapshot();
}

// ============================
// Join / Rename (Board -> Host)
// ============================
function sendJoin(name) { emitSync({ type: "join", payload: { id: clientId, name } }); }
function sendRename(name) { emitSync({ type: "rename", payload: { id: clientId, name } }); }

// ============================
// Snapshot Sync
// ============================
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

function applySnapshot(s) {
  if (!s) return;

  used.clear();
  (s.used || []).forEach((k) => used.add(k));

  if (Array.isArray(s.players)) players = s.players;
  if (Number.isInteger(s.activePlayerIndex)) activePlayerIndex = s.activePlayerIndex;

  current = s.current || null;

  renderPlayers();
  renderTurn();
  buildBoard();

  if (overlay) {
    if (s.overlays?.questionOpen && current) {
      const clue = gameData.categories[current.ci]?.clues?.[current.qi];
      if (clue) {
        if (modalCategory) modalCategory.textContent = gameData.categories[current.ci].name;
        if (modalValue) modalValue.textContent = clue.value;

        if (modalQuestion) {
          if (clue.img) modalQuestion.innerHTML = `<img src="${clue.img}" alt="Fragebild" class="whoImg">`;
          else modalQuestion.textContent = clue.q ?? "";
        }

        if (modalAnswer) {
          prepareAnswerContent(clue);

          if (current.phase === "buzzer") modalAnswer.classList.add("show");
          else modalAnswer.classList.remove("show");

          setAnswerVisible(!!current.revealed);
        }

        overlay.classList.add("show");
        renderBuzzerUI();
      }
    } else {
      overlay.classList.remove("show");
    }
  }

  if (endOverlay) {
    if (s.overlays?.endOpen) showEndScoreboard();
    else hideEndScoreboard();
  }
}

function syncSnapshot() {
  if (!isHost) return;
  emitSync({ type: "snapshot", payload: getSnapshot() });
}

// ============================
// Sync Listener
// ============================
onSync((msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === "request_state" && isHost) {
    emitSync({ type: "snapshot", payload: getSnapshot() });
    return;
  }

  if (msg.type === "snapshot" && !isHost) {
    applySnapshot(msg.payload);
    return;
  }

  if (isHost && msg.type === "join") {
    const { id, name } = msg.payload || {};
    if (!id) return;

    const safeName = String(name || "").trim() || `Spieler ${players.length + 1}`;

    const existing = players.find(p => p.id === id);
    if (existing) existing.name = safeName;
    else players.push({ id, name: safeName, score: 0 });

    if (players.length === 1) activePlayerIndex = 0;

    renderPlayers();
    renderTurn();
    syncSnapshot();
    return;
  }

  if (isHost && msg.type === "rename") {
    const { id, name } = msg.payload || {};
    if (!id) return;

    const p = players.find(x => x.id === id);
    if (!p) return;

    const safeName = String(name || "").trim();
    if (safeName) p.name = safeName;

    renderPlayers();
    renderTurn();
    syncSnapshot();
    return;
  }

  if (isHost && msg.type === "buzz") {
    if (!current || current.phase !== "buzzer") return;

    // ✅ NEU: wenn gelockt -> keine weiteren Buzzes akzeptieren
    if (current.buzzLocked) return;

    const pid = msg.payload?.id;
    if (!pid) return;
    if (!getPlayerById(pid)) return;

    if (current.buzzed?.[pid]) return;

    current.buzzed[pid] = true;
    current.buzzQueue = current.buzzQueue || [];
    current.buzzQueue.push(pid);

    // wenn noch keiner aktiv ist, setzen wir aktiv, aber locken NICHT automatisch
    if (!current.buzzerActiveId) current.buzzerActiveId = pid;

    renderBuzzerUI();
    updateHostButtonsForPhase();
    syncSnapshot();
    return;
  }
});

// ============================
// Events
// ============================
if (isHost) {
  if (revealBtn) revealBtn.onclick = revealAnswer;

  if (rightBtn) rightBtn.onclick = () => {
    if (!current) return;
    if (current.phase === "main") answerMain(true);
    else answerBuzzer(true);
  };

  if (wrongBtn) wrongBtn.onclick = () => {
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

  if (addPlayerBtn) addPlayerBtn.addEventListener("click", () => {
    players.push({ id: `host_${Date.now()}`, name: `Spieler ${players.length + 1}`, score: 0 });
    if (players.length === 1) activePlayerIndex = 0;
    renderPlayers();
    renderTurn();
    syncSnapshot();
  });

  if (removePlayerBtn) removePlayerBtn.addEventListener("click", () => {
    if (players.length <= 0) return;
    players.pop();
    activePlayerIndex = Math.min(activePlayerIndex, Math.max(players.length - 1, 0));
    renderPlayers();
    renderTurn();
    syncSnapshot();
  });

  if (resetBtn) resetBtn.onclick = resetGame;

  if (endCloseBtn) endCloseBtn.onclick = () => { hideEndScoreboard(); syncSnapshot(); };
  if (endNewGameBtn) endNewGameBtn.onclick = resetGame;

  if (endOverlay) {
    endOverlay.addEventListener("click", (e) => {
      if (e.target === endOverlay) { hideEndScoreboard(); syncSnapshot(); }
    });
  }
}

// Board: Join
if (!isHost) {
  if (joinNameInput) joinNameInput.value = clientName;

  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      const name = (joinNameInput?.value || "").trim();
      clientName = name;
      try { sessionStorage.setItem(CLIENT_NAME_KEY, clientName); } catch (_) {}
      sendJoin(clientName);
    });
  }

  if (joinNameInput) {
    joinNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const name = (joinNameInput.value || "").trim();
        clientName = name;
        try { sessionStorage.setItem(CLIENT_NAME_KEY, clientName); } catch (_) {}
        sendJoin(clientName);
      }
    });

    joinNameInput.addEventListener("input", () => {
      const name = (joinNameInput.value || "").trim();
      clientName = name;
      try { sessionStorage.setItem(CLIENT_NAME_KEY, clientName); } catch (_) {}
      sendRename(clientName);
    });
  }

  if (clientName.trim()) sendJoin(clientName.trim());
  emitSync({ type: "request_state" });
}

// Start
renderPlayers();
renderTurn();
buildBoard();
if (isHost) syncSnapshot();
