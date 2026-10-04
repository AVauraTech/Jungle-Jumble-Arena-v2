/**
 * app.js
 * Main frontend controller for Jungle-Jumble Arena.
 * Coordinates Socket.io real-time events, 3D board rendering, HUD, audio, and themes.
 */

import { sounds } from './soundEngine.js';
import { FXManager } from './fx.js';
import { network } from './socketClient.js';

class JungleArenaApp {
  constructor() {
    this.playerName = localStorage.getItem('jj_player_name') || 'SafariHunter';
    this.currentThemeIndex = 0;
    this.themes = ['default', 'theme-cyber', 'theme-savannah'];
    this.currentRoomId = null;
    this.currentMode = 'solo';
    this.gameState = null;
    this.activeLeaderboardTab = 'solo';
    this.cachedLeaderboard = null;

    this.initDOM();
    this.bindEvents();
    this.initSocket();
    this.loadSavedTheme();
  }

  initDOM() {
    // Header controls
    this.themeBtn = document.getElementById('theme-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.leaderboardBtn = document.getElementById('leaderboard-btn');
    this.nameInput = document.getElementById('player-name-input');
    this.nameInput.value = this.playerName;

    // Screens
    this.screenLobby = document.getElementById('screen-lobby');
    this.screenArena = document.getElementById('screen-arena');

    // Modals
    this.modalSolo = document.getElementById('modal-solo');
    this.modalAI = document.getElementById('modal-ai');
    this.modalPvP = document.getElementById('modal-pvp');
    this.modalWaiting = document.getElementById('modal-waiting');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalLeaderboard = document.getElementById('modal-leaderboard');

    // Arena elements
    this.board = document.getElementById('game-board');
    this.hudP1 = document.getElementById('hud-p1');
    this.hudP2 = document.getElementById('hud-p2');
    this.p1Name = document.getElementById('p1-name');
    this.p1Score = document.getElementById('p1-score');
    this.p2Name = document.getElementById('p2-name');
    this.p2Score = document.getElementById('p2-score');
    this.p2Avatar = document.getElementById('p2-avatar');
    this.turnBanner = document.getElementById('turn-banner');
    this.statMoves = document.getElementById('stat-moves');
    this.statTimer = document.getElementById('stat-timer');
    this.statPairs = document.getElementById('stat-pairs');

    // Action buttons
    this.hintBtn = document.getElementById('hint-btn');
    this.restartBtn = document.getElementById('restart-btn');
    this.leaveBtn = document.getElementById('leave-btn');
    this.emoteBar = document.getElementById('emote-bar');

    // Easter Egg
    this.easterEgg = document.getElementById('easterEgg');
    this.eggToast = document.getElementById('eggToast');
  }

  bindEvents() {
    // Nickname persistence
    this.nameInput.addEventListener('input', (e) => {
      this.playerName = e.target.value.trim() || 'SafariHunter';
      localStorage.setItem('jj_player_name', this.playerName);
    });

    // Theme toggle
    this.themeBtn.addEventListener('click', () => this.cycleTheme());

    // Sound toggle
    this.soundBtn.addEventListener('click', () => {
      const on = sounds.toggle();
      this.soundBtn.textContent = on ? '🔊 Sound' : '🔇 Muted';
      if (on) sounds.playPop();
    });

    // Leaderboard modal open
    this.leaderboardBtn.addEventListener('click', () => this.openLeaderboard());

    // Mode Card triggers
    document.getElementById('mode-card-solo').addEventListener('click', () => {
      sounds.playPop();
      this.openModal(this.modalSolo);
    });
    document.getElementById('mode-card-ai').addEventListener('click', () => {
      sounds.playPop();
      this.openModal(this.modalAI);
    });
    document.getElementById('mode-card-pvp').addEventListener('click', () => {
      sounds.playPop();
      this.openModal(this.modalPvP);
    });

    // Modal Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // Launch Solo
    document.getElementById('solo-launch-btn').addEventListener('click', () => {
      const diff = document.getElementById('solo-difficulty-select').value;
      this.startGame('solo', diff);
    });

    // Launch AI
    document.getElementById('ai-launch-btn').addEventListener('click', () => {
      const diff = document.getElementById('ai-difficulty-select').value;
      this.startGame('pvai', diff);
    });

    // PvP Actions
    document.getElementById('pvp-create-btn').addEventListener('click', () => {
      this.createPvPRoom();
    });
    document.getElementById('pvp-join-btn').addEventListener('click', () => {
      const code = document.getElementById('pvp-room-code-input').value;
      this.joinPvPRoom(code);
    });
    document.getElementById('pvp-quickmatch-btn').addEventListener('click', () => {
      this.queueQuickMatch();
    });

    // In-game actions
    this.hintBtn.addEventListener('click', () => {
      sounds.playPop();
      network.emit('game:hint');
    });
    this.restartBtn.addEventListener('click', () => {
      sounds.playPop();
      network.emit('game:restart');
    });
    this.leaveBtn.addEventListener('click', () => {
      sounds.playPop();
      this.returnToLobby();
    });

    // Emote reactions
    this.emoteBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.emote-btn');
      if (btn) {
        const emote = btn.dataset.emote;
        sounds.playPop();
        network.emit('game:emote', { emote });
      }
    });

