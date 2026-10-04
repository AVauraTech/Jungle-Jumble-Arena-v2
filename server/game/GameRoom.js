/**
 * GameRoom.js
 * Authoritative game room state machine with anti-cheat card masking,
 * turn arbitration, combo multipliers, and AI agent execution.
 */

import { AIAgent } from './AIAgent.js';

const DIFFICULTY_CONFIG = {
  easy:   { rows: 4, cols: 4, pairs: 8 },
  medium: { rows: 4, cols: 6, pairs: 12 },
  hard:   { rows: 6, cols: 6, pairs: 18 }
};

export class GameRoom {
  constructor(roomId, mode = 'solo', difficulty = 'easy', io, leaderboard) {
    this.roomId = roomId;
    this.mode = mode; // 'solo' | 'pvai' | 'pvp'
    this.difficulty = difficulty;
    this.io = io;
    this.leaderboard = leaderboard;

    this.status = 'waiting'; // 'waiting' | 'in_progress' | 'finished'
    this.players = [];
    this.currentTurnIndex = 0;
    this.board = [];
    this.flippedCards = []; // [index1, index2]
    this.boardLocked = false;
    this.moves = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.matches = 0;
    this.aiAgent = null;
  }

  get config() {
    return DIFFICULTY_CONFIG[this.difficulty] || DIFFICULTY_CONFIG.easy;
  }

