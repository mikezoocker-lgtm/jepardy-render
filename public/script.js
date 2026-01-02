/*************************************************
 * JEOPARDY – HOST/BOARD MULTIPLAYER (WebSocket)
 *************************************************/

const ROLE = (document.body?.dataset?.role || "host").toLowerCase();
const isHost = ROLE === "host";

/* =========================
   WebSocket Sync Layer
========================= */
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;

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
    try { msg = JSON.parse(e.data); } catch { return; }
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

function onSync(cb) { syncHandlers.push(cb); }
connectWS();

/* =========================
   Client ID
========================= */
const urlParams = new URLSearchParams(location.search);
const tabParam = urlParams.get("p");

const CLIENT_ID_KEY = "jeopardy_client_id_tab_v2";
function getClientId() {
  if (tabParam) return `tab_${tabParam}`;
  let id = "";
  try { id = sessionStorage.getItem(CLIENT_ID_KEY) || ""; } catch {}
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    try { sessionStorage.setItem(CLIENT_ID_KEY, id); } catch {}
  }
  return id;
}
const clientId = getClientId();

/* =========================
   TIMER
========================= */
const TIMER_SECONDS = 30;
let timerUiInterval = null;

function clueHasTimer(clue, categoryName) {
  if (clue?.audio) return false;
  if ((categoryName || "").toLowerCase().includes("soundtrack")) return false;
  return true;
}

function ensureTimerUI() {
  if (!modalQuestion) return;
  if (document.getElementById("timerWrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "timerWrap";
  wrap.className = "timerWrap";
  wrap.innerHTML = `
    <div class="timerBarBg">
      <div class="timerBar" id="timerBar"></div>
    </div>
    <div class="timerText" id="timerText"></div>
  `;
  modalQuestion.appendChild(wrap);
}

function stopTimerUI() {
  if (timerUiInterval) clearInterval(timerUiInterval);
  timerUiInterval = null;
  const t = document.getElementById("timerText");
  const b = document.getElementById("timerBar");
  if (t) t.textContent = "";
  if (b) b.style.width = "0%";
}

function startTimerUI(endAt, durationMs) {
  stopTimerUI();
  ensureTimerUI();

  const bar = document.getElementById("timerBar");
  const txt = document.getElementById("timerText");
  if (!bar || !txt) return;

  const tick = () => {
    const now = Date.now();
    const remaining = Math.max(0, endAt - now);
    const s = Math.ceil(remaining / 1000);
    const pct = Math.max(0, Math.min(100, (remaining / durationMs) * 100));
    txt.textContent = `⏱️ ${s}s`;
    bar.style.width = pct + "%";

    if (remaining <= 0) {
      stopTimerUI();
      if (isHost) handleTimerExpired();
    }
  };

  tick();
  timerUiInterval = setInterval(tick, 120);
}

function restartCurrentTimer() {
  if (!current) return;
  if (!current.timerEnabled) {
    stopTimerUI();
    return;
  }
  current.timerEndAt = Date.now() + (current.timerDurationMs || TIMER_SECONDS * 1000);
  startTimerUI(current.timerEndAt, current.timerDurationMs || TIMER_SECONDS * 1000);
}

/* =========================
   GAME DATA (deins)
========================= */
let gameData = window.gameData || {
  categories: [
    // ... DEIN GAME DATA bleibt wie bei dir ...
  ],
};

// WICHTIG: Falls du gameData nicht global setzt:
if (!gameData?.categories?.length) {
  console.warn("gameData ist leer. Bitte dein gameData im Script drin lassen.");
}

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

// Board Join
const joinBtnEl = document.getElementById("joinBtn");
const joinNameEl = document.getElementById("joinName");

/* =========================
   State
========================= */
const used = new Set();
let players = [];
let activePlayerIndex = 0;

let current = null;
let currentAudio = null;

const TOTAL_CLUES = (gameData.categories || []).reduce((s, c) => s + (c.clues?.length || 0), 0);

/* =========================
   Helpers
========================= */
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function halfPoints(v) { return Math.floor((v || 0) / 2); }

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[m]));
}

function getActivePlayer() { return players[activePlayerIndex] || null; }
function getPlayerById(id) { return players.find((p) => p.id === id) || null; }