    // Waiting modal cancel
    document.getElementById('waiting-cancel-btn').addEventListener('click', () => {
      this.closeAllModals();
      this.returnToLobby();
    });

    // Game Over Rematch & Lobby
    document.getElementById('gameover-rematch-btn').addEventListener('click', () => {
      this.closeAllModals();
      sounds.playPop();
      network.emit('game:restart');
    });
    document.getElementById('gameover-lobby-btn').addEventListener('click', () => {
      this.closeAllModals();
      this.returnToLobby();
    });

    // Leaderboard Tabs
    document.getElementById('lb-tab-solo').addEventListener('click', () => {
      this.activeLeaderboardTab = 'solo';
      document.getElementById('lb-tab-solo').style.borderColor = 'var(--accent-pink)';
      document.getElementById('lb-tab-pvp').style.borderColor = 'var(--surface-border)';
      this.renderLeaderboardTable();
    });
    document.getElementById('lb-tab-pvp').addEventListener('click', () => {
      this.activeLeaderboardTab = 'pvp';
      document.getElementById('lb-tab-pvp').style.borderColor = 'var(--accent-pink)';
      document.getElementById('lb-tab-solo').style.borderColor = 'var(--surface-border)';
      this.renderLeaderboardTable();
    });

    // Easter Egg
    this.easterEgg.addEventListener('click', () => this.triggerEasterEgg());
    this.easterEgg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.triggerEasterEgg();
    });
  }

  async initSocket() {
    await network.connect();

    // Listen for room & match state updates
    network.on('game:state', (state) => this.handleGameState(state));
    network.on('card:revealed', (data) => this.handleCardRevealed(data));
    network.on('card:match', (data) => this.handleCardMatch(data));
    network.on('card:mismatch', (data) => this.handleCardMismatch(data));
    network.on('game:hint', (data) => this.handleHint(data));
    network.on('game:emote', (data) => this.handleEmote(data));
    network.on('timer:tick', ({ timer }) => {
      this.statTimer.textContent = timer;
    });
    network.on('game:over', (result) => this.handleGameOver(result));
  }

  // --- GAMEPLAY FLOW ---

  startGame(mode, difficulty) {
    this.closeAllModals();
    this.currentMode = mode;

    network.emit('room:create', {
      name: this.playerName,
      mode,
      difficulty
    }, (res) => {
      if (res && res.success) {
        this.currentRoomId = res.roomId;
        this.showArena();
      }
    });
  }

  createPvPRoom() {
    this.closeAllModals();
    this.currentMode = 'pvp';

    network.emit('room:create', {
      name: this.playerName,
      mode: 'pvp',
      difficulty: 'medium'
    }, (res) => {
      if (res && res.success) {
        this.currentRoomId = res.roomId;
        document.getElementById('display-room-code').textContent = res.roomId;
        this.openModal(this.modalWaiting);
      }
    });
  }

  joinPvPRoom(code) {
    if (!code || !code.trim()) return alert('Please enter a valid room code!');
    this.closeAllModals();
    this.currentMode = 'pvp';

    network.emit('room:join', {
      name: this.playerName,
      roomId: code.trim().toUpperCase()
    }, (res) => {
      if (res && res.success) {
        this.currentRoomId = res.roomId;
        this.showArena();
      } else {
        alert(res?.error || 'Failed to join room');
      }
    });
  }

  queueQuickMatch() {
    this.closeAllModals();
    this.currentMode = 'pvp';

    document.getElementById('display-room-code').textContent = 'SEARCHING...';
    this.openModal(this.modalWaiting);

    network.emit('room:queue', {
      name: this.playerName,
      difficulty: 'medium'
    }, (res) => {
      if (res && res.matched) {
        this.closeAllModals();
        this.currentRoomId = res.roomId;
        this.showArena();
      }
    });
  }

  returnToLobby() {
    this.screenArena.classList.add('hidden');
    this.screenLobby.classList.remove('hidden');
    this.board.innerHTML = '';
  }

  showArena() {
    this.closeAllModals();
    this.screenLobby.classList.add('hidden');
    this.screenArena.classList.remove('hidden');
  }

  // --- REAL-TIME EVENT HANDLERS ---

  handleGameState(state) {
    this.gameState = state;
    this.closeAllModals();
    this.showArena();

    // Render Board Grid
    this.renderBoard(state.board, state.config);

    // Update Metrics
    this.statMoves.textContent = state.moves;
    this.statTimer.textContent = state.timer;
    this.statPairs.textContent = `${state.matches}/${state.totalPairs}`;

    // Update HUD Players
    const p1 = state.players[0];
    const p2 = state.players[1];

    if (p1) {
      this.p1Name.textContent = p1.name;
      this.p1Score.textContent = p1.score;
    }
    if (p2) {
      this.hudP2.style.display = 'flex';
      this.p2Name.textContent = p2.name;
      this.p2Score.textContent = p2.score;
      this.p2Avatar.textContent = p2.isAI ? '🤖' : '🥷';
    } else {
      this.hudP2.style.display = 'none'; // Solo mode
    }

    // Active Turn Highlights
    const myId = network.getId();
    const isMyTurn = state.currentTurnPlayerId === myId || state.mode === 'solo';

    if (isMyTurn) {
      this.turnBanner.textContent = 'YOUR TURN! 🎯';
      this.turnBanner.style.color = 'var(--accent-green)';
      this.hudP1.classList.add('active-turn');
      this.hudP2.classList.remove('active-turn');
    } else {
      this.turnBanner.textContent = `${state.currentTurnPlayer || "Opponent"}'S TURN ⏳`;
      this.turnBanner.style.color = 'var(--accent-pink)';
      this.hudP1.classList.remove('active-turn');
      this.hudP2.classList.add('active-turn');
    }

    // Toggle Solo-only Hint Button
    this.hintBtn.style.display = state.mode === 'solo' ? 'inline-flex' : 'none';
  }

  renderBoard(boardData, config) {
    this.board.innerHTML = '';
    const cols = config?.cols || 4;
    const rows = config?.rows || 4;
    this.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    boardData.forEach((card) => {
      const tile = document.createElement('div');
      tile.className = 'card-tile';
      tile.dataset.index = card.index;
      tile.tabIndex = 0; // Accessible keyboard focus

      if (card.isFlipped) tile.classList.add('flipped');
      if (card.isMatched) tile.classList.add('matched');

      tile.innerHTML = `
        <div class="card-tile-inner">
          <div class="card-face face-back"></div>
          <div class="card-face face-front" style="background-image: ${card.img ? `url('/${card.img}')` : 'none'}"></div>
        </div>
      `;

      // Event handlers
      tile.addEventListener('click', () => this.onCardClick(card.index));
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onCardClick(card.index);
        }
      });

      this.board.appendChild(tile);
    });
  }

  onCardClick(index) {
    const tile = this.board.querySelector(`.card-tile[data-index="${index}"]`);
    if (!tile || tile.classList.contains('flipped') || tile.classList.contains('matched')) return;

    sounds.init();
    network.emit('card:flip', { cardIndex: index });
  }

  handleCardRevealed({ index, img }) {
    const tile = this.board.querySelector(`.card-tile[data-index="${index}"]`);
    if (tile) {
      const front = tile.querySelector('.face-front');
      if (front) front.style.backgroundImage = `url('/${img}')`;
      tile.classList.add('flipped');
      sounds.playFlip();
    }
  }

  handleCardMatch({ indices, matchedBy, points, combo }) {
    indices.forEach(idx => {
      const tile = this.board.querySelector(`.card-tile[data-index="${idx}"]`);
      if (tile) {
        tile.classList.add('matched');
      }
    });

    sounds.playMatch(combo);
    FXManager.launchConfetti(8);

    // Show streak combo on matching player
    const isP1 = this.p1Name.textContent === matchedBy;
    const targetHud = isP1 ? this.hudP1 : this.hudP2;
    if (combo > 1) {
      FXManager.showComboBadge(targetHud, combo);
    }
  }

  handleCardMismatch({ indices }) {
    sounds.playMismatch();
    setTimeout(() => {
      indices.forEach(idx => {
        const tile = this.board.querySelector(`.card-tile[data-index="${idx}"]`);
        if (tile && !tile.classList.contains('matched')) {
          tile.classList.remove('flipped');
        }
      });
    }, 950);
  }

  handleHint({ hintData, duration }) {
    hintData.forEach(item => {
      const tile = this.board.querySelector(`.card-tile[data-index="${item.index}"]`);
      if (tile && !tile.classList.contains('matched')) {
        const front = tile.querySelector('.face-front');
        if (front) front.style.backgroundImage = `url('/${item.img}')`;
        tile.classList.add('flipped');
      }
    });

    setTimeout(() => {
      hintData.forEach(item => {
        const tile = this.board.querySelector(`.card-tile[data-index="${item.index}"]`);
        if (tile && !tile.classList.contains('matched')) {
          tile.classList.remove('flipped');
        }
      });
    }, duration);
  }

  handleEmote({ sender, emote }) {
    sounds.playPop();
    FXManager.spawnEmote(sender, emote);
  }

  handleGameOver({ winner, isTie, moves, time, players }) {
    sounds.playVictory();
    FXManager.launchConfetti(35);

    const titleEl = document.getElementById('gameover-title');
    const descEl = document.getElementById('gameover-desc');
    const statsEl = document.getElementById('gameover-stats');

    if (isTie) {
      titleEl.textContent = '🤝 Stalemate Tie!';
      descEl.textContent = 'Both players matched equal pairs!';
    } else {
      const isWinner = winner === this.playerName;
      titleEl.textContent = isWinner ? '🏆 VICTORY!' : '🦁 MATCH FINISHED';
      descEl.textContent = isWinner ? 'You conquered the Jungle Arena!' : `${winner} seized victory!`;
    }

    let statsHTML = `<p>⏱️ Final Time: <b>${time}s</b> | 🐾 Moves: <b>${moves}</b></p>`;
    if (players && players.length > 1) {
      statsHTML += `<p>⭐ Scores: ${players.map(p => `${p.name}: <b>${p.score}</b>`).join(' vs ')}</p>`;
    }
    statsEl.innerHTML = statsHTML;

    this.openModal(this.modalGameOver);
  }

  // --- LEADERBOARDS & THEMES ---

  async openLeaderboard() {
    this.openModal(this.modalLeaderboard);
    try {
      const res = await fetch('/api/leaderboard');
      this.cachedLeaderboard = await res.json();
      this.renderLeaderboardTable();
    } catch (err) {
      document.getElementById('leaderboard-content').innerHTML = '<p>Error fetching rankings.</p>';
    }
  }

  renderLeaderboardTable() {
    const container = document.getElementById('leaderboard-content');
    if (!this.cachedLeaderboard) {
      container.innerHTML = '<p>Loading rankings...</p>';
      return;
    }

    if (this.activeLeaderboardTab === 'solo') {
      const solo = this.cachedLeaderboard.solo || {};
      let html = '';
      ['easy', 'medium', 'hard'].forEach(diff => {
        const records = solo[diff] || [];
        html += `<h4 style="margin-top: 12px; color: var(--accent-gold); text-transform: uppercase;">🍃 ${diff} Mode</h4>`;
        if (records.length === 0) {
          html += '<p style="color: var(--text-muted); font-size: 0.85rem;">No records yet.</p>';
        } else {
          html += `
            <table class="leaderboard-table">
              <thead><tr><th>#</th><th>Player</th><th>Moves</th><th>Time</th><th>Date</th></tr></thead>
              <tbody>
                ${records.map((r, i) => `
                  <tr>
                    <td>${i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : i + 1))}</td>
                    <td><b>${r.name}</b></td>
                    <td>${r.moves}</td>
                    <td>${r.time}s</td>
                    <td>${r.date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      });
      container.innerHTML = html;
    } else {
      const pvp = this.cachedLeaderboard.pvp || [];
      container.innerHTML = `
        <table class="leaderboard-table">
          <thead><tr><th>Rank</th><th>Player</th><th>Elo Rating</th><th>Record (W-L)</th></tr></thead>
          <tbody>
            ${pvp.map((p, i) => `
              <tr>
                <td>${i === 0 ? '👑' : i + 1}</td>
                <td><b>${p.name}</b></td>
                <td style="color: var(--accent-gold); font-weight: 700;">${p.rating}</td>
                <td>${p.wins}W - ${p.losses}L</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  cycleTheme() {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
    const theme = this.themes[this.currentThemeIndex];
    document.body.className = theme === 'default' ? '' : theme;
    localStorage.setItem('jj_theme', theme);
    sounds.playPop();
  }

  loadSavedTheme() {
    const saved = localStorage.getItem('jj_theme');
    if (saved) {
      document.body.className = saved === 'default' ? '' : saved;
      this.currentThemeIndex = this.themes.indexOf(saved);
      if (this.currentThemeIndex === -1) this.currentThemeIndex = 0;
    }
  }

  triggerEasterEgg() {
    sounds.playPop();
    this.easterEgg.style.transform = 'scale(1.4) rotate(20deg)';
    this.eggToast.classList.add('visible');
    FXManager.launchConfetti(15);

    setTimeout(() => {
      this.easterEgg.style.transform = '';
      this.eggToast.classList.remove('visible');
    }, 3200);
  }

  openModal(modal) {
    modal.classList.remove('hidden');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.arenaApp = new JungleArenaApp();
});
