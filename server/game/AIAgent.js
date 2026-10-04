/**
 * AIAgent.js
 * Adaptive AI memory bot with cognitive decay simulation (Ebbinghaus forgetting curve),
 * varying difficulty tiers (Cub, Hunter, Apex Predator), and human-like deliberation delays.
 */

export class AIAgent {
  constructor(difficulty = 'medium', room) {
    this.difficulty = difficulty;
    this.room = room;
    this.name = this.getAIName(difficulty);
    // Episodic memory map: cardIndex -> { img, turnSeen }
    this.memory = new Map();
    this.currentTurn = 0;
  }

  getAIName(diff) {
    switch (diff) {
      case 'easy': return 'Cub AI 🐾';
      case 'hard': return 'Apex Predator AI 🦁';
      default: return 'Hunter AI 🐆';
    }
  }

  /**
   * Called whenever a card is revealed on the board so AI can update its cognitive memory
   */
  observeCard(index, img) {
    this.memory.set(index, {
      img,
      turnSeen: this.currentTurn
    });
  }

  /**
   * Called when a matched pair is removed from play
   */
  forgetMatched(indices) {
    indices.forEach(idx => this.memory.delete(idx));
  }

  /**
   * Advance the internal turn counter for decay simulation
   */
  incrementTurn() {
    this.currentTurn++;
    this.applyMemoryDecay();
  }

  /**
   * Apply cognitive decay based on difficulty
   */
  applyMemoryDecay() {
    if (this.difficulty === 'hard') {
      // Apex has near-infinite memory
      return;
    }

    if (this.difficulty === 'easy') {
      // Cub only remembers up to 3 most recent cards
      if (this.memory.size > 3) {
        const sorted = [...this.memory.entries()].sort((a, b) => b[1].turnSeen - a[1].turnSeen);
        this.memory = new Map(sorted.slice(0, 3));
      }
      return;
    }

    // Medium (Hunter): Ebbinghaus forgetting probability: P_recall = e^(-0.2 * age)
    for (const [idx, data] of this.memory.entries()) {
      const age = this.currentTurn - data.turnSeen;
      const recallProb = Math.exp(-0.25 * age);
      if (Math.random() > recallProb) {
        this.memory.delete(idx);
      }
    }
  }

  /**
   * Find if there are two cards in memory with the same image
   */
  findKnownPair(availableIndices) {
    const availableSet = new Set(availableIndices);
    const seenByImg = new Map();

    for (const [idx, data] of this.memory.entries()) {
      if (!availableSet.has(idx)) continue;
      if (seenByImg.has(data.img)) {
        return [seenByImg.get(data.img), idx];
      }
      seenByImg.set(data.img, idx);
    }
    return null;
  }

  /**
   * Select the first card of the AI's turn
   */
  chooseFirstCard(availableIndices) {
    this.applyMemoryDecay();

    // 1. Easy mode: chance of totally random flip
    if (this.difficulty === 'easy' && Math.random() < 0.45) {
      return this.getRandomChoice(availableIndices);
    }

    // 2. Check if a complete matching pair is already known in memory
    const knownPair = this.findKnownPair(availableIndices);
    if (knownPair) {
      return knownPair[0];
    }

    // 3. If no known pair, prefer picking an uninspected card to gain information
    const unknownIndices = availableIndices.filter(idx => !this.memory.has(idx));
    if (unknownIndices.length > 0) {
      return this.getRandomChoice(unknownIndices);
    }

    // Fallback: pick any available
    return this.getRandomChoice(availableIndices);
  }

  /**
   * Select the second card given the first revealed card
   */
  chooseSecondCard(firstIndex, firstImg, availableIndices) {
    const remaining = availableIndices.filter(idx => idx !== firstIndex);
    if (remaining.length === 0) return null;

    // 1. Check memory to see if we know where the matching pair for firstImg is
    for (const [idx, data] of this.memory.entries()) {
      if (idx !== firstIndex && data.img === firstImg && remaining.includes(idx)) {
        // If easy mode, 30% chance AI forgets or misses even if in memory
        if (this.difficulty === 'easy' && Math.random() < 0.3) {
          continue;
        }
        return idx;
      }
    }

    // 2. If no match in memory, flip an uninspected card
    const unknownIndices = remaining.filter(idx => !this.memory.has(idx));
    if (unknownIndices.length > 0) {
      return this.getRandomChoice(unknownIndices);
    }

    // Fallback: random remaining
    return this.getRandomChoice(remaining);
  }

  getRandomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get dynamic thinking delay (in ms) to simulate human cognition
   */
  getThinkingDelay() {
    switch (this.difficulty) {
      case 'easy': return 800 + Math.floor(Math.random() * 400);
      case 'hard': return 1100 + Math.floor(Math.random() * 500);
      default: return 950 + Math.floor(Math.random() * 450);
    }
  }
}
