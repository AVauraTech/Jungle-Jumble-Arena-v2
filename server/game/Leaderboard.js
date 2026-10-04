import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/leaderboard.json');

export class LeaderboardManager {
  constructor() {
    this.data = {
      solo: { easy: [], medium: [], hard: [] },
      pvp: []
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Leaderboard] Error loading data, using defaults:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Leaderboard] Error saving data:', err.message);
    }
  }

  getAll() {
    return this.data;
  }

  recordSoloGame({ name = 'Anonymous', difficulty = 'easy', moves, time }) {
    if (!this.data.solo[difficulty]) {
      this.data.solo[difficulty] = [];
    }
    const entry = {
      name: name.slice(0, 16),
      moves: Number(moves),
      time: Number(time),
      date: new Date().toISOString().split('T')[0]
    };
    this.data.solo[difficulty].push(entry);
    // Sort by fewest moves, then fastest time
    this.data.solo[difficulty].sort((a, b) => {
      if (a.moves !== b.moves) return a.moves - b.moves;
      return a.time - b.time;
    });
    // Keep top 10
    this.data.solo[difficulty] = this.data.solo[difficulty].slice(0, 10);
    this.save();
    return this.data.solo[difficulty];
  }

  recordPvPGame({ winnerName, loserName, isTie = false }) {
    let winner = this.data.pvp.find(p => p.name.toLowerCase() === winnerName.toLowerCase());
    let loser = this.data.pvp.find(p => p.name.toLowerCase() === loserName.toLowerCase());

    if (!winner) {
      winner = { name: winnerName, rating: 1200, wins: 0, losses: 0 };
      this.data.pvp.push(winner);
    }
    if (!loser) {
      loser = { name: loserName, rating: 1200, wins: 0, losses: 0 };
      this.data.pvp.push(loser);
    }

    // Standard Elo calculation (K-factor = 32)
    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winner.rating - loser.rating) / 400));

    if (isTie) {
      winner.rating = Math.round(winner.rating + K * (0.5 - expectedWinner));
      loser.rating = Math.round(loser.rating + K * (0.5 - expectedLoser));
    } else {
      winner.rating = Math.round(winner.rating + K * (1 - expectedWinner));
      loser.rating = Math.max(800, Math.round(loser.rating + K * (0 - expectedLoser)));
      winner.wins += 1;
      loser.losses += 1;
    }

    this.data.pvp.sort((a, b) => b.rating - a.rating);
    this.data.pvp = this.data.pvp.slice(0, 15);
    this.save();

    return { winner, loser };
  }
}
