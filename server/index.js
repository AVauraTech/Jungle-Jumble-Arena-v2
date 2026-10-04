/**
 * server/index.js
 * Main entry point for Jungle-Jumble Arena full-stack server.
 * Express + Socket.io + REST API + Static Asset Serving.
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { LeaderboardManager } from './game/Leaderboard.js';
import { RoomManager } from './game/RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
// Serve static client assets from public/ directory
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Initialize Singletons
const leaderboard = new LeaderboardManager();
const roomManager = new RoomManager(io, leaderboard);

// --- REST Endpoints ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Jungle-Jumble Arena',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    activeRooms: roomManager.rooms.size,
    queuedPlayers: roomManager.matchmakingQueue.length
  });
});

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard.getAll());
});

app.post('/api/solo/record', (req, res) => {
  const { name, difficulty, moves, time } = req.body;
  if (!difficulty || moves === undefined || time === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  const updated = leaderboard.recordSoloGame({ name, difficulty, moves, time });
  res.json({ success: true, leaderboard: updated });
});

// --- Socket.IO Real-Time Engine ---
io.on('connection', (socket) => {
  // console.log(`[Socket] Connected: ${socket.id}`);

  // Create Room (Solo, PvAI, or Private PvP)
  socket.on('room:create', ({ name, mode, difficulty }, callback) => {
    try {
      const result = roomManager.createRoom({
        socketId: socket.id,
        name,
        mode,
        difficulty
      });
      if (typeof callback === 'function') {
        callback({ success: true, roomId: result.roomId, player: result.player });
      }
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Join Existing Private Room
  socket.on('room:join', ({ name, roomId }, callback) => {
    try {
      const result = roomManager.joinRoom({
        socketId: socket.id,
        name,
        roomId: (roomId || '').trim().toUpperCase()
      });
      if (result.error) {
        if (typeof callback === 'function') callback({ success: false, error: result.error });
      } else {
        if (typeof callback === 'function') {
          callback({ success: true, roomId: result.roomId, player: result.player });
        }
      }
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Matchmaking Queue
  socket.on('room:queue', ({ name, difficulty }, callback) => {
    try {
      const result = roomManager.queueMatchmaking({
        socketId: socket.id,
        name,
        difficulty
      });
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Card Flip Request (Anti-cheat verification)
  socket.on('card:flip', ({ cardIndex }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.handleCardClick(socket.id, cardIndex);
    }
  });

  // Solo Hint Request
  socket.on('game:hint', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.triggerHint(socket.id);
    }
  });

  // Restart Request
  socket.on('game:restart', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      room.start();
    }
  });

  // Live Floating Emote Reaction
  socket.on('game:emote', ({ emote }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      room.sendEmote(player ? player.name : 'Player', emote);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    // console.log(`[Socket] Disconnected: ${socket.id}`);
    roomManager.leaveCurrentRoom(socket.id);
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  🦁 Jungle-Jumble Arena Server Online!       `);
  console.log(`  🌐 Running on: http://localhost:${PORT}      `);
  console.log(`  ⚡ Real-Time WebSockets & AI Matchmaking Ready`);
  console.log(`===============================================`);
});

export { app, server, io };
