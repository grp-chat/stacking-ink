const WordDeck = require("./worddeck");

const ROUND_SECONDS = 180;
const INK_MAX = 300;
const INK_COST_PER_UNIT = 12;

function createDrawSession(io, deck = new WordDeck()) {
  let currentWord = "";
  let score = 0;
  let timeLeft = ROUND_SECONDS;
  let inkLeft = INK_MAX;
  let roundActive = false;
  let timerRunning = false;
  let endedReason = null;
  let timerInterval = null;

  deck.on("deck-refilled", (payload) => {
    io.emit("deck-refilled", payload);
  });

  function getSnapshot() {
    return {
      active: roundActive,
      timerRunning,
      endedReason,
      score,
      timeLeft,
      inkLeft: Math.round(inkLeft),
      inkMax: INK_MAX,
      wordsRemaining: deck.getRemaining(),
      deckCycle: deck.cycleCount
    };
  }

  function stopTimer() {
    timerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function broadcastState() {
    io.emit("round-state", getSnapshot());
  }

  function startTimer() {
    if (!roundActive || timeLeft <= 0 || inkLeft <= 0) return;
    if (timerRunning) return;

    timerRunning = true;
    broadcastState();

    timerInterval = setInterval(() => {
      if (!roundActive || !timerRunning) {
        stopTimer();
        return;
      }

      timeLeft = Math.max(0, timeLeft - 1);

      if (timeLeft <= 0) {
        roundActive = false;
        endedReason = "time";
        stopTimer();
        io.emit("round-ended", { reason: "time", ...getSnapshot() });
      }

      broadcastState();
    }, 1000);
  }

  function pickWord() {
    return deck.draw() || "";
  }

  function assignWordOnly(socket) {
    currentWord = pickWord();
    roundActive = Boolean(currentWord);
    if (socket) {
      socket.emit("secret-word", currentWord);
    }
    io.emit("clear-canvas");
    broadcastState();
  }

  function startNewGame(socket) {
    stopTimer();
    score = 0;
    timeLeft = ROUND_SECONDS;
    inkLeft = INK_MAX;
    endedReason = null;
    currentWord = pickWord();
    roundActive = Boolean(currentWord);

    if (socket) {
      socket.emit("secret-word", currentWord);
    }

    io.emit("clear-canvas");
    broadcastState();
  }

  function registerSocket(socket) {
    socket.emit("round-state", getSnapshot());

    socket.on("next-word", () => {
      if (endedReason) return;
      if (!roundActive) {
        startNewGame(socket);
        return;
      }
      assignWordOnly(socket);
    });

    socket.on("restart-game", () => {
      startNewGame(socket);
    });

    socket.on("toggle-pause-timer", () => {
      if (!roundActive || timeLeft <= 0 || inkLeft <= 0) return;
      if (timerRunning) {
        stopTimer();
        broadcastState();
      } else {
        startTimer();
      }
    });

    socket.on("draw-stroke", (stroke) => {
      if (!roundActive || inkLeft <= 0 || timeLeft <= 0) return;
      if (!stroke || !stroke.from || !stroke.to) return;

      const dx = stroke.to.x - stroke.from.x;
      const dy = stroke.to.y - stroke.from.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0) return;

      if (!timerRunning) {
        startTimer();
      }

      const requestedCost = dist * INK_COST_PER_UNIT;

      if (inkLeft >= requestedCost) {
        inkLeft -= requestedCost;
        socket.broadcast.emit("draw-stroke", stroke);
      } else {
        const ratio = inkLeft / requestedCost;
        const partialTo = {
          x: stroke.from.x + dx * ratio,
          y: stroke.from.y + dy * ratio
        };
        inkLeft = 0;
        socket.broadcast.emit("draw-stroke", {
          from: stroke.from,
          to: partialTo
        });
      }

      if (inkLeft <= 0) {
        inkLeft = 0;
        roundActive = false;
        endedReason = "ink";
        stopTimer();
        io.emit("round-ended", { reason: "ink", ...getSnapshot() });
      }

      broadcastState();
    });

    socket.on("clear-canvas", () => {
      io.emit("clear-canvas");
    });

    socket.on("mark-scored", () => {
      if (!roundActive) return;
      score += 1;
      io.emit("score-updated", { score });
      assignWordOnly(socket);
    });
  }

  return {
    registerSocket
  };
}

module.exports = { createDrawSession };