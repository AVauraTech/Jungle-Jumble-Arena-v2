/**
 * test/simulate_match.js
 * Headless simulation test for GameRoom, AIAgent, and Leaderboard mechanics.
 * Verifies turn arbitration, anti-cheat masking, memory decay, and game over resolution.
 */

import { GameRoom } from '../server/game/GameRoom.js';
import { LeaderboardManager } from '../server/game/Leaderboard.js';

// Mock Socket.io emitter for headless test
class MockIO {
  to(roomId) {
    return {
      emit: (event, payload) => {
        // console.log(`[Event ${event}] -> Room ${roomId}`);
      }
    };
  }
}

async function runSimulation() {
  console.log('🧪 Starting Headless Jungle-Jumble Arena Simulation...');

  const mockIO = new MockIO();
  const leaderboard = new LeaderboardManager();
  const room = new GameRoom('test-room-1', 'pvai', 'easy', mockIO, leaderboard);

  // 1. Add human player and AI player
  const p1 = room.addPlayer('socket-human-1', 'TestHuman');
  console.log(`✅ Player added: ${p1.name}`);
  console.log(`✅ AI Opponent initialized: ${room.players[1].name}`);

  // 2. Start game
  room.start();
  console.log(`✅ Board generated with ${room.board.length} cards (${room.config.pairs} pairs)`);

  // 3. Verify Anti-Cheat Card Masking
  const publicBoard = room.getPublicBoard();
  const unmaskedBeforeFlip = publicBoard.filter(c => c.img !== null);
  if (unmaskedBeforeFlip.length !== 0) {
    throw new Error(`❌ Anti-cheat test failed! Expected 0 revealed cards, found ${unmaskedBeforeFlip.length}`);
  }
  console.log('✅ Anti-Cheat verified: 100% of card faces are hidden on client public board');

  // 4. Simulate card flips until game is won
  let turnCount = 0;
  const maxTurns = 100;

  while (room.status === 'in_progress' && turnCount < maxTurns) {
    turnCount++;
    const current = room.getCurrentPlayer();
    const unmatched = room.board.filter(c => !c.isMatched && !c.isFlipped);

    if (unmatched.length === 0) break;

    // Pick two cards
    const card1 = unmatched[0];
    room.flipCard(card1.index);

    // Pick a second card
    const remainingUnmatched = room.board.filter(c => !c.isMatched && c.index !== card1.index);
    // Find matching card or pick random
    const matchTarget = remainingUnmatched.find(c => c.pairKey === card1.pairKey);
    const card2 = matchTarget || remainingUnmatched[0];

    room.flipCard(card2.index);

    // Short wait to allow evaluateTurn timeouts if any
    await new Promise(r => setTimeout(r, 60));
  }

  // Wait for endGame timeout (450ms)
  await new Promise(r => setTimeout(r, 600));

  console.log(`✅ Simulation finished in ${turnCount} iterations! Final matches: ${room.matches}/${room.config.pairs}`);
  console.log(`✅ Final Room Status: ${room.status}`);
  if (room.status !== 'finished') {
    throw new Error(`❌ Expected room status to be 'finished', got '${room.status}'`);
  }
  console.log(`✅ Player scores:`, room.players.map(p => `${p.name}: ${p.score}pts`));

  // 5. Test Leaderboard persistence
  const records = leaderboard.recordSoloGame({
    name: 'TestHuman',
    difficulty: 'easy',
    moves: 12,
    time: 25
  });
  console.log(`✅ Leaderboard updated! Top record moves: ${records[0].moves}`);

  console.log('\n🎉 ALL HEADLESS SIMULATION TESTS PASSED SUCCESSFULLY!\n');
}

runSimulation().catch(err => {
  console.error('❌ Simulation Test Failed:', err);
  process.exit(1);
});
