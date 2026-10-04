/**
 * RoomManager.js
 * Manages active game rooms, 1v1 PvP matchmaking queues, private codes, and socket lifecycle.
 */

import { GameRoom } from './GameRoom.js';

export class RoomManager {
  constructor(io, leaderboard) {
    this.io = io;
    this.leaderboard = leaderboard;
    this.rooms = new Map(); // roomId -> GameRoom
    this.playerRoomMap = new Map(); // socketId -> roomId
    this.matchmakingQueue = []; // [{ socketId, name, difficulty }]
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'JGL-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom({ socketId, name = 'Player', mode = 'solo', difficulty = 'easy' }) {
    // Leave previous room if any
    this.leaveCurrentRoom(socketId);

    const roomId = mode === 'solo' ? `solo_${socketId}` : this.generateRoomCode();
    const room = new GameRoom(roomId, mode, difficulty, this.io, this.leaderboard);
    this.rooms.set(roomId, room);

    const player = room.addPlayer(socketId, name);
    this.playerRoomMap.set(socketId, roomId);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(roomId);
    }

    // Auto-start for solo & pvai
    if (mode === 'solo' || mode === 'pvai') {
      room.start();
    } else {
      // PvP lobby waiting for 2nd player
      room.broadcastState();
    }

    return { roomId, player, room };
  }

  joinRoom({ socketId, name = 'Challenger', roomId }) {
    this.leaveCurrentRoom(socketId);

    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: 'Room not found. Please check your room code.' };
    }

    if (room.players.length >= 2) {
      return { error: 'Room is already full.' };
    }

    const player = room.addPlayer(socketId, name);
    this.playerRoomMap.set(socketId, roomId);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(roomId);
    }

    // If 2 players present, start the game
    if (room.players.length === 2 && room.status === 'waiting') {
      room.start();
    } else {
      room.broadcastState();
    }

    return { roomId, player, room };
  }

  queueMatchmaking({ socketId, name = 'Challenger', difficulty = 'medium' }) {
    this.leaveCurrentRoom(socketId);

    // Look for matching challenger in queue
    const matchIndex = this.matchmakingQueue.findIndex(
      q => q.difficulty === difficulty && q.socketId !== socketId
    );

    if (matchIndex !== -1) {
      const opponent = this.matchmakingQueue.splice(matchIndex, 1)[0];
      const roomId = this.generateRoomCode();
      const room = new GameRoom(roomId, 'pvp', difficulty, this.io, this.leaderboard);
      this.rooms.set(roomId, room);

      // Add opponent (player 1)
      room.addPlayer(opponent.socketId, opponent.name);
      this.playerRoomMap.set(opponent.socketId, roomId);
      const oppSocket = this.io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.join(roomId);

      // Add current player (player 2)
      room.addPlayer(socketId, name);
      this.playerRoomMap.set(socketId, roomId);
      const curSocket = this.io.sockets.sockets.get(socketId);
      if (curSocket) curSocket.join(roomId);

      room.start();
      return { matched: true, roomId, room };
    }

    // Otherwise add to waiting queue
    this.matchmakingQueue.push({ socketId, name, difficulty });
    return { matched: false, inQueue: true };
  }

  leaveCurrentRoom(socketId) {
    // Remove from matchmaking queue if present
    this.matchmakingQueue = this.matchmakingQueue.filter(q => q.socketId !== socketId);

    const roomId = this.playerRoomMap.get(socketId);
    if (!roomId) return;

    this.playerRoomMap.delete(socketId);
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.removePlayer(socketId);

    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(roomId);
    }

    // Clean up empty room
    const humanPlayers = room.players.filter(p => !p.isAI);
    if (humanPlayers.length === 0) {
      room.destroy();
      this.rooms.delete(roomId);
    } else {
      room.broadcastState();
    }
  }

  getRoomBySocket(socketId) {
    const roomId = this.playerRoomMap.get(socketId);
    return roomId ? this.rooms.get(roomId) : null;
  }
}
