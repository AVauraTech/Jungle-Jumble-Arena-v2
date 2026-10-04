/**
 * fx.js
 * Visual effects: Confetti burst physics, floating live reaction emotes, and combo popups.
 */

const CONFETTI_SYMBOLS = ['🎉', '✨', '🌿', '🍃', '🦁', '🦜', '💎', '🌸', '⭐', '🔥'];

export class FXManager {
  static launchConfetti(count = 20) {
    const container = document.body;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'fx-confetti';
        el.textContent = CONFETTI_SYMBOLS[Math.floor(Math.random() * CONFETTI_SYMBOLS.length)];
        el.style.left = `${15 + Math.random() * 70}vw`;
        el.style.top = `${20 + Math.random() * 30}vh`;
        el.style.setProperty('--tx', `${(Math.random() - 0.5) * 160}px`);
        el.style.setProperty('--ty', `${-80 - Math.random() * 120}px`);
        el.style.setProperty('--rot', `${(Math.random() - 0.5) * 360}deg`);

        container.appendChild(el);
        setTimeout(() => el.remove(), 1600);
      }, i * 35);
    }
  }

  static spawnEmote(sender, emote) {
    const el = document.createElement('div');
    el.className = 'fx-floating-emote';
    el.innerHTML = `<span class="emote-icon">${emote}</span><span class="emote-sender">${sender}</span>`;
    el.style.left = `${20 + Math.random() * 60}vw`;
    el.style.bottom = '120px';

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  static showComboBadge(targetElement, combo) {
    if (!targetElement) return;
    const badge = document.createElement('div');
    badge.className = 'fx-combo-badge';
    badge.textContent = `🔥 ${combo}x STREAK!`;
    targetElement.appendChild(badge);
    setTimeout(() => badge.remove(), 1200);
  }
}
