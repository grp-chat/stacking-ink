(function () {
  function mount(container, socket) {
    container.innerHTML = `
      <section class="stage-view">
        <div class="stage-bar">
          <div class="stage-stats">
            <div class="stat-pill stat-pill-lg">Score: <strong id="tvScore">0</strong></div>
            <div class="stat-pill">Time: <strong id="tvTime">60s</strong></div>
            <div class="stat-pill">Ink: <strong id="tvInk">100/100</strong></div>
          </div>
          <div class="stage-actions">
            <div id="tvStatus" class="tv-status">Waiting for drawing...</div>
            <button id="tvFullscreenBtn" type="button" class="btn-stage">Fullscreen</button>
          </div>
        </div>

        <div class="canvas-shell">
          <canvas id="tvCanvas"></canvas>
        </div>
      </section>
    `;

    const canvas = document.getElementById("tvCanvas");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("tvScore");
    const timeEl = document.getElementById("tvTime");
    const inkEl = document.getElementById("tvInk");
    const statusEl = document.getElementById("tvStatus");
    const fullscreenBtn = document.getElementById("tvFullscreenBtn");

    function updateFullscreenLabel() {
      fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
      requestAnimationFrame(resizeCanvas);
    }

    async function toggleFullscreen() {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.error("Fullscreen toggle failed:", err);
      }
    }

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

    function onDrawStroke({ from, to }) {
      drawSegment(from, to);
      statusEl.textContent = "Live drawing...";
    }

    function onRoundState({ active, timerRunning, endedReason, score, timeLeft, inkLeft, inkMax }) {
      scoreEl.textContent = score;
      timeEl.textContent = `${timeLeft ?? 60}s`;
      inkEl.textContent = `${inkLeft ?? 100}/${inkMax ?? 100}`;

      if (!active && endedReason === "time") {
        statusEl.textContent = "Time's up!";
      } else if (!active && endedReason === "ink") {
        statusEl.textContent = "Out of ink!";
      } else if (timerRunning) {
        statusEl.textContent = "Live drawing...";
      } else if (active) {
        statusEl.textContent = "Timer paused";
      } else {
        statusEl.textContent = "Waiting for drawing...";
      }
    }

    function onRoundEnded({ reason }) {
      statusEl.textContent = reason === "time" ? "Time's up!" : "Out of ink!";
    }

    function onScoreUpdated({ score }) {
      scoreEl.textContent = score;
      statusEl.textContent = "Word guessed! Next round...";
    }

    function onClearCanvas() {
      clearCanvas();
    }

    fullscreenBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenLabel);
    window.addEventListener("resize", resizeCanvas);
    socket.on("draw-stroke", onDrawStroke);
    socket.on("round-state", onRoundState);
    socket.on("round-ended", onRoundEnded);
    socket.on("score-updated", onScoreUpdated);
    socket.on("clear-canvas", onClearCanvas);

    requestAnimationFrame(resizeCanvas);

    this._cleanup = () => {
      fullscreenBtn.removeEventListener("click", toggleFullscreen);
      document.removeEventListener("fullscreenchange", updateFullscreenLabel);
      window.removeEventListener("resize", resizeCanvas);
      socket.off("draw-stroke", onDrawStroke);
      socket.off("round-state", onRoundState);
      socket.off("round-ended", onRoundEnded);
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

  window.StackingInkApp.registerView("dashboard", { mount, unmount });
})();