  addPlayer(socketId, name = 'Player') {
    const isHost = this.players.length === 0;
    const player = {
      id: socketId,
      socketId,
      name: name.slice(0, 16),
      score: 0,
      combo: 0,
      isHost,
      isReady: this.mode !== 'pvp' // Auto-ready for solo & AI
    };
    this.players.push(player);

    if (this.mode === 'pvai' && this.players.length === 1) {
      // Add AI as second player
      this.aiAgent = new AIAgent(this.difficulty, this);
      this.players.push({
        id: 'ai-opponent',
        socketId: 'ai-opponent',
        name: this.aiAgent.name,
        score: 0,
        combo: 0,
        isHost: false,
        isReady: true,
        isAI: true
      });
    }

    return player;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.socketId === socketId);
    if (index !== -1) {
      const removed = this.players.splice(index, 1)[0];
      // If game is in progress and a player leaves PvP, forfeit game
      if (this.status === 'in_progress' && this.mode === 'pvp') {
        const remaining = this.players.find(p => !p.isAI);
        if (remaining) {
          this.endGame(remaining.name, `${removed.name} disconnected. Match forfeited.`);
        }
      }
      return removed;
    }
    return null;
  }

  start() {
    this.initBoard();
    this.status = 'in_progress';
    this.moves = 0;
    this.timer = 0;
    this.matches = 0;
    this.flippedCards = [];
    this.boardLocked = false;
    this.currentTurnIndex = 0;

    // Reset scores & combos
    this.players.forEach(p => {
      p.score = 0;
      p.combo = 0;
    });

    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.status === 'in_progress') {
        this.timer++;
        this.io.to(this.roomId).emit('timer:tick', { timer: this.timer });
      }
    }, 1000);

    this.broadcastState();
  }

  initBoard() {
    const pairsCount = this.config.pairs;
    const deck = [];

    for (let i = 1; i <= pairsCount; i++) {
      const imgPath = `images/${i}.jpg`;
      deck.push({ id: `p${i}_a`, img: imgPath, pairKey: i });
      deck.push({ id: `p${i}_b`, img: imgPath, pairKey: i });
    }

    // Fisher-Yates algorithmic shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.board = deck.map((card, index) => ({
      index,
      id: card.id,
      img: card.img,
      pairKey: card.pairKey,
      isFlipped: false,
      isMatched: false
    }));
  }

  /**
   * Anti-Cheat Card Masking:
   * Masks cards that are not flipped or matched so client cannot inspect DOM/memory to cheat.
   */
  getPublicBoard() {
    return this.board.map(c => ({
      index: c.index,
      isFlipped: c.isFlipped,
      isMatched: c.isMatched,
      img: (c.isFlipped || c.isMatched) ? c.img : null
    }));
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  broadcastState() {
    this.io.to(this.roomId).emit('game:state', {
      roomId: this.roomId,
      mode: this.mode,
      difficulty: this.difficulty,
      config: this.config,
      status: this.status,
      board: this.getPublicBoard(),
      players: this.players,
      currentTurnPlayer: this.getCurrentPlayer()?.name,
      currentTurnPlayerId: this.getCurrentPlayer()?.id,
      moves: this.moves,
      timer: this.timer,
      matches: this.matches,
      totalPairs: this.config.pairs
    });
  }

  handleCardClick(socketId, cardIndex) {
    if (this.status !== 'in_progress' || this.boardLocked) return;

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== socketId) return;

    const card = this.board[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return;

    this.flipCard(cardIndex);
  }

  flipCard(cardIndex) {
    const card = this.board[cardIndex];
    if (!card || card.isFlipped || card.isMatched) return;

    card.isFlipped = true;
    this.flippedCards.push(cardIndex);

    // Notify AI observation
    if (this.aiAgent) {
      this.aiAgent.observeCard(cardIndex, card.img);
    }

    // Broadcast reveal of this specific card
    this.io.to(this.roomId).emit('card:revealed', {
      index: cardIndex,
      img: card.img,
      flippedBy: this.getCurrentPlayer()?.name
    });

    if (this.flippedCards.length === 1) {
      // First card flipped
      if (this.getCurrentPlayer()?.isAI) {
        this.scheduleAISecondMove();
      }
    } else if (this.flippedCards.length === 2) {
      // Second card flipped -> evaluate match
      this.boardLocked = true;
      this.moves++;
      this.evaluateTurn();
    }
  }

  evaluateTurn() {
    const [idx1, idx2] = this.flippedCards;
    const card1 = this.board[idx1];
    const card2 = this.board[idx2];
    const currentPlayer = this.getCurrentPlayer();

    if (card1.pairKey === card2.pairKey) {
      // MATCH!
      card1.isMatched = true;
      card2.isMatched = true;
      this.matches++;

      // Update scoring & combo
      currentPlayer.combo += 1;
      const points = 10 + (currentPlayer.combo - 1) * 5;
      currentPlayer.score += points;

      if (this.aiAgent) {
        this.aiAgent.forgetMatched([idx1, idx2]);
      }

      this.flippedCards = [];

      this.io.to(this.roomId).emit('card:match', {
        indices: [idx1, idx2],
        matchedBy: currentPlayer.name,
        points,
        combo: currentPlayer.combo,
        totalScore: currentPlayer.score
      });

      if (this.matches >= this.config.pairs) {
        setTimeout(() => this.endGame(), 450);
      } else {
        // Player keeps the turn on a match
        this.boardLocked = false;
        this.broadcastState();

        if (currentPlayer.isAI) {
          this.scheduleAIFirstMove();
        }
      }
    } else {
      // MISMATCH!
      currentPlayer.combo = 0;

      this.io.to(this.roomId).emit('card:mismatch', {
        indices: [idx1, idx2]
      });

      if (this.aiAgent) {
        this.aiAgent.incrementTurn();
      }

      setTimeout(() => {
        card1.isFlipped = false;
        card2.isFlipped = false;
        this.flippedCards = [];

        // Rotate turn in 2-player modes
        if (this.players.length > 1) {
          this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        }

        this.boardLocked = false;
        this.broadcastState();

        // Check if next turn belongs to AI
        if (this.getCurrentPlayer()?.isAI && this.status === 'in_progress') {
          this.scheduleAIFirstMove();
        }
      }, 1050);
    }
  }

  scheduleAIFirstMove() {
    if (this.status !== 'in_progress') return;
    const delay = this.aiAgent.getThinkingDelay();
    setTimeout(() => {
      if (this.status !== 'in_progress' || !this.getCurrentPlayer()?.isAI) return;
      const available = this.board.filter(c => !c.isMatched && !c.isFlipped).map(c => c.index);
      if (available.length === 0) return;

      const firstChoice = this.aiAgent.chooseFirstCard(available);
      if (firstChoice !== null && firstChoice !== undefined) {
        this.flipCard(firstChoice);
      }
    }, delay);
  }

  scheduleAISecondMove() {
    if (this.status !== 'in_progress') return;
    const delay = this.aiAgent.getThinkingDelay();
    setTimeout(() => {
      if (this.status !== 'in_progress' || !this.getCurrentPlayer()?.isAI) return;
      if (this.flippedCards.length !== 1) return;

      const firstIdx = this.flippedCards[0];
      const firstCard = this.board[firstIdx];
      const available = this.board.filter(c => !c.isMatched).map(c => c.index);

      const secondChoice = this.aiAgent.chooseSecondCard(firstIdx, firstCard.img, available);
      if (secondChoice !== null && secondChoice !== undefined) {
        this.flipCard(secondChoice);
      }
    }, delay);
  }

  triggerHint(socketId) {
    if (this.mode !== 'solo' || this.boardLocked || this.status !== 'in_progress') return;
    this.boardLocked = true;

    const unrevealed = this.board.filter(c => !c.isFlipped && !c.isMatched);
    const hintData = unrevealed.map(c => ({ index: c.index, img: c.img }));

    this.io.to(this.roomId).emit('game:hint', { hintData, duration: 950 });

    setTimeout(() => {
      this.boardLocked = false;
      this.broadcastState();
    }, 1050);
  }

  sendEmote(playerName, emote) {
    this.io.to(this.roomId).emit('game:emote', {
      sender: playerName,
      emote
    });
  }

  endGame(winnerOverride = null, forfeitReason = null) {
    clearInterval(this.timerInterval);
    this.status = 'finished';

    let winner = null;
    let isTie = false;

    if (winnerOverride) {
      winner = this.players.find(p => p.name === winnerOverride) || { name: winnerOverride };
    } else if (this.players.length === 1) {
      winner = this.players[0];
      // Save solo speedrun record
      this.leaderboard.recordSoloGame({
        name: winner.name,
        difficulty: this.difficulty,
        moves: this.moves,
        time: this.timer
      });
    } else {
      // 2-player score comparison
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      if (sorted[0].score === sorted[1].score) {
        isTie = true;
        winner = null;
      } else {
        winner = sorted[0];
        const loser = sorted[1];
        if (this.mode === 'pvp') {
          this.leaderboard.recordPvPGame({
            winnerName: winner.name,
            loserName: loser.name,
            isTie: false
          });
        }
      }
    }

    this.io.to(this.roomId).emit('game:over', {
      winner: winner ? winner.name : 'Tie Match',
      isTie,
      forfeitReason,
      moves: this.moves,
      time: this.timer,
      players: this.players,
      leaderboards: this.leaderboard.getAll()
    });
  }

  destroy() {
    clearInterval(this.timerInterval);
  }
}
