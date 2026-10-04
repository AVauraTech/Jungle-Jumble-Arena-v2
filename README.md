# 🦁 Jungle-Jumble Arena (v2.0)
### Full-Stack Real-Time Multiplayer & AI Memory Card Platform

> A modernized, scalable full-stack card game powered by Node.js, Express, Socket.io, and an adaptive cognitive AI agent, built with high-performance CSS3 3D transforms, authoritative anti-cheat game loop, and persistent Elo leaderboards.

---

## 🚀 Key Highlights & Architectural Features

- **⚡ Real-Time 1v1 PvP Synchronization**:
  - Sub-40ms tick synchronization using WebSockets (Socket.io) with private room lobbies (`JGL-XXXX`) and quick random matchmaking queues.
- **🤖 Adaptive Cognitive AI Agent (PvAI)**:
  - Neural-inspired memory model incorporating an Ebbinghaus forgetting curve.
  - Three distinct difficulty tiers:
    - **Cub AI (Easy)**: Short episodic memory span (remembers ~2 recent cards), random exploratory moves.
    - **Hunter AI (Medium)**: Simulated human cognitive decay (`P_recall = e^(-0.25 * age)`), ~70% recall accuracy.
    - **Apex Predator (Hard)**: Deep episodic memory, optimal information-gain exploration, and instant match pairing.
  - Variable deliberation delays (800ms – 1500ms) simulating human thought processes.
- **🛡️ Authoritative Server State & Anti-Cheat**:
  - Card identities (`img`) are kept strictly concealed in server memory.
  - Client public board only receives masked states (`isFlipped`, `isMatched`) until a validated flip request is arbitrated by the server, eliminating DevTools and memory inspection exploits.
- **🔥 Combo Multiplier & Precision Scoring**:
  - Consecutive matches within a single turn yield ascending combo streak points and fire multipliers (`10 + (combo - 1) * 5`).
- **🏆 Persistent Leaderboard & Elo Rating Engine**:
  - Standard chess-style Elo rating calculation (K=32) for 1v1 PvP battles.
  - Solo Time-Attack speedrun ladder tracking fewest moves and fastest completion times per grid tier.
- **🎨 Modern Glassmorphic UI & 3D Spatial Flips**:
  - CSS3 3D perspective with individual transform properties (`scale`, `rotate`, `translate`) ensuring 60 FPS transitions without stacking context shifts.
  - Three switchable visual themes: **Default Emerald Jungle**, **Cyber Neon Synth**, and **Golden Savannah**.
  - Synthesized Web Audio API sound engine (guaranteed cross-browser audio with zero latency) plus celebratory confetti physics and floating live emote reactions (`🦁`, `🔥`, `😱`, `🎉`).

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express 4, Socket.io 4, CORS
- **Frontend**: Vanilla ES6+ Modules, Semantic HTML5, Modern CSS3 (Grid, 3D Transforms, Glassmorphism)
- **Audio Engine**: Web Audio API Synthesizer + HTML5 Audio fallback
- **State & Networking**: Authoritative State Machine, WebSockets, JSON Persistence Store

---

## 📦 Getting Started

### 1. Installation
```bash
git clone <repo-url>
cd "Card game"
npm install
```

### 2. Start the Server
```bash
npm start
```
The game will be live at:
👉 **`http://localhost:3000`**

### 3. Run Automated Match Simulation Tests
```bash
npm test
```

---

## 🎮 Game Modes

1. **Solo Time-Attack (PvE)**:
   - Choose from 3 grid densities: 🍃 Easy (4x4), 🌴 Medium (4x6), 🦁 Hard (6x6).
   - Use the peek hint feature (💡) and beat personal or global records.
2. **AI Memory Duel (PvAI)**:
   - Challenge Cub, Hunter, or Apex Predator AI bots in turn-based duels.
3. **1v1 Real-Time PvP (Multiplayer)**:
   - Create private rooms with custom invite codes or enter the Quick Match queue.
   - Send floating reaction emotes in real-time to your opponent!

---

## 🥚 Secret Easter Egg
Click on **Anushka's Golden Egg** in the bottom-right corner to reveal the original creator's spark animation!