function renderTurn() {
  const p = getActivePlayer();
  if (!turnPill) return;
  turnPill.textContent = p ? `${p.name} ist dran!` : "Warte auf Spieler…";
}

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
  activePlayerIndex = Number.isInteger(s.activePlayerIndex) ? s.activePlayerIndex : 0;
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

        // ✅ BUZZER-FIX: Wenn buzzer-phase -> Answer immer show
        if (current.phase === "buzzer" && modalAnswer) modalAnswer.classList.add("show");

        setAnswerVisible(!!current.revealed);
        renderBuzzerUI();

        // ✅ Timer
        if (current?.timerEnabled && current?.timerEndAt) {
          startTimerUI(current.timerEndAt, current.timerDurationMs || TIMER_SECONDS * 1000);
        } else {
          stopTimerUI();
        }
      }
    } else {
      overlay.classList.remove("show");
      stopAudio();
      stopTimerUI();
    }
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
   Modal helpers
========================= */
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

  if (modalAnswer) {
    // ✅ BUZZER-FIX: bei buzzer-phase immer show
    if (visible || (current && current.phase === "buzzer")) modalAnswer.classList.add("show");
    else modalAnswer.classList.remove("show");
  }
}

function fillModalFromClue(clue, categoryName, value) {
  if (modalCategory) modalCategory.textContent = categoryName || "Kategorie";
  if (modalValue) modalValue.textContent = value ?? clue.value ?? 0;

  if (modalQuestion) {
    if (clue.img) {
      modalQuestion.innerHTML = `<img src="${clue.img}" alt="Fragebild" class="whoImg">`;
    } else if (clue.audio) {
      modalQuestion.innerHTML = `<div class="questionText">🎵 Soundtrack läuft…</div>`;
    } else {
      modalQuestion.textContent = clue.q ?? "";
    }
  }

  if (current?.timerEnabled) ensureTimerUI();
  else stopTimerUI();

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

/* =========================
   Host: Open Question
========================= */
function openQuestion(ci, qi) {
  if (!isHost) return;

  const clue = gameData.categories[ci].clues[qi];
  const key = `${ci}-${qi}`;
  if (!clue || used.has(key)) return;

  const mainPlayerId = getActivePlayer()?.id || null;
  const categoryName = gameData.categories[ci].name;

  const timerEnabled = clueHasTimer(clue, categoryName);
  const durationMs = TIMER_SECONDS * 1000;

  current = {
    ci, qi, key,
    phase: "main",
    revealed: false,

    timerEnabled,
    timerDurationMs: durationMs,
    timerEndAt: timerEnabled ? Date.now() + durationMs : null,

    buzzLocked: false,
    buzzed: {},
    buzzQueue: [],
    buzzerActiveId: null,

    mainPlayerId,
    ...clue,
  };

  if (clue.audio) playAudio(clue.audio);
  else stopAudio();

  fillModalFromClue(clue, categoryName, clue.value);

  if (overlay) overlay.classList.add("show");

  if (current.timerEnabled && current.timerEndAt) startTimerUI(current.timerEndAt, current.timerDurationMs);
  else stopTimerUI();

  renderBuzzerUI();
  updateHostButtonsForPhase();
  syncSnapshot();
}

function closeModal() {
  if (!isHost) return;

  // ✅ FIX: beim X schließen -> Frage wird USED
  if (current?.key) used.add(current.key);

  if (overlay) overlay.classList.remove("show");
  stopAudio();
  stopTimerUI();

  current = null;

  buildBoard();
  nextPlayer();
  syncSnapshot();
}

/* =========================
   Host: Buttons enabling
========================= */
function updateHostButtonsForPhase() {
  if (!isHost || !current) return;

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

function revealAnswer() {
  if (!isHost || !current) return;
  current.revealed = true;
  setAnswerVisible(true);
  syncSnapshot();
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
  if (overlay) overlay.classList.remove("show");
  stopAudio();
  stopTimerUI();

  current = null;
  buildBoard();
  nextPlayer();
  syncSnapshot();
}

function answerMain(correct) {
  if (!isHost || !current) return;

  const v = current.value || 0;
  const mainId = current.mainPlayerId;

  if (correct) {
    if (mainId) addScoreByPlayerId(mainId, v);
    used.add(current.key);
    endQuestionAndAdvance();
    return;
  }

  // main falsch: - halbe Punkte
  if (mainId) addScoreByPlayerId(mainId, -halfPoints(v));

  // buzzer phase
  current.phase = "buzzer";
  current.revealed = false;
  current.buzzLocked = false;
  current.buzzed = {};
  current.buzzQueue = [];
  current.buzzerActiveId = null;

  // ✅ BUZZER-FIX: Answer sofort sichtbar (damit buzzerArea sichtbar ist)
  if (modalAnswer) modalAnswer.classList.add("show");

  setAnswerVisible(false);
  renderBuzzerUI();
  updateHostButtonsForPhase();

  if (current.timerEnabled) restartCurrentTimer();
  else stopTimerUI();

  syncSnapshot();
}

function answerBuzzer(correct) {
  if (!isHost || !current) return;

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

  current.buzzQueue = (current.buzzQueue || []).filter((x) => x !== pid);
  current.buzzerActiveId = current.buzzQueue[0] || null;

  if (!current.buzzerActiveId) {
    used.add(current.key);
    endQuestionAndAdvance();
    return;
  }

  renderBuzzerUI();
  updateHostButtonsForPhase();

  if (current.timerEnabled) restartCurrentTimer();
  else stopTimerUI();

  syncSnapshot();
}

function handleTimerExpired() {
  if (!isHost || !current) return;
  if (current.phase === "main") answerMain(false);
  else if (current.phase === "buzzer" && current.buzzerActiveId) answerBuzzer(false);
}

/* =========================
   BUZZER UI
========================= */
function renderBuzzerUI() {
  if (!current) return;

  const area = document.getElementById("buzzerArea");
  if (!area) return;

  area.innerHTML = "";

  if (current.phase !== "buzzer") return;

  // ✅ BUZZER-FIX: Answer Container immer sichtbar
  if (modalAnswer) modalAnswer.classList.add("show");
  setAnswerVisible(false);

  // BOARD
  if (!isHost) {
    const myPlayer = getPlayerById(clientId);

    if (!myPlayer) {
      area.innerHTML = `
        <div class="buzzerHint">🔔 BUZZERN!</div>
        <div class="buzzerEmpty">Du musst erst beitreten.</div>
      `;
      return;
    }

    const isMainTurnPlayer = current.mainPlayerId && clientId === current.mainPlayerId;
    if (isMainTurnPlayer) {
      area.innerHTML = `
        <div class="buzzerHint">🚫 Du bist dran</div>
        <div class="buzzerLocked">Der aktive Spieler darf nicht buzzern.</div>
      `;
      return;
    }

    if (current.buzzLocked && current.buzzerActiveId && clientId !== current.buzzerActiveId) {
      area.innerHTML = `
        <div class="buzzerHint">🔒 Gesperrt</div>
        <div class="buzzerLocked">
          ${escapeHtml(getPlayerById(current.buzzerActiveId)?.name || "Ein Spieler")} ist dran.
        </div>
      `;
      return;
    }

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

  // HOST
  const queue = current.buzzQueue || [];
  const activeId = current.buzzerActiveId || null;

  const items = queue
    .map((pid) => {
      const p = getPlayerById(pid);
      const name = p ? p.name : pid;
      const active = pid === activeId;
      return `<button class="buzzerPick ${active ? "active" : ""}" data-pid="${escapeHtml(pid)}">${escapeHtml(name)}</button>`;
    })
    .join("");

  area.innerHTML = `
    <div class="buzzerHint">Buzz-Reihenfolge (klicken zum Auswählen)</div>
    <div class="buzzerList">${items || `<span class="buzzerEmpty">Noch niemand gebuzzert…</span>`}</div>
    <div class="buzzerCurrent">
      Aktiv: <b>${activeId ? escapeHtml(getPlayerById(activeId)?.name || activeId) : "—"}</b>
      <span class="buzzerSmall">(Richtig/Falsch = ± halbe Punkte)</span>
    </div>
  `;

  area.querySelectorAll(".buzzerPick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-pid");
      if (!pid) return;

      current.buzzerActiveId = pid;
      current.buzzLocked = true;

      if (current.timerEnabled) restartCurrentTimer();
      else stopTimerUI();

      renderBuzzerUI();
      updateHostButtonsForPhase();
      syncSnapshot();
    });
  });
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
    if (current.buzzLocked) return;

    const pid = msg.payload?.id;
    if (!pid) return;
    if (!getPlayerById(pid)) return;
    if (current?.mainPlayerId && pid === current.mainPlayerId) return;
    if (current.buzzed?.[pid]) return;

    current.buzzed[pid] = true;
    current.buzzQueue.push(pid);
    if (!current.buzzerActiveId) current.buzzerActiveId = pid;

    renderBuzzerUI();
    updateHostButtonsForPhase();
    syncSnapshot();
    return;
  }
});

/* =========================
   Host Buttons
========================= */
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

  if (resetBtn) resetBtn.onclick = () => {
    used.clear();
    stopAudio();
    stopTimerUI();
    if (overlay) overlay.classList.remove("show");
    current = null;
    players = players.map((p) => ({ ...p, score: 0 }));
    activePlayerIndex = 0;
    renderPlayers();
    renderTurn();
    buildBoard();
    syncSnapshot();
  };
}

/* =========================
   Board Join
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
if (isHost) syncSnapshot();
