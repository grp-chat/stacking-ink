(function () {
  function mount(container, socket) {
    container.innerHTML = `
      <section class="stage-view">
        <div class="stage-bar">
          <div class="stage-actions">
            <button id="dpNewWordBtn" type="button" class="btn-stage btn-primary">New / Skip Word</button>
            <button id="dpScoredBtn" type="button" class="btn-stage btn-success">Scored (+1)</button>
            <button id="dpPauseBtn" type="button" class="btn-stage btn-warning">Pause Timer</button>
            <button id="dpClearBtn" type="button" class="btn-stage">Clear</button>
            <button id="dpRestartBtn" type="button" class="btn-stage btn-danger">Restart Game</button>
          </div>
          <div class="stage-stats">
            <div class="stat-pill">Word: <strong id="dpWord">—</strong></div>
            <div class="stat-pill">Time: <strong id="dpTime">60s</strong></div>
            <div class="stat-pill">Ink: <strong id="dpInk">100/100</strong></div>
            <div class="stat-pill">Score: <strong id="dpScore">0</strong></div>
          </div>
        </div>

        <div class="canvas-shell">
          <canvas id="dpCanvas"></canvas>
        </div>
      </section>
    `;

    const canvas = document.getElementById("dpCanvas");
    const ctx = canvas.getContext("2d");
    const newWordBtn = document.getElementById("dpNewWordBtn");
    const scoredBtn = document.getElementById("dpScoredBtn");
    const pauseBtn = document.getElementById("dpPauseBtn");
    const clearBtn = document.getElementById("dpClearBtn");
    const restartBtn = document.getElementById("dpRestartBtn");
    const wordEl = document.getElementById("dpWord");
    const timeEl = document.getElementById("dpTime");
    const inkEl = document.getElementById("dpInk");
    const scoreEl = document.getElementById("dpScore");

    let isDrawing = false;
    let lastNorm = null;
    let canDraw = false;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      if (snapshot.width && snapshot.height) {
        snapshot.getContext("2d").drawImage(canvas, 0, 0);
      }

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#0f172a";

      if (snapshot.width && snapshot.height) {
        ctx.drawImage(snapshot, 0, 0, rect.width, rect.height);
      }
    }

    function clearCanvas() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    }

    function drawSegment(from, to) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      ctx.beginPath();
      ctx.moveTo(from.x * rect.width, from.y * rect.height);
      ctx.lineTo(to.x * rect.width, to.y * rect.height);
      ctx.stroke();
    }

    function getNormPoint(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      };
    }

    function onPointerDown(e) {
      if (!canDraw) return;
      if (e.pointerType === "touch" && e.isPrimary === false) return;
      canvas.setPointerCapture(e.pointerId);
      isDrawing = true;
      lastNorm = getNormPoint(e);
    }

    function onPointerMove(e) {
      if (!isDrawing || !lastNorm || !canDraw) return;
      const currentNorm = getNormPoint(e);
      drawSegment(lastNorm, currentNorm);
      socket.emit("draw-stroke", { from: lastNorm, to: currentNorm });
      lastNorm = currentNorm;
    }

    function stopDrawing(e) {
      if (!isDrawing) return;
      isDrawing = false;
      lastNorm = null;
      if (e && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    function onNewWord() {
      socket.emit("next-word");
    }

    function onScored() {
      socket.emit("mark-scored");
    }

    function onTogglePause() {
      socket.emit("toggle-pause-timer");
    }

    function onClear() {
      clearCanvas();
      socket.emit("clear-canvas");
    }

    function onRestartGame() {
      socket.emit("restart-game");
    }

    function onSecretWord(word) {
      wordEl.textContent = word || "—";
    }

    function onRoundState(state) {
      const { score, timeLeft, inkLeft, inkMax, active, timerRunning, endedReason } = state;
      scoreEl.textContent = score;
      timeEl.textContent = `${timeLeft ?? 60}s`;
      inkEl.textContent = `${inkLeft ?? 100}/${inkMax ?? 100}`;

      const isEnded = Boolean(endedReason) || (!active && ((timeLeft ?? 0) <= 0 || (inkLeft ?? 0) <= 0));
      canDraw = Boolean(active) && (inkLeft ?? 0) > 0 && (timeLeft ?? 0) > 0;

      if (!canDraw) {
        isDrawing = false;
        lastNorm = null;
      }

      if (!active) {
        wordEl.textContent = "—";
      }

      newWordBtn.disabled = isEnded;
      scoredBtn.disabled = !active;
      pauseBtn.disabled = !active;
      pauseBtn.textContent = timerRunning ? "Pause Timer" : "Resume Timer";
      // restartBtn.classList.toggle("hidden", !isEnded);
    }

    function onScoreUpdated({ score }) {
      scoreEl.textContent = score;
    }

    function onClearCanvas() {
      clearCanvas();
    }

    newWordBtn.addEventListener("click", onNewWord);
    scoredBtn.addEventListener("click", onScored);
    pauseBtn.addEventListener("click", onTogglePause);
    clearBtn.addEventListener("click", onClear);
    restartBtn.addEventListener("click", onRestartGame);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
    window.addEventListener("resize", resizeCanvas);

    socket.on("secret-word", onSecretWord);
    socket.on("round-state", onRoundState);
    socket.on("score-updated", onScoreUpdated);
    socket.on("clear-canvas", onClearCanvas);

    requestAnimationFrame(resizeCanvas);

    this._cleanup = () => {
      window.removeEventListener("resize", resizeCanvas);
      socket.off("secret-word", onSecretWord);
      socket.off("round-state", onRoundState);
      socket.off("score-updated", onScoreUpdated);
      socket.off("clear-canvas", onClearCanvas);
    };
  }

  function unmount() {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
  }

  window.StackingInkApp.registerView("drawing-panel", { mount, unmount });
})();