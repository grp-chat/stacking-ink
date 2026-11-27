const EventEmitter = require("events");
const baseWords = require("./words");

function shuffleArray(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

class WordDeck extends EventEmitter {
  constructor(words = baseWords) {
    super();
    this.sourceWords = Array.isArray(words) ? words : [];
    this.deck = [];
    this.cycleCount = 0;
    this.refill(false);
  }

  refill(emitEvent = true) {
    // Filter out blank/non-string entries in case words.js has stray items
    const cleanWords = this.sourceWords.filter(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    this.deck = shuffleArray(cleanWords);
    this.cycleCount += 1;

    if (emitEvent) {
      this.emit("deck-refilled", {
        cycleCount: this.cycleCount,
        remaining: this.deck.length,
      });
    }
  }

  draw() {
    if (this.sourceWords.length === 0) {
      return null;
    }

    if (this.deck.length === 0) {
      this.refill(true);
    }

    return this.deck.pop() ?? null;
  }

  getRemaining() {
    return this.deck.length;
  }
}

module.exports = WordDeck